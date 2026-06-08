import prisma from "@travenest/database";
import xss from "xss";
import { ApiError } from "../../middleware/errorHandler.js";

export interface ReviewQuery {
  page?: number;
  limit?: number;
}

export interface DimensionRatings {
  ratingVehicleCondition?: number;
  ratingDriverBehavior?: number;
  ratingPunctuality?: number;
  ratingCleanliness?: number;
  ratingValueForMoney?: number;
}

export interface CreateReviewInput {
  bookingId: string;
  vehicleId: string;
  // The 5 sub-ratings are mandatory; the overall rating is derived from them.
  dimensions: DimensionRatings;
  title?: string;
  comment?: string;
  isRecommended?: boolean;
}

const DIMENSION_FIELDS = [
  "ratingVehicleCondition",
  "ratingDriverBehavior",
  "ratingPunctuality",
  "ratingCleanliness",
  "ratingValueForMoney",
] as const;

// Shared select shape reused across queries
const reviewDimensionSelect = {
  id: true,
  rating: true,
  ratingVehicleCondition: true,
  ratingDriverBehavior: true,
  ratingPunctuality: true,
  ratingCleanliness: true,
  ratingValueForMoney: true,
  title: true,
  comment: true,
  isRecommended: true,
  ownerResponse: true,
  createdAt: true,
  updatedAt: true,
} as const;

function sanitizeText(value: string | undefined | null): string | null {
  if (!value) return null;
  return xss(value.trim(), { whiteList: {}, stripIgnoreTag: true }) || null;
}

function validateDimensionRating(value: number | undefined | null, name: string): void {
  if (value !== undefined && value !== null && (value < 1 || value > 5)) {
    throw ApiError.badRequest(`${name} must be between 1 and 5`);
  }
}

/**
 * Derive the overall rating as the rounded average of the five sub-ratings.
 * Throws if any of the five dimensions is missing.
 */
function computeOverallRating(dimensions: DimensionRatings): number {
  const values = DIMENSION_FIELDS.map((field) => dimensions[field]);

  if (values.some((value) => value === undefined || value === null)) {
    throw ApiError.badRequest("All five category ratings are required");
  }

  const numbers = values as number[];
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return Math.round(total / DIMENSION_FIELDS.length);
}

/**
 * Get customer's own reviews
 */
export const getCustomerReviews = async (
  customerId: string,
  query: ReviewQuery,
) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { customerId },
      skip,
      take: limit,
      select: {
        ...reviewDimensionSelect,
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
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.count({ where: { customerId } }),
  ]);

  const transformedReviews = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    dimensions: {
      vehicleCondition: review.ratingVehicleCondition,
      driverBehavior: review.ratingDriverBehavior,
      punctuality: review.ratingPunctuality,
      cleanliness: review.ratingCleanliness,
      valueForMoney: review.ratingValueForMoney,
    },
    title: review.title,
    comment: review.comment,
    isRecommended: review.isRecommended,
    createdAt: review.createdAt.toISOString(),
    vehicleName: review.vehicle.name,
    ownerName: `${review.vehicle.owner.firstName} ${review.vehicle.owner.lastName}`,
    ownerResponse: review.ownerResponse,
    ownerResponseDate: review.updatedAt.toISOString(),
    tripDate: review.booking.startDate.toISOString(),
  }));

  return {
    reviews: transformedReviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get bookings pending review for a customer
 */
export const getPendingReviews = async (
  customerId: string,
  query: ReviewQuery,
) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: {
        customerId,
        status: "COMPLETED",
        review: null,
      },
      skip,
      take: limit,
      include: {
        vehicle: {
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { endDate: "desc" },
    }),
    prisma.booking.count({
      where: {
        customerId,
        status: "COMPLETED",
        review: null,
      },
    }),
  ]);

  const pendingReviews = bookings.map((booking) => ({
    bookingId: booking.id,
    vehicleId: booking.vehicleId,
    vehicleName: booking.vehicle.name,
    ownerName: `${booking.vehicle.owner.firstName} ${booking.vehicle.owner.lastName}`,
    tripDate: booking.endDate.toISOString(),
  }));

  return {
    pendingReviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Create a review for a completed booking (with optional 6-dimension ratings)
 */
export const createReview = async (
  customerId: string,
  data: CreateReviewInput,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: { review: true },
  });

  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.customerId !== customerId)
    throw ApiError.forbidden("Not authorized to review this booking");
  if (booking.status !== "COMPLETED")
    throw ApiError.badRequest("Only completed bookings can be reviewed");
  if (booking.review)
    throw ApiError.badRequest("This booking has already been reviewed");
  if (data.vehicleId !== booking.vehicleId)
    throw ApiError.badRequest("Vehicle ID does not match the booking's vehicle");

  validateDimensionRating(data.dimensions.ratingVehicleCondition, "Vehicle condition rating");
  validateDimensionRating(data.dimensions.ratingDriverBehavior, "Driver behavior rating");
  validateDimensionRating(data.dimensions.ratingPunctuality, "Punctuality rating");
  validateDimensionRating(data.dimensions.ratingCleanliness, "Cleanliness rating");
  validateDimensionRating(data.dimensions.ratingValueForMoney, "Value for money rating");

  // Overall rating is the average of the five sub-ratings, not a separate input.
  const rating = computeOverallRating(data.dimensions);

  const review = await prisma.review.create({
    data: {
      customerId,
      vehicleId: data.vehicleId,
      bookingId: data.bookingId,
      rating,
      ratingVehicleCondition: data.dimensions.ratingVehicleCondition ?? null,
      ratingDriverBehavior: data.dimensions.ratingDriverBehavior ?? null,
      ratingPunctuality: data.dimensions.ratingPunctuality ?? null,
      ratingCleanliness: data.dimensions.ratingCleanliness ?? null,
      ratingValueForMoney: data.dimensions.ratingValueForMoney ?? null,
      title: sanitizeText(data.title),
      comment: sanitizeText(data.comment),
      isRecommended: data.isRecommended ?? null,
    },
    include: {
      vehicle: {
        select: {
          name: true,
          owner: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return {
    id: review.id,
    rating: review.rating,
    dimensions: {
      vehicleCondition: review.ratingVehicleCondition,
      driverBehavior: review.ratingDriverBehavior,
      punctuality: review.ratingPunctuality,
      cleanliness: review.ratingCleanliness,
      valueForMoney: review.ratingValueForMoney,
    },
    title: review.title,
    comment: review.comment,
    isRecommended: review.isRecommended,
    vehicleName: review.vehicle.name,
    ownerName: `${review.vehicle.owner.firstName} ${review.vehicle.owner.lastName}`,
    createdAt: review.createdAt.toISOString(),
  };
};

/**
 * Update an existing review (owner's copy, dimensions included)
 */
export const updateReview = async (
  reviewId: string,
  customerId: string,
  data: {
    title?: string;
    comment?: string;
    isRecommended?: boolean;
    dimensions?: DimensionRatings;
  },
) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound("Review not found");
  if (review.customerId !== customerId)
    throw ApiError.forbidden("Not authorized to update this review");

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = sanitizeText(data.title);
  if (data.comment !== undefined) updateData.comment = sanitizeText(data.comment);
  if (data.isRecommended !== undefined) updateData.isRecommended = data.isRecommended;

  if (data.dimensions) {
    validateDimensionRating(data.dimensions.ratingVehicleCondition, "Vehicle condition rating");
    validateDimensionRating(data.dimensions.ratingDriverBehavior, "Driver behavior rating");
    validateDimensionRating(data.dimensions.ratingPunctuality, "Punctuality rating");
    validateDimensionRating(data.dimensions.ratingCleanliness, "Cleanliness rating");
    validateDimensionRating(data.dimensions.ratingValueForMoney, "Value for money rating");

    updateData.ratingVehicleCondition = data.dimensions.ratingVehicleCondition;
    updateData.ratingDriverBehavior = data.dimensions.ratingDriverBehavior;
    updateData.ratingPunctuality = data.dimensions.ratingPunctuality;
    updateData.ratingCleanliness = data.dimensions.ratingCleanliness;
    updateData.ratingValueForMoney = data.dimensions.ratingValueForMoney;

    // Keep the overall rating in sync with the edited sub-ratings.
    updateData.rating = computeOverallRating(data.dimensions);
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: updateData,
    select: reviewDimensionSelect,
  });

  return {
    id: updatedReview.id,
    rating: updatedReview.rating,
    dimensions: {
      vehicleCondition: updatedReview.ratingVehicleCondition,
      driverBehavior: updatedReview.ratingDriverBehavior,
      punctuality: updatedReview.ratingPunctuality,
      cleanliness: updatedReview.ratingCleanliness,
      valueForMoney: updatedReview.ratingValueForMoney,
    },
    title: updatedReview.title,
    comment: updatedReview.comment,
    isRecommended: updatedReview.isRecommended,
  };
};

/**
 * Delete a review
 */
export const deleteReview = async (reviewId: string, customerId: string) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound("Review not found");
  if (review.customerId !== customerId)
    throw ApiError.forbidden("Not authorized to delete this review");

  await prisma.review.delete({ where: { id: reviewId } });
  return { message: "Review deleted successfully" };
};

/**
 * Get reviews for a vehicle (public) — includes per-dimension averages
 */
export const getVehicleReviews = async (
  vehicleId: string,
  query: ReviewQuery,
) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const [reviews, total, stats, dimStats] = await Promise.all([
    prisma.review.findMany({
      where: { vehicleId },
      skip,
      take: limit,
      select: {
        ...reviewDimensionSelect,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.count({ where: { vehicleId } }),
    prisma.review.aggregate({
      where: { vehicleId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.review.aggregate({
      where: { vehicleId },
      _avg: {
        ratingVehicleCondition: true,
        ratingDriverBehavior: true,
        ratingPunctuality: true,
        ratingCleanliness: true,
        ratingValueForMoney: true,
      },
    }),
  ]);

  const ratingDistribution = await prisma.review.groupBy({
    by: ["rating"],
    where: { vehicleId },
    _count: { rating: true },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingDistribution.forEach((r) => {
    distribution[r.rating] = r._count.rating;
  });

  const transformedReviews = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    dimensions: {
      vehicleCondition: review.ratingVehicleCondition,
      driverBehavior: review.ratingDriverBehavior,
      punctuality: review.ratingPunctuality,
      cleanliness: review.ratingCleanliness,
      valueForMoney: review.ratingValueForMoney,
    },
    title: review.title,
    comment: review.comment,
    isRecommended: review.isRecommended,
    customerName: `${review.customer.firstName} ${review.customer.lastName.charAt(0)}.`,
    customerAvatar: review.customer.avatar,
    ownerResponse: review.ownerResponse,
    createdAt: review.createdAt.toISOString(),
  }));

  return {
    reviews: transformedReviews,
    stats: {
      averageRating: stats._avg.rating ?? 0,
      totalReviews: stats._count.rating,
      ratingDistribution: distribution,
      dimensionAverages: {
        vehicleCondition: dimStats._avg.ratingVehicleCondition ?? null,
        driverBehavior: dimStats._avg.ratingDriverBehavior ?? null,
        punctuality: dimStats._avg.ratingPunctuality ?? null,
        cleanliness: dimStats._avg.ratingCleanliness ?? null,
        valueForMoney: dimStats._avg.ratingValueForMoney ?? null,
      },
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get review summary stats for an owner (all vehicles combined)
 */
export const getOwnerReviewSummary = async (ownerId: string) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const vehicleIds = vehicles.map((v) => v.id);

  const [stats, dimStats, pendingCount] = await Promise.all([
    prisma.review.aggregate({
      where: { vehicleId: { in: vehicleIds } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.review.aggregate({
      where: { vehicleId: { in: vehicleIds } },
      _avg: {
        ratingVehicleCondition: true,
        ratingDriverBehavior: true,
        ratingPunctuality: true,
        ratingCleanliness: true,
        ratingValueForMoney: true,
      },
    }),
    prisma.review.count({
      where: { vehicleId: { in: vehicleIds }, ownerResponse: null },
    }),
  ]);

  const totalReviews = stats._count.rating;
  const pendingResponses = pendingCount;
  const respondedCount = totalReviews - pendingResponses;

  const ratingDistribution = await prisma.review.groupBy({
    by: ["rating"],
    where: { vehicleId: { in: vehicleIds } },
    _count: { rating: true },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingDistribution.forEach((r) => {
    distribution[r.rating] = r._count.rating;
  });

  return {
    averageRating: stats._avg.rating ?? 0,
    totalReviews,
    pendingResponses,
    responseRate: totalReviews > 0 ? Math.round((respondedCount / totalReviews) * 100) : 0,
    ratingDistribution: distribution,
    dimensionAverages: {
      vehicleCondition: dimStats._avg.ratingVehicleCondition ?? null,
      driverBehavior: dimStats._avg.ratingDriverBehavior ?? null,
      punctuality: dimStats._avg.ratingPunctuality ?? null,
      cleanliness: dimStats._avg.ratingCleanliness ?? null,
      valueForMoney: dimStats._avg.ratingValueForMoney ?? null,
    },
  };
};

/**
 * Get owner's received reviews (with optional has-response filter)
 */
export const getOwnerReviews = async (
  ownerId: string,
  query: ReviewQuery & { hasResponse?: boolean },
) => {
  const { page = 1, limit = 20, hasResponse } = query;
  const skip = (page - 1) * limit;

  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const vehicleIds = vehicles.map((v) => v.id);

  const where: Record<string, unknown> = { vehicleId: { in: vehicleIds } };
  if (hasResponse === true) where.ownerResponse = { not: null };
  if (hasResponse === false) where.ownerResponse = null;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      select: {
        ...reviewDimensionSelect,
        customer: {
          select: { firstName: true, lastName: true, avatar: true },
        },
        vehicle: { select: { id: true, name: true } },
        booking: { select: { endDate: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.count({ where }),
  ]);

  const transformedReviews = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    dimensions: {
      vehicleCondition: review.ratingVehicleCondition,
      driverBehavior: review.ratingDriverBehavior,
      punctuality: review.ratingPunctuality,
      cleanliness: review.ratingCleanliness,
      valueForMoney: review.ratingValueForMoney,
    },
    title: review.title,
    comment: review.comment,
    isRecommended: review.isRecommended,
    ownerResponse: review.ownerResponse,
    createdAt: review.createdAt.toISOString(),
    tripDate: review.booking.endDate.toISOString(),
    customerName: `${review.customer.firstName} ${review.customer.lastName.charAt(0)}.`,
    customerAvatar: review.customer.avatar,
    vehicleId: review.vehicle.id,
    vehicleName: review.vehicle.name,
  }));

  return {
    reviews: transformedReviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Owner responds to a review
 */
export const respondToReview = async (
  reviewId: string,
  ownerId: string,
  response: string,
) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { vehicle: { select: { ownerId: true } } },
  });

  if (!review) throw ApiError.notFound("Review not found");
  if (review.vehicle.ownerId !== ownerId)
    throw ApiError.forbidden("Not authorized to respond to this review");
  if (review.ownerResponse)
    throw ApiError.badRequest("This review already has a response");

  const sanitizedResponse = sanitizeText(response);
  if (!sanitizedResponse)
    throw ApiError.badRequest("Response cannot be empty");

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: { ownerResponse: sanitizedResponse },
  });

  return updatedReview;
};
