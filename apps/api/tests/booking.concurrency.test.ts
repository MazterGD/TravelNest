/**
 * Race-safety of booking state transitions (ADR-004): concurrent requests
 * must not double-book a vehicle or double-cancel a booking.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const EMAILS = {
  customer: "race.customer@example.com",
  owner: "race.owner@example.com",
};
const DAY = 24 * 60 * 60 * 1000;

describe("Booking concurrency", () => {
  let customerId = "";
  let ownerId = "";
  let vehicleId = "";
  let customerToken = "";
  let quoteSeq = 0;

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: "RACE-001" } });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(EMAILS) } },
    });
  };

  beforeAll(async () => {
    await cleanup();
    const customer = await prisma.user.create({
      data: {
        email: EMAILS.customer,
        password: "hashed",
        firstName: "Race",
        lastName: "Customer",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    customerId = customer.id;
    const owner = await prisma.user.create({
      data: {
        email: EMAILS.owner,
        password: "hashed",
        firstName: "Race",
        lastName: "Owner",
        role: "VEHICLE_OWNER",
        status: "ACTIVE",
        isVerified: true,
      },
    });
    ownerId = owner.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId,
        name: "Race Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "RACE-001",
        seats: 30,
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
    vehicleId = vehicle.id;
    customerToken = jwt.sign(
      { id: customerId, email: EMAILS.customer, role: "CUSTOMER" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany({ where: { vehicleId } });
    await prisma.quotation.deleteMany({ where: { vehicleId } });
  });

  afterAll(cleanup);

  const sentQuotation = (startInDays: number) =>
    prisma.quotation.create({
      data: {
        quotationId: `QUO-RACE-${Date.now()}-${quoteSeq++}`,
        customerId,
        vehicleId,
        startDate: new Date(Date.now() + startInDays * DAY),
        endDate: new Date(Date.now() + (startInDays + 1) * DAY),
        pickupLocation: "Colombo",
        dropoffLocation: "Kandy",
        passengerCount: 20,
        status: "SENT",
        totalAmount: 30000,
        validUntil: new Date(Date.now() + 5 * DAY),
      },
    });

  const accept = (quotationId: string) =>
    request(app)
      .patch(`${API_BASE}/quotations/${quotationId}/respond`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "ACCEPTED" });

  it("creates one booking when the same quotation is accepted twice at once", async () => {
    const quote = await sentQuotation(10);

    const responses = await Promise.all([accept(quote.id), accept(quote.id)]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
    expect(await prisma.booking.count({ where: { vehicleId } })).toBe(1);
  });

  it("creates one booking when two quotes for the same dates are accepted at once", async () => {
    const [first, second] = await Promise.all([
      sentQuotation(20),
      sentQuotation(20),
    ]);

    const responses = await Promise.all([accept(first.id), accept(second.id)]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(await prisma.booking.count({ where: { vehicleId } })).toBe(1);
  });

  describe("package booking", () => {
    let packageId = "";

    beforeAll(async () => {
      const pkg = await prisma.tripPackage.create({
        data: {
          ownerId,
          vehicleId,
          title: "Race Package",
          startLocation: "Colombo",
          endLocation: "Galle",
          durationDays: 2,
          price: 45000,
          minPassengers: 1,
          maxPassengers: 30,
        },
      });
      packageId = pkg.id;
    });

    const book = (startInDays: number) =>
      request(app)
        .post(`${API_BASE}/packages/${packageId}/book`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          startDate: new Date(Date.now() + startInDays * DAY).toISOString(),
          passengerCount: 10,
        });

    it("rejects a package booking that overlaps an existing booking", async () => {
      await prisma.booking.create({
        data: {
          customerId,
          vehicleId,
          startDate: new Date(Date.now() + 30 * DAY),
          endDate: new Date(Date.now() + 32 * DAY),
          pickupLocation: "Colombo",
          totalAmount: 30000,
          status: "CONFIRMED",
        },
      });

      const response = await book(31);

      expect(response.status).toBe(409);
      expect(await prisma.booking.count({ where: { vehicleId } })).toBe(1);
    });

    it("creates one booking for two simultaneous package bookings", async () => {
      const responses = await Promise.all([book(40), book(40)]);

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);
      expect(await prisma.booking.count({ where: { vehicleId } })).toBe(1);
    });
  });

  it("cancels a booking only once when two cancellations race", async () => {
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        startDate: new Date(Date.now() + 60 * DAY),
        endDate: new Date(Date.now() + 61 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 30000,
        status: "PENDING",
      },
    });

    const cancel = () =>
      request(app)
        .patch(`${API_BASE}/bookings/${booking.id}/cancel`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ reason: "Changed plans" });

    const responses = await Promise.all([cancel(), cancel()]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
  });
});
