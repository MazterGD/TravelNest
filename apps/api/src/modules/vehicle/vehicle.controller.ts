import { Request, Response } from "express";
import * as vehicleService from "./vehicle.service.js";
import { ResponseHelper } from "../../utils/response.js";

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

  return ResponseHelper.created(res, { vehicle }, "Vehicle created successfully");
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

  return ResponseHelper.success(res, { vehicle }, "Vehicle updated successfully");
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
  const { photos } = req.body;

  const uploadedPhotos = await vehicleService.uploadVehiclePhotos(
    String(id),
    ownerId,
    photos,
  );

  return ResponseHelper.created(res, { photos: uploadedPhotos }, "Photos uploaded successfully");
};

/**
 * Upload vehicle documents
 * POST /api/v1/vehicles/:id/documents
 */
export const uploadDocuments = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const { documents } = req.body;

  const uploadedDocs = await vehicleService.uploadVehicleDocuments(
    String(id),
    ownerId,
    documents,
  );

  return ResponseHelper.success(res, { documents: uploadedDocs }, "Documents uploaded successfully");
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
