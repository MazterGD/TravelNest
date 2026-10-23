/**
 * Booking endpoints: customer and owner lists, booking from a quotation,
 * booking detail, driver details and the day-by-day itinerary.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = `booking-api-${Date.now()}`;
const PLATE_PREFIX = "BAZ";
const DAY = 24 * 60 * 60 * 1000;

describe("Booking API", () => {
  const users = { customer: "", stranger: "", owner: "", other: "", admin: "" };
  const tokens = { ...users };
  const vehicles = { ordinary: "", luxury: "", foreign: "" };
  let plateSeq = 0;
  let quoteSeq = 0;

  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inDays = (n: number) => new Date(Date.now() + n * DAY);

  const makeVehicle = (ownerId: string, type: "ORDINARY" | "LUXURY_AC") =>
    prisma.vehicle.create({
      data: {
        ownerId,
        name: `${PREFIX} ${type}`,
        type,
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: `${PLATE_PREFIX}-${1000 + ++plateSeq}`,
        seats: 40,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
        isActive: true,
        isAvailable: true,
      },
    });

  const makeBooking = (
    vehicleId: string,
    status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED",
    start: number,
    extra: Record<string, unknown> = {},
  ) =>
    prisma.booking.create({
      data: {
        customerId: users.customer,
        vehicleId,
        startDate: inDays(start),
        endDate: inDays(start + 2),
        pickupLocation: "Colombo",
        totalAmount: 30000,
        status,
        ...extra,
      },
    });

  const makeQuotation = (overrides: Record<string, unknown> = {}) =>
    prisma.quotation.create({
      data: {
        quotationId: `QUO-${PREFIX}-${++quoteSeq}`,
        customerId: users.customer,
        vehicleId: vehicles.ordinary,
        startDate: inDays(60 + quoteSeq * 5),
        endDate: inDays(61 + quoteSeq * 5),
        pickupLocation: "Galle",
        dropoffLocation: "Ella",
        passengerCount: 20,
        totalAmount: 45000,
        status: "ACCEPTED",
        validUntil: inDays(7),
        ...overrides,
      },
    });

  const cleanup = async () => {
    const ids = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    const vehicleIds = (
      await prisma.vehicle.findMany({
        where: { OR: [{ ownerId: { in: ids } }, { licensePlate: { startsWith: `${PLATE_PREFIX}-` } }] },
        select: { id: true },
      })
    ).map((v) => v.id);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.tripItinerary.deleteMany({ where: { booking: { vehicleId: { in: vehicleIds } } } });
    await prisma.booking.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.quotation.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.trip.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    const create = async (
      key: keyof typeof users,
      role: "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN",
    ) => {
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

    vehicles.ordinary = (await makeVehicle(users.owner, "ORDINARY")).id;
    vehicles.luxury = (await makeVehicle(users.owner, "LUXURY_AC")).id;
    vehicles.foreign = (await makeVehicle(users.other, "ORDINARY")).id;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("GET /bookings/my-bookings", () => {
    beforeAll(async () => {
      await makeBooking(vehicles.ordinary, "CONFIRMED", 10, { totalAmount: 10000 });
      await makeBooking(vehicles.luxury, "COMPLETED", -10, { totalAmount: 50000 });
      await makeBooking(vehicles.ordinary, "CANCELLED", 20, { totalAmount: 20000 });
    });

    const mine = (query = "") =>
      request(app).get(`${API_BASE}/bookings/my-bookings${query}`).set(auth("customer"));

    it("lists the customer's bookings with paging", async () => {
      const res = await mine("?page=1&limit=2");

      expect(res.status).toBe(200);
      expect(res.body.data.bookings).toHaveLength(2);
      expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 2, total: 3 });
    });

    it("filters by status, vehicle type and trip dates, and sorts", async () => {
      const confirmed = await mine("?status=confirmed");
      const luxury = await mine("?vehicleType=luxury_ac");
      const window = await mine(
        `?startDate=${inDays(5).toISOString().slice(0, 10)}&endDate=${inDays(15).toISOString().slice(0, 10)}`,
      );
      const cheapest = await mine("?sort=totalAmount_asc");

      expect(
        confirmed.body.data.bookings.map((b: { status: string }) => b.status.toUpperCase()),
      ).toEqual(["CONFIRMED"]);
      expect(luxury.body.data.bookings).toHaveLength(1);
      expect(luxury.body.data.bookings[0].totalAmount).toBe(50000);
      expect(window.body.data.bookings).toHaveLength(1);
      expect(cheapest.body.data.bookings.map((b: { totalAmount: number }) => b.totalAmount)).toEqual([
        10000, 20000, 50000,
      ]);
    });

    it("shows nothing to another customer", async () => {
      const res = await request(app)
        .get(`${API_BASE}/bookings/my-bookings`)
        .set(auth("stranger"));

      expect(res.body.data.bookings).toEqual([]);
    });

    it.each([
      ["an unknown status", "?status=LOST"],
      ["an unknown vehicle type", "?vehicleType=ROCKET"],
      ["a malformed date", "?startDate=soon"],
      ["a zero page", "?page=0"],
      ["a limit over 1000", "?limit=1001"],
    ])("rejects %s", async (_label, query) => {
      expect((await mine(query)).status).toBe(422);
    });
  });

  describe("POST /bookings/from-quotation", () => {
    const fromQuote = (quotationId: unknown, who: keyof typeof tokens = "customer") =>
      request(app)
        .post(`${API_BASE}/bookings/from-quotation`)
        .set(auth(who))
        .send(quotationId === undefined ? {} : { quotationId });

    it("reserves the vehicle as a pending booking linked to the quotation", async () => {
      const quotation = await makeQuotation();

      const res = await fromQuote(quotation.id);

      expect(res.status).toBe(201);
      const booking = await prisma.booking.findUnique({ where: { id: res.body.data.booking.id } });
      expect(booking).toMatchObject({
        status: "PENDING",
        quotationId: quotation.id,
        vehicleId: vehicles.ordinary,
        totalAmount: 45000,
        totalPassengers: 20,
        dropoffLocation: "Ella",
      });
      await expect
        .poll(() => prisma.notification.count({ where: { userId: users.owner } }))
        .toBeGreaterThan(0);
    });

    it("refuses a second booking for the same dates", async () => {
      const quotation = await makeQuotation();
      await makeBooking(vehicles.ordinary, "CONFIRMED", 0, {
        startDate: quotation.startDate,
        endDate: quotation.endDate,
      });

      expect((await fromQuote(quotation.id)).status).toBe(409);
    });

    it("lets only one of two simultaneous requests through", async () => {
      const first = await makeQuotation();
      const second = await makeQuotation({ startDate: first.startDate, endDate: first.endDate });

      const results = await Promise.all([fromQuote(first.id), fromQuote(second.id)]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    });

    it("refuses quotations that are not the caller's, not accepted, expired or without a vehicle", async () => {
      const foreign = await makeQuotation();
      const pending = await makeQuotation({ status: "PENDING" });
      const expired = await makeQuotation({ validUntil: inDays(-1) });
      const noVehicle = await makeQuotation({ vehicleId: null });

      expect((await fromQuote(foreign.id, "stranger")).status).toBe(403);
      expect((await fromQuote(pending.id)).status).toBe(400);
      expect((await fromQuote(expired.id)).status).toBe(400);
      expect((await fromQuote(noVehicle.id)).status).toBe(400);
      expect((await fromQuote("missing-quotation")).status).toBe(404);
    });

    it("validates the request body", async () => {
      expect((await fromQuote(undefined)).status).toBe(422);
      expect((await fromQuote(42)).status).toBe(422);
    });
  });

  describe("GET /bookings/:id", () => {
    it("shows a quotation booking with the trip's drawn stops when no route was stored", async () => {
      const trip = await prisma.trip.create({
        data: {
          tripCode: `TRP-${PREFIX}`,
          customerId: users.customer,
          pickupLocation: "Galle",
          startDate: inDays(90),
          endDate: inDays(91),
          passengerCount: 20,
          startTime: "06:30",
          pickupLatitude: 6.03,
          pickupLongitude: 80.21,
          dropoffLatitude: 6.87,
          dropoffLongitude: 81.05,
          itineraryStops: [
            { locationName: "Galle", lat: 6.03, lng: 80.21 },
            { name: "Ella", lat: 6.87, lng: 81.05 },
          ],
          itineraryRoute: { distanceKm: 210 },
        },
      });
      const quotation = await makeQuotation({ tripId: trip.id });
      const booking = await makeBooking(vehicles.ordinary, "CONFIRMED", 90, {
        quotationId: quotation.id,
      });

      const asCustomer = await request(app)
        .get(`${API_BASE}/bookings/${booking.id}`)
        .set(auth("customer"));
      const asOwner = await request(app).get(`${API_BASE}/bookings/${booking.id}`).set(auth("owner"));
      const asAdmin = await request(app).get(`${API_BASE}/bookings/${booking.id}`).set(auth("admin"));
      const asStranger = await request(app)
        .get(`${API_BASE}/bookings/${booking.id}`)
        .set(auth("stranger"));

      expect(asCustomer.status).toBe(200);
      const detail = asCustomer.body.data.booking;
      expect(detail.trip).toMatchObject({ startTime: "06:30", pickupLatitude: 6.03, dropoffLongitude: 81.05 });
      expect(detail.trip.itineraryStops.map((s: { locationName: string }) => s.locationName)).toEqual([
        "Galle",
        "Ella",
      ]);
      expect(asOwner.status).toBe(200);
      expect(asAdmin.status).toBe(200);
      expect(asStranger.status).toBe(403);
    });

    it("404s an unknown booking", async () => {
      const res = await request(app)
        .get(`${API_BASE}/bookings/missing-booking`)
        .set(auth("customer"));

      expect(res.status).toBe(404);
    });
  });

  describe("owner and admin lists", () => {
    it("lists only the owner's vehicle bookings, filtered by status and vehicle", async () => {
      await makeBooking(vehicles.foreign, "CONFIRMED", 30);

      const all = await request(app)
        .get(`${API_BASE}/bookings/owner/vehicle-bookings?limit=100`)
        .set(auth("owner"));
      const luxuryOnly = await request(app)
        .get(`${API_BASE}/bookings/owner/vehicle-bookings?vehicleId=${vehicles.luxury}&status=completed`)
        .set(auth("owner"));
      const bad = await request(app)
        .get(`${API_BASE}/bookings/owner/vehicle-bookings?status=LOST`)
        .set(auth("owner"));

      expect(all.status).toBe(200);
      const vehicleIds = new Set(all.body.data.bookings.map((b: { vehicleId: string }) => b.vehicleId));
      expect(vehicleIds.has(vehicles.foreign)).toBe(false);
      expect(luxuryOnly.body.data.bookings).toHaveLength(1);
      expect(bad.status).toBe(422);
    });

    it("gives admins every booking and keeps others out", async () => {
      const admin = await request(app)
        .get(`${API_BASE}/bookings?status=cancelled&page=1&limit=5`)
        .set(auth("admin"));
      const owner = await request(app).get(`${API_BASE}/bookings`).set(auth("owner"));

      expect(admin.status).toBe(200);
      expect(admin.body.data.bookings.every((b: { status: string }) => b.status === "CANCELLED")).toBe(true);
      expect(owner.status).toBe(403);
    });
  });

  describe("driver details", () => {
    it("lets the owner assign a driver the customer can then see", async () => {
      const booking = await makeBooking(vehicles.ordinary, "CONFIRMED", 120);

      const assigned = await request(app)
        .patch(`${API_BASE}/bookings/${booking.id}/driver`)
        .set(auth("owner"))
        .send({ driverName: " Sunil Silva ", driverPhone: "0771234567", driverLicense: "b1234567" });
      const seen = await request(app)
        .get(`${API_BASE}/bookings/${booking.id}/driver`)
        .set(auth("customer"));

      expect(assigned.status).toBe(200);
      expect(assigned.body.data.booking).toMatchObject({
        driverName: "Sunil Silva",
        driverLicense: "B1234567",
      });
      expect(seen.status).toBe(200);
      expect(JSON.stringify(seen.body.data)).toContain("Sunil Silva");
    });

    it("rejects bad driver details and other owners", async () => {
      const booking = await makeBooking(vehicles.ordinary, "CONFIRMED", 125);
      const send = (body: object, who: keyof typeof tokens = "owner") =>
        request(app).patch(`${API_BASE}/bookings/${booking.id}/driver`).set(auth(who)).send(body);
      const good = { driverName: "Sunil", driverPhone: "0771234567", driverLicense: "B1234567" };

      expect((await send({ ...good, driverName: "S" })).status).toBe(400);
      expect((await send({ ...good, driverPhone: "call me" })).status).toBe(400);
      expect((await send({ ...good, driverLicense: "B1" })).status).toBe(400);
      expect((await send({ ...good, driverName: 7 })).status).toBe(422);
      expect((await send(good, "other")).status).toBe(403);
      expect(
        (await request(app).get(`${API_BASE}/bookings/${booking.id}/driver`).set(auth("stranger"))).status,
      ).toBe(403);
    });
  });

  describe("itinerary", () => {
    const day = (dayNumber: number, overrides: Record<string, unknown> = {}) => ({
      dayNumber,
      date: inDays(150 + dayNumber).toISOString(),
      startLocation: "Kandy",
      endLocation: "Nuwara Eliya",
      overnightStop: "Nuwara Eliya",
      estimatedKm: 80,
      pickupPoints: [{ location: "Kandy Lake", time: "07:00" }],
      ...overrides,
    });

    it("replaces the itinerary and shows it to the customer", async () => {
      const booking = await makeBooking(vehicles.ordinary, "CONFIRMED", 150);
      const put = (itinerary: object[]) =>
        request(app)
          .put(`${API_BASE}/bookings/${booking.id}/itinerary`)
          .set(auth("owner"))
          .send({ itinerary });

      expect((await put([day(1), day(2)])).status).toBe(200);
      const replaced = await put([day(1, { endLocation: "Ella" })]);
      expect(replaced.status).toBe(200);

      const seen = await request(app)
        .get(`${API_BASE}/bookings/${booking.id}/itinerary`)
        .set(auth("customer"));
      expect(seen.status).toBe(200);
      expect(seen.body.data).toMatchObject({ tripDays: 3, hasItinerary: true });
      expect(seen.body.data.itinerary).toHaveLength(1);
      expect(seen.body.data.itinerary[0].endLocation).toBe("Ella");
    });

    it("rejects empty, too long or malformed itineraries and other owners", async () => {
      const booking = await makeBooking(vehicles.ordinary, "CONFIRMED", 160);
      const put = (body: object, who: keyof typeof tokens = "owner") =>
        request(app).put(`${API_BASE}/bookings/${booking.id}/itinerary`).set(auth(who)).send(body);

      expect((await put({ itinerary: [] })).status).toBe(400);
      expect((await put({ itinerary: [day(1), day(2), day(3), day(4)] })).status).toBe(400);
      expect((await put({ itinerary: [day(1, { date: "someday" })] })).status).toBe(422);
      expect((await put({ itinerary: "day one" })).status).toBe(422);
      expect((await put({ itinerary: [day(1)] }, "other")).status).toBe(403);
      expect(
        (await request(app).get(`${API_BASE}/bookings/${booking.id}/itinerary`).set(auth("stranger"))).status,
      ).toBe(403);
      expect(
        (await request(app).get(`${API_BASE}/bookings/missing-booking/itinerary`).set(auth("customer"))).status,
      ).toBe(404);
    });
  });

  it("caps cancellation and rejection reasons", async () => {
    const booking = await makeBooking(vehicles.ordinary, "PENDING", 170);
    const long = "x".repeat(1001);

    const cancel = await request(app)
      .patch(`${API_BASE}/bookings/${booking.id}/cancel`)
      .set(auth("customer"))
      .send({ reason: long });
    const reject = await request(app)
      .patch(`${API_BASE}/bookings/${booking.id}/reject`)
      .set(auth("owner"))
      .send({ reason: long });

    expect(cancel.status).toBe(422);
    expect(reject.status).toBe(422);
    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe("PENDING");
  });
});
