import { prisma, type Prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { parsePagination } from "../types.js";
import { recordAuditLog } from "../audit/audit.service.js";
import type {
  ResolveReviewReportInput,
  ReviewModerationStatus,
  UpdateReviewStatusInput,
} from "./reviews.schemas.js";

type ModerationFilters = {
  search?: string;
  status?: ReviewModerationStatus;
  flaggedOnly?: boolean;
};

const FLAGGED_KEYWORDS = [
  "scam",
  "fraud",
  "abuse",
  "unsafe",
  "threat",
  "cheat",
  "fake",
];

const buildModerationWhere = (filters: ModerationFilters): Prisma.ReviewWhereInput => {
  const where: Prisma.ReviewWhereInput = {};

  if (filters.search) {
    where.OR = [
      { comment: { contains: filters.search, mode: "insensitive" } },
      {
        customer: {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      },
      {
        vehicle: {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { licensePlate: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  return where;
};

const extractNextStatus = (changes: unknown): ReviewModerationStatus | null => {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return null;
  }

  const value = (changes as Record<string, unknown>).newStatus;
  if (value === "ACTIVE" || value === "HIDDEN" || value === "DELETED") {
    return value;
  }

  return null;
};

const getModerationStatusMap = async (reviewIds: string[]) => {
  if (reviewIds.length === 0) {
    return new Map<string, ReviewModerationStatus>();
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "REVIEW_MODERATION",
      entityId: {
        in: reviewIds,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      entityId: true,
      changes: true,
    },
  });

  const map = new Map<string, ReviewModerationStatus>();

  for (const log of logs) {
    if (map.has(log.entityId)) {
      continue;
    }

    const status = extractNextStatus(log.changes);
    if (status) {
      map.set(log.entityId, status);
    }
  }

  return map;
};

const getCurrentModerationStatus = async (
  reviewId: string,
): Promise<ReviewModerationStatus> => {
  const log = await prisma.auditLog.findFirst({
    where: {
      entityType: "REVIEW_MODERATION",
      entityId: reviewId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      changes: true,
    },
  });

  return extractNextStatus(log?.changes) ?? "ACTIVE";
};

const isReviewFlagged = (
  review: {
    rating: number;
    comment: string | null;
  },
  moderationStatus: ReviewModerationStatus,
) => {
  const comment = review.comment?.toLowerCase() ?? "";

  const hasFlaggedKeyword = FLAGGED_KEYWORDS.some((keyword) =>
    comment.includes(keyword),
  );

  return {
    flagged:
      review.rating <= 2 || hasFlaggedKeyword || moderationStatus !== "ACTIVE",
    hasFlaggedKeyword,
  };
};

const normalizeReviewForModeration = (
  review: {
    id: string;
    rating: number;
    comment: string | null;
    ownerResponse: string | null;
    createdAt: Date;
    updatedAt: Date;
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    vehicle: {
      id: string;
      name: string;
      licensePlate: string;
      owner: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    };
    booking: {
      id: string;
      startDate: Date;
      endDate: Date;
      status: string;
    };
  },
  moderationStatus: ReviewModerationStatus,
) => {
  const flaggedMeta = isReviewFlagged(review, moderationStatus);

  return {
    ...review,
    moderationStatus,
    isFlagged: flaggedMeta.flagged,
    flaggedByKeyword: flaggedMeta.hasFlaggedKeyword,
  };
};

export const listReviewModerationQueue = async (
  filters: ModerationFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildModerationWhere(filters);

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          name: true,
          licensePlate: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      booking: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      },
    },
  });

  const statusMap = await getModerationStatusMap(reviews.map((review) => review.id));

  const enriched = reviews.map((review) =>
    normalizeReviewForModeration(
      review,
      statusMap.get(review.id) ?? "ACTIVE",
    ),
  );

  const flaggedOnly = filters.flaggedOnly ?? true;

  const filtered = enriched.filter((review) => {
    if (filters.status && review.moderationStatus !== filters.status) {
      return false;
    }

    if (flaggedOnly && !review.isFlagged) {
      return false;
    }

    return true;
  });

  const total = filtered.length;
  const paged = filtered.slice(paging.skip, paging.skip + paging.limit);

  return {
    reviews: paged,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getReviewModerationDetails = async (reviewId: string) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          name: true,
          licensePlate: true,
          type: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              status: true,
            },
          },
        },
      },
      booking: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
          pickupLocation: true,
          dropoffLocation: true,
          totalAmount: true,
        },
      },
    },
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  const moderationStatus = await getCurrentModerationStatus(reviewId);

  const moderationHistory = await prisma.auditLog.findMany({
    where: {
      entityId: reviewId,
      entityType: {
        in: ["REVIEW_MODERATION", "REVIEW_REPORT"],
      },
    },
    include: {
      admin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const normalized = normalizeReviewForModeration(review, moderationStatus);

  return {
    ...normalized,
    moderationHistory,
  };
};

export const updateReviewModerationStatus = async (
  adminId: string,
  reviewId: string,
  payload: UpdateReviewStatusInput,
) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      vehicle: {
        select: {
          ownerId: true,
          name: true,
        },
      },
      customer: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  const previousStatus = await getCurrentModerationStatus(reviewId);

  if (previousStatus === payload.status) {
    return {
      id: reviewId,
      moderationStatus: payload.status,
      updated: false,
    };
  }

  await recordAuditLog(
    adminId,
    "UPDATE",
    "REVIEW_MODERATION",
    reviewId,
    {
      previousStatus,
      newStatus: payload.status,
      reason: payload.reason,
    },
    `Review moderation status changed to ${payload.status}`,
  );

  await prisma.notification.createMany({
    data: [
      {
        userId: review.customer.id,
        type: "review_moderation_update",
        title: "Review moderation update",
        message: `A moderation action (${payload.status}) was applied to one of your reviews.`,
        data: {
          reviewId,
          status: payload.status,
          reason: payload.reason,
        },
      },
      {
        userId: review.vehicle.ownerId,
        type: "review_moderation_update",
        title: "Review moderation update",
        message: `A moderation action (${payload.status}) was applied to a review on ${review.vehicle.name}.`,
        data: {
          reviewId,
          status: payload.status,
          reason: payload.reason,
        },
      },
    ],
    skipDuplicates: false,
  });

  return {
    id: reviewId,
    moderationStatus: payload.status,
    updated: true,
  };
};

export const resolveReviewReport = async (
  adminId: string,
  reviewId: string,
  payload: ResolveReviewReportInput,
) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      customerId: true,
    },
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  await recordAuditLog(
    adminId,
    "UPDATE",
    "REVIEW_REPORT",
    reviewId,
    {
      resolutionStatus: payload.status,
      resolution: payload.resolution,
    },
    `Review report ${payload.status.toLowerCase()}`,
  );

  await prisma.notification.create({
    data: {
      userId: review.customerId,
      type: "review_report_resolution",
      title: "Review report update",
      message: "A report linked to your review has been resolved by the admin team.",
      data: {
        reviewId,
        resolutionStatus: payload.status,
      },
    },
  });

  return {
    reviewId,
    reportStatus: payload.status,
    resolution: payload.resolution,
  };
};
