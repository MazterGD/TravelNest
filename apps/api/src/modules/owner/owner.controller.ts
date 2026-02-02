import type { Request, Response } from "express";
import * as ownerService from "./owner.service.js";
import { config } from "../../config/index.js";
import { ResponseHelper } from "../../utils/response.js";

/**
 * Register a new bus owner with vehicles
 * POST /api/v1/owner/register
 */
export const register = async (req: Request, res: Response) => {
  const result = await ownerService.registerOwner(req.body);

  // Set refresh token as HTTP-only cookie
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  return ResponseHelper.created(
    res,
    {
      user: result.user,
      accessToken: result.accessToken,
    },
    "Owner registration successful. Your account is pending verification.",
  );
};

/**
 * Get owner profile with vehicles and documents
 * GET /api/v1/owner/profile
 */
export const getProfile = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const profile = await ownerService.getOwnerProfile(ownerId);

  return ResponseHelper.success(res, profile);
};

/**
 * Update owner verification status (admin only)
 * PATCH /api/v1/owner/:id/verify
 */
export const verifyOwner = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isVerified } = req.body;
  const adminId = req.user!.id;

  const owner = await ownerService.updateOwnerVerification(
    String(id),
    isVerified,
    adminId,
  );

  return ResponseHelper.success(
    res,
    { owner },
    isVerified ? "Owner verified successfully" : "Owner verification revoked",
  );
};

/**
 * Update personal information
 * PATCH /api/v1/owner/profile/personal
 */
export const updatePersonalInfo = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const updatedUser = await ownerService.updatePersonalInfo(ownerId, req.body);

  return ResponseHelper.success(
    res,
    updatedUser,
    "Personal information updated successfully",
  );
};

/**
 * Update address information
 * PATCH /api/v1/owner/profile/address
 */
export const updateAddress = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const updatedUser = await ownerService.updateAddress(ownerId, req.body);

  return ResponseHelper.success(
    res,
    updatedUser,
    "Address updated successfully",
  );
};

/**
 * Get dashboard statistics
 * GET /api/v1/owner/dashboard/stats
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const stats = await ownerService.getDashboardStats(ownerId);

  return ResponseHelper.success(res, stats);
};
