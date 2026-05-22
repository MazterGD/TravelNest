import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import {
  ownerRegistrationSchema,
  updatePersonalInfoSchema,
  updateAddressSchema,
  addOwnerDocumentSchema,
  earningsTransactionsQuerySchema,
  upsertBankAccountSchema,
} from "./owner.schemas.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as ownerController from "./owner.controller.js";

const router = Router();

/**
 * @route   POST /api/v1/owner/register
 * @desc    Register a new bus owner with vehicles
 * @access  Public
 */
router.post(
  "/register",
  validate(ownerRegistrationSchema),
  asyncHandler(ownerController.register),
);

/**
 * @route   GET /api/v1/owner/profile
 * @desc    Get owner profile with vehicles and documents
 * @access  Private (Owner only)
 */
router.get(
  "/profile",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getProfile),
);

/**
 * @route   PATCH /api/v1/owner/:id/verify
 * @desc    Verify or revoke owner verification
 * @access  Private (Admin only)
 */
router.patch(
  "/:id/verify",
  authenticate,
  authorize("admin"),
  asyncHandler(ownerController.verifyOwner),
);

/**
 * @route   PATCH /api/v1/owner/profile/personal
 * @desc    Update personal information
 * @access  Private (Owner only)
 */
router.patch(
  "/profile/personal",
  authenticate,
  authorize("owner"),
  validate(updatePersonalInfoSchema),
  asyncHandler(ownerController.updatePersonalInfo),
);

/**
 * @route   PATCH /api/v1/owner/profile/address
 * @desc    Update address information
 * @access  Private (Owner only)
 */
router.patch(
  "/profile/address",
  authenticate,
  authorize("owner"),
  validate(updateAddressSchema),
  asyncHandler(ownerController.updateAddress),
);

/**
 * @route   GET /api/v1/owner/documents
 * @desc    List all owner documents
 * @access  Private (Owner only)
 */
router.get(
  "/documents",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getOwnerDocuments),
);

/**
 * @route   POST /api/v1/owner/documents
 * @desc    Add or replace an owner document
 * @access  Private (Owner only)
 */
router.post(
  "/documents",
  authenticate,
  csrfProtection,
  authorize("owner"),
  validate(addOwnerDocumentSchema),
  asyncHandler(ownerController.addOwnerDocument),
);

/**
 * @route   DELETE /api/v1/owner/documents/:docId
 * @desc    Delete an owner document
 * @access  Private (Owner only)
 */
router.delete(
  "/documents/:docId",
  authenticate,
  csrfProtection,
  authorize("owner"),
  asyncHandler(ownerController.deleteOwnerDocument),
);

/**
 * @route   GET /api/v1/owner/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (Owner only)
 */
router.get(
  "/dashboard/stats",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getDashboardStats),
);

/**
 * @route   GET /api/v1/owner/dashboard/revenue-chart
 * @desc    Get monthly revenue for the last 6 months
 * @access  Private (Owner only)
 */
router.get(
  "/dashboard/revenue-chart",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getRevenueChart),
);

/**
 * @route   GET /api/v1/owner/dashboard/recent-reviews
 * @desc    Get 5 most recent reviews across all owner vehicles
 * @access  Private (Owner only)
 */
router.get(
  "/dashboard/recent-reviews",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getRecentReviews),
);

/**
 * @route   GET /api/v1/owner/reviews
 * @desc    Get all reviews across owner's vehicles
 * @access  Private (Owner only)
 */
router.get(
  "/reviews",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getOwnerReviews),
);

/**
 * @route   GET /api/v1/owner/reviews/summary
 * @desc    Get aggregate review summary (avg rating, distribution, response rate)
 * @access  Private (Owner only)
 */
router.get(
  "/reviews/summary",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getOwnerReviewSummary),
);

/**
 * @route   GET /api/v1/owner/analytics/overview
 * @desc    Get KPI overview (revenue, bookings, fleet utilization, rating)
 * @access  Private (Owner only)
 */
router.get(
  "/analytics/overview",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getAnalyticsOverview),
);

/**
 * @route   GET /api/v1/owner/analytics/revenue
 * @desc    Get revenue trend and bookings count for the last 6 months
 * @access  Private (Owner only)
 */
router.get(
  "/analytics/revenue",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getAnalyticsRevenue),
);

/**
 * @route   GET /api/v1/owner/analytics/vehicles
 * @desc    Get per-vehicle performance metrics sorted by revenue
 * @access  Private (Owner only)
 */
router.get(
  "/analytics/vehicles",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getAnalyticsVehicles),
);

/**
 * @route   GET /api/v1/owner/earnings/summary
 * @desc    Get lifetime/month/year earnings and pending settlement balance
 * @access  Private (Owner only)
 */
router.get(
  "/earnings/summary",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getEarningsSummary),
);

/**
 * @route   GET /api/v1/owner/earnings/transactions
 * @desc    Get paginated payment history with status/date filters
 * @access  Private (Owner only)
 */
router.get(
  "/earnings/transactions",
  authenticate,
  authorize("owner"),
  validate(earningsTransactionsQuerySchema),
  asyncHandler(ownerController.getEarningsTransactions),
);

/**
 * @route   GET /api/v1/owner/earnings/settlements
 * @desc    Get settlement payout history
 * @access  Private (Owner only)
 */
router.get(
  "/earnings/settlements",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getEarningsSettlements),
);

/**
 * @route   GET /api/v1/owner/bank-account
 * @desc    Get the owner's saved bank account (account number masked)
 * @access  Private (Owner only)
 */
router.get(
  "/bank-account",
  authenticate,
  authorize("owner"),
  asyncHandler(ownerController.getBankAccount),
);

/**
 * @route   PUT /api/v1/owner/bank-account
 * @desc    Create or update the owner's bank account
 * @access  Private (Owner only)
 */
router.put(
  "/bank-account",
  authenticate,
  csrfProtection,
  authorize("owner"),
  validate(upsertBankAccountSchema),
  asyncHandler(ownerController.upsertBankAccount),
);

export default router;
