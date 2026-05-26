import type { Request, Response } from "express";
import type { TripStatus } from "@travenest/database";
import * as tripService from "./trip.service.js";
import { ResponseHelper } from "../../utils/response.js";

export const createTrip = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const trip = await tripService.createTrip(customerId, req.body);
  return ResponseHelper.created(res, { trip }, "Trip created successfully");
};

export const listTrips = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { status, page, limit, activeOnly } = req.query;

  const result = await tripService.listTrips(customerId, {
    status: typeof status === "string" ? (status as TripStatus) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    activeOnly: activeOnly === "true",
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
  const trip = await tripService.updateTrip(id as string, userId, req.body);
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
