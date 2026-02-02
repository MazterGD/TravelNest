import type { Request, Response } from "express";
import * as reviewService from "./review.service.js";

/**
 * Get customer's reviews
 * GET /api/v1/reviews/my-reviews
 */
export const getMyReviews = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { page, limit } = req.query;

  const result = await reviewService.getCustomerReviews(customerId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Get bookings pending review
 * GET /api/v1/reviews/pending
 */
export const getPendingReviews = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { page, limit } = req.query;

  const result = await reviewService.getPendingReviews(customerId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Create a review
 * POST /api/v1/reviews
 */
export const createReview = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { bookingId, vehicleId, rating, comment } = req.body;

  const review = await reviewService.createReview(customerId, {
    bookingId,
    vehicleId,
    rating,
    comment,
  });

  res.status(201).json({
    success: true,
    message: "Review submitted successfully",
    data: { review },
  });
};

/**
 * Update a review
 * PUT /api/v1/reviews/:id
 */
export const updateReview = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const customerId = req.user!.id;
  const { rating, comment } = req.body;

  const review = await reviewService.updateReview(id, customerId, {
    rating,
    comment,
  });

  res.json({
    success: true,
    message: "Review updated successfully",
    data: { review },
  });
};

/**
 * Delete a review
 * DELETE /api/v1/reviews/:id
 */
export const deleteReview = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const customerId = req.user!.id;

  const result = await reviewService.deleteReview(id, customerId);

  res.json({
    success: true,
    message: result.message,
  });
};

/**
 * Get reviews for a vehicle
 * GET /api/v1/reviews/vehicle/:vehicleId
 */
export const getVehicleReviews = async (req: Request, res: Response) => {
  const vehicleId = req.params.vehicleId as string;
  const { page, limit } = req.query;

  const result = await reviewService.getVehicleReviews(vehicleId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Owner responds to a review
 * POST /api/v1/reviews/:id/response
 */
export const respondToReview = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const ownerId = req.user!.id;
  const { response } = req.body;

  const review = await reviewService.respondToReview(id, ownerId, response);

  res.json({
    success: true,
    message: "Response added successfully",
    data: { review },
  });
};
