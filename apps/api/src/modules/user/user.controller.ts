import type { Request, Response } from "express";
import * as userService from "./user.service.js";
import { ResponseHelper } from "../../utils/response.js";

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

  return ResponseHelper.success(res, updatedUser, "Personal information updated successfully");
};

/**
 * Update address information
 * PATCH /api/v1/users/profile/address
 */
export const updateAddress = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const updatedUser = await userService.updateAddress(userId, req.body);

  return ResponseHelper.success(res, updatedUser, "Address updated successfully");
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
