import { Router, type RequestHandler } from "express";
import { requireAdminPermission } from "../admin/admin.middleware.js";
import multer from "multer";
import {
  authenticate,
  authorize,
  optionalAuth,
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { ApiError, asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as vehicleController from "./vehicle.controller.js";
import {
  createVehicleSchema,
  updateVehicleSchema,
  getVehicleByIdSchema,
  deleteVehicleSchema,
  deletePhotoSchema,
  getVehicleAvailabilitySchema,
  getSimilarVehiclesSchema,
  uploadPhotosSchema,
  uploadDocumentsSchema,
  toggleAvailabilitySchema,
  toggleStatusSchema,
  createAvailabilityBlockSchema,
  removeAvailabilityBlockSchema,
} from "./vehicle.schemas.js";
import { config } from "../../config/index.js";

const router = Router();

// Admins reactivate or suspend through the verification permissions, not by
// role alone; owners pass straight through to the service's own checks.
const adminVehicleStatusPermission: RequestHandler = (req, res, next) => {
  if (req.user?.role !== "ADMIN") return next();
  const permission = req.body?.isActive
    ? "admin.verifications.approve"
    : "admin.verifications.reject";
  return requireAdminPermission(permission)(req, res, next);
};

const photoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      cb(ApiError.badRequest("Unsupported photo file type"));
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
      cb(ApiError.badRequest("Unsupported document file type"));
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

// Platform-set base pricing per vehicle type (read-only reference) — MUST come before /:id
router.get(
  "/pricing-config",
  asyncHandler(vehicleController.getTypePricing),
);

// Protected routes (Owner only)
// Get my vehicles - MUST come before /:id
router.get(
  "/my",
  authenticate,
  authorize("owner"),
  asyncHandler(vehicleController.getMyVehicles),
);

router.get(
  "/:id/availability",
  optionalAuth,
  validate(getVehicleAvailabilitySchema),
  asyncHandler(vehicleController.getVehicleAvailability),
);

router.get(
  "/:id/similar",
  optionalAuth,
  validate(getSimilarVehiclesSchema),
  asyncHandler(vehicleController.getSimilarVehicles),
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

router.post(
  "/:id/photos/metadata",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(uploadPhotosSchema),
  asyncHandler(vehicleController.uploadPhotosMetadata),
);

router.delete(
  "/:id/photos/:photoId",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(deletePhotoSchema),
  asyncHandler(vehicleController.deletePhoto),
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

router.post(
  "/:id/documents/metadata",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(uploadDocumentsSchema),
  asyncHandler(vehicleController.uploadDocumentsMetadata),
);

// Owner-blocked dates
router.post(
  "/:id/availability/blocks",
  authenticate,
  csrfProtection,
  authorize("owner"),
  validate(createAvailabilityBlockSchema),
  asyncHandler(vehicleController.createAvailabilityBlock),
);

router.delete(
  "/:id/availability/blocks/:blockId",
  authenticate,
  csrfProtection,
  authorize("owner"),
  validate(removeAvailabilityBlockSchema),
  asyncHandler(vehicleController.removeAvailabilityBlock),
);

// Toggle vehicle availability
router.patch(
  "/:id/availability",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(toggleAvailabilitySchema),
  asyncHandler(vehicleController.toggleAvailability),
);

// Toggle vehicle status (isActive) — admin controls activation; owner can only deactivate
router.patch(
  "/:id/status",
  authenticate,
  csrfProtection,
  authorize("owner", "admin"),
  validate(toggleStatusSchema),
  adminVehicleStatusPermission,
  asyncHandler(vehicleController.toggleStatus),
);

// Submit activation request (owner → pending state)
router.patch(
  "/:id/request-activation",
  authenticate,
  csrfProtection,
  authorize("owner"),
  asyncHandler(vehicleController.requestActivation),
);

// Cancel pending activation request (owner → back to inactive)
router.patch(
  "/:id/cancel-activation",
  authenticate,
  csrfProtection,
  authorize("owner"),
  asyncHandler(vehicleController.cancelActivation),
);

export default router;
