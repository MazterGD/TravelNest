import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ApiError, asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import {
  updatePersonalInfoSchema,
  updateAddressSchema,
  changePasswordSchema,
  dataDeletionRequestSchema,
} from "./user.schemas.js";
import * as userController from "./user.controller.js";
import { config } from "../../config/index.js";

const router = Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      cb(ApiError.badRequest("Unsupported avatar file type"));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get("/profile", authenticate, asyncHandler(userController.getProfile));

/**
 * @route   PATCH /api/v1/users/profile/personal
 * @desc    Update personal information
 * @access  Private
 */
router.patch(
  "/profile/personal",
  authenticate,
  csrfProtection,
  validate(updatePersonalInfoSchema),
  asyncHandler(userController.updatePersonalInfo),
);

/**
 * @route   PATCH /api/v1/users/profile/address
 * @desc    Update address information
 * @access  Private
 */
router.patch(
  "/profile/address",
  authenticate,
  csrfProtection,
  validate(updateAddressSchema),
  asyncHandler(userController.updateAddress),
);

/**
 * @route   POST /api/v1/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  "/change-password",
  authenticate,
  csrfProtection,
  validate(changePasswordSchema),
  asyncHandler(userController.changePassword),
);

/**
 * @route   POST /api/v1/users/avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post(
  "/avatar",
  authenticate,
  csrfProtection,
  avatarUpload.single("avatar"),
  asyncHandler(userController.uploadAvatar),
);

/**
 * @route   DELETE /api/v1/users/avatar
 * @desc    Delete user avatar
 * @access  Private
 */
router.delete(
  "/avatar",
  authenticate,
  csrfProtection,
  asyncHandler(userController.deleteAvatar),
);

/**
 * @route   POST /api/v1/users/data-deletion-request
 * @desc    Ask support to delete all of the user's data
 * @access  Private
 */
router.post(
  "/data-deletion-request",
  authenticate,
  csrfProtection,
  validate(dataDeletionRequestSchema),
  asyncHandler(userController.requestDataDeletion),
);

/**
 * @route   DELETE /api/v1/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  "/account",
  authenticate,
  csrfProtection,
  asyncHandler(userController.deleteAccount),
);

/**
 * @route   GET /api/v1/users/dashboard/stats
 * @desc    Get customer dashboard statistics
 * @access  Private
 */
router.get(
  "/dashboard/stats",
  authenticate,
  asyncHandler(userController.getDashboardStats),
);

export default router;
