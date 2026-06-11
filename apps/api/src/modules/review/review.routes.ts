import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { createReviewSchema, updateReviewSchema } from "./review.schemas.js";
import * as reviewController from "./review.controller.js";

const router = Router();

// ==========================================
// Public routes
// ==========================================

/**
 * @route   GET /api/v1/reviews/vehicle/:vehicleId
 * @desc    Get reviews for a vehicle (includes 6-dimension stats)
 * @access  Public
 */
router.get(
  "/vehicle/:vehicleId",
  asyncHandler(reviewController.getVehicleReviews),
);

// ==========================================
// Customer routes
// ==========================================

/**
 * @route   GET /api/v1/reviews/my-reviews
 * @desc    Get customer's own reviews
 * @access  Private (Customer)
 */
router.get(
  "/my-reviews",
  authenticate,
  asyncHandler(reviewController.getMyReviews),
);

/**
 * @route   GET /api/v1/reviews/pending
 * @desc    Get bookings awaiting a review
 * @access  Private (Customer)
 */
router.get(
  "/pending",
  authenticate,
  asyncHandler(reviewController.getPendingReviews),
);

/**
 * @route   POST /api/v1/reviews
 * @desc    Create a review (with optional 6-dimension sub-ratings)
 * @access  Private (Customer)
 */
router.post(
  "/",
  authenticate,
  csrfProtection,
  validate(createReviewSchema),
  asyncHandler(reviewController.createReview),
);

/**
 * @route   PUT /api/v1/reviews/:id
 * @desc    Update a review
 * @access  Private (Customer)
 */
router.put(
  "/:id",
  authenticate,
  csrfProtection,
  validate(updateReviewSchema),
  asyncHandler(reviewController.updateReview),
);

/**
 * @route   DELETE /api/v1/reviews/:id
 * @desc    Delete a review
 * @access  Private (Customer)
 */
router.delete(
  "/:id",
  authenticate,
  asyncHandler(reviewController.deleteReview),
);

// ==========================================
// Owner routes
// ==========================================

/**
 * @route   GET /api/v1/reviews/owner/summary
 * @desc    Aggregate review stats for the owner (with dimension averages)
 * @access  Private (Owner)
 */
router.get(
  "/owner/summary",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(reviewController.getOwnerReviewSummary),
);

/**
 * @route   GET /api/v1/reviews/owner/list
 * @desc    Paginated reviews received by the owner (filter: hasResponse)
 * @access  Private (Owner)
 */
router.get(
  "/owner/list",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(reviewController.getOwnerReviews),
);

/**
 * @route   POST /api/v1/reviews/:id/response
 * @desc    Owner responds to a review
 * @access  Private (Owner)
 */
router.post(
  "/:id/response",
  authenticate,
  authorize("owner", "admin"),
  csrfProtection,
  asyncHandler(reviewController.respondToReview),
);

export default router;
