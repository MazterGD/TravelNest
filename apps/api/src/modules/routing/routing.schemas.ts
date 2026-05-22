import { z } from "zod";

/**
 * Schema for a single coordinate point.
 * Validates that lat/lng are within Sri Lanka's approximate bounding box
 * to catch obviously invalid inputs early.
 */
const coordinateSchema = z.object({
  lat: z
    .number()
    .min(5.5, "Latitude must be within Sri Lanka (≥ 5.5°N)")
    .max(10.0, "Latitude must be within Sri Lanka (≤ 10.0°N)"),
  lng: z
    .number()
    .min(79.2, "Longitude must be within Sri Lanka (≥ 79.2°E)")
    .max(82.2, "Longitude must be within Sri Lanka (≤ 82.2°E)"),
  name: z.string().max(255).optional(),
});

/**
 * Request body schema for POST /routing/calculate
 *
 * Accepts an array of waypoints (min 2: origin + destination) and an optional
 * quotationId to persist the calculated route and waypoints to the database.
 */
export const calculateRouteSchema = z.object({
  body: z.object({
    waypoints: z
      .array(coordinateSchema)
      .min(2, "At least two waypoints (origin and destination) are required")
      .max(25, "A maximum of 25 waypoints is supported by OSRM"),
    quotationId: z
      .string()
      .min(1, "quotationId must not be empty")
      .optional(),
  }),
});

export type CalculateRouteInput = z.infer<
  typeof calculateRouteSchema
>["body"];

export type CoordinateInput = z.infer<typeof coordinateSchema>;
