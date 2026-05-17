import type { NextFunction, Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  createAmenity,
  deleteAmenity,
  listAmenities,
  updateAmenity,
} from "./amenities.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getAmenitiesCollection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const amenities = await listAmenities(
      {
        search: req.query.search as string | undefined,
        includeInactive:
          req.query.includeInactive !== undefined
            ? String(req.query.includeInactive) === "true"
            : undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      amenities,
      "Amenities fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postCreateAmenity = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const created = await createAmenity(adminId, req.body);

    return ResponseHelper.success(res, created, "Amenity created successfully", 201);
  } catch (error) {
    return next(error);
  }
};

export const patchAmenityById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const updated = await updateAmenity(
      adminId,
      normalizeParam(req.params.amenityId),
      req.body,
    );

    return ResponseHelper.success(res, updated, "Amenity updated successfully");
  } catch (error) {
    return next(error);
  }
};

export const deleteAmenityById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const deleted = await deleteAmenity(
      adminId,
      normalizeParam(req.params.amenityId),
    );

    return ResponseHelper.success(res, deleted, "Amenity deleted successfully");
  } catch (error) {
    return next(error);
  }
};
