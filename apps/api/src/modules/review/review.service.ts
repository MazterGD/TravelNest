import prisma from "@travenest/database";
import xss from "xss";
import { ApiError } from "../../middleware/errorHandler.js";

export interface ReviewQuery {
  page?: number;
  limit?: number;
}

export interface CreateReviewInput {
  bookingId: string;
  vehicleId: string;
  rating: number;
  comment?: string;
}

/**
 * Get customer's reviews
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
      include: {
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

  // Transform reviews for frontend
  const transformedReviews = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
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

  // Find completed bookings without reviews
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

  // Transform for frontend
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
 * Create a review for a completed booking
 */
export const createReview = async (
  customerId: string,
  data: CreateReviewInput,
) => {
  // Validate booking
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: {
      review: true,
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.customerId !== customerId) {
    throw ApiError.forbidden("Not authorized to review this booking");
  }

  if (booking.status !== "COMPLETED") {
    throw ApiError.badRequest("Only completed bookings can be reviewed");
  }

  if (booking.review) {
    throw ApiError.badRequest("This booking has already been reviewed");
  }

  // Validate rating
  if (data.rating < 1 || data.rating > 5) {
    throw ApiError.badRequest("Rating must be between 1 and 5");
  }

  // Sanitize comment
  const sanitizedComment = data.comment
    ? xss(data.comment.trim(), { whiteList: {}, stripIgnoreTag: true })
    : null;

  // Create review
  const review = await prisma.review.create({
    data: {
      customerId,
      vehicleId: data.vehicleId,
      bookingId: data.bookingId,
      rating: data.rating,
      comment: sanitizedComment,
    },
    include: {
      vehicle: {
        select: {
          name: true,
          owner: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    vehicleName: review.vehicle.name,
    ownerName: `${review.vehicle.owner.firstName} ${review.vehicle.owner.lastName}`,
    createdAt: review.createdAt.toISOString(),
  };
};

/**
 * Update a review
 */
export const updateReview = async (
  reviewId: string,
  customerId: string,
  data: { rating?: number; comment?: string },
) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw ApiError.notFound("Review not found");
  }

  if (review.customerId !== customerId) {
    throw ApiError.forbidden("Not authorized to update this review");
  }

  // Validate rating if provided
  if (data.rating && (data.rating < 1 || data.rating > 5)) {
    throw ApiError.badRequest("Rating must be between 1 and 5");
  }

  const updateData: any = {};
  if (data.rating) updateData.rating = data.rating;
  if (data.comment !== undefined) {
    updateData.comment = data.comment
      ? xss(data.comment.trim(), { whiteList: {}, stripIgnoreTag: true })
      : null;
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: updateData,
  });

  return updatedReview;
};

/**
 * Delete a review
 */
export const deleteReview = async (reviewId: string, customerId: string) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw ApiError.notFound("Review not found");
  }

  if (review.customerId !== customerId) {
    throw ApiError.forbidden("Not authorized to delete this review");
  }

  await prisma.review.delete({
    where: { id: reviewId },
  });

  return { message: "Review deleted successfully" };
};

/**
 * Get reviews for a vehicle (public)
 */
export const getVehicleReviews = async (
  vehicleId: string,
  query: ReviewQuery,
) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const [reviews, total, stats] = await Promise.all([
    prisma.review.findMany({
      where: { vehicleId },
      skip,
      take: limit,
      include: {
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
  ]);

  // Calculate rating distribution
  const ratingDistribution = await prisma.review.groupBy({
    by: ["rating"],
    where: { vehicleId },
    _count: { rating: true },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingDistribution.forEach((r) => {
    distribution[r.rating] = r._count.rating;
  });

  // Transform reviews for frontend
  const transformedReviews = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    customerName: `${review.customer.firstName} ${review.customer.lastName.charAt(0)}.`,
    customerAvatar: review.customer.avatar,
    ownerResponse: review.ownerResponse,
    createdAt: review.createdAt.toISOString(),
  }));

  return {
    reviews: transformedReviews,
    stats: {
      averageRating: stats._avg.rating || 0,
      totalReviews: stats._count.rating,
      ratingDistribution: distribution,
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
 * Owner responds to a review
 */
export const respondToReview = async (
  reviewId: string,
  ownerId: string,
  response: string,
) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      vehicle: {
        select: { ownerId: true },
      },
    },
  });

  if (!review) {
    throw ApiError.notFound("Review not found");
  }

  if (review.vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden("Not authorized to respond to this review");
  }

  if (review.ownerResponse) {
    throw ApiError.badRequest("This review already has a response");
  }

  const sanitizedResponse = xss(response.trim(), {
    whiteList: {},
    stripIgnoreTag: true,
  });

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: { ownerResponse: sanitizedResponse },
  });

  return updatedReview;
};
