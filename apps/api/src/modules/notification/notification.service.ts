import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { emitToUser } from "../../realtime/socket.js";
import type { NotificationCategory } from "./notification.schemas.js";

/**
 * Notification response type
 */
export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  category: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Get user's notifications with pagination
 */
export const getUserNotifications = async (
  userId: string,
  page: number,
  limit: number,
  unreadOnly: boolean = false,
  category?: NotificationCategory,
) => {
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(unreadOnly && { isRead: false }),
    ...(category && { category }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications as NotificationResponse[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get unread notification count for user
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return count;
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (
  userId: string,
  notificationId: string,
): Promise<NotificationResponse> => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found");
  }

  if (notification.userId !== userId) {
    console.warn(
      `[notification] Forbidden read attempt: user ${userId} on notification ${notificationId}`,
    );
    throw ApiError.forbidden("Not authorized to access this notification");
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return updated as NotificationResponse;
};

/**
 * Mark all user's notifications as read
 */
export const markAllAsRead = async (userId: string): Promise<number> => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return result.count;
};

/**
 * Delete a single notification
 */
export const deleteNotification = async (
  userId: string,
  notificationId: string,
): Promise<NotificationResponse> => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found");
  }

  if (notification.userId !== userId) {
    console.warn(
      `[notification] Forbidden delete attempt: user ${userId} on notification ${notificationId}`,
    );
    throw ApiError.forbidden("Not authorized to delete this notification");
  }

  const deleted = await prisma.notification.delete({
    where: { id: notificationId },
  });

  return deleted as NotificationResponse;
};

/**
 * Delete all user's notifications
 */
export const deleteAllNotifications = async (
  userId: string,
): Promise<number> => {
  const result = await prisma.notification.deleteMany({
    where: { userId },
  });

  return result.count;
};

/**
 * i18n metadata stored inside `data._i18n` so the web client can render the
 * notification in the viewer's locale (en/si/ta). `title`/`message` stay
 * populated as a plain-English fallback for any consumer that does not localise.
 */
export interface NotificationI18n {
  titleKey: string;
  messageKey: string;
  params?: Record<string, string | number>;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  category?: NotificationCategory;
  data?: Record<string, unknown>;
  i18n?: NotificationI18n;
}

/**
 * Realtime payload kept intentionally minimal — clients treat `notification:new`
 * as a "refetch" signal rather than merging the row, so pagination, category
 * filters and unread counts stay authoritative on the server.
 */
const emitNotificationCreated = (userId: string): void => {
  emitToUser(userId, "notification:new", { at: new Date().toISOString() });
};

const buildData = (
  data?: Record<string, unknown>,
  i18n?: NotificationI18n,
): Record<string, unknown> | undefined => {
  if (!data && !i18n) return undefined;
  return { ...(data ?? {}), ...(i18n ? { _i18n: i18n } : {}) };
};

/**
 * Create a notification. This is the single creation entry point — callers must
 * not hit `prisma.notification.create` directly, so that category, i18n payload
 * and realtime delivery stay consistent across every module.
 */
export const createNotification = async (
  input: CreateNotificationInput,
): Promise<NotificationResponse> => {
  const { userId, type, title, message, category = "System", data, i18n } =
    input;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      category,
      title,
      message,
      data: (buildData(data, i18n) as any) || undefined,
    },
  });

  emitNotificationCreated(userId);

  return notification as NotificationResponse;
};

/**
 * Create the same notification for several users in one write.
 */
export const createBulkNotifications = async (
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<number> => {
  if (userIds.length === 0) {
    return 0;
  }

  const { type, title, message, category = "System", data, i18n } = input;
  const payloadData = buildData(data, i18n);

  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      category,
      title,
      message,
      data: payloadData as any,
    })) as any,
  });

  userIds.forEach(emitNotificationCreated);

  return result.count;
};

/**
 * Fire-and-forget wrappers used by event-driven call sites (booking, quotation,
 * payment, …). A notification failure must never roll back or block the action
 * that triggered it, so failures are isolated and logged rather than thrown.
 */
export const dispatchNotification = (input: CreateNotificationInput): void => {
  void createNotification(input).catch((err) => {
    console.error(`[notification] failed to create (${input.type})`, err);
  });
};

export const dispatchBulkNotifications = (
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): void => {
  void createBulkNotifications(userIds, input).catch((err) => {
    console.error(`[notification] failed to create bulk (${input.type})`, err);
  });
};

/**
 * Delete read notifications older than `daysOld` across all users. Backs the
 * scheduled retention job so the `notifications` table does not grow unbounded.
 */
export const purgeReadNotifications = async (
  daysOld: number = 90,
): Promise<number> => {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      isRead: true,
    },
  });

  return result.count;
};
