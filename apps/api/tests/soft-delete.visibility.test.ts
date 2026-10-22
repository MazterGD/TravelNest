/**
 * Who still sees soft-removed data (ADR-006): admins see it flagged, and the
 * other party of a past trip sees the removed account marked, without its
 * contact details.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "softdelete.visibility";
const DAY = 24 * 60 * 60 * 1000;

describe("Soft-removed data visibility", () => {
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  let bookingId = "";

  const cleanup = async () => {
    const found = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const userIds = found.map((u) => u.id);
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  };

  beforeAll(async () => {
    await cleanup();
    for (const [key, role, adminRole] of [
      ["owner", "VEHICLE_OWNER", undefined],
      ["customer", "CUSTOMER", undefined],
      ["admin", "ADMIN", "SUPER_ADMIN"],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: "Visible",
          lastName: key,
          phone: "+94771112222",
          role,
          adminRole,
          status: "ACTIVE",
        },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: ids.owner,
        name: "Visibility Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "VIS-001",
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
      },
    });
    const booking = await prisma.booking.create({
      data: {
        customerId: ids.customer,
        vehicleId: vehicle.id,
        startDate: new Date(Date.now() - 10 * DAY),
        endDate: new Date(Date.now() - 9 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 20000,
        status: "COMPLETED",
      },
    });
    bookingId = booking.id;

    const removal = await request(app)
      .delete(`${API_BASE}/users/account`)
      .set("Authorization", `Bearer ${tokens.customer}`);
    expect(removal.status).toBe(200);
  });

  afterAll(cleanup);

  it("shows the owner a removed customer on a past trip, without contacts", async () => {
    const response = await request(app)
      .get(`${API_BASE}/bookings/${bookingId}`)
      .set("Authorization", `Bearer ${tokens.owner}`);

    expect(response.status).toBe(200);
    const customer = response.body.data.booking.customer;
    expect(customer.isRemoved).toBe(true);
    expect(customer.name).toBe("Visible customer");
    expect(customer.email).toBe("");
    expect(customer.phone).toBe("");
  });

  it("flags the removed customer in the owner's booking list", async () => {
    const response = await request(app)
      .get(`${API_BASE}/bookings/owner/vehicle-bookings`)
      .set("Authorization", `Bearer ${tokens.owner}`);

    const row = response.body.data.bookings.find(
      (b: { id: string }) => b.id === bookingId,
    );
    expect(row.customer.isRemoved).toBe(true);
  });

  it("lists removed users for admins, flagged", async () => {
    const response = await request(app)
      .get(`${API_BASE}/admin/users?search=${PREFIX}.customer`)
      .set("Authorization", `Bearer ${tokens.admin}`);

    expect(response.status).toBe(200);
    const users = response.body.data.users ?? response.body.data;
    const removed = users.find((u: { id: string }) => u.id === ids.customer);
    expect(removed?.isRemoved).toBe(true);

    const detail = await request(app)
      .get(`${API_BASE}/admin/users/${ids.customer}`)
      .set("Authorization", `Bearer ${tokens.admin}`);
    expect(detail.status).toBe(200);
  });
});
