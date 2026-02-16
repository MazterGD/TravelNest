import { Router } from "express";
import multer from "multer";
import {
  authenticate,
  authorize,
  optionalAuth,
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as vehicleController from "./vehicle.controller.js";
import {
  createVehicleSchema,
  updateVehicleSchema,
  getVehicleByIdSchema,
  deleteVehicleSchema,
} from "./vehicle.schemas.js";
import { config } from "../../config/index.js";

const router = Router();

const photoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Unsupported photo file type"));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Unsupported document file type"));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// Public routes
// Get all vehicles (with filters)
router.get("/", optionalAuth, asyncHandler(vehicleController.getAllVehicles));

// Protected routes (Owner only)
// Get my vehicles - MUST come before /:id
router.get(
  "/my",
  authenticate,
  authorize("owner"),
  asyncHandler(vehicleController.getMyVehicles),
);

// Get vehicle by ID - parameterized routes come after specific routes
router.get(
  "/:id",
  optionalAuth,
  validate(getVehicleByIdSchema),
  asyncHandler(vehicleController.getVehicleById),
);

// Create a vehicle
router.post(
  "/",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(createVehicleSchema),
  asyncHandler(vehicleController.createVehicle),
);

// Update a vehicle
router.patch(
  "/:id",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(updateVehicleSchema),
  asyncHandler(vehicleController.updateVehicle),
);

// Delete a vehicle
router.delete(
  "/:id",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(deleteVehicleSchema),
  asyncHandler(vehicleController.deleteVehicle),
);

// Upload vehicle photos
router.post(
  "/:id/photos",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  photoUpload.array("photos", 10),
  asyncHandler(vehicleController.uploadPhotos),
);

// Upload vehicle documents
router.post(
  "/:id/documents",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  documentUpload.fields([
    { name: "license", maxCount: 1 },
    { name: "insurance", maxCount: 1 },
    { name: "registrationCertificate", maxCount: 1 },
  ]),
  asyncHandler(vehicleController.uploadDocuments),
);

// Toggle vehicle availability
router.patch(
  "/:id/availability",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  asyncHandler(vehicleController.toggleAvailability),
);

// Toggle vehicle status (isActive)
router.patch(
  "/:id/status",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  asyncHandler(vehicleController.toggleStatus),
);

export default router;
