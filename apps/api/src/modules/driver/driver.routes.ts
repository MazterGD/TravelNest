import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./driver.controller.js";
import {
  createDriverSchema,
  updateDriverSchema,
  driverIdParamSchema,
  assignDriverToBookingSchema,
} from "./driver.schemas.js";

const router = Router();

// All driver routes are owner-only.
router.use(authenticate, authorize("owner", "admin"));

/**
 * @route   GET /api/v1/drivers
 * @desc    List all drivers in the owner's roster (with analytics)
 */
router.get("/", asyncHandler(controller.list));

/**
 * @route   GET /api/v1/drivers/available
 * @desc    List drivers available for a given date range
 * @query   startDate, endDate, excludeBookingId?
 */
router.get("/available", asyncHandler(controller.getAvailable));

/**
 * @route   GET /api/v1/drivers/:id
 * @desc    Get a single driver with recent bookings
 */
router.get(
  "/:id",
  validate(driverIdParamSchema),
  asyncHandler(controller.getOne),
);

/**
 * @route   POST /api/v1/drivers
 * @desc    Add a new driver to the roster
 */
router.post(
  "/",
  csrfProtection,
  validate(createDriverSchema),
  asyncHandler(controller.create),
);

/**
 * @route   PATCH /api/v1/drivers/:id
 * @desc    Update driver details or status
 */
router.patch(
  "/:id",
  csrfProtection,
  validate(updateDriverSchema),
  asyncHandler(controller.update),
);

/**
 * @route   DELETE /api/v1/drivers/:id
 * @desc    Delete a driver (only if no active bookings)
 */
router.delete(
  "/:id",
  csrfProtection,
  validate(driverIdParamSchema),
  asyncHandler(controller.remove),
);

/**
 * @route   POST /api/v1/drivers/assign/:bookingId
 * @desc    Assign a roster driver to a booking (with conflict detection)
 */
router.post(
  "/assign/:bookingId",
  csrfProtection,
  validate(assignDriverToBookingSchema),
  asyncHandler(controller.assignToBooking),
);

/**
 * @route   DELETE /api/v1/drivers/assign/:bookingId
 * @desc    Remove driver assignment from a booking
 */
router.delete(
  "/assign/:bookingId",
  csrfProtection,
  asyncHandler(controller.unassignFromBooking),
);

export default router;
