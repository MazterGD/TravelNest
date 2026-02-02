import type { Request, Response } from "express";
import * as bookingService from "./booking.service.js";

/**
 * Get customer's bookings
 * GET /api/v1/bookings/my-bookings
 */
export const getMyBookings = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { status, page, limit } = req.query;

  const result = await bookingService.getCustomerBookings(customerId, {
    status: status as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Get single booking by ID
 * GET /api/v1/bookings/:id
 */
export const getBookingById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const booking = await bookingService.getBookingById(id, userId, userRole);

  res.json({
    success: true,
    data: booking,
  });
};

/**
 * Cancel a booking
 * PATCH /api/v1/bookings/:id/cancel
 */
export const cancelBooking = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const customerId = req.user!.id;
  const { reason } = req.body;

  const booking = await bookingService.cancelBooking(id, customerId, reason);

  res.json({
    success: true,
    message: "Booking cancelled successfully",
    data: { booking },
  });
};

/**
 * Create booking from accepted quotation
 * POST /api/v1/bookings/from-quotation
 */
export const createFromQuotation = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { quotationId } = req.body;

  const booking = await bookingService.createBookingFromQuotation(
    customerId,
    quotationId,
  );

  res.status(201).json({
    success: true,
    message: "Booking created successfully",
    data: { booking },
  });
};
