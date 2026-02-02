import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import {
  ownerRegistrationSchema,
  updatePersonalInfoSchema,
  updateAddressSchema,
} from "./owner.schemas.js";
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

export default router;
