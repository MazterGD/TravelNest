import { Request, Response } from "express";
import xss from "xss";
import * as vehicleService from "./vehicle.service.js";
import { ResponseHelper } from "../../utils/response.js";
import { ApiError } from "../../middleware/errorHandler.js";
import { uploadBuffer } from "../../utils/storage.js";

/**
 * Sanitize an optional string query parameter
 */
const sanitizeQueryParam = (
  value: string | undefined,
): string | undefined => {
  if (!value || typeof value !== "string") return undefined;
  return xss(value.trim());
};

/**
 * Get all vehicles with filters
 * GET /api/v1/vehicles
 */
export const getAllVehicles = async (req: Request, res: Response) => {
  const amenitiesInput = req.query.amenities as string | undefined;
  const amenities = amenitiesInput
    ? amenitiesInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;

  const filters = {
    type: sanitizeQueryParam(req.query.type as string | undefined),
    location: sanitizeQueryParam(req.query.location as string | undefined),
    district: sanitizeQueryParam(req.query.district as string | undefined),
    acType: sanitizeQueryParam(req.query.acType as string | undefined),
    amenities,
    minSeats: req.query.minSeats ? Number(req.query.minSeats) : undefined,
    maxSeats: req.query.maxSeats ? Number(req.query.maxSeats) : undefined,
    available:
      req.query.available !== undefined
        ? req.query.available === "true"
        : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 12,
    sortBy: sanitizeQueryParam(req.query.sortBy as string | undefined),
    sortOrder: sanitizeQueryParam(req.query.sortOrder as string | undefined),
  };

  const result = await vehicleService.getAllVehicles(filters);

  return ResponseHelper.success(res, result);
};

/**
 * Get vehicle by ID
 * GET /api/v1/vehicles/:id
 */
export const getVehicleById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const vehicle = await vehicleService.getVehicleById(String(id));

  return ResponseHelper.success(res, { vehicle });
};

/**
 * Get current user's vehicles
 * GET /api/v1/vehicles/my
 */
export const getMyVehicles = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const vehicles = await vehicleService.getMyVehicles(ownerId);

  return ResponseHelper.success(res, { vehicles });
};

/**
 * Create a new vehicle
 * POST /api/v1/vehicles
 */
export const createVehicle = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const vehicle = await vehicleService.createVehicle(ownerId, req.body);

  return ResponseHelper.created(
    res,
    { vehicle },
    "Vehicle created successfully",
  );
};

/**
 * Update vehicle
 * PATCH /api/v1/vehicles/:id
 */
export const updateVehicle = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const vehicle = await vehicleService.updateVehicle(
    String(id),
    ownerId,
    req.body,
  );

  return ResponseHelper.success(
    res,
    { vehicle },
    "Vehicle updated successfully",
  );
};

/**
 * Delete vehicle
 * DELETE /api/v1/vehicles/:id
 */
export const deleteVehicle = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  await vehicleService.deleteVehicle(String(id), ownerId);

  return ResponseHelper.success(res, null, "Vehicle deleted successfully");
};

/**
 * Upload vehicle photos
 * POST /api/v1/vehicles/:id/photos
 */
export const uploadPhotos = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const files = (req.files as Express.Multer.File[]) || [];

  if (!files.length) {
    throw ApiError.badRequest("At least one photo is required");
  }

  const uploads = await Promise.all(
    files.map((file) =>
      uploadBuffer({
        prefix: `vehicles/${id}/photos`,
        fileName: file.originalname,
        buffer: file.buffer,
        contentType: file.mimetype,
      }),
    ),
  );

  const photoData = uploads.map((upload, index) => ({
    url: upload.publicUrl,
    fileName: files[index].originalname,
    fileSize: files[index].size,
    mimeType: files[index].mimetype,
    isPrimary: index === 0,
  }));

  const uploadedPhotos = await vehicleService.uploadVehiclePhotos(
    String(id),
    ownerId,
    photoData,
  );

  return ResponseHelper.created(
    res,
    { photos: uploadedPhotos },
    "Photos uploaded successfully",
  );
};

/**
 * Upload vehicle photos (metadata only)
 * POST /api/v1/vehicles/:id/photos/metadata
 */
export const uploadPhotosMetadata = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const photos = (req.body?.photos as Array<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    isPrimary?: boolean;
  }>) || [];

  if (!photos.length) {
    throw ApiError.badRequest("At least one photo is required");
  }

  const uploadedPhotos = await vehicleService.uploadVehiclePhotos(
    String(id),
    ownerId,
    photos,
  );

  return ResponseHelper.created(
    res,
    { photos: uploadedPhotos },
    "Photos uploaded successfully",
  );
};

/**
 * Upload vehicle documents
 * POST /api/v1/vehicles/:id/documents
 */
export const uploadDocuments = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  const licenseFile = files?.license?.[0];
  const insuranceFile = files?.insurance?.[0];
  const registrationFile = files?.registrationCertificate?.[0];

  if (!licenseFile || !insuranceFile || !registrationFile) {
    throw ApiError.badRequest("All vehicle documents are required");
  }

  const documentFiles = [
    { file: licenseFile, type: "DRIVING_LICENSE" },
    { file: insuranceFile, type: "INSURANCE" },
    { file: registrationFile, type: "REGISTRATION_CERTIFICATE" },
  ];

  const uploads = await Promise.all(
    documentFiles.map((doc) =>
      uploadBuffer({
        prefix: `vehicles/${id}/documents/${doc.type.toLowerCase().replace(/_/g, "-")}`,
        fileName: doc.file.originalname,
        buffer: doc.file.buffer,
        contentType: doc.file.mimetype,
      }),
    ),
  );

  const documents = documentFiles.map((doc, index) => ({
    type: doc.type,
    url: uploads[index].publicUrl,
    fileName: doc.file.originalname,
    fileSize: doc.file.size,
    mimeType: doc.file.mimetype,
  }));

  const uploadedDocs = await vehicleService.uploadVehicleDocuments(
    String(id),
    ownerId,
    documents,
  );

  return ResponseHelper.success(
    res,
    { documents: uploadedDocs },
    "Documents uploaded successfully",
  );
};

/**
 * Upload vehicle documents (metadata only)
 * POST /api/v1/vehicles/:id/documents/metadata
 */
export const uploadDocumentsMetadata = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const documents = (req.body?.documents as Array<{
    type: string;
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>) || [];

  if (!documents.length) {
    throw ApiError.badRequest("At least one document is required");
  }

  const uploadedDocs = await vehicleService.uploadVehicleDocuments(
    String(id),
    ownerId,
    documents,
  );

  return ResponseHelper.success(
    res,
    { documents: uploadedDocs },
    "Documents uploaded successfully",
  );
};

/**
 * Toggle vehicle availability
 * PATCH /api/v1/vehicles/:id/availability
 */
export const toggleAvailability = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const { available } = req.body;

  const vehicle = await vehicleService.toggleVehicleAvailability(
    String(id),
    ownerId,
    available,
  );

  return ResponseHelper.success(
    res,
    { vehicle },
    `Vehicle ${available ? "activated" : "deactivated"} successfully`,
  );
};

/**
 * Toggle vehicle active status (isActive/admin toggle)
 * PATCH /api/v1/vehicles/:id/status
 */
export const toggleStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const { isActive } = req.body;
  const isAdmin = req.user!.role === "ADMIN";

  const vehicle = await vehicleService.toggleVehicleStatus(
    String(id),
    ownerId,
    isActive,
    isAdmin,
  );

  return ResponseHelper.success(
    res,
    { vehicle },
    `Vehicle ${isActive ? "activated" : "deactivated"} successfully`,
  );
};

/**
 * Request vehicle activation (owner action — pending state)
 * PATCH /api/v1/vehicles/:id/request-activation
 */
export const requestActivation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const vehicle = await vehicleService.requestVehicleActivation(String(id), ownerId);

  return ResponseHelper.success(
    res,
    { vehicle },
    "Activation request submitted. You will be notified once reviewed.",
  );
};

/**
 * Cancel a pending vehicle activation request (owner action)
 * PATCH /api/v1/vehicles/:id/cancel-activation
 */
export const cancelActivation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const vehicle = await vehicleService.cancelVehicleActivation(String(id), ownerId);

  return ResponseHelper.success(res, { vehicle }, "Activation request cancelled.");
};

/**
 * Get monthly availability and bookings for a vehicle
 * GET /api/v1/vehicles/:id/availability
 */
export const getVehicleAvailability = async (req: Request, res: Response) => {
  const { id } = req.params;
  const month =
    sanitizeQueryParam(req.query.month as string | undefined) ||
    sanitizeQueryParam(req.query.startDate as string | undefined)?.slice(0, 7);

  const availability = await vehicleService.getVehicleAvailability(
    String(id),
    month,
  );

  return ResponseHelper.success(res, availability);
};

/**
 * Get similar vehicles for recommendations
 * GET /api/v1/vehicles/:id/similar
 */
export const getSimilarVehicles = async (req: Request, res: Response) => {
  const { id } = req.params;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  const vehicles = await vehicleService.getSimilarVehicles(String(id), limit);

  return ResponseHelper.success(res, { vehicles });
};
