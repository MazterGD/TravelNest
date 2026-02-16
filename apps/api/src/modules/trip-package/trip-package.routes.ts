import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as tripPackageController from "./trip-package.controller.js";
import {
  createTripPackageSchema,
  updateTripPackageSchema,
  getTripPackageByIdSchema,
  deleteTripPackageSchema,
  bookTripPackageSchema,
} from "./trip-package.schemas.js";

const router = Router();

// Public routes
router.get("/", asyncHandler(tripPackageController.getAllTripPackages));

// Owner routes
router.get(
  "/owner/my",
  authenticate,
  authorize("owner"),
  asyncHandler(tripPackageController.getMyTripPackages),
);

router.post(
  "/",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(createTripPackageSchema),
  asyncHandler(tripPackageController.createTripPackage),
);

router.patch(
  "/:id",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(updateTripPackageSchema),
  asyncHandler(tripPackageController.updateTripPackage),
);

router.delete(
  "/:id",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(deleteTripPackageSchema),
  asyncHandler(tripPackageController.deleteTripPackage),
);

// Customer booking route
router.post(
  "/:id/book",
  authenticate,
  csrfProtection,
  authorize("customer"),
  validate(bookTripPackageSchema),
  asyncHandler(tripPackageController.bookTripPackage),
);

// Get by ID (public)
router.get(
  "/:id",
  validate(getTripPackageByIdSchema),
  asyncHandler(tripPackageController.getTripPackageById),
);

export default router;
