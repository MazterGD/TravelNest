import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as bookingController from "./booking.controller.js";
import type { Request, Response } from "express";
import prisma from "@travenest/database";

const router = Router();

// ==========================================
// Customer routes
// ==========================================

/**
 * @route   GET /api/v1/bookings/my-bookings
 * @desc    Get customer's bookings
 * @access  Private
 */
router.get(
  "/my-bookings",
  authenticate,
  asyncHandler(bookingController.getMyBookings),
);

/**
 * @route   POST /api/v1/bookings/from-quotation
 * @desc    Create booking from accepted quotation
 * @access  Private
 */
router.post(
  "/from-quotation",
  authenticate,
  csrfProtection,
  asyncHandler(bookingController.createFromQuotation),
);

/**
 * @route   GET /api/v1/bookings/:id
 * @desc    Get booking by ID
 * @access  Private (customer, owner, admin)
 */
router.get(
  "/:id",
  authenticate,
  asyncHandler(bookingController.getBookingById),
);

/**
 * @route   PATCH /api/v1/bookings/:id/cancel
 * @desc    Cancel a booking
 * @access  Private (customer)
 */
router.patch(
  "/:id/cancel",
  authenticate,
  csrfProtection,
  asyncHandler(bookingController.cancelBooking),
);

// ==========================================
// Owner routes
// ==========================================

/**
 * @route   GET /api/v1/bookings/owner/vehicle-bookings
 * @desc    Get bookings for owner's vehicles
 * @access  Private (Owner only)
 */
router.get(
  "/owner/vehicle-bookings",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, vehicleId, page = 1, limit = 10 } = req.query;
    const ownerId = req.user!.id;

    // Build filter conditions
    const where: any = {
      vehicle: {
        ownerId: ownerId,
      },
    };

    if (status && typeof status === "string") {
      where.status = status.toUpperCase();
    }

    if (vehicleId && typeof vehicleId === "string") {
      where.vehicleId = vehicleId;
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Query bookings with related data
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              name: true,
              licensePlate: true,
              type: true,
              brand: true,
              model: true,
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
              method: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limitNum,
      }),
      prisma.booking.count({ where }),
    ]);

    // Transform bookings to match frontend interface
    const transformedBookings = bookings.map((booking) => ({
      id: booking.id,
      bookingRef: `BK-${booking.id.slice(0, 8).toUpperCase()}`,
      customer: {
        name: `${booking.customer.firstName} ${booking.customer.lastName}`,
        phone: booking.customer.phone || "",
        email: booking.customer.email,
      },
      vehicle: {
        registration: booking.vehicle.licensePlate,
        type: booking.vehicle.type,
      },
      trip: {
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
        route: `${booking.pickupLocation} → ${booking.dropoffLocation || booking.pickupLocation}`,
        passengers: booking.totalPassengers || 0,
      },
      payment: {
        total: booking.totalAmount,
        status: booking.payment?.status?.toLowerCase() || "pending",
      },
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
    }));

    res.json({
      success: true,
      data: {
        bookings: transformedBookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  }),
);

/**
 * @route   PATCH /api/v1/bookings/:id/confirm
 * @desc    Confirm a booking
 * @access  Private (Owner only)
 */
router.patch(
  "/:id/confirm",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const ownerId = req.user!.id;

    // Get booking and verify ownership
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: { ownerId: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { message: "Booking not found", code: "BOOKING_NOT_FOUND" },
      });
    }

    if (booking.vehicle.ownerId !== ownerId && req.user!.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: { message: "Not authorized", code: "FORBIDDEN" },
      });
    }

    if (booking.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        error: {
          message: "Only pending bookings can be confirmed",
          code: "INVALID_STATUS",
        },
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });

    res.json({
      success: true,
      message: "Booking confirmed successfully",
      data: { booking: updatedBooking },
    });
  }),
);

/**
 * @route   PATCH /api/v1/bookings/:id/reject
 * @desc    Reject a booking
 * @access  Private (Owner only)
 */
router.patch(
  "/:id/reject",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { reason } = req.body;
    const ownerId = req.user!.id;

    // Get booking and verify ownership
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: { ownerId: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { message: "Booking not found", code: "BOOKING_NOT_FOUND" },
      });
    }

    if (booking.vehicle.ownerId !== ownerId && req.user!.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: { message: "Not authorized", code: "FORBIDDEN" },
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: reason || "Rejected by owner",
      },
    });

    res.json({
      success: true,
      message: "Booking rejected successfully",
      data: { booking: updatedBooking },
    });
  }),
);

/**
 * @route   PATCH /api/v1/bookings/:id/complete
 * @desc    Mark booking as completed
 * @access  Private (Owner only)
 */
router.patch(
  "/:id/complete",
  authenticate,
  authorize("owner", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const ownerId = req.user!.id;

    // Get booking and verify ownership
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: { ownerId: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { message: "Booking not found", code: "BOOKING_NOT_FOUND" },
      });
    }

    if (booking.vehicle.ownerId !== ownerId && req.user!.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: { message: "Not authorized", code: "FORBIDDEN" },
      });
    }

    if (booking.status !== "ONGOING" && booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        error: {
          message: "Booking cannot be completed in current status",
          code: "INVALID_STATUS",
        },
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    res.json({
      success: true,
      message: "Booking marked as completed",
      data: { booking: updatedBooking },
    });
  }),
);

// ==========================================
// Admin routes
// ==========================================

/**
 * @route   GET /api/v1/bookings
 * @desc    Get all bookings (admin)
 * @access  Private (Admin only)
 */
router.get(
  "/",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, page = 1, limit = 10 } = req.query;

    const where: any = {};
    if (status && typeof status === "string") {
      where.status = status.toUpperCase();
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              name: true,
              licensePlate: true,
              type: true,
            },
          },
          payment: {
            select: {
              status: true,
              amount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  }),
);

// ==========================================
// Driver Information Routes
// ==========================================

/**
 * @route   PATCH /api/v1/bookings/:id/driver
 * @desc    Assign/update driver information for a booking
 * @access  Private (Owner only)
 */
router.patch(
  "/:id/driver",
  authenticate,
  authorize("owner", "admin"),
  csrfProtection,
  asyncHandler(bookingController.assignDriver),
);

/**
 * @route   GET /api/v1/bookings/:id/driver
 * @desc    Get driver information for a booking
 * @access  Private (Customer, Owner)
 */
router.get(
  "/:id/driver",
  authenticate,
  asyncHandler(bookingController.getDriverInfo),
);

// ==========================================
// Trip Itinerary Routes
// ==========================================

/**
 * @route   PUT /api/v1/bookings/:id/itinerary
 * @desc    Add or update trip itinerary for a booking
 * @access  Private (Owner only)
 */
router.put(
  "/:id/itinerary",
  authenticate,
  authorize("owner", "admin"),
  csrfProtection,
  asyncHandler(bookingController.updateTripItinerary),
);

/**
 * @route   GET /api/v1/bookings/:id/itinerary
 * @desc    Get trip itinerary for a booking
 * @access  Private (Customer, Owner)
 */
router.get(
  "/:id/itinerary",
  authenticate,
  asyncHandler(bookingController.getTripItinerary),
);

export default router;
