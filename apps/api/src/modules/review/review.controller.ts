import type { Request, Response } from "express";
import * as reviewService from "./review.service.js";
import { ResponseHelper } from "../../utils/response.js";

/**
 * GET /api/v1/reviews/my-reviews
 */
export const getMyReviews = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { page, limit } = req.query;

  const result = await reviewService.getCustomerReviews(customerId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return ResponseHelper.success(res, result);
};

/**
 * GET /api/v1/reviews/pending
 */
export const getPendingReviews = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { page, limit } = req.query;

  const result = await reviewService.getPendingReviews(customerId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return ResponseHelper.success(res, result);
};

/**
 * POST /api/v1/reviews
 */
export const createReview = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { bookingId, vehicleId, title, comment, isRecommended, dimensions } =
    req.body;

  const review = await reviewService.createReview(customerId, {
    bookingId,
    vehicleId,
    title,
    comment,
    isRecommended,
    dimensions,
  });

  return ResponseHelper.created(res, { review }, "Review submitted successfully");
};

/**
 * PUT /api/v1/reviews/:id
 */
export const updateReview = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const customerId = req.user!.id;
  const { title, comment, isRecommended, dimensions } = req.body;

  const review = await reviewService.updateReview(id, customerId, {
    title,
    comment,
    isRecommended,
    dimensions,
  });

  return ResponseHelper.success(res, { review }, "Review updated successfully");
};

/**
 * DELETE /api/v1/reviews/:id
 */
export const deleteReview = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const customerId = req.user!.id;

  const result = await reviewService.deleteReview(id, customerId);

  return ResponseHelper.success(res, null, result.message);
};

/**
 * GET /api/v1/reviews/vehicle/:vehicleId
 */
export const getVehicleReviews = async (req: Request, res: Response) => {
  const vehicleId = req.params.vehicleId as string;
  const { page, limit } = req.query;

  const result = await reviewService.getVehicleReviews(vehicleId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return ResponseHelper.success(res, result);
};

/**
 * GET /api/v1/reviews/owner/summary
 * Returns aggregate stats for the authenticated owner
 */
export const getOwnerReviewSummary = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const result = await reviewService.getOwnerReviewSummary(ownerId);
  return ResponseHelper.success(res, result);
};

/**
 * GET /api/v1/reviews/owner/list
 * Returns paginated reviews received by the authenticated owner
 */
export const getOwnerReviews = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { page, limit, hasResponse } = req.query;

  const result = await reviewService.getOwnerReviews(ownerId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    hasResponse:
      hasResponse === "true" ? true : hasResponse === "false" ? false : undefined,
  });

  return ResponseHelper.success(res, result);
};

/**
 * POST /api/v1/reviews/:id/response
 */
export const respondToReview = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const ownerId = req.user!.id;
  const { response } = req.body;

  const review = await reviewService.respondToReview(id, ownerId, response);

  return ResponseHelper.success(res, { review }, "Response added successfully");
};
