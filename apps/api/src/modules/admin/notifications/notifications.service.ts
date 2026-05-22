import {
  prisma,
  type PlatformNotificationChannel,
  type PlatformNotificationStatus,
  type Prisma,
  type UserRole,
} from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { parsePagination } from "../types.js";
import type {
  CreatePlatformNotificationInput,
  PlatformNotificationChannelInput,
  PlatformNotificationStatusInput,
  ResendPlatformNotificationInput,
  UserRoleInput,
} from "./notifications.schemas.js";

type PlatformNotificationFilters = {
  search?: string;
  status?: PlatformNotificationStatusInput;
  channel?: PlatformNotificationChannelInput;
  targetRole?: UserRoleInput;
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const normalizeUserIds = (userIds: string[] | undefined): string[] =>
  Array.from(new Set((userIds ?? []).map((id) => id.trim()).filter(Boolean)));

const resolveRecipientIds = async (
  targetRole: UserRole | null | undefined,
  targetUserIds: string[] | undefined,
): Promise<string[]> => {
  const normalizedIds = normalizeUserIds(targetUserIds);
  const where: Prisma.UserWhereInput = {
    status: "ACTIVE",
  };

  if (normalizedIds.length > 0) {
    where.id = { in: normalizedIds };
  } else if (targetRole) {
    where.role = targetRole;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
    },
  });

  return users.map((user) => user.id);
};

const extractCampaignId = (data: unknown): string | null => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const candidate = (data as Record<string, unknown>).platformNotificationId;
  return typeof candidate === "string" ? candidate : null;
};

const buildPlatformNotificationWhere = (
  filters: PlatformNotificationFilters,
): Prisma.PlatformNotificationWhereInput => {
  const where: Prisma.PlatformNotificationWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.channel) {
    where.channel = filters.channel;
  }

  if (filters.targetRole) {
    where.targetRole = filters.targetRole;
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { message: { contains: filters.search, mode: "insensitive" } },
      { type: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
};

const dispatchInAppNotifications = async (
  platformNotificationId: string,
  recipients: string[],
  payload: {
    title: string;
    message: string;
    type: string;
    channel: PlatformNotificationChannel;
    metadata?: Record<string, unknown>;
  },
) => {
  if (recipients.length === 0) {
    return 0;
  }

  const now = new Date();

  const result = await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: "platform_announcement",
      title: payload.title,
      message: payload.message,
      data: toJsonValue({
        platformNotificationId,
        campaignType: payload.type,
        channel: payload.channel,
        metadata: payload.metadata ?? null,
        sentAt: now.toISOString(),
      }),
    })),
  });

  return result.count;
};

export const listPlatformNotifications = async (
  filters: PlatformNotificationFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildPlatformNotificationWhere(filters);

  const [items, total] = await Promise.all([
    prisma.platformNotification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: paging.skip,
      take: paging.limit,
      include: {
        createdByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            adminRole: true,
          },
        },
        _count: {
          select: {
            resends: true,
          },
        },
      },
    }),
    prisma.platformNotification.count({ where }),
  ]);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const createPlatformNotification = async (
  adminId: string,
  payload: CreatePlatformNotificationInput,
) => {
  const now = new Date();
  const scheduledFor = payload.scheduledFor ?? null;
  const isScheduled =
    scheduledFor !== null && scheduledFor.getTime() > now.getTime();

  const targetUserIds = normalizeUserIds(payload.targetUserIds);
  const resolvedTargetRole = payload.targetRole as UserRole | undefined;

  const recipients = await resolveRecipientIds(resolvedTargetRole, targetUserIds);

  const status: PlatformNotificationStatus = isScheduled ? "SCHEDULED" : "SENT";

  const created = await prisma.platformNotification.create({
    data: {
      title: payload.title,
      message: payload.message,
      type: payload.type ?? "ANNOUNCEMENT",
      channel: (payload.channel ?? "IN_APP") as PlatformNotificationChannel,
      status,
      targetRole: resolvedTargetRole,
      targetUserIds,
      metadata: payload.metadata ? toJsonValue(payload.metadata) : undefined,
      scheduledFor,
      sentAt: isScheduled ? null : now,
      createdBy: adminId,
    },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });

  const dispatchedCount = isScheduled
    ? 0
    : await dispatchInAppNotifications(created.id, recipients, {
        title: created.title,
        message: created.message,
        type: created.type,
        channel: created.channel,
        metadata: payload.metadata,
      });

  await recordAuditLog(
    adminId,
    "CREATE",
    "PLATFORM_NOTIFICATION",
    created.id,
    {
      status: created.status,
      channel: created.channel,
      targetRole: created.targetRole,
      targetUserCount: recipients.length,
      dispatchedCount,
    },
    "Platform notification created",
  );

  return {
    notification: created,
    delivery: {
      recipientCount: recipients.length,
      dispatchedCount,
      status: created.status,
      scheduledFor: created.scheduledFor,
      sentAt: created.sentAt,
    },
  };
};

const findPlatformNotificationById = async (notificationId: string) => {
  const notification = await prisma.platformNotification.findUnique({
    where: { id: notificationId },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
      resentFrom: {
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          resends: true,
        },
      },
    },
  });

  if (!notification) {
    throw new ApiError(404, "Platform notification not found");
  }

  return notification;
};

export const getPlatformNotificationAnalytics = async (notificationId: string) => {
  const notification = await findPlatformNotificationById(notificationId);

  const recipients = await resolveRecipientIds(
    notification.targetRole,
    notification.targetUserIds,
  );

  const deliveredNotifications = await prisma.notification.findMany({
    where: {
      type: "platform_announcement",
      createdAt: {
        gte: notification.createdAt,
      },
    },
    select: {
      isRead: true,
      data: true,
    },
  });

  const relatedDeliveries = deliveredNotifications.filter(
    (entry) => extractCampaignId(entry.data) === notification.id,
  );

  const sentCount = relatedDeliveries.length;
  const readCount = relatedDeliveries.filter((entry) => entry.isRead).length;
  const openRate = sentCount > 0 ? (readCount / sentCount) * 100 : 0;
  const deliveryRate = recipients.length > 0 ? (sentCount / recipients.length) * 100 : 0;

  return {
    notification,
    metrics: {
      targetedRecipients: recipients.length,
      delivered: sentCount,
      reads: readCount,
      openRate,
      deliveryRate,
      resendCount: notification._count.resends,
    },
  };
};

export const resendPlatformNotification = async (
  adminId: string,
  notificationId: string,
  payload: ResendPlatformNotificationInput,
) => {
  const existing = await findPlatformNotificationById(notificationId);

  const nextTargetUserIds =
    payload.targetUserIds !== undefined
      ? normalizeUserIds(payload.targetUserIds)
      : existing.targetUserIds;

  const nextTargetRole = (payload.targetRole ?? existing.targetRole) as
    | UserRole
    | null;

  const recipients = await resolveRecipientIds(nextTargetRole, nextTargetUserIds);

  const resent = await prisma.platformNotification.create({
    data: {
      title: payload.title ?? existing.title,
      message: payload.message ?? existing.message,
      type: payload.type ?? existing.type,
      channel: (payload.channel ?? existing.channel) as PlatformNotificationChannel,
      status: "SENT",
      targetRole: nextTargetRole,
      targetUserIds: nextTargetUserIds,
      metadata:
        payload.metadata !== undefined
          ? toJsonValue(payload.metadata)
          : existing.metadata ?? undefined,
      sentAt: new Date(),
      createdBy: adminId,
      resentFromId: existing.id,
    },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
      resentFrom: {
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      },
    },
  });

  const dispatchedCount = await dispatchInAppNotifications(resent.id, recipients, {
    title: resent.title,
    message: resent.message,
    type: resent.type,
    channel: resent.channel,
    metadata: payload.metadata,
  });

  await recordAuditLog(
    adminId,
    "RESEND",
    "PLATFORM_NOTIFICATION",
    resent.id,
    {
      sourceNotificationId: existing.id,
      targetRole: resent.targetRole,
      targetUserCount: recipients.length,
      dispatchedCount,
    },
    "Platform notification resent",
  );

  return {
    notification: resent,
    delivery: {
      recipientCount: recipients.length,
      dispatchedCount,
      status: resent.status,
      sentAt: resent.sentAt,
    },
  };
};
