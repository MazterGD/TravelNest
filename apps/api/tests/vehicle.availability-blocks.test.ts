/**
 * Owner-blocked dates: blocks persist, cannot cover booked days, and are
 * soft-removed (ADR-006); dates held by a paid booking stay put.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1/vehicles";
const PREFIX = `avail-blocks-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

describe("Availability blocks", () => {
  const ids = { owner: "", other: "", customer: "", vehicle: "" };
  const tokens = { owner: "", other: "", customer: "" };

  const block = (body: object, who: keyof typeof tokens = "owner") =>
    request(app)
      .post(`${API_BASE}/${ids.vehicle}/availability/blocks`)
      .set("Authorization", `Bearer ${tokens[who]}`)
      .send(body);
  const unblock = (blockId: string, who: keyof typeof tokens = "owner") =>
    request(app)
      .delete(`${API_BASE}/${ids.vehicle}/availability/blocks/${blockId}`)
      .set("Authorization", `Bearer ${tokens[who]}`);

  const cleanup = async () => {
    const users = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.vehicleAvailability.deleteMany({ where: { vehicle: { ownerId: { in: users } } } });
    await prisma.booking.deleteMany({ where: { customerId: { in: users } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  };

  beforeAll(async () => {
    await cleanup();
    for (const [key, role] of [
      ["owner", "VEHICLE_OWNER"],
      ["other", "VEHICLE_OWNER"],
      ["customer", "CUSTOMER"],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `${PREFIX}.${key}@example.com`, password: "x", firstName: key, lastName: "T", role, status: "ACTIVE", isVerified: true },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign({ id: user.id, email: user.email, role }, config.jwt.secret, { expiresIn: "1h" });
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
          licensePlate: "ABZ-4411",
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
    await prisma.booking.create({
      data: {
        customerId: ids.customer,
        vehicleId: ids.vehicle,
        startDate: new Date(Date.now() + 20 * DAY),
        endDate: new Date(Date.now() + 21 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 20000,
        status: "CONFIRMED",
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it("stores a block that then shows on the vehicle calendar", async () => {
    const res = await block({ startDate: day(5), endDate: day(6), reason: "Service", notes: "Annual check" });

    expect(res.status).toBe(201);
    const stored = await prisma.vehicleAvailability.findUnique({ where: { id: res.body.data.block.id } });
    expect(stored).toMatchObject({ isBlocked: true, reason: "Service", notes: "Annual check", isRemoved: false });

    const path = `${API_BASE}/${ids.vehicle}/availability?month=${day(5).slice(0, 7)}`;
    const publicView = await request(app).get(path);
    const ownerView = await request(app).get(path).set("Authorization", `Bearer ${tokens.owner}`);
    const find = (r: request.Response) =>
      r.body.data.blocked.find((b: { id: string }) => b.id === res.body.data.block.id);
    expect(find(publicView)).toBeTruthy();
    expect(find(publicView).notes).toBeUndefined();
    expect(find(ownerView).notes).toBe("Annual check");
  });

  it("refuses dates that already carry an active booking", async () => {
    const res = await block({ startDate: day(19), endDate: day(20), reason: "Private hire" });

    expect(res.status).toBe(409);
  });

  it("keeps other owners, customers and bad input out", async () => {
    expect((await block({ startDate: day(5), endDate: day(6), reason: "x" }, "other")).status).toBe(403);
    expect((await block({ startDate: day(5), endDate: day(6), reason: "x" }, "customer")).status).toBe(403);
    expect((await block({ startDate: day(6), endDate: day(5), reason: "x" })).status).toBe(422);
    expect((await block({ startDate: "soon", endDate: day(5), reason: "x" })).status).toBe(422);
    expect((await block({ startDate: day(5), endDate: day(5), reason: "" })).status).toBe(422);
  });

  it("soft-removes an owner block, which then leaves the calendar", async () => {
    const created = await block({ startDate: day(8), endDate: day(8), reason: "Repairs" });
    const blockId = created.body.data.block.id;

    expect((await unblock(blockId, "other")).status).toBe(403);
    expect((await unblock(blockId)).status).toBe(200);

    const row = await prisma.vehicleAvailability.findUnique({ where: { id: blockId } });
    expect(row).toMatchObject({ isRemoved: true });
    expect(row?.removedAt).not.toBeNull();
    expect((await unblock(blockId)).status).toBe(404);
  });

  it("leaves dates held by a paid booking alone", async () => {
    const held = await prisma.vehicleAvailability.create({
      data: {
        vehicleId: ids.vehicle,
        startDate: new Date(Date.now() + 20 * DAY),
        endDate: new Date(Date.now() + 21 * DAY),
        isBlocked: true,
        reason: "Booking abc",
      },
    });

    expect((await unblock(held.id)).status).toBe(400);
    expect((await unblock("cm0000000000000000000000")).status).toBe(404);
  });
});
