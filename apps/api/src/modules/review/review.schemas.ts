import { z } from "zod";

const dimensionRating = z
  .number({
    required_error: "All five category ratings are required",
    invalid_type_error: "Category ratings must be numbers",
  })
  .int("Rating must be a whole number")
  .min(1, "Rating must be between 1 and 5")
  .max(5, "Rating must be between 1 and 5");

// All five sub-ratings are mandatory — the overall rating is derived from them.
const reviewDimensionsSchema = z.object({
  ratingVehicleCondition: dimensionRating,
  ratingDriverBehavior: dimensionRating,
  ratingPunctuality: dimensionRating,
  ratingCleanliness: dimensionRating,
  ratingValueForMoney: dimensionRating,
});

export const createReviewSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
    vehicleId: z.string().min(1, "Vehicle ID is required"),
    dimensions: reviewDimensionsSchema,
    title: z.string().trim().max(120).optional(),
    comment: z.string().trim().max(1000).optional(),
    isRecommended: z.boolean().optional(),
  }),
});

export const updateReviewSchema = z.object({
  body: z.object({
    dimensions: reviewDimensionsSchema.optional(),
    title: z.string().trim().max(120).optional(),
    comment: z.string().trim().max(1000).optional(),
    isRecommended: z.boolean().optional(),
  }),
});

export type CreateReviewBody = z.infer<typeof createReviewSchema>["body"];
export type UpdateReviewBody = z.infer<typeof updateReviewSchema>["body"];
