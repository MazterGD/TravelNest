/**
 * Self-service account deletion (AUTH-4): an owner cannot delete their
 * account while customers hold bookings on their vehicles or a payout is
 * pending, because deletion cascades to those bookings and payments.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "account.delete";
const DAY = 24 * 60 * 60 * 1000;

describe("DELETE /users/account", () => {
  let bookingId = "";
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: "ACC-DEL-1" } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  beforeAll(async () => {
    await cleanup();
    const roles = {
      busyOwner: "VEHICLE_OWNER",
      idleOwner: "VEHICLE_OWNER",
      customer: "CUSTOMER",
    } as const;
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key.toLowerCase()}@example.com`,
          password: "hashed",
          firstName: "Delete",
          lastName: key,
          role: roles[key],
          status: "ACTIVE",
        },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: roles[key] },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: ids.busyOwner,
        name: "Busy Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "ACC-DEL-1",
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
        startDate: new Date(Date.now() + 10 * DAY),
        endDate: new Date(Date.now() + 11 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 20000,
        status: "CONFIRMED",
      },
    });
    bookingId = booking.id;
  });

  afterAll(cleanup);

  const deleteAccount = (key: string) =>
    request(app)
      .delete(`${API_BASE}/users/account`)
      .set("Authorization", `Bearer ${tokens[key]}`);

  it("refuses while customers hold bookings on the owner's vehicles", async () => {
    const response = await deleteAccount("busyOwner");

    expect(response.status).toBe(400);
    expect(await prisma.booking.findUnique({ where: { id: bookingId } })).not.toBeNull();
  });

  it("soft-removes an owner without active bookings or pending payouts", async () => {
    const response = await deleteAccount("idleOwner");

    expect(response.status).toBe(200);
    const removed = await prisma.user.findUnique({ where: { id: ids.idleOwner } });
    expect(removed?.isRemoved).toBe(true);

    // The removed account can no longer use its session
    const me = await request(app)
      .get(`${API_BASE}/auth/me`)
      .set("Authorization", `Bearer ${tokens.idleOwner}`);
    expect(me.status).toBe(401);
  });
});
