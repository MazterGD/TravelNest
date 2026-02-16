import { Request, Response } from "express";
import * as vehicleService from "./vehicle.service.js";
import { ResponseHelper } from "../../utils/response.js";
import { ApiError } from "../../middleware/errorHandler.js";
import { uploadBuffer } from "../../utils/storage.js";

/**
 * Get all vehicles with filters
 * GET /api/v1/vehicles
 */
export const getAllVehicles = async (req: Request, res: Response) => {
  const filters = {
    type: req.query.type as string | undefined,
    location: req.query.location as string | undefined,
    minSeats: req.query.minSeats ? Number(req.query.minSeats) : undefined,
    maxSeats: req.query.maxSeats ? Number(req.query.maxSeats) : undefined,
    available:
      req.query.available !== undefined
        ? req.query.available === "true"
        : undefined,
  };

  const vehicles = await vehicleService.getAllVehicles(filters);

  return ResponseHelper.success(res, { vehicles });
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
        prefix: `vehicles/${id}/documents`,
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
 * Toggle vehicle active status (isActive)
 */
export const toggleStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const { isActive } = req.body;

  const vehicle = await vehicleService.toggleVehicleStatus(
    String(id),
    ownerId,
    isActive,
  );

  return ResponseHelper.success(
    res,
    { vehicle },
    `Vehicle ${isActive ? "activated" : "deactivated"} successfully`,
  );
};
