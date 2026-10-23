/**
 * Customer trip plans: creation and validation, listing and filters, the
 * active-trip picker, per-customer access control, editing rules, cancellation
 * and the status helpers the quotation flow relies on.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import * as tripService from "../src/modules/trip/trip.service";

const API_BASE = "/api/v1";
const PREFIX = "trip.api";
const PLATE = "TRIP-API-1";
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

type TripStatus =
  | "PLANNING"
  | "AWAITING_QUOTES"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

describe("Trips API", () => {
  const users = { customer: "", other: "", owner: "" };
  const tokens = { customer: "", other: "", owner: "" };
  let vehicleId = "";
  let codeSeq = 0;

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: PLATE } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  const seedTrip = (
    customerId: string,
    overrides: {
      status?: TripStatus;
      startDate?: string;
      endDate?: string;
    } = {},
  ) =>
    prisma.trip.create({
      data: {
        tripCode: `TRP-API-${Date.now()}-${++codeSeq}`,
        customerId,
        pickupLocation: "Colombo",
        passengerCount: 20,
        startDate: new Date(overrides.startDate ?? inDays(10)),
        endDate: new Date(overrides.endDate ?? inDays(11)),
        status: overrides.status ?? "PLANNING",
      },
    });

  const as = (role: keyof typeof tokens) => ({
    get: (path: string) =>
      request(app)
        .get(`${API_BASE}/trips${path}`)
        .set("Authorization", `Bearer ${tokens[role]}`),
    post: (path: string, body: object) =>
      request(app)
        .post(`${API_BASE}/trips${path}`)
        .set("Authorization", `Bearer ${tokens[role]}`)
        .send(body),
    patch: (path: string, body: object = {}) =>
      request(app)
        .patch(`${API_BASE}/trips${path}`)
        .set("Authorization", `Bearer ${tokens[role]}`)
        .send(body),
  });

  beforeAll(async () => {
    await cleanup();
    const roles = {
      customer: "CUSTOMER",
      other: "CUSTOMER",
      owner: "VEHICLE_OWNER",
    } as const;
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: "Trip",
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
          name: "Trip API Bus",
          type: "SEMI_LUXURY",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: PLATE,
          seats: 40,
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

  afterAll(cleanup);

  describe("POST /trips", () => {
    it("rejects an unauthenticated request", async () => {
      const response = await request(app)
        .post(`${API_BASE}/trips`)
        .send({ pickupLocation: "Colombo", startDate: inDays(5), passengerCount: 10 });

      expect(response.status).toBe(401);
    });

    it("creates a single-day trip from a plain address with sensible defaults", async () => {
      const startDate = inDays(5);
      const response = await as("customer").post("", {
        pickupLocation: "  Galle Fort, Galle  ",
        startDate,
        passengerCount: 12,
      });

      expect(response.status).toBe(201);
      const { trip } = response.body.data;
      expect(trip.tripCode).toMatch(new RegExp(`^TRP-${new Date().getFullYear()}-\\d{3}$`));
      expect(trip).toMatchObject({
        customerId: users.customer,
        title: null,
        pickupLocation: "Galle Fort, Galle",
        pickupCity: "Galle Fort",
        pickupDistrict: null,
        pickupLatitude: null,
        dropoffLocation: null,
        dropoffCity: null,
        passengerCount: 12,
        isRoundTrip: false,
        needsAC: true,
        vehicleTypePreference: null,
        startTime: null,
        specialRequests: null,
        estimatedDistance: null,
        status: "PLANNING",
      });
      expect(trip.endDate).toBe(trip.startDate);
      const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
      expect(stored?.customerId).toBe(users.customer);
    });

    it("stores structured locations, stops, itinerary and preferences", async () => {
      const response = await as("customer").post("", {
        title: "  Hill country tour  ",
        pickupLocation: {
          address: "1 Galle Rd",
          city: " Colombo ",
          district: " Colombo ",
          lat: 6.9271,
          lng: 79.8612,
        },
        dropoffLocation: { city: "Kandy", lat: 7.2906, lng: 80.6337 },
        intermediateStops: [{ id: "s1", location: { city: "Kegalle" } }],
        startDate: inDays(6),
        endDate: inDays(8),
        startTime: "07:30",
        isRoundTrip: true,
        passengerCount: 30,
        vehicleTypePreference: "LUXURY_AC",
        needsAC: false,
        specialRequests: "  Extra luggage space  ",
        estimatedDistance: "120 km",
        estimatedDuration: "3 hrs",
        itineraryStops: [{ order: 0, locationName: "Colombo" }],
        itineraryRoute: { distanceKm: 120 },
      });

      expect(response.status).toBe(201);
      expect(response.body.data.trip).toMatchObject({
        title: "Hill country tour",
        pickupLocation: "1 Galle Rd,  Colombo ,  Colombo ",
        pickupCity: "Colombo",
        pickupDistrict: "Colombo",
        pickupLatitude: 6.9271,
        pickupLongitude: 79.8612,
        dropoffLocation: "Kandy",
        dropoffCity: "Kandy",
        dropoffDistrict: null,
        dropoffLatitude: 7.2906,
        startTime: "07:30",
        isRoundTrip: true,
        vehicleTypePreference: "LUXURY_AC",
        needsAC: false,
        specialRequests: "Extra luggage space",
        estimatedDistance: "120 km",
        estimatedDuration: "3 hrs",
        itineraryStops: [{ order: 0, locationName: "Colombo" }],
        itineraryRoute: { distanceKm: 120 },
        intermediateStops: [{ id: "s1", location: { city: "Kegalle" } }],
      });
    });

    it("accepts a lower-case vehicle type and a numeric-string passenger count", async () => {
      const response = await as("customer").post("", {
        pickupLocation: "Colombo",
        startDate: inDays(5),
        passengerCount: "12",
        vehicleTypePreference: "luxury_ac",
      });

      expect(response.status).toBe(201);
      expect(response.body.data.trip).toMatchObject({
        passengerCount: 12,
        vehicleTypePreference: "LUXURY_AC",
      });
    });

    it("rejects a pickup location with no address, city or district", async () => {
      const response = await as("customer").post("", {
        pickupLocation: { lat: 6.9, lng: 79.8 },
        startDate: inDays(5),
        passengerCount: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe("Pickup location is required");
    });

    it("rejects a start date in the past", async () => {
      const response = await as("customer").post("", {
        pickupLocation: "Colombo",
        startDate: inDays(-3),
        passengerCount: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/today or in the future/);
    });

    it.each([
      ["an end date before the start date", { endDate: inDays(2) }],
      ["an unparseable start date", { startDate: "not-a-date" }],
      ["zero passengers", { passengerCount: 0 }],
      ["more than 100 passengers", { passengerCount: 101 }],
      ["an empty pickup string", { pickupLocation: "   " }],
      ["an unknown vehicle type", { vehicleTypePreference: "DOUBLE_DECKER" }],
      ["more than 10 stops", { intermediateStops: Array.from({ length: 11 }, () => ({ location: {} })) }],
    ])("rejects %s", async (_label, override) => {
      const response = await as("customer").post("", {
        pickupLocation: "Colombo",
        startDate: inDays(5),
        passengerCount: 10,
        ...override,
      });

      expect(response.status).toBe(422);
    });

    it("rejects a request with no start date", async () => {
      const response = await as("customer").post("", {
        pickupLocation: "Colombo",
        passengerCount: 10,
      });

      expect(response.status).toBe(422);
    });

    it("rejects unparseable dates when called directly", async () => {
      await expect(
        tripService.createTrip(users.customer, {
          pickupLocation: "Colombo",
          startDate: "garbage",
          passengerCount: 5,
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: "Invalid start date" });
      await expect(
        tripService.createTrip(users.customer, {
          pickupLocation: "Colombo",
          startDate: inDays(3),
          endDate: "garbage",
          passengerCount: 5,
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: "Invalid end date" });
      await expect(
        tripService.createTrip(users.customer, {
          pickupLocation: "Colombo",
          startDate: inDays(3),
          endDate: inDays(2),
          passengerCount: 5,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "End date cannot be before start date",
      });
    });

    it("rejects an empty pickup string when called directly", async () => {
      await expect(
        tripService.createTrip(users.customer, {
          pickupLocation: "",
          startDate: inDays(3),
          passengerCount: 5,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("numbers trip codes sequentially within the year", async () => {
      const first = await as("other").post("", {
        pickupLocation: "Jaffna",
        startDate: inDays(4),
        passengerCount: 8,
      });
      const second = await as("other").post("", {
        pickupLocation: "Jaffna",
        startDate: inDays(4),
        passengerCount: 8,
      });

      const seq = (code: string) => Number(code.split("-")[2]);
      expect(seq(second.body.data.trip.tripCode)).toBe(
        seq(first.body.data.trip.tripCode) + 1,
      );
    });
  });

  describe("GET /trips", () => {
    let listCustomer = "";
    let listToken = "";

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.lister@example.com`,
          password: "hashed",
          firstName: "Trip",
          lastName: "Lister",
          role: "CUSTOMER",
          status: "ACTIVE",
        },
      });
      listCustomer = user.id;
      listToken = jwt.sign(
        { id: user.id, email: user.email, role: "CUSTOMER" },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
      await seedTrip(listCustomer, { status: "PLANNING" });
      await seedTrip(listCustomer, { status: "AWAITING_QUOTES" });
      await seedTrip(listCustomer, { status: "CONFIRMED" });
      await seedTrip(listCustomer, { status: "CANCELLED" });
      await seedTrip(users.other, { status: "PLANNING" });
    });

    const list = (query = "") =>
      request(app)
        .get(`${API_BASE}/trips${query}`)
        .set("Authorization", `Bearer ${listToken}`);

    it("lists only the caller's trips with pagination and quotation counts", async () => {
      const response = await list();

      expect(response.status).toBe(200);
      const { trips, pagination } = response.body.data;
      expect(trips).toHaveLength(4);
      expect(trips.every((t: { customerId: string }) => t.customerId === listCustomer)).toBe(true);
      expect(trips[0]._count).toEqual({ quotations: 0 });
      expect(trips[0].quotations).toEqual([]);
      expect(pagination).toEqual({ page: 1, limit: 20, total: 4, totalPages: 1 });
    });

    it("filters by status", async () => {
      const response = await list("?status=CONFIRMED");

      expect(response.status).toBe(200);
      expect(response.body.data.trips.map((t: { status: string }) => t.status)).toEqual([
        "CONFIRMED",
      ]);
    });

    it("limits to open trips when activeOnly is set", async () => {
      const response = await list("?activeOnly=true");

      const statuses = response.body.data.trips.map((t: { status: string }) => t.status).sort();
      expect(statuses).toEqual(["AWAITING_QUOTES", "PLANNING"]);
    });

    it("returns every trip when activeOnly is false", async () => {
      const response = await list("?activeOnly=false");

      expect(response.body.data.pagination.total).toBe(4);
    });

    it("pages results", async () => {
      const response = await list("?page=2&limit=3");

      expect(response.status).toBe(200);
      expect(response.body.data.trips).toHaveLength(1);
      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 3,
        total: 4,
        totalPages: 2,
      });
    });

    it.each([
      ["an unknown status", "?status=LOST"],
      ["a zero page", "?page=0"],
      ["a limit over 50", "?limit=51"],
      ["a non-boolean activeOnly", "?activeOnly=maybe"],
    ])("rejects %s", async (_label, query) => {
      const response = await list(query);

      expect(response.status).toBe(422);
    });

    it("accepts a lower-case status filter", async () => {
      const response = await list("?status=planning");

      expect(response.status).toBe(200);
      for (const trip of response.body.data.trips) {
        expect(trip.status).toBe("PLANNING");
      }
    });
  });

  describe("GET /trips/active", () => {
    it("returns only the caller's open, not-yet-ended trips", async () => {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.active@example.com`,
          password: "hashed",
          firstName: "Trip",
          lastName: "Active",
          role: "CUSTOMER",
          status: "ACTIVE",
        },
      });
      const token = jwt.sign(
        { id: user.id, email: user.email, role: "CUSTOMER" },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
      const open = await seedTrip(user.id, { status: "PLANNING", startDate: inDays(9), endDate: inDays(9) });
      const awaiting = await seedTrip(user.id, { status: "AWAITING_QUOTES", startDate: inDays(3), endDate: inDays(4) });
      await seedTrip(user.id, { status: "CONFIRMED" });
      await seedTrip(user.id, { status: "PLANNING", startDate: inDays(-5), endDate: inDays(-4) });
      await seedTrip(users.other, { status: "PLANNING" });

      const response = await request(app)
        .get(`${API_BASE}/trips/active`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.trips.map((t: { id: string }) => t.id)).toEqual([
        awaiting.id,
        open.id,
      ]);
    });
  });

  describe("GET /trips/:id", () => {
    it("returns the trip with its quotations and vehicle details", async () => {
      const trip = await seedTrip(users.customer);
      await prisma.quotation.create({
        data: {
          quotationId: `QUO-TRIP-API-${Date.now()}`,
          customerId: users.customer,
          tripId: trip.id,
          vehicleId,
          startDate: trip.startDate,
          endDate: trip.endDate,
          pickupLocation: "Colombo",
        },
      });

      const response = await as("customer").get(`/${trip.id}`);

      expect(response.status).toBe(200);
      const body = response.body.data.trip;
      expect(body.id).toBe(trip.id);
      expect(body.quotations).toHaveLength(1);
      expect(body.quotations[0].vehicle).toMatchObject({
        id: vehicleId,
        licensePlate: PLATE,
        owner: { id: users.owner },
      });
    });

    it("refuses another customer", async () => {
      const trip = await seedTrip(users.customer);

      const response = await as("other").get(`/${trip.id}`);

      expect(response.status).toBe(403);
    });

    it("refuses a vehicle owner", async () => {
      const trip = await seedTrip(users.customer);

      const response = await as("owner").get(`/${trip.id}`);

      expect(response.status).toBe(403);
    });

    it("returns 404 for an unknown trip", async () => {
      const response = await as("customer").get("/does-not-exist");

      expect(response.status).toBe(404);
    });

    it("expires an open trip whose end date has passed", async () => {
      const trip = await seedTrip(users.customer, {
        status: "AWAITING_QUOTES",
        startDate: inDays(-4),
        endDate: inDays(-2),
      });

      const response = await as("customer").get(`/${trip.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.trip.status).toBe("EXPIRED");
      const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
      expect(stored?.status).toBe("EXPIRED");
    });

    it("expires a past PLANNING trip too", async () => {
      const trip = await seedTrip(users.customer, {
        startDate: inDays(-4),
        endDate: inDays(-2),
      });

      const response = await as("customer").get(`/${trip.id}`);

      expect(response.body.data.trip.status).toBe("EXPIRED");
    });

    it("leaves a past confirmed trip untouched", async () => {
      const trip = await seedTrip(users.customer, {
        status: "CONFIRMED",
        startDate: inDays(-4),
        endDate: inDays(-2),
      });

      const response = await as("customer").get(`/${trip.id}`);

      expect(response.body.data.trip.status).toBe("CONFIRMED");
      const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
      expect(stored?.status).toBe("CONFIRMED");
    });
  });

  describe("PATCH /trips/:id", () => {
    it("updates every editable field and returns the trip with quotations", async () => {
      const trip = await seedTrip(users.customer, { status: "AWAITING_QUOTES" });
      const startDate = inDays(20);
      const endDate = inDays(22);

      const response = await as("customer").patch(`/${trip.id}`, {
        title: "Updated",
        pickupLocation: { address: "Temple Rd", city: "Kandy", lat: 7.29, lng: 80.63 },
        dropoffLocation: "Nuwara Eliya, Central",
        intermediateStops: [{ location: { city: "Peradeniya" } }],
        startDate,
        endDate,
        startTime: "06:00",
        isRoundTrip: true,
        passengerCount: 25,
        vehicleTypePreference: "ORDINARY",
        needsAC: false,
        specialRequests: "Child seats",
        estimatedDistance: "80 km",
        estimatedDuration: "2 hrs",
        itineraryStops: [{ order: 1 }],
        itineraryRoute: { distanceKm: 80 },
      });

      expect(response.status).toBe(200);
      expect(response.body.data.trip).toMatchObject({
        title: "Updated",
        pickupLocation: "Temple Rd, Kandy",
        pickupCity: "Kandy",
        pickupLatitude: 7.29,
        dropoffLocation: "Nuwara Eliya, Central",
        dropoffCity: "Nuwara Eliya",
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        startTime: "06:00",
        isRoundTrip: true,
        passengerCount: 25,
        vehicleTypePreference: "ORDINARY",
        needsAC: false,
        specialRequests: "Child seats",
        estimatedDistance: "80 km",
        estimatedDuration: "2 hrs",
        itineraryStops: [{ order: 1 }],
        itineraryRoute: { distanceKm: 80 },
        intermediateStops: [{ location: { city: "Peradeniya" } }],
        quotations: [],
      });
    });

    it("clears optional text fields when given empty values", async () => {
      const trip = await prisma.trip.update({
        where: { id: (await seedTrip(users.customer)).id },
        data: {
          title: "Old",
          dropoffLocation: "Kandy",
          dropoffCity: "Kandy",
          startTime: "08:00",
          specialRequests: "Old",
          estimatedDistance: "1 km",
          estimatedDuration: "1 hr",
        },
      });

      const response = await as("customer").patch(`/${trip.id}`, {
        title: "",
        dropoffLocation: {},
        startTime: "",
        specialRequests: "   ",
        estimatedDistance: "",
        estimatedDuration: "",
      });

      expect(response.status).toBe(200);
      expect(response.body.data.trip).toMatchObject({
        title: null,
        dropoffLocation: null,
        dropoffCity: null,
        startTime: null,
        specialRequests: null,
        estimatedDistance: null,
        estimatedDuration: null,
      });
    });

    it("keeps the existing start date when only the end date changes", async () => {
      const trip = await seedTrip(users.customer, { startDate: inDays(10), endDate: inDays(10) });
      const endDate = inDays(13);

      const response = await as("customer").patch(`/${trip.id}`, { endDate });

      expect(response.status).toBe(200);
      expect(response.body.data.trip.startDate).toBe(trip.startDate.toISOString());
      expect(response.body.data.trip.endDate).toBe(new Date(endDate).toISOString());
    });

    it("keeps a multi-day trip's end date when only the start date moves", async () => {
      const trip = await seedTrip(users.customer, { startDate: inDays(10), endDate: inDays(14) });
      const startDate = inDays(12);

      const response = await as("customer").patch(`/${trip.id}`, { startDate });

      expect(response.status).toBe(200);
      expect(response.body.data.trip.startDate).toBe(new Date(startDate).toISOString());
      expect(response.body.data.trip.endDate).toBe(trip.endDate.toISOString());
    });

    it("moves a single-day trip's end date along with its start date", async () => {
      const trip = await seedTrip(users.customer, { startDate: inDays(10), endDate: inDays(10) });
      const startDate = inDays(12);

      const response = await as("customer").patch(`/${trip.id}`, { startDate });

      expect(response.status).toBe(200);
      expect(response.body.data.trip.endDate).toBe(new Date(startDate).toISOString());
    });

    it("rejects an end date before the stored start date", async () => {
      const trip = await seedTrip(users.customer, { startDate: inDays(10), endDate: inDays(11) });

      const response = await as("customer").patch(`/${trip.id}`, { endDate: inDays(8) });

      expect(response.status).toBe(400);
      const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
      expect(stored?.endDate.toISOString()).toBe(trip.endDate.toISOString());
    });

    it("rejects moving the start date into the past", async () => {
      const trip = await seedTrip(users.customer);

      const response = await as("customer").patch(`/${trip.id}`, { startDate: inDays(-2) });

      expect(response.status).toBe(400);
    });

    it("rejects an empty pickup location", async () => {
      const trip = await seedTrip(users.customer);

      const response = await as("customer").patch(`/${trip.id}`, {
        pickupLocation: { lat: 7, lng: 80 },
      });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe("Pickup location cannot be empty");
    });

    it.each([
      ["an end date before the start date", { startDate: inDays(9), endDate: inDays(8) }],
      ["a passenger count over 100", { passengerCount: 500 }],
      ["an overlong title", { title: "x".repeat(121) }],
    ])("rejects %s", async (_label, body) => {
      const trip = await seedTrip(users.customer);

      const response = await as("customer").patch(`/${trip.id}`, body);

      expect(response.status).toBe(422);
    });

    it("refuses another customer and leaves the trip unchanged", async () => {
      const trip = await seedTrip(users.customer);

      const response = await as("other").patch(`/${trip.id}`, { passengerCount: 2 });

      expect(response.status).toBe(403);
      const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
      expect(stored?.passengerCount).toBe(20);
    });

    it("returns 404 for an unknown trip", async () => {
      const response = await as("customer").patch("/does-not-exist", { passengerCount: 2 });

      expect(response.status).toBe(404);
    });

    it.each(["CONFIRMED", "COMPLETED", "CANCELLED", "EXPIRED"] as const)(
      "refuses to edit a %s trip",
      async (status) => {
        const trip = await seedTrip(users.customer, { status });

        const response = await as("customer").patch(`/${trip.id}`, { passengerCount: 2 });

        expect(response.status).toBe(400);
      },
    );
  });

  describe("PATCH /trips/:id/cancel", () => {
    it.each(["PLANNING", "AWAITING_QUOTES"] as const)(
      "cancels a %s trip",
      async (status) => {
        const trip = await seedTrip(users.customer, { status });

        const response = await as("customer").patch(`/${trip.id}/cancel`);

        expect(response.status).toBe(200);
        expect(response.body.data.trip.status).toBe("CANCELLED");
        const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
        expect(stored?.status).toBe("CANCELLED");
      },
    );

    it("refuses to cancel a trip with a confirmed booking", async () => {
      const trip = await seedTrip(users.customer, { status: "CONFIRMED" });

      const response = await as("customer").patch(`/${trip.id}/cancel`);

      expect(response.status).toBe(400);
      const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
      expect(stored?.status).toBe("CONFIRMED");
    });

    it.each(["CANCELLED", "COMPLETED", "EXPIRED"] as const)(
      "leaves an already %s trip as it is",
      async (status) => {
        const trip = await seedTrip(users.customer, { status });

        const response = await as("customer").patch(`/${trip.id}/cancel`);

        expect(response.status).toBe(200);
        expect(response.body.data.trip.status).toBe(status);
      },
    );

    it("refuses another customer", async () => {
      const trip = await seedTrip(users.customer);

      const response = await as("other").patch(`/${trip.id}/cancel`);

      expect(response.status).toBe(403);
      const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
      expect(stored?.status).toBe("PLANNING");
    });

    it("returns 404 for an unknown trip", async () => {
      const response = await as("customer").patch("/does-not-exist/cancel");

      expect(response.status).toBe(404);
    });
  });

  describe("quotation-flow status helpers", () => {
    it("moves a PLANNING trip to AWAITING_QUOTES", async () => {
      const trip = await seedTrip(users.customer);

      const updated = await tripService.markTripAwaitingQuotes(trip.id);

      expect(updated?.status).toBe("AWAITING_QUOTES");
    });

    it("leaves a trip that is past PLANNING unchanged", async () => {
      const trip = await seedTrip(users.customer, { status: "CONFIRMED" });

      const updated = await tripService.markTripAwaitingQuotes(trip.id);

      expect(updated?.status).toBe("CONFIRMED");
    });

    it("returns null for an unknown trip", async () => {
      expect(await tripService.markTripAwaitingQuotes("does-not-exist")).toBeNull();
    });

    it("confirms a trip", async () => {
      const trip = await seedTrip(users.customer, { status: "AWAITING_QUOTES" });

      const updated = await tripService.markTripConfirmed(trip.id);

      expect(updated.status).toBe("CONFIRMED");
    });
  });
});
