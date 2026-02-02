import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as reviewController from "./review.controller.js";

const router = Router();

// ==========================================
// Public routes
// ==========================================

/**
 * @route   GET /api/v1/reviews/vehicle/:vehicleId
 * @desc    Get reviews for a vehicle
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
 * @desc    Get customer's reviews
 * @access  Private
 */
router.get(
  "/my-reviews",
  authenticate,
  asyncHandler(reviewController.getMyReviews),
);

/**
 * @route   GET /api/v1/reviews/pending
 * @desc    Get bookings pending review
 * @access  Private
 */
router.get(
  "/pending",
  authenticate,
  asyncHandler(reviewController.getPendingReviews),
);

/**
 * @route   POST /api/v1/reviews
 * @desc    Create a review
 * @access  Private
 */
router.post(
  "/",
  authenticate,
  csrfProtection,
  asyncHandler(reviewController.createReview),
);

/**
 * @route   PUT /api/v1/reviews/:id
 * @desc    Update a review
 * @access  Private
 */
router.put(
  "/:id",
  authenticate,
  csrfProtection,
  asyncHandler(reviewController.updateReview),
);

/**
 * @route   DELETE /api/v1/reviews/:id
 * @desc    Delete a review
 * @access  Private
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
 * @route   POST /api/v1/reviews/:id/response
 * @desc    Owner responds to a review
 * @access  Private (Owner)
 */
router.post(
  "/:id/response",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(reviewController.respondToReview),
);

export default router;
