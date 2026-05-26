import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as tripController from "./trip.controller.js";
import {
  createTripSchema,
  updateTripSchema,
  listTripsSchema,
} from "./trip.schemas.js";

const router = Router();

// All trip routes are scoped to authenticated customers
router.get(
  "/active",
  authenticate,
  asyncHandler(tripController.getActiveTrips),
);

router.get(
  "/",
  authenticate,
  validate(listTripsSchema),
  asyncHandler(tripController.listTrips),
);

router.post(
  "/",
  authenticate,
  csrfProtection,
  validate(createTripSchema),
  asyncHandler(tripController.createTrip),
);

router.get("/:id", authenticate, asyncHandler(tripController.getTripById));

router.patch(
  "/:id",
  authenticate,
  csrfProtection,
  validate(updateTripSchema),
  asyncHandler(tripController.updateTrip),
);

router.patch(
  "/:id/cancel",
  authenticate,
  csrfProtection,
  asyncHandler(tripController.cancelTrip),
);

export default router;
