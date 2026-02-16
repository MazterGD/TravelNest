import type { Request, Response } from "express";
import * as tripPackageService from "./trip-package.service.js";
import { ResponseHelper } from "../../utils/response.js";

/**
 * Get all trip packages (public)
 * GET /api/v1/packages
 */
export const getAllTripPackages = async (req: Request, res: Response) => {
  const result = await tripPackageService.getAllTripPackages({
    startLocation: req.query.startLocation as string | undefined,
    endLocation: req.query.endLocation as string | undefined,
    minPassengers: req.query.minPassengers
      ? Number(req.query.minPassengers)
      : undefined,
    maxPassengers: req.query.maxPassengers
      ? Number(req.query.maxPassengers)
      : undefined,
    durationDays: req.query.durationDays
      ? Number(req.query.durationDays)
      : undefined,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    vehicleType: req.query.vehicleType as string | undefined,
    ownerId: req.query.ownerId as string | undefined,
    search: req.query.search as string | undefined,
    isActive:
      req.query.isActive !== undefined
        ? req.query.isActive === "true"
        : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  return ResponseHelper.success(res, result);
};

/**
 * Get trip package by ID (public)
 * GET /api/v1/packages/:id
 */
export const getTripPackageById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const tripPackage = await tripPackageService.getTripPackageById(String(id));

  return ResponseHelper.success(res, { tripPackage });
};

/**
 * Get current owner's trip packages
 * GET /api/v1/packages/owner/my
 */
export const getMyTripPackages = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const packages = await tripPackageService.getOwnerTripPackages(ownerId);

  return ResponseHelper.success(res, { packages });
};

/**
 * Create trip package (owner)
 * POST /api/v1/packages
 */
export const createTripPackage = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const tripPackage = await tripPackageService.createTripPackage(
    ownerId,
    req.body,
  );

  return ResponseHelper.created(
    res,
    { tripPackage },
    "Trip package created successfully",
  );
};

/**
 * Update trip package (owner)
 * PATCH /api/v1/packages/:id
 */
export const updateTripPackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  const tripPackage = await tripPackageService.updateTripPackage(
    String(id),
    ownerId,
    req.body,
  );

  return ResponseHelper.success(
    res,
    { tripPackage },
    "Trip package updated successfully",
  );
};

/**
 * Delete trip package (owner)
 * DELETE /api/v1/packages/:id
 */
export const deleteTripPackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;
  await tripPackageService.deleteTripPackage(String(id), ownerId);

  return ResponseHelper.success(res, null, "Trip package deleted successfully");
};

/**
 * Book a trip package (customer)
 * POST /api/v1/packages/:id/book
 */
export const bookTripPackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const customerId = req.user!.id;
  const booking = await tripPackageService.bookTripPackage(
    String(id),
    customerId,
    req.body,
  );

  return ResponseHelper.created(
    res,
    { booking },
    "Trip package booked successfully",
  );
};
