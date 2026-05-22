import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  getBookingById,
  getBookingsCsv,
  listBookings,
  patchBookingStatus,
  postCancelWithRefund,
} from "./bookings.controller.js";
import {
  bookingIdParamsSchema,
  cancelWithRefundSchema,
  exportBookingsSchema,
  listBookingsSchema,
  updateBookingStatusSchema,
} from "./bookings.schemas.js";

const router = Router();

router.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

router.get(
  "/",
  validate(listBookingsSchema),
  requireAdminPermission("admin.bookings.read"),
  asyncHandler(listBookings),
);

router.get(
  "/export",
  validate(exportBookingsSchema),
  requireAdminPermission("admin.bookings.export"),
  asyncHandler(getBookingsCsv),
);

router.get(
  "/:bookingId",
  validate(bookingIdParamsSchema),
  requireAdminPermission("admin.bookings.read"),
  asyncHandler(getBookingById),
);

router.patch(
  "/:bookingId/status",
  validate(updateBookingStatusSchema),
  requireAdminPermission("admin.bookings.update_status"),
  asyncHandler(patchBookingStatus),
);

router.post(
  "/:bookingId/cancel-with-refund",
  validate(cancelWithRefundSchema),
  requireAdminPermission("admin.bookings.cancel_refund"),
  asyncHandler(postCancelWithRefund),
);

export default router;
