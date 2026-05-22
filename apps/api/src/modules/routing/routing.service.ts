import axios from "axios";
import { prisma } from "@travenest/database";
import type { Prisma } from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { config } from "../../config/index.js";
import type { CalculateRouteInput, CoordinateInput } from "./routing.schemas.js";

// ---------------------------------------------------------------------------
// Constants (sourced from centralized config)
// ---------------------------------------------------------------------------

/** Base URL of the self-hosted OSRM instance (Docker container on port 5000) */
const OSRM_BASE_URL = config.osrm.baseUrl;

/** Request timeout for OSRM calls (ms) */
const OSRM_TIMEOUT_MS = config.osrm.timeoutMs;

// ---------------------------------------------------------------------------
// OSRM Response Types
// ---------------------------------------------------------------------------

interface OsrmWaypoint {
  waypoint_index: number;
  trips_index: number;
  location: [number, number]; // [lng, lat]
  name: string;
  distance: number;
}

interface OsrmLeg {
  distance: number;
  duration: number;
  steps: unknown[];
}

interface OsrmTrip {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  legs: OsrmLeg[];
  distance: number;
  duration: number;
}

interface OsrmTripResponse {
  code: string;
  waypoints: OsrmWaypoint[];
  trips: OsrmTrip[];
}

// ---------------------------------------------------------------------------
// Service Result Types
// ---------------------------------------------------------------------------

export interface RouteCalculationResult {
  /** Optimised waypoints in OSRM-suggested order */
  optimizedWaypoints: Array<{
    index: number;
    lat: number;
    lng: number;
    name: string;
    originalName?: string;
  }>;
  /** Total driving distance in metres */
  distanceMeters: number;
  /** Total driving duration in seconds */
  durationSeconds: number;
  /** Full route geometry as GeoJSON LineString */
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  /** Whether the result was persisted to the database */
  persisted: boolean;
  /** The quotation ID if persisted */
  quotationId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Transform an array of {lat, lng} objects into the semicolon-delimited
 * `lng,lat;lng,lat` format expected by OSRM.
 */
const toOsrmCoordinateString = (waypoints: CoordinateInput[]): string =>
  waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(";");

// ---------------------------------------------------------------------------
// Core Service Function
// ---------------------------------------------------------------------------

/**
 * Calculate a route through the given waypoints using the local OSRM Trip API,
 * optionally persisting the result to the `itinerary_routes` and
 * `itinerary_stops` tables when a `quotationId` is provided.
 *
 * Uses the Trip endpoint (not Route) because it optimises the waypoint
 * visiting order — which is what charter customers need when building
 * multi-stop itineraries.
 */
export const calculateRoute = async (
  input: CalculateRouteInput,
): Promise<RouteCalculationResult> => {
  const { waypoints, quotationId } = input;

  // ------------------------------------------------------------------
  // 1. Build the OSRM request URL
  // ------------------------------------------------------------------
  const coords = toOsrmCoordinateString(waypoints);
  const osrmUrl =
    `${OSRM_BASE_URL}/trip/v1/driving/${coords}` +
    `?steps=true&geometries=geojson&overview=full&annotations=true`;

  // ------------------------------------------------------------------
  // 2. Call the local OSRM Trip API
  // ------------------------------------------------------------------
  let osrmData: OsrmTripResponse;

  try {
    const response = await axios.get<OsrmTripResponse>(osrmUrl, {
      timeout: OSRM_TIMEOUT_MS,
    });
    osrmData = response.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === "ECONNREFUSED") {
        throw ApiError.internal(
          "OSRM routing service is unavailable. Ensure the Docker container is running on port 5000.",
        );
      }
      throw ApiError.internal(
        `OSRM request failed: ${err.message}`,
      );
    }
    throw err;
  }

  if (osrmData.code !== "Ok") {
    throw ApiError.badRequest(
      `OSRM returned error code "${osrmData.code}". Verify that all coordinates are routable on Sri Lankan roads.`,
    );
  }

  if (!osrmData.trips || osrmData.trips.length === 0) {
    throw ApiError.badRequest(
      "OSRM could not find a valid trip through the given waypoints.",
    );
  }

  // ------------------------------------------------------------------
  // 3. Parse the OSRM response
  // ------------------------------------------------------------------
  const trip = osrmData.trips[0]!;
  const distanceMeters = trip.distance;
  const durationSeconds = trip.duration;
  const geometry = trip.geometry;

  // Build the optimised waypoint list in OSRM-suggested order
  const optimizedWaypoints = osrmData.waypoints
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map((wp) => ({
      index: wp.waypoint_index,
      lat: wp.location[1],
      lng: wp.location[0],
      name: wp.name || "",
      // Attach the user-provided name if available (matched by original index)
      originalName: waypoints[wp.waypoint_index]?.name,
    }));

  // ------------------------------------------------------------------
  // 4. Optionally persist to the database
  // ------------------------------------------------------------------
  let persisted = false;

  if (quotationId) {
    // Verify the quotation exists
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true },
    });

    if (!quotation) {
      throw ApiError.notFound("Quotation not found");
    }

    // Build the GeoJSON for the full route
    const routeGeoJson = JSON.stringify(geometry);

    // Build the waypoints LineString GeoJSON from OSRM-optimised order
    const waypointsLineString = JSON.stringify({
      type: "LineString",
      coordinates: optimizedWaypoints.map((wp) => [wp.lng, wp.lat]),
    });

    // Use a Prisma transaction for atomicity (architecture.md §3.4)
    await prisma.$transaction(async (tx) => {
      // Delete any pre-existing route / stops for this quotation
      // (user may recalculate)
      await tx.$executeRawUnsafe(
        `DELETE FROM "itinerary_routes" WHERE "quotationId" = $1`,
        quotationId,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "itinerary_stops" WHERE "quotationId" = $1`,
        quotationId,
      );

      // Insert the continuous route geometry
      await tx.$executeRawUnsafe(
        `INSERT INTO "itinerary_routes"
           ("id", "quotationId", "waypoints", "routeGeometry",
            "distanceMeters", "durationSeconds", "createdAt")
         VALUES (
           gen_random_uuid()::text,
           $1,
           ST_GeomFromGeoJSON($2),
           ST_GeomFromGeoJSON($3),
           $4,
           $5,
           NOW()
         )`,
        quotationId,
        waypointsLineString,
        routeGeoJson,
        distanceMeters,
        durationSeconds,
      );

      // Insert each optimised waypoint as a spatial Point
      for (const wp of optimizedWaypoints) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "itinerary_stops"
             ("id", "quotationId", "stopOrder", "locationName",
              "coordinates", "createdAt")
           VALUES (
             gen_random_uuid()::text,
             $1,
             $2,
             $3,
             ST_SetSRID(ST_MakePoint($4, $5), 4326),
             NOW()
           )`,
          quotationId,
          wp.index,
          wp.originalName || wp.name || null,
          wp.lng,
          wp.lat,
        );
      }

      // Also update the quotation's estimatedDistance / estimatedDuration
      // so pricing suggestions have accurate OSRM data
      const distanceKm = (distanceMeters / 1000).toFixed(1);
      const durationHrs = (durationSeconds / 3600).toFixed(1);
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          estimatedDistance: `${distanceKm} km`,
          estimatedDuration: `${durationHrs} hrs`,
        },
      });
    });

    persisted = true;
  }

  // ------------------------------------------------------------------
  // 5. Return the result to the controller
  // ------------------------------------------------------------------
  return {
    optimizedWaypoints,
    distanceMeters,
    durationSeconds,
    geometry,
    persisted,
    quotationId,
  };
};
