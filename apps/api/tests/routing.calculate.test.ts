/**
 * OSRM route calculation: request validation, the OSRM call and its failure
 * modes, response shaping, and PostGIS persistence of a quotation's route by
 * its parties only. OSRM is never contacted; axios.get is stubbed.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import axios, { AxiosError } from "axios";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { calculateRoute } from "../src/modules/routing/routing.service";

const API_BASE = "/api/v1";
const PREFIX = "routing.calc";
const PLATE = "ROUTE-CALC-1";
const DAY = 24 * 60 * 60 * 1000;
const WAYPOINTS = [
  { lat: 6.9271, lng: 79.8612, name: "Colombo" },
  { lat: 7.2906, lng: 80.6337, name: "Kandy" },
  { lat: 6.0535, lng: 80.221 },
];
const GEOMETRY = {
  type: "LineString" as const,
  coordinates: [
    [79.8612, 6.9271],
    [80.6337, 7.2906],
    [80.221, 6.0535],
  ],
};

const osrmOk = (overrides: Record<string, unknown> = {}) => ({
  data: {
    code: "Ok",
    waypoints: [
      { waypoint_index: 0, trips_index: 0, location: [79.8612, 6.9271], name: "Galle Road", distance: 1 },
      { waypoint_index: 1, trips_index: 0, location: [80.6337, 7.2906], name: "", distance: 1 },
      { waypoint_index: 2, trips_index: 0, location: [80.221, 6.0535], name: "", distance: 1 },
    ],
    trips: [{ geometry: GEOMETRY, legs: [], distance: 245_678, duration: 15_300 }],
    ...overrides,
  },
});

describe("POST /routing/calculate", () => {
  const users = { customer: "", stranger: "", owner: "", otherOwner: "", admin: "" };
  const tokens = { ...users };
  let vehicleId = "";
  let quoteSeq = 0;
  const getSpy = vi.spyOn(axios, "get");

  const roles = {
    customer: "CUSTOMER",
    stranger: "CUSTOMER",
    owner: "VEHICLE_OWNER",
    otherOwner: "VEHICLE_OWNER",
    admin: "ADMIN",
  } as const;

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: PLATE } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  const makeQuote = async (
    status: "PENDING" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" = "PENDING",
    withVehicle = true,
  ) =>
    (
      await prisma.quotation.create({
        data: {
          quotationId: `QUO-ROUTE-CALC-${Date.now()}-${++quoteSeq}`,
          customerId: users.customer,
          vehicleId: withVehicle ? vehicleId : null,
          startDate: new Date(Date.now() + 10 * DAY),
          endDate: new Date(Date.now() + 11 * DAY),
          pickupLocation: "Colombo",
          estimatedDistance: "1 km",
          status,
        },
      })
    ).id;

  const calculate = (role: keyof typeof tokens | null, body: object) => {
    const req = request(app).post(`${API_BASE}/routing/calculate`);
    return (role ? req.set("Authorization", `Bearer ${tokens[role]}`) : req).send(body);
  };

  const storedStops = (quotationId: string) =>
    prisma.$queryRawUnsafe<
      { stopOrder: number; locationName: string | null; lng: number; lat: number }[]
    >(
      `SELECT "stopOrder", "locationName", ST_X(coordinates) AS lng, ST_Y(coordinates) AS lat
         FROM "itinerary_stops" WHERE "quotationId" = $1 ORDER BY "stopOrder"`,
      quotationId,
    );

  const storedRoutes = (quotationId: string) =>
    prisma.$queryRawUnsafe<
      { distanceMeters: number; durationSeconds: number; points: number }[]
    >(
      `SELECT "distanceMeters", "durationSeconds", ST_NPoints("routeGeometry") AS points
         FROM "itinerary_routes" WHERE "quotationId" = $1`,
      quotationId,
    );

  beforeAll(async () => {
    await cleanup();
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: "Route",
          lastName: key,
          role: roles[key],
          status: "ACTIVE",
        },
      });
      users[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: roles[key] },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }
    vehicleId = (
      await prisma.vehicle.create({
        data: {
          ownerId: users.owner,
          name: "Route Calc Bus",
          type: "ORDINARY",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: PLATE,
          seats: 30,
          fuelType: "DIESEL",
          transmission: "MANUAL",
          pricePerDay: 15000,
          location: "Colombo",
          images: [],
          amenities: [],
        },
      })
    ).id;
  });

  afterEach(() => {
    getSpy.mockReset();
  });

  afterAll(async () => {
    getSpy.mockRestore();
    await cleanup();
  });

  describe("validation and access", () => {
    it("requires authentication", async () => {
      const response = await calculate(null, { waypoints: WAYPOINTS });

      expect(response.status).toBe(401);
      expect(getSpy).not.toHaveBeenCalled();
    });

    it.each([
      ["a single waypoint", { waypoints: WAYPOINTS.slice(0, 1) }],
      ["more than 25 waypoints", { waypoints: Array.from({ length: 26 }, () => WAYPOINTS[0]) }],
      ["a latitude outside Sri Lanka", { waypoints: [WAYPOINTS[0], { lat: 51.5, lng: 80 }] }],
      ["a longitude outside Sri Lanka", { waypoints: [WAYPOINTS[0], { lat: 7, lng: 0.1 }] }],
      ["an empty quotationId", { waypoints: WAYPOINTS, quotationId: "" }],
      ["a missing waypoints array", {}],
    ])("rejects %s", async (_label, body) => {
      const response = await calculate("customer", body);

      expect(response.status).toBe(422);
      expect(getSpy).not.toHaveBeenCalled();
    });
  });

  describe("without a quotation", () => {
    it("calls the OSRM trip service and shapes the route", async () => {
      getSpy.mockResolvedValueOnce(osrmOk());

      const response = await calculate("customer", { waypoints: WAYPOINTS });

      expect(response.status).toBe(200);
      const [url, options] = getSpy.mock.calls[0]!;
      expect(url).toBe(
        `${config.osrm.baseUrl}/trip/v1/driving/79.8612,6.9271;80.6337,7.2906;80.221,6.0535` +
          "?steps=true&geometries=geojson&overview=full&annotations=true",
      );
      expect(options).toEqual({ timeout: config.osrm.timeoutMs });
      expect(response.body.data).toEqual({
        route: {
          optimizedWaypoints: [
            { index: 0, lat: 6.9271, lng: 79.8612, name: "Galle Road", originalName: "Colombo" },
            { index: 1, lat: 7.2906, lng: 80.6337, name: "", originalName: "Kandy" },
            { index: 2, lat: 6.0535, lng: 80.221, name: "" },
          ],
          distanceMeters: 245_678,
          durationSeconds: 15_300,
          distanceKm: 245.7,
          durationMinutes: 255,
          geometry: GEOMETRY,
        },
        persisted: false,
      });
    });

    it("is open to vehicle owners and admins", async () => {
      getSpy.mockResolvedValue(osrmOk());

      expect((await calculate("owner", { waypoints: WAYPOINTS })).status).toBe(200);
      expect((await calculate("admin", { waypoints: WAYPOINTS })).status).toBe(200);
    });

    it.todo(
      "labels reordered stops with their own names (originalName is looked up by trip order, not input order, so a reordered trip mislabels stops)",
    );
  });

  describe("OSRM failures", () => {
    it("reports an unreachable OSRM container", async () => {
      getSpy.mockRejectedValueOnce(new AxiosError("connect refused", "ECONNREFUSED"));

      const response = await calculate("customer", { waypoints: WAYPOINTS });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toMatch(/routing service is unavailable/);
    });

    it("reports any other OSRM request failure", async () => {
      getSpy.mockRejectedValueOnce(new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED"));

      const response = await calculate("customer", { waypoints: WAYPOINTS });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe(
        "OSRM request failed: timeout of 15000ms exceeded",
      );
    });

    it("surfaces unexpected non-HTTP errors as a generic failure", async () => {
      getSpy.mockRejectedValueOnce(new TypeError("boom"));

      const response = await calculate("customer", { waypoints: WAYPOINTS });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe("An unexpected error occurred");
    });

    it("rejects an OSRM error code", async () => {
      getSpy.mockResolvedValueOnce({ data: { code: "NoTrips", waypoints: [], trips: [] } });

      const response = await calculate("customer", { waypoints: WAYPOINTS });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/NoTrips/);
    });

    it.each([
      ["an empty trips list", { trips: [] }],
      ["a missing trips list", { trips: undefined }],
    ])("rejects %s", async (_label, overrides) => {
      getSpy.mockResolvedValueOnce(osrmOk(overrides));

      const response = await calculate("customer", { waypoints: WAYPOINTS });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/could not find a valid trip/);
    });
  });

  describe("persisting a quotation's route", () => {
    it("stores the route and stops and updates the quotation estimates", async () => {
      const quotationId = await makeQuote();
      getSpy.mockResolvedValueOnce(osrmOk());

      const response = await calculate("customer", { waypoints: WAYPOINTS, quotationId });

      expect(response.status).toBe(200);
      expect(response.body.data.persisted).toBe(true);
      expect(response.body.data.quotationId).toBe(quotationId);
      const quote = await prisma.quotation.findUnique({ where: { id: quotationId } });
      expect(quote?.estimatedDistance).toBe("245.7 km");
      expect(quote?.estimatedDuration).toBe("4.3 hrs");
      expect(await storedRoutes(quotationId)).toEqual([
        { distanceMeters: 245_678, durationSeconds: 15_300, points: 3 },
      ]);
      expect(await storedStops(quotationId)).toEqual([
        { stopOrder: 0, locationName: "Colombo", lng: 79.8612, lat: 6.9271 },
        { stopOrder: 1, locationName: "Kandy", lng: 80.6337, lat: 7.2906 },
        { stopOrder: 2, locationName: null, lng: 80.221, lat: 6.0535 },
      ]);
    });

    it("replaces a previously stored route on recalculation", async () => {
      const quotationId = await makeQuote("SENT");
      getSpy.mockResolvedValueOnce(osrmOk());
      await calculate("customer", { waypoints: WAYPOINTS, quotationId });
      getSpy.mockResolvedValueOnce(
        osrmOk({
          waypoints: [
            { waypoint_index: 0, trips_index: 0, location: [79.8612, 6.9271], name: "A", distance: 0 },
            { waypoint_index: 1, trips_index: 0, location: [80.6337, 7.2906], name: "B", distance: 0 },
          ],
          trips: [{ geometry: GEOMETRY, legs: [], distance: 100_000, duration: 7_200 }],
        }),
      );

      const response = await calculate("customer", {
        waypoints: [{ lat: 6.9271, lng: 79.8612 }, { lat: 7.2906, lng: 80.6337 }],
        quotationId,
      });

      expect(response.status).toBe(200);
      expect(await storedRoutes(quotationId)).toHaveLength(1);
      expect((await storedStops(quotationId)).map((s) => s.locationName)).toEqual(["A", "B"]);
      const quote = await prisma.quotation.findUnique({ where: { id: quotationId } });
      expect(quote?.estimatedDistance).toBe("100.0 km");
      expect(quote?.estimatedDuration).toBe("2.0 hrs");
    });

    it("lets the quoted vehicle's owner store the route", async () => {
      const quotationId = await makeQuote("VIEWED");
      getSpy.mockResolvedValueOnce(osrmOk());

      const response = await calculate("owner", { waypoints: WAYPOINTS, quotationId });

      expect(response.status).toBe(200);
      expect(await storedRoutes(quotationId)).toHaveLength(1);
    });

    it("lets an admin store the route", async () => {
      const quotationId = await makeQuote();
      getSpy.mockResolvedValueOnce(osrmOk());

      const response = await calculate("admin", { waypoints: WAYPOINTS, quotationId });

      expect(response.status).toBe(200);
      expect(response.body.data.persisted).toBe(true);
    });

    it.each(["stranger", "otherOwner"] as const)(
      "refuses a %s who is not party to the quotation",
      async (role) => {
        const quotationId = await makeQuote();

        const response = await calculate(role, { waypoints: WAYPOINTS, quotationId });

        expect(response.status).toBe(403);
        expect(getSpy).not.toHaveBeenCalled();
        expect(await storedRoutes(quotationId)).toHaveLength(0);
        const quote = await prisma.quotation.findUnique({ where: { id: quotationId } });
        expect(quote?.estimatedDistance).toBe("1 km");
      },
    );

    it("refuses an owner when the quotation has no vehicle yet", async () => {
      const quotationId = await makeQuote("PENDING", false);

      const response = await calculate("otherOwner", { waypoints: WAYPOINTS, quotationId });

      expect(response.status).toBe(403);
    });

    it.each(["ACCEPTED", "REJECTED"] as const)(
      "freezes the route of a %s quotation",
      async (status) => {
        const quotationId = await makeQuote(status);

        const response = await calculate("customer", { waypoints: WAYPOINTS, quotationId });

        expect(response.status).toBe(400);
        expect(getSpy).not.toHaveBeenCalled();
      },
    );

    it("returns 404 for an unknown quotation", async () => {
      const response = await calculate("customer", {
        waypoints: WAYPOINTS,
        quotationId: "does-not-exist",
      });

      expect(response.status).toBe(404);
    });

    it("refuses an anonymous caller at the service layer", async () => {
      const quotationId = await makeQuote();

      await expect(
        calculateRoute({ waypoints: WAYPOINTS, quotationId }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
