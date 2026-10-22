/**
 * Soft-delete behaviour of user-facing delete actions (ADR-006).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { withRegistrationProof } from "./helpers";

const API_BASE = "/api/v1";
const PREFIX = "softdelete.behaviour";
const DAY = 24 * 60 * 60 * 1000;

const tokenFor = (user: { id: string; email: string; role: string }) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: "1h" },
  );

describe("Soft delete", () => {
  const users: Record<string, { id: string; email: string; role: string }> = {};
  let vehicleId = "";
  let completedBookingId = "";

  const cleanup = async () => {
    const found = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = found.map((u) => u.id);
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    for (const [key, role] of [
      ["owner", "VEHICLE_OWNER"],
      ["customer", "CUSTOMER"],
      ["quoter", "CUSTOMER"],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: "Soft",
          lastName: key,
          role,
          status: "ACTIVE",
          isVerified: true,
        },
      });
      users[key] = { id: user.id, email: user.email, role };
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: users.owner.id,
        name: "Soft Delete Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "SOFT-001",
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
        isActive: true,
      },
    });
    vehicleId = vehicle.id;
    await prisma.tripPackage.create({
      data: {
        ownerId: users.owner.id,
        vehicleId,
        title: "Soft Package",
        startLocation: "Colombo",
        endLocation: "Galle",
        durationDays: 1,
        price: 20000,
        minPassengers: 1,
        maxPassengers: 30,
      },
    });
    await prisma.driver.create({
      data: { ownerId: users.owner.id, name: "Soft Driver", phone: "+94770000000" },
    });

    const booking = await prisma.booking.create({
      data: {
        customerId: users.customer.id,
        vehicleId,
        startDate: new Date(Date.now() - 10 * DAY),
        endDate: new Date(Date.now() - 9 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 20000,
        status: "COMPLETED",
      },
    });
    completedBookingId = booking.id;
  });

  afterAll(cleanup);

  const auth = (key: string) => `Bearer ${tokenFor(users[key])}`;

  it("lets a customer remove a review and post a new one", async () => {
    const review = (title: string) =>
      request(app)
        .post(`${API_BASE}/reviews`)
        .set("Authorization", auth("customer"))
        .send({
          bookingId: completedBookingId,
          vehicleId,
          title,
          comment: "A comfortable and punctual trip overall.",
          dimensions: {
            ratingVehicleCondition: 5,
            ratingDriverBehavior: 5,
            ratingPunctuality: 4,
            ratingCleanliness: 5,
            ratingValueForMoney: 4,
          },
        });

    const first = await review("First impressions");
    expect(first.status).toBe(201);

    const removal = await request(app)
      .delete(`${API_BASE}/reviews/${first.body.data.review?.id ?? first.body.data.id}`)
      .set("Authorization", auth("customer"));
    expect(removal.status).toBe(200);

    const second = await review("Second thoughts");
    expect(second.status).toBe(201);

    const rows = await prisma.review.findMany({
      where: { bookingId: completedBookingId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].isRemoved).toBe(false);
    expect(rows[0].title).toBe("Second thoughts");
  });

  it("keeps deleted notifications as removed and hides them", async () => {
    const notification = await prisma.notification.create({
      data: {
        userId: users.customer.id,
        type: "system",
        title: "Hello",
        message: "Soft delete check",
      },
    });

    const removal = await request(app)
      .delete(`${API_BASE}/notifications/${notification.id}`)
      .set("Authorization", auth("customer"));
    expect(removal.status).toBe(200);

    const row = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(row?.isRemoved).toBe(true);

    const list = await request(app)
      .get(`${API_BASE}/notifications`)
      .set("Authorization", auth("customer"));
    const ids = JSON.stringify(list.body);
    expect(ids).not.toContain(notification.id);
  });

  it("refuses to remove a customer with an open quotation", async () => {
    await prisma.quotation.create({
      data: {
        quotationId: `QUO-SOFT-${Date.now()}`,
        customerId: users.quoter.id,
        startDate: new Date(Date.now() + 10 * DAY),
        endDate: new Date(Date.now() + 11 * DAY),
        pickupLocation: "Colombo",
        status: "PENDING",
      },
    });

    const response = await request(app)
      .delete(`${API_BASE}/users/account`)
      .set("Authorization", auth("quoter"));

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("open quotations");
  });

  it("removes an owner's vehicles, packages and drivers with the account", async () => {
    const response = await request(app)
      .delete(`${API_BASE}/users/account`)
      .set("Authorization", auth("owner"));
    expect(response.status).toBe(200);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    expect(vehicle?.isRemoved).toBe(true);
    expect(vehicle?.licensePlate).toBe(`SOFT-001#removed-${vehicleId}`);
    expect(
      await prisma.tripPackage.count({
        where: { ownerId: users.owner.id, isRemoved: false },
      }),
    ).toBe(0);
    expect(
      await prisma.driver.count({
        where: { ownerId: users.owner.id, isRemoved: false },
      }),
    ).toBe(0);

    const publicView = await request(app).get(`${API_BASE}/vehicles/${vehicleId}`);
    expect(publicView.status).toBe(404);

    // The completed trip is still on record for the customer
    expect(
      await prisma.booking.findUnique({ where: { id: completedBookingId } }),
    ).not.toBeNull();
  });

  it("lets the freed email register a new account", async () => {
    const response = await request(app)
      .post(`${API_BASE}/auth/register`)
      .send(
        withRegistrationProof({
          email: users.owner.email,
          password: "Password123!",
          confirmPassword: "Password123!",
          firstName: "New",
          lastName: "Owner",
          role: "customer",
        }),
      );

    expect(response.status).toBe(201);
  });
});
