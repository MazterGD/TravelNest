import type { Request, Response } from "express";
import * as ownerService from "./owner.service.js";
import { config } from "../../config/index.js";
import { ResponseHelper } from "../../utils/response.js";
import type { EarningsTransactionsQuery } from "./owner.schemas.js";

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

/**
 * List owner documents
 * GET /api/v1/owner/documents
 */
export const getOwnerDocuments = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const docs = await ownerService.getOwnerDocuments(ownerId);
  return ResponseHelper.success(res, docs);
};

/**
 * Add (or replace) an owner document
 * POST /api/v1/owner/documents
 */
export const addOwnerDocument = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const doc = await ownerService.addOwnerDocument(ownerId, req.body);
  return ResponseHelper.created(res, doc, "Document uploaded successfully");
};

/**
 * Delete an owner document
 * DELETE /api/v1/owner/documents/:docId
 */
export const deleteOwnerDocument = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { docId } = req.params;
  await ownerService.deleteOwnerDocument(ownerId, String(docId));
  return ResponseHelper.success(res, null, "Document deleted successfully");
};

/**
 * Get revenue chart data for the last 6 months
 * GET /api/v1/owner/dashboard/revenue-chart
 */
export const getRevenueChart = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const data = await ownerService.getRevenueChart(ownerId);

  return ResponseHelper.success(res, data);
};

/**
 * Get 5 most recent reviews across all owner vehicles
 * GET /api/v1/owner/dashboard/recent-reviews
 */
export const getRecentReviews = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const reviews = await ownerService.getRecentReviews(ownerId);

  return ResponseHelper.success(res, reviews);
};

/**
 * Get all reviews for owner's vehicles
 * GET /api/v1/owner/reviews
 */
export const getOwnerReviews = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { page, limit, rating, hasResponse } = req.query;

  const result = await ownerService.getOwnerReviews(ownerId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    rating: rating ? Number(rating) : undefined,
    hasResponse: hasResponse as string | undefined,
  });

  return ResponseHelper.success(res, result);
};

/**
 * Get aggregate review summary for owner's vehicles
 * GET /api/v1/owner/reviews/summary
 */
export const getOwnerReviewSummary = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const summary = await ownerService.getOwnerReviewSummary(ownerId);

  return ResponseHelper.success(res, summary);
};

/**
 * Get analytics overview KPI data
 * GET /api/v1/owner/analytics/overview
 */
export const getAnalyticsOverview = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const overview = await ownerService.getAnalyticsOverview(ownerId);
  return ResponseHelper.success(res, overview);
};

/**
 * Get revenue trend and bookings by month (last 6 months)
 * GET /api/v1/owner/analytics/revenue
 */
export const getAnalyticsRevenue = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const data = await ownerService.getAnalyticsRevenue(ownerId);
  return ResponseHelper.success(res, data);
};

/**
 * Get per-vehicle performance metrics
 * GET /api/v1/owner/analytics/vehicles
 */
export const getAnalyticsVehicles = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const data = await ownerService.getAnalyticsVehicles(ownerId);
  return ResponseHelper.success(res, data);
};

/**
 * Get booking history for a specific vehicle (ownership-guarded)
 * GET /api/v1/owner/analytics/vehicles/:vehicleId/bookings
 */
export const getAnalyticsVehicleBookings = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const vehicleId = req.params.vehicleId as string;
  const data = await ownerService.getAnalyticsVehicleBookings(ownerId, vehicleId);
  return ResponseHelper.success(res, data);
};

/**
 * Get earnings summary (lifetime / month / year earnings + pending balance)
 * GET /api/v1/owner/earnings/summary
 */
export const getEarningsSummary = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const summary = await ownerService.getEarningsSummary(ownerId);
  return ResponseHelper.success(res, summary);
};

/**
 * Get paginated payment transaction history
 * GET /api/v1/owner/earnings/transactions
 */
export const getEarningsTransactions = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { page, limit, status, from, to } = req.query;

  const result = await ownerService.getTransactions(ownerId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status as EarningsTransactionsQuery["status"],
    from: from as string | undefined,
    to: to as string | undefined,
  });

  return ResponseHelper.success(res, result);
};

/**
 * Get settlement payout history
 * GET /api/v1/owner/earnings/settlements
 */
export const getEarningsSettlements = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const settlements = await ownerService.getSettlements(ownerId);
  return ResponseHelper.success(res, settlements);
};

/**
 * Get the owner's saved bank account (account number masked to last 4 digits)
 * GET /api/v1/owner/bank-account
 */
export const getBankAccount = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const account = await ownerService.getBankAccount(ownerId);
  return ResponseHelper.success(res, account);
};

/**
 * Create or update the owner's bank account
 * PUT /api/v1/owner/bank-account
 */
export const upsertBankAccount = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const account = await ownerService.upsertBankAccount(ownerId, req.body);
  return ResponseHelper.success(
    res,
    account,
    "Bank account saved successfully",
  );
};
