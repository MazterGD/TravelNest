import type { Request, Response } from "express";
import * as userService from "./user.service.js";

/**
 * Get current user's profile
 * GET /api/v1/users/profile
 */
export const getProfile = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const profile = await userService.getUserProfile(userId);

  res.json({
    success: true,
    data: profile,
  });
};

/**
 * Update personal information
 * PATCH /api/v1/users/profile/personal
 */
export const updatePersonalInfo = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const updatedUser = await userService.updatePersonalInfo(userId, req.body);

  res.json({
    success: true,
    message: "Personal information updated successfully",
    data: updatedUser,
  });
};

/**
 * Update address information
 * PATCH /api/v1/users/profile/address
 */
export const updateAddress = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const updatedUser = await userService.updateAddress(userId, req.body);

  res.json({
    success: true,
    message: "Address updated successfully",
    data: updatedUser,
  });
};

/**
 * Change password
 * POST /api/v1/users/change-password
 */
export const changePassword = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await userService.changePassword(userId, req.body);

  res.json({
    success: true,
    message: result.message,
  });
};

/**
 * Delete user account
 * DELETE /api/v1/users/account
 */
export const deleteAccount = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await userService.deleteAccount(userId);

  res.json({
    success: true,
    message: result.message,
  });
};

/**
 * Get customer dashboard statistics
 * GET /api/v1/users/dashboard/stats
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const stats = await userService.getCustomerDashboardStats(userId);

  res.json({
    success: true,
    data: stats,
  });
};
