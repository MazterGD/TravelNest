import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import {
  updatePersonalInfoSchema,
  updateAddressSchema,
  changePasswordSchema,
} from "./user.schemas.js";
import * as userController from "./user.controller.js";
import type { Request, Response } from "express";
import { config } from "../../config/index.js";

const router = Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Unsupported avatar file type"));
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
 * @route   DELETE /api/v1/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  "/account",
  authenticate,
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

// Admin routes
// Get all users (admin only)
router.get(
  "/",
  authenticate,
  authorize("admin"),
  asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implement with database
    res.json({
      success: true,
      data: { users: [] },
    });
  }),
);

// Get user by ID (admin only)
router.get(
  "/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // TODO: Implement with database
    res.json({
      success: true,
      data: { user: { id } },
    });
  }),
);

// Update user (admin only)
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // TODO: Implement with database
    res.json({
      success: true,
      message: `User ${id} updated successfully`,
    });
  }),
);

// Delete user (admin only)
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // TODO: Implement with database
    res.json({
      success: true,
      message: `User ${id} deleted successfully`,
    });
  }),
);

export default router;
