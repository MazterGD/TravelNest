import { PrismaClient } from "@prisma/client";

/**
 * Backfill OSRM route geometry for quotations/trips that were seeded while the
 * OSRM container was unreachable. The detail-page maps (customer + owner) render
 * from STORED geometry in `itinerary_routes` / `itinerary_stops` and
 * `trips.itineraryRoute` — not from live OSRM calls — so an empty geometry table
 * means blank maps even when the container is up.
 *
 * This is idempotent: it deletes any pre-existing route/stops for a quotation
 * before re-inserting, so it can be run repeatedly. It does NOT touch any other
 * seeded data.
 *
 * Prereq: the OSRM Sri Lanka container must be running (default host port 5001).
 * Run: pnpm --filter @travenest/database backfill:osrm-routes
 */

const prisma = new PrismaClient();
const prismaAny = prisma as any;

// Mirrors the seed gazetteer so backfilled routes match the seeded itineraries.
const LOCATIONS: Record<string, { latitude: number; longitude: number }> = {
  Colombo: { latitude: 6.9271, longitude: 79.8612 },
  Kandy: { latitude: 7.2906, longitude: 80.6337 },
  Galle: { latitude: 6.0535, longitude: 80.221 },
  Jaffna: { latitude: 9.6615, longitude: 80.0255 },
  Negombo: { latitude: 7.2008, longitude: 79.8737 },
  Anuradhapura: { latitude: 8.3114, longitude: 80.4037 },
  Matara: { latitude: 5.9549, longitude: 80.555 },
  Kurunegala: { latitude: 7.4863, longitude: 80.3647 },
  Batticaloa: { latitude: 7.7102, longitude: 81.6924 },
  Trincomalee: { latitude: 8.5874, longitude: 81.2152 },
  Yala: { latitude: 6.3719, longitude: 81.5117 },
  // Additional towns referenced by seeded quotations but absent from the seed
  // gazetteer (so those routes were previously skipped).
  Ella: { latitude: 6.8667, longitude: 81.0466 },
  Sigiriya: { latitude: 7.957, longitude: 80.7603 },
  Bentota: { latitude: 6.4258, longitude: 79.9959 },
  Mirissa: { latitude: 5.9483, longitude: 80.4716 },
  Wellawatte: { latitude: 6.878, longitude: 79.8608 },
  "Arugam Bay": { latitude: 6.84, longitude: 81.8367 },
};

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "http://127.0.0.1:5001";

const extractCity = (locStr: string) => {
  if (!locStr) return null;
  for (const city of Object.keys(LOCATIONS)) {
    if (locStr.includes(city)) return LOCATIONS[city];
  }
  return null;
};

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { type: "LineString"; coordinates: [number, number][] };
  }>;
}

const preflightOsrm = async (): Promise<void> => {
  // Colombo → Kandy; a route here proves the engine has the SL extract loaded.
  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `79.8612,6.9271;80.6337,7.2906?overview=false`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as OsrmRouteResponse;
    if (data.code !== "Ok") {
      throw new Error(`OSRM responded with code "${data.code}"`);
    }
  } catch (err) {
    throw new Error(
      `OSRM is not reachable at ${OSRM_BASE_URL}. Start the Sri Lanka container ` +
        `(it should publish host port 5001) before running this backfill. ` +
        `Underlying error: ${(err as Error).message}`,
    );
  }
};

const main = async () => {
  console.log(`Backfilling OSRM routes via ${OSRM_BASE_URL} ...\n`);
  await preflightOsrm();

  const quotations = await prisma.quotation.findMany();
  console.log(`Found ${quotations.length} quotation(s) to evaluate.\n`);

  let routed = 0;
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const q of quotations) {
    const start = extractCity(q.pickupLocation);
    const end = extractCity(q.dropoffLocation || "");
    if (!start || !end) {
      skipped.push(
        `${q.id} — unmatched location "${q.pickupLocation}" → "${q.dropoffLocation}"`,
      );
      continue;
    }

    // Pull the linked trip's intermediate stops so the route passes through them.
    const midStops: Array<{ lat: number; lng: number; name: string }> = [];
    if (q.tripId) {
      const linkedTrip = await prismaAny.trip.findUnique({
        where: { id: q.tripId },
        select: { intermediateStops: true },
      });
      if (linkedTrip && Array.isArray(linkedTrip.intermediateStops)) {
        for (const s of linkedTrip.intermediateStops as any[]) {
          const lat = s?.location?.lat;
          const lng = s?.location?.lng;
          if (typeof lat === "number" && typeof lng === "number") {
            midStops.push({
              lat,
              lng,
              name: s?.location?.city || s?.location?.address || "",
            });
          }
        }
      }
    }

    const orderedStops: Array<{ lat: number; lng: number; name: string }> = [
      { lat: start.latitude, lng: start.longitude, name: q.pickupLocation },
      ...midStops,
      { lat: end.latitude, lng: end.longitude, name: q.dropoffLocation || "" },
    ];

    try {
      // Route service (not Trip/TSP) so the pickup→stops→dropoff order is kept.
      const coordStr = orderedStops.map((s) => `${s.lng},${s.lat}`).join(";");
      const url =
        `${OSRM_BASE_URL}/route/v1/driving/${coordStr}` +
        `?steps=true&geometries=geojson&overview=full&annotations=true`;
      const res = await fetch(url);
      const data = (await res.json()) as OsrmRouteResponse;

      if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
        failed.push(`${q.id} — OSRM code "${data.code}"`);
        continue;
      }

      const route = data.routes[0]!;
      const { distance: distanceMeters, duration: durationSeconds, geometry } =
        route;

      await prismaAny.$transaction(async (tx: any) => {
        // Idempotency: clear any prior geometry for this quotation first.
        await tx.$executeRawUnsafe(
          `DELETE FROM "itinerary_routes" WHERE "quotationId" = $1`,
          q.id,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM "itinerary_stops" WHERE "quotationId" = $1`,
          q.id,
        );

        await tx.$executeRawUnsafe(
          `INSERT INTO "itinerary_routes"
             ("id", "quotationId", "waypoints", "routeGeometry",
              "distanceMeters", "durationSeconds", "createdAt")
           VALUES (
             gen_random_uuid()::text, $1,
             ST_GeomFromGeoJSON($2), ST_GeomFromGeoJSON($3),
             $4, $5, NOW()
           )`,
          q.id,
          JSON.stringify({
            type: "LineString",
            coordinates: orderedStops.map((s) => [s.lng, s.lat]),
          }),
          JSON.stringify(geometry),
          distanceMeters,
          durationSeconds,
        );

        for (let i = 0; i < orderedStops.length; i++) {
          const s = orderedStops[i]!;
          await tx.$executeRawUnsafe(
            `INSERT INTO "itinerary_stops"
               ("id", "quotationId", "stopOrder", "locationName", "coordinates", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), NOW())`,
            q.id,
            i,
            s.name,
            s.lng,
            s.lat,
          );
        }

        // Mirror geometry onto the linked trip so trip/quotation/booking maps that
        // read the JSON snapshot render the line from stored data.
        if (q.tripId) {
          await tx.trip.update({
            where: { id: q.tripId },
            data: { itineraryRoute: geometry },
          });
        }

        await tx.quotation.update({
          where: { id: q.id },
          data: {
            estimatedDistance: `${(distanceMeters / 1000).toFixed(1)} km`,
            estimatedDuration: `${(durationSeconds / 3600).toFixed(1)} hours`,
          },
        });
      });

      routed += 1;
    } catch (err) {
      failed.push(`${q.id} — ${(err as Error).message}`);
    }
  }

  // Refresh booking distance/duration display values too (cosmetic, point-to-point).
  const bookings = await prisma.booking.findMany();
  for (const b of bookings) {
    const start = extractCity(b.pickupLocation);
    const end = extractCity(b.dropoffLocation || "");
    if (!start || !end) continue;
    try {
      const url =
        `${OSRM_BASE_URL}/route/v1/driving/` +
        `${start.longitude},${start.latitude};${end.longitude},${end.latitude}` +
        `?overview=false`;
      const res = await fetch(url);
      const data = (await res.json()) as OsrmRouteResponse;
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const r = data.routes[0]!;
        await prisma.booking.update({
          where: { id: b.id },
          data: {
            estimatedDistance: `${(r.distance / 1000).toFixed(1)} km`,
            estimatedDuration: `${(r.duration / 3600).toFixed(1)} hours`,
          },
        });
      }
    } catch {
      // booking distance is cosmetic; ignore individual failures
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Routes written:   ${routed}`);
  console.log(`Skipped (no city match): ${skipped.length}`);
  console.log(`Failed:           ${failed.length}`);
  if (skipped.length > 0) {
    console.log("\nSkipped:");
    skipped.forEach((s) => console.log(`  • ${s}`));
  }
  if (failed.length > 0) {
    console.log("\nFailed:");
    failed.forEach((f) => console.log(`  • ${f}`));
  }
  console.log("=".repeat(50));
};

main()
  .catch((error) => {
    console.error("\nBackfill failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
