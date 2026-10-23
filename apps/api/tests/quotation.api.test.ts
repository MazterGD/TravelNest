/**
 * Quotation requests from customers, the customer/owner/admin lists and the
 * owner's pricing suggestions.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = `quote-api-${Date.now()}`;
const PLATE_PREFIX = "QAZ";
const DAY = 24 * 60 * 60 * 1000;

describe("Quotation API", () => {
  const users = { customer: "", stranger: "", owner: "", other: "", admin: "" };
  const tokens = { ...users };
  const vehicles = { rated: "", plain: "", inactive: "", foreign: "" };
  let plateSeq = 0;
  let quoteSeq = 0;

  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

  const makeVehicle = (
    ownerId: string,
    overrides: Partial<{
      type: "ORDINARY" | "LUXURY_AC";
      isActive: boolean;
      pricePerKm: number | null;
      fuelCostPerKm: number | null;
      driverAllowance: number | null;
    }> = {},
  ) =>
    prisma.vehicle.create({
      data: {
        ownerId,
        name: `${PREFIX} bus`,
        type: overrides.type ?? "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: `${PLATE_PREFIX}-${1000 + ++plateSeq}`,
        seats: 40,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        pricePerKm: overrides.pricePerKm ?? null,
        fuelCostPerKm: overrides.fuelCostPerKm ?? null,
        driverAllowance: overrides.driverAllowance ?? null,
        location: "Colombo",
        images: [],
        amenities: [],
        isActive: overrides.isActive ?? true,
        isAvailable: overrides.isActive ?? true,
      },
    });

  const makeQuotation = (overrides: Record<string, unknown> = {}) =>
    prisma.quotation.create({
      data: {
        quotationId: `QUO-${PREFIX}-${++quoteSeq}`,
        customerId: users.customer,
        startDate: new Date(inDays(30)),
        endDate: new Date(inDays(31)),
        pickupLocation: "Colombo",
        status: "PENDING",
        ...overrides,
      },
    });

  const createRequest = (body: Record<string, unknown>, who: keyof typeof tokens = "customer") =>
    request(app).post(`${API_BASE}/quotations`).set(auth(who)).send(body);

  const cleanup = async () => {
    const ids = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.quotation.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.trip.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.vehicle.deleteMany({
      where: { OR: [{ ownerId: { in: ids } }, { licensePlate: { startsWith: `${PLATE_PREFIX}-` } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    const create = async (key: keyof typeof users, role: "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN") => {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: key,
          lastName: "Tester",
          role,
          status: "ACTIVE",
          isVerified: true,
          adminRole: role === "ADMIN" ? "SUPER_ADMIN" : undefined,
        },
      });
      users[key] = user.id;
      tokens[key] = jwt.sign({ id: user.id, email: user.email, role }, config.jwt.secret, {
        expiresIn: "1h",
      });
    };
    await create("customer", "CUSTOMER");
    await create("stranger", "CUSTOMER");
    await create("owner", "VEHICLE_OWNER");
    await create("other", "VEHICLE_OWNER");
    await create("admin", "ADMIN");

    vehicles.rated = (
      await makeVehicle(users.owner, {
        type: "LUXURY_AC",
        pricePerKm: 200,
        fuelCostPerKm: 60,
        driverAllowance: 4000,
      })
    ).id;
    vehicles.plain = (await makeVehicle(users.owner)).id;
    vehicles.inactive = (await makeVehicle(users.owner, { isActive: false })).id;
    vehicles.foreign = (await makeVehicle(users.other)).id;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("POST /quotations", () => {
    it("creates a pending request and a trip awaiting quotes", async () => {
      const res = await createRequest({
        vehicleId: vehicles.plain,
        pickupLocation: { address: "", city: "Kandy", district: "Kandy", lat: null, lng: null },
        dropoffLocation: { city: "Ella", lat: 6.87, lng: 81.05 },
        startDate: inDays(20),
        endDate: "",
        startTime: "08:00",
        passengerCount: "25",
        vehicleType: "ordinary",
        estimatedDistance: "140 km",
        isRoundTrip: false,
        luggageCount: 0,
      });

      expect(res.status).toBe(201);
      const quotation = await prisma.quotation.findUnique({ where: { id: res.body.data.quotation.id } });
      expect(quotation).toMatchObject({
        status: "PENDING",
        vehicleType: "ORDINARY",
        passengerCount: 25,
        pickupLocation: "Kandy, Kandy",
        dropoffLocation: "Ella",
      });
      const trip = await prisma.trip.findUnique({ where: { id: quotation!.tripId! } });
      expect(trip).toMatchObject({ status: "AWAITING_QUOTES", dropoffLatitude: 6.87, pickupLatitude: null });
      await expect
        .poll(() =>
          prisma.notification.count({ where: { userId: users.owner, type: "quotation_requested" } }),
        )
        .toBe(1);
    });

    it("attaches to the customer's own open trip", async () => {
      const trip = await prisma.trip.create({
        data: {
          tripCode: `TRP-${PREFIX}-open`,
          customerId: users.customer,
          pickupLocation: "Galle",
          startDate: new Date(inDays(40)),
          endDate: new Date(inDays(41)),
          passengerCount: 10,
          status: "PLANNING",
        },
      });

      const res = await createRequest({ tripId: trip.id, pickupLocation: "Galle", startDate: inDays(40) });

      expect(res.status).toBe(201);
      expect(res.body.data.quotation.tripId).toBe(trip.id);
      expect((await prisma.trip.findUnique({ where: { id: trip.id } }))?.status).toBe("AWAITING_QUOTES");
    });

    it("refuses another customer's trip and a closed trip", async () => {
      const closed = await prisma.trip.create({
        data: {
          tripCode: `TRP-${PREFIX}-closed`,
          customerId: users.customer,
          pickupLocation: "Galle",
          startDate: new Date(inDays(40)),
          endDate: new Date(inDays(41)),
          passengerCount: 10,
          status: "CONFIRMED",
        },
      });

      expect((await createRequest({ tripId: closed.id, pickupLocation: "Galle", startDate: inDays(40) }, "stranger")).status).toBe(403);
      expect((await createRequest({ tripId: closed.id, pickupLocation: "Galle", startDate: inDays(40) })).status).toBe(400);
    });

    it("refuses unknown or inactive vehicles and impossible dates", async () => {
      const base = { pickupLocation: "Colombo", startDate: inDays(10) };

      expect((await createRequest({ ...base, vehicleId: "missing-vehicle" })).status).toBe(404);
      expect((await createRequest({ ...base, vehicleId: vehicles.inactive })).status).toBe(400);
      expect((await createRequest({ ...base, startDate: inDays(-1) })).status).toBe(400);
      expect((await createRequest({ ...base, endDate: inDays(5) })).status).toBe(400);
      expect((await createRequest({ startDate: inDays(10) })).status).toBe(400);
    });

    it.each([
      ["a malformed start date", { pickupLocation: "Colombo", startDate: "soon" }],
      ["a non-text pickup", { pickupLocation: 42, startDate: inDays(10) }],
      ["an unknown vehicle type", { pickupLocation: "Colombo", startDate: inDays(10), vehicleType: "ROCKET" }],
      ["too many passengers", { pickupLocation: "Colombo", startDate: inDays(10), passengerCount: 101 }],
      ["a non-numeric passenger count", { pickupLocation: "Colombo", startDate: inDays(10), passengerCount: "many" }],
    ])("rejects %s", async (_label, body) => {
      expect((await createRequest(body)).status).toBe(422);
    });
  });

  describe("lists", () => {
    beforeAll(async () => {
      await makeQuotation({ status: "ACCEPTED", vehicleId: vehicles.plain, sentAt: new Date() });
      await makeQuotation({ status: "SENT", vehicleId: vehicles.rated, sentAt: new Date() });
      await makeQuotation({ status: "SENT", vehicleId: vehicles.foreign, sentAt: new Date() });
    });

    it("gives the customer their own requests, filtered and paged", async () => {
      const sent = await request(app)
        .get(`${API_BASE}/quotations/my-requests?status=sent&page=1&limit=1`)
        .set(auth("customer"));
      const stranger = await request(app)
        .get(`${API_BASE}/quotations/my-requests`)
        .set(auth("stranger"));

      expect(sent.status).toBe(200);
      expect(sent.body.data.quotations).toHaveLength(1);
      expect(sent.body.data.pagination).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
      expect(stranger.body.data.quotations).toEqual([]);
    });

    it("gives the owner only quotations sent for their vehicles", async () => {
      const all = await request(app).get(`${API_BASE}/quotations/owner/sent`).set(auth("owner"));
      const accepted = await request(app)
        .get(`${API_BASE}/quotations/owner/sent?status=accepted`)
        .set(auth("owner"));

      expect(all.status).toBe(200);
      const vehicleIds = all.body.data.quotations.map((q: { vehicle: { id: string } }) => q.vehicle.id);
      expect(vehicleIds.sort()).toEqual([vehicles.plain, vehicles.rated].sort());
      expect(accepted.body.data.quotations).toHaveLength(1);
    });

    it("gives admins every quotation and keeps others out", async () => {
      const admin = await request(app)
        .get(`${API_BASE}/quotations/admin/all?status=sent&limit=100`)
        .set(auth("admin"));
      const owner = await request(app).get(`${API_BASE}/quotations/admin/all`).set(auth("owner"));

      expect(admin.status).toBe(200);
      expect(admin.body.data.quotations.every((q: { status: string }) => q.status === "SENT")).toBe(true);
      expect(owner.status).toBe(403);
    });

    it.each([
      ["/my-requests?status=LOST"],
      ["/owner/sent?page=0"],
      ["/admin/all?limit=101"],
    ])("rejects bad list queries: %s", async (path) => {
      const who = path.startsWith("/admin") ? "admin" : path.startsWith("/owner") ? "owner" : "customer";
      const res = await request(app).get(`${API_BASE}/quotations${path}`).set(auth(who));

      expect(res.status).toBe(422);
    });
  });

  describe("GET /quotations/:id/pricing-suggestions", () => {
    const suggest = (quotationId: string, query: string, who: keyof typeof tokens = "owner") =>
      request(app)
        .get(`${API_BASE}/quotations/${quotationId}/pricing-suggestions${query}`)
        .set(auth(who));

    it("prices from the vehicle's own rates over the trip distance and days", async () => {
      const quotation = await makeQuotation({ estimatedDistance: "250 km" });

      const res = await suggest(quotation.id, `?vehicleId=${vehicles.rated}`);

      expect(res.status).toBe(200);
      const data = res.body.data.suggestions ? res.body.data : res.body.data.pricing;
      expect(data.tripDetails).toMatchObject({ estimatedDistanceKm: 250, tripDays: 2 });
      expect(data.suggestions.vehicleRentalCost).toMatchObject({ suggested: 50000, perKm: 200 });
      expect(data.suggestions.fuelCost).toMatchObject({ suggested: 15000, perKm: 60 });
      expect(data.suggestions.driverCost).toMatchObject({ suggested: 8000, perDay: 4000 });
      expect(data.estimatedTotal).toBe(73000);
    });

    it("falls back to the platform defaults and the minimum distance", async () => {
      const quotation = await makeQuotation();

      const res = await suggest(quotation.id, `?vehicleId=${vehicles.plain}`);

      expect(res.status).toBe(200);
      const data = res.body.data.suggestions ? res.body.data : res.body.data.pricing;
      const rules = config.pricingRules;
      expect(data.tripDetails.estimatedDistanceKm).toBe(rules.minimumBooking.kilometers);
      expect(data.minimumBooking.meetsMinimum).toBe(true);
      expect(data.suggestions.vehicleRentalCost.perKm).toBe(rules.perKmRate.ORDINARY.default);
    });

    it("needs a vehicle of the caller's own and a real quotation", async () => {
      const quotation = await makeQuotation();

      expect((await suggest(quotation.id, "")).status).toBe(400);
      expect((await suggest(quotation.id, `?vehicleId=${vehicles.foreign}`)).status).toBe(403);
      expect((await suggest("missing-quotation", `?vehicleId=${vehicles.plain}`)).status).toBe(404);
      expect((await suggest(quotation.id, `?vehicleId=${vehicles.plain}`, "customer")).status).toBe(403);
    });
  });
});
