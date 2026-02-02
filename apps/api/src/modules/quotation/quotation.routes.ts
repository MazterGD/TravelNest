import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as quotationController from "./quotation.controller.js";

const router = Router();

// Customer routes
// Get my quotation requests
router.get(
  "/my-requests",
  authenticate,
  asyncHandler(quotationController.getCustomerQuotations),
);

// Create a quotation request
router.post(
  "/",
  authenticate,
  csrfProtection,
  asyncHandler(quotationController.createQuotationRequest),
);

// Get quotation by ID
router.get(
  "/:id",
  authenticate,
  asyncHandler(quotationController.getQuotationById),
);

// Respond to a quotation (accept/reject)
router.patch(
  "/:id/respond",
  authenticate,
  csrfProtection,
  asyncHandler(quotationController.respondToQuotation),
);

// Owner routes
// Get quotation requests for owner (PENDING)
router.get(
  "/owner/requests",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(quotationController.getOwnerQuotationRequests),
);

// Get sent quotations by owner
router.get(
  "/owner/sent",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(quotationController.getOwnerSentQuotations),
);

// Get pricing suggestions for a quotation (owner)
router.get(
  "/:id/pricing-suggestions",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(quotationController.getPricingSuggestions),
);

// Send quotation (owner responds to request)
router.patch(
  "/:id/send",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  asyncHandler(quotationController.sendQuotation),
);

// Admin routes
// Get all quotations
router.get(
  "/admin/all",
  authenticate,
  authorize("admin"),
  asyncHandler(quotationController.getAllQuotations),
);

export default router;
