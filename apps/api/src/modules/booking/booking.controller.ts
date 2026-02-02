import type { Request, Response } from "express";
import * as bookingService from "./booking.service.js";
import { ResponseHelper } from "../../utils/response.js";

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

  return ResponseHelper.success(res, result);
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

  return ResponseHelper.success(res, { booking });
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

  return ResponseHelper.success(res, { booking }, "Booking cancelled successfully");
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

  return ResponseHelper.created(res, { booking }, "Booking created successfully");
};

/**
 * Assign driver to booking
 * PATCH /api/v1/bookings/:id/driver
 */
export const assignDriver = async (req: Request, res: Response) => {
  const bookingId = req.params.id as string;
  const ownerId = req.user!.id;
  const { driverName, driverPhone, driverLicense } = req.body;

  const booking = await bookingService.assignDriver(bookingId, ownerId, {
    driverName,
    driverPhone,
    driverLicense,
  });

  return ResponseHelper.success(res, { booking }, "Driver assigned successfully");
};

/**
 * Get driver information for a booking
 * GET /api/v1/bookings/:id/driver
 */
export const getDriverInfo = async (req: Request, res: Response) => {
  const bookingId = req.params.id as string;
  const userId = req.user!.id;

  const driverInfo = await bookingService.getDriverInfo(bookingId, userId);

  return ResponseHelper.success(res, driverInfo);
};

/**
 * Update trip itinerary for a booking
 * PUT /api/v1/bookings/:id/itinerary
 */
export const updateTripItinerary = async (req: Request, res: Response) => {
  const bookingId = req.params.id as string;
  const ownerId = req.user!.id;
  const { itinerary } = req.body;

  const result = await bookingService.updateTripItinerary(
    bookingId,
    ownerId,
    itinerary,
  );

  return ResponseHelper.success(res, { itinerary: result }, "Trip itinerary updated successfully");
};

/**
 * Get trip itinerary for a booking
 * GET /api/v1/bookings/:id/itinerary
 */
export const getTripItinerary = async (req: Request, res: Response) => {
  const bookingId = req.params.id as string;
  const userId = req.user!.id;

  const itinerary = await bookingService.getTripItinerary(bookingId, userId);

  return ResponseHelper.success(res, itinerary);
};
