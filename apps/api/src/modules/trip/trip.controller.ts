import type { Request, Response } from "express";
import * as tripService from "./trip.service.js";
import {
  createTripSchema,
  listTripsSchema,
  updateTripSchema,
} from "./trip.schemas.js";
import { ResponseHelper } from "../../utils/response.js";

export const createTrip = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  // validate() checks but does not replace req.body, so reuse the parsed
  // values to keep the schema's coercions (upper-cased enums, numbers).
  const body = createTripSchema.shape.body.parse(req.body);
  const trip = await tripService.createTrip(customerId, body);
  return ResponseHelper.created(res, { trip }, "Trip created successfully");
};

export const listTrips = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { status, page, limit, activeOnly } = listTripsSchema.shape.query.parse(
    req.query,
  );

  const result = await tripService.listTrips(customerId, {
    status,
    page,
    limit,
    activeOnly: activeOnly === true,
  });

  return ResponseHelper.success(res, result);
};

export const getTripById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const trip = await tripService.getTripById(id as string, userId);
  return ResponseHelper.success(res, { trip });
};

export const updateTrip = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const body = updateTripSchema.shape.body.parse(req.body);
  const trip = await tripService.updateTrip(id as string, userId, body);
  return ResponseHelper.success(res, { trip }, "Trip updated successfully");
};

export const cancelTrip = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const trip = await tripService.cancelTrip(id as string, userId);
  return ResponseHelper.success(res, { trip }, "Trip cancelled");
};

export const getActiveTrips = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const trips = await tripService.getActiveTripsForCustomer(customerId);
  return ResponseHelper.success(res, { trips });
};
