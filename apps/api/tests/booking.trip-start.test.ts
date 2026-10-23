/**
 * Owner trip actions: starting a trip inside its window, and the not-found /
 * not-yours guards on confirm, complete and start.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import db from "@travenest/database";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1/bookings";
const PREFIX = `trip-start-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;

describe("Owner trip actions", () => {
  const ids = { customer: "", owner: "", other: "", vehicle: "" };
  const tokens = { owner: "", other: "" };

  const act = (bookingId: string, action: string, who: keyof typeof tokens = "owner") => {
    const method = action === "start" ? "post" : "patch";
    return request(app)[method](`${API_BASE}/${bookingId}/${action}`).set("Authorization", `Bearer ${tokens[who]}`);
  };

  const makeBooking = (status: "CONFIRMED" | "PENDING", startOffsetDays: number, lengthDays = 1) =>
    prisma.booking.create({
      data: {
        customerId: ids.customer,
        vehicleId: ids.vehicle,
        startDate: new Date(Date.now() + startOffsetDays * DAY),
        endDate: new Date(Date.now() + (startOffsetDays + lengthDays) * DAY),
        pickupLocation: "Colombo",
        totalAmount: 15000,
        status,
      },
    });

  const cleanup = async () => {
    const users = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.booking.deleteMany({ where: { customerId: { in: users } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  };

  beforeAll(async () => {
    await cleanup();
    for (const [key, role] of [
      ["customer", "CUSTOMER"],
      ["owner", "VEHICLE_OWNER"],
      ["other", "VEHICLE_OWNER"],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `${PREFIX}.${key}@example.com`, password: "x", firstName: key, lastName: "T", role, status: "ACTIVE" },
      });
      ids[key] = user.id;
      if (key !== "customer") {
        tokens[key] = jwt.sign({ id: user.id, email: user.email, role }, config.jwt.secret, { expiresIn: "1h" });
      }
    }
    ids.vehicle = (
      await prisma.vehicle.create({
        data: {
          ownerId: ids.owner,
          name: `${PREFIX} bus`,
          type: "ORDINARY",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: "TSZ-2211",
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

  afterAll(async () => {
    await cleanup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts a confirmed trip on its day", async () => {
    const booking = await makeBooking("CONFIRMED", 0);

    const res = await act(booking.id, "start");

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe("ONGOING");
  });

  it.each([
    ["before the trip day", "CONFIRMED", 3, "TRIP_NOT_STARTED_YET"],
    ["after the trip has ended", "CONFIRMED", -5, "TRIP_WINDOW_PASSED"],
    ["for an unconfirmed booking", "PENDING", 0, "INVALID_STATUS"],
  ] as const)("refuses to start %s", async (_label, status, offset, code) => {
    const booking = await makeBooking(status, offset);

    const res = await act(booking.id, "start");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(code);
    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe(status);
  });

  it("loses to a change that lands first", async () => {
    const booking = await makeBooking("CONFIRMED", 0);
    vi.spyOn(db.booking, "updateMany").mockResolvedValueOnce({ count: 0 });

    const res = await act(booking.id, "start");

    expect(res.status).toBe(409);
  });

  it.each(["start", "confirm", "complete"])("guards %s against unknown and foreign bookings", async (action) => {
    const booking = await makeBooking("CONFIRMED", 0);

    expect((await act("missing-booking", action)).status).toBe(404);
    expect((await act(booking.id, action, "other")).status).toBe(403);
  });
});
