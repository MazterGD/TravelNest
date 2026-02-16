import type { Request, Response } from "express";
import { uploadBuffer } from "../../utils/storage.js";
import * as userService from "./user.service.js";
import { ResponseHelper } from "../../utils/response.js";
import { ApiError } from "../../middleware/errorHandler.js";

/**
 * Get current user's profile
 * GET /api/v1/users/profile
 */
export const getProfile = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const profile = await userService.getUserProfile(userId);

  return ResponseHelper.success(res, profile);
};

/**
 * Update personal information
 * PATCH /api/v1/users/profile/personal
 */
export const updatePersonalInfo = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const updatedUser = await userService.updatePersonalInfo(userId, req.body);

  return ResponseHelper.success(
    res,
    updatedUser,
    "Personal information updated successfully",
  );
};

/**
 * Update address information
 * PATCH /api/v1/users/profile/address
 */
export const updateAddress = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const updatedUser = await userService.updateAddress(userId, req.body);

  return ResponseHelper.success(
    res,
    updatedUser,
    "Address updated successfully",
  );
};

/**
 * Change password
 * POST /api/v1/users/change-password
 */
export const changePassword = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await userService.changePassword(userId, req.body);

  return ResponseHelper.success(res, null, result.message);
};

/**
 * Delete user account
 * DELETE /api/v1/users/account
 */
export const deleteAccount = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await userService.deleteAccount(userId);

  return ResponseHelper.success(res, null, result.message);
};

/**
 * Get customer dashboard statistics
 * GET /api/v1/users/dashboard/stats
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const stats = await userService.getCustomerDashboardStats(userId);

  return ResponseHelper.success(res, stats);
};

/**
 * Upload avatar image
 * POST /api/v1/users/avatar
 */
export const uploadAvatar = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;

  if (!uploadedFile) {
    throw ApiError.badRequest("Avatar file is required");
  }

  const upload = await uploadBuffer({
    prefix: `avatars/${userId}`,
    fileName: uploadedFile.originalname,
    buffer: uploadedFile.buffer,
    contentType: uploadedFile.mimetype,
  });

  const updatedUser = await userService.updateAvatar(userId, upload.publicUrl);

  return ResponseHelper.success(
    res,
    updatedUser,
    "Avatar updated successfully",
  );
};
