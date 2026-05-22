import type { Request, Response } from "express";
import * as routingService from "./routing.service.js";
import { ResponseHelper } from "../../utils/response.js";

/**
 * POST /routing/calculate
 *
 * Accepts an array of waypoints, calls the local OSRM Trip API, and
 * returns the optimised route. If a `quotationId` is provided in the body,
 * the route geometry and waypoints are persisted to the PostGIS tables.
 */
export const calculateRoute = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const result = await routingService.calculateRoute(req.body);

  return ResponseHelper.success(
    res,
    {
      route: {
        optimizedWaypoints: result.optimizedWaypoints,
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        /** Human-readable distance in km */
        distanceKm: +(result.distanceMeters / 1000).toFixed(1),
        /** Human-readable duration in minutes */
        durationMinutes: +(result.durationSeconds / 60).toFixed(1),
        geometry: result.geometry,
      },
      persisted: result.persisted,
      quotationId: result.quotationId,
    },
    "Route calculated successfully",
  );
};
