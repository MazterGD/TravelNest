/**
 * Driver roster: owners manage only their own drivers, deletes are soft
 * (ADR-006), and booking assignment enforces ownership, status and date
 * conflicts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const EMAILS = {
  owner: "driver.roster.owner@example.com",
  otherOwner: "driver.roster.other@example.com",
  customer: "driver.roster.customer@example.com",
};
const PLATES = ["DRV-RST-1", "DRV-RST-2"];
const DAY = 24 * 60 * 60 * 1000;
const MISSING_CUID = "clxxxxxxxxxxxxxxxxxxxxxxx";
const PHOTO = "storage://private/drivers/photo.webp";

describe("Driver roster", () => {
  const tokens = { owner: "", otherOwner: "", customer: "" };
  const ids = { owner: "", otherOwner: "", customer: "" };
  let vehicleId = "";
  let otherVehicleId = "";
  let dayOffset = 20;

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: { in: PLATES } } });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(EMAILS) } },
    });
  };

  const makeVehicle = (ownerId: string, licensePlate: string) =>
    prisma.vehicle.create({
      data: {
        ownerId,
        name: "Roster Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate,
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
      },
    });

  const makeDriver = (
    ownerId: string,
    data: { name?: string; status?: "ACTIVE" | "INACTIVE" } = {},
  ) =>
    prisma.driver.create({
      data: {
        ownerId,
        name: data.name ?? "Roster Driver",
        phone: "0771234567",
        status: data.status ?? "ACTIVE",
      },
    });

  const makeBooking = async (
    opts: {
      vehicle?: string;
      driverId?: string;
      status?: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED";
      start?: Date;
    } = {},
  ) => {
    dayOffset += 5;
    const startDate = opts.start ?? new Date(Date.now() + dayOffset * DAY);
    return prisma.booking.create({
      data: {
        customerId: ids.customer,
        vehicleId: opts.vehicle ?? vehicleId,
        driverId: opts.driverId,
        startDate,
        endDate: new Date(startDate.getTime() + 2 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 30000,
        status: opts.status ?? "CONFIRMED",
      },
    });
  };

  const call = (
    method: "get" | "post" | "patch" | "delete",
    path: string,
    token = tokens.owner,
  ) =>
    request(app)
      [method](`${API_BASE}/drivers${path}`)
      .set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    await cleanup();
    const roles = {
      owner: "VEHICLE_OWNER",
      otherOwner: "VEHICLE_OWNER",
      customer: "CUSTOMER",
    } as const;
    for (const key of Object.keys(EMAILS) as (keyof typeof EMAILS)[]) {
      const user = await prisma.user.create({
        data: {
          email: EMAILS[key],
          password: "hashed",
          firstName: "Roster",
          lastName: key,
          role: roles[key],
          status: "ACTIVE",
          isVerified: true,
        },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }
    vehicleId = (await makeVehicle(ids.owner, PLATES[0])).id;
    otherVehicleId = (await makeVehicle(ids.otherOwner, PLATES[1])).id;
  });

  afterAll(cleanup);

  describe("access control", () => {
    it("requires sign-in", async () => {
      const response = await request(app).get(`${API_BASE}/drivers`);
      expect(response.status).toBe(401);
    });

    it("refuses customers", async () => {
      const response = await call("get", "", tokens.customer);
      expect(response.status).toBe(403);
    });
  });

  describe("POST /drivers", () => {
    it("adds a trimmed ACTIVE driver to the caller's roster by default", async () => {
      const response = await call("post", "").send({
        name: "  Sunil Perera  ",
        phone: "077 123 4567",
      });

      expect(response.status).toBe(201);
      const stored = await prisma.driver.findUnique({
        where: { id: response.body.data.driver.id },
      });
      expect(stored).toMatchObject({
        ownerId: ids.owner,
        name: "Sunil Perera",
        phone: "077 123 4567",
        photoUrl: null,
        status: "ACTIVE",
      });
    });

    it("keeps a platform photo and an explicit status", async () => {
      const response = await call("post", "").send({
        name: "Kamal",
        phone: "+94771234567",
        photoUrl: PHOTO,
        status: "INACTIVE",
      });

      expect(response.status).toBe(201);
      const stored = await prisma.driver.findUnique({
        where: { id: response.body.data.driver.id },
      });
      expect(stored).toMatchObject({ photoUrl: PHOTO, status: "INACTIVE" });
    });

    it.each([
      ["a malformed phone", { name: "Kamal", phone: "call-me" }],
      ["a one-letter name", { name: "K", phone: "0771234567" }],
      [
        "an external photo URL",
        { name: "Kamal", phone: "0771234567", photoUrl: "https://evil.example/x.png" },
      ],
    ])("rejects %s", async (_label, body) => {
      const response = await call("post", "").send(body);
      expect(response.status).toBe(422);
    });
  });

  describe("GET /drivers", () => {
    it("lists only the caller's live drivers with trip analytics", async () => {
      const busy = await makeDriver(ids.owner, { name: "Busy Analytics" });
      await makeBooking({ driverId: busy.id, status: "CONFIRMED" });
      await makeBooking({ driverId: busy.id, status: "COMPLETED" });
      const removed = await prisma.driver.create({
        data: {
          ownerId: ids.owner,
          name: "Removed Analytics",
          phone: "0771234567",
          isRemoved: true,
          removedAt: new Date(),
        },
      });
      const foreign = await makeDriver(ids.otherOwner, { name: "Foreign" });

      const response = await call("get", "");

      expect(response.status).toBe(200);
      const drivers = response.body.data.drivers as Array<{
        id: string;
        totalTrips: number;
        activeTrips: number;
      }>;
      const listedIds = drivers.map((d) => d.id);
      expect(listedIds).not.toContain(removed.id);
      expect(listedIds).not.toContain(foreign.id);
      const entry = drivers.find((d) => d.id === busy.id);
      expect(entry).toMatchObject({ totalTrips: 2, activeTrips: 1 });
      const idle = drivers.find((d) => d.id !== busy.id);
      expect(idle?.activeTrips).toBe(0);
    });

    it("shows another owner only their own drivers", async () => {
      const response = await call("get", "", tokens.otherOwner);
      expect(response.status).toBe(200);
      const names = (response.body.data.drivers as Array<{ name: string }>).map(
        (d) => d.name,
      );
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((name) => name === "Foreign")).toBe(true);
    });
  });

  describe("GET /drivers/:id", () => {
    it("returns the driver with recent bookings", async () => {
      const driver = await makeDriver(ids.owner);
      const booking = await makeBooking({ driverId: driver.id });

      const response = await call("get", `/${driver.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.driver.id).toBe(driver.id);
      expect(response.body.data.driver.bookings[0]).toMatchObject({
        id: booking.id,
        vehicle: { licensePlate: PLATES[0] },
      });
    });

    it("refuses another owner's driver", async () => {
      const driver = await makeDriver(ids.owner);
      const response = await call("get", `/${driver.id}`, tokens.otherOwner);
      expect(response.status).toBe(403);
    });

    it("returns 404 for an unknown driver", async () => {
      const response = await call("get", `/${MISSING_CUID}`);
      expect(response.status).toBe(404);
    });

    it("rejects a malformed id", async () => {
      const response = await call("get", "/not-a-cuid");
      expect(response.status).toBe(422);
    });
  });

  describe("PATCH /drivers/:id", () => {
    it("updates only the supplied fields", async () => {
      const driver = await makeDriver(ids.owner, { name: "Before" });

      const response = await call("patch", `/${driver.id}`).send({
        name: "  After  ",
      });

      expect(response.status).toBe(200);
      const stored = await prisma.driver.findUnique({ where: { id: driver.id } });
      expect(stored).toMatchObject({
        name: "After",
        phone: "0771234567",
        status: "ACTIVE",
      });
    });

    it("updates phone, photo and status together", async () => {
      const driver = await makeDriver(ids.owner);

      const response = await call("patch", `/${driver.id}`).send({
        phone: "0719998887",
        photoUrl: PHOTO,
        status: "INACTIVE",
      });

      expect(response.status).toBe(200);
      const stored = await prisma.driver.findUnique({ where: { id: driver.id } });
      expect(stored).toMatchObject({
        phone: "0719998887",
        photoUrl: PHOTO,
        status: "INACTIVE",
      });
    });

    it("rejects fields outside the editable set", async () => {
      const driver = await makeDriver(ids.owner);
      const response = await call("patch", `/${driver.id}`).send({
        ownerId: ids.otherOwner,
      });
      expect(response.status).toBe(422);
    });

    it("refuses another owner's driver and leaves it unchanged", async () => {
      const driver = await makeDriver(ids.owner, { name: "Untouched" });

      const response = await call("patch", `/${driver.id}`, tokens.otherOwner).send({
        name: "Hijacked",
      });

      expect(response.status).toBe(403);
      const stored = await prisma.driver.findUnique({ where: { id: driver.id } });
      expect(stored?.name).toBe("Untouched");
    });

    it("returns 404 for an unknown driver", async () => {
      const response = await call("patch", `/${MISSING_CUID}`).send({ name: "Nobody" });
      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /drivers/:id", () => {
    it("soft-deletes an idle driver and hides it afterwards", async () => {
      const driver = await makeDriver(ids.owner);
      const past = await makeBooking({ driverId: driver.id, status: "COMPLETED" });

      const response = await call("delete", `/${driver.id}`);

      expect(response.status).toBe(200);
      const stored = await prisma.driver.findUnique({ where: { id: driver.id } });
      expect(stored?.isRemoved).toBe(true);
      expect(stored?.removedAt).toBeInstanceOf(Date);
      const booking = await prisma.booking.findUnique({ where: { id: past.id } });
      expect(booking?.driverId).toBe(driver.id);

      const again = await call("get", `/${driver.id}`);
      expect(again.status).toBe(404);
    });

    it("refuses while the driver has an active booking", async () => {
      const driver = await makeDriver(ids.owner);
      await makeBooking({ driverId: driver.id, status: "ONGOING" });

      const response = await call("delete", `/${driver.id}`);

      expect(response.status).toBe(400);
      const stored = await prisma.driver.findUnique({ where: { id: driver.id } });
      expect(stored?.isRemoved).toBe(false);
    });

    it("refuses another owner's driver", async () => {
      const driver = await makeDriver(ids.owner);
      const response = await call("delete", `/${driver.id}`, tokens.otherOwner);
      expect(response.status).toBe(403);
    });

    it("returns 404 for an unknown driver", async () => {
      const response = await call("delete", `/${MISSING_CUID}`);
      expect(response.status).toBe(404);
    });
  });

  describe("POST /drivers/assign/:bookingId", () => {
    const assign = (bookingId: string, driverId: string, token = tokens.owner) =>
      call("post", `/assign/${bookingId}`, token).send({ driverId });

    it("assigns the driver and denormalises name and phone", async () => {
      const driver = await makeDriver(ids.owner, { name: "Assignable" });
      const booking = await makeBooking({ status: "PENDING" });

      const response = await assign(booking.id, driver.id);

      expect(response.status).toBe(200);
      expect(response.body.data.booking.driver).toMatchObject({ id: driver.id });
      const stored = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(stored).toMatchObject({
        driverId: driver.id,
        driverName: "Assignable",
        driverPhone: "0771234567",
      });
    });

    it("rejects a driver already booked on overlapping dates", async () => {
      const driver = await makeDriver(ids.owner, { name: "Double Booked" });
      const start = new Date(Date.now() + 400 * DAY);
      await makeBooking({ driverId: driver.id, status: "CONFIRMED", start });
      const target = await makeBooking({ start: new Date(start.getTime() + DAY) });

      const response = await assign(target.id, driver.id);

      expect(response.status).toBe(409);
      const stored = await prisma.booking.findUnique({ where: { id: target.id } });
      expect(stored?.driverId).toBeNull();
    });

    it("ignores overlapping bookings that are no longer active", async () => {
      const driver = await makeDriver(ids.owner);
      const start = new Date(Date.now() + 450 * DAY);
      await makeBooking({ driverId: driver.id, status: "CANCELLED", start });
      const target = await makeBooking({ start });

      const response = await assign(target.id, driver.id);

      expect(response.status).toBe(200);
    });

    it("refuses an inactive driver", async () => {
      const driver = await makeDriver(ids.owner, { status: "INACTIVE" });
      const booking = await makeBooking();
      const response = await assign(booking.id, driver.id);
      expect(response.status).toBe(400);
    });

    it("refuses a booking on another owner's vehicle", async () => {
      const driver = await makeDriver(ids.owner);
      const booking = await makeBooking({ vehicle: otherVehicleId });
      const response = await assign(booking.id, driver.id);
      expect(response.status).toBe(403);
    });

    it("refuses another owner's driver", async () => {
      const driver = await makeDriver(ids.otherOwner);
      const booking = await makeBooking();
      const response = await assign(booking.id, driver.id);
      expect(response.status).toBe(403);
    });

    it("returns 404 for an unknown booking", async () => {
      const driver = await makeDriver(ids.owner);
      const response = await assign(MISSING_CUID, driver.id);
      expect(response.status).toBe(404);
    });

    it("returns 404 for an unknown driver", async () => {
      const booking = await makeBooking();
      const response = await assign(booking.id, MISSING_CUID);
      expect(response.status).toBe(404);
    });

    it("rejects a malformed driver id", async () => {
      const booking = await makeBooking();
      const response = await assign(booking.id, "nope");
      expect(response.status).toBe(422);
    });
  });

  describe("DELETE /drivers/assign/:bookingId", () => {
    it("clears the assignment", async () => {
      const driver = await makeDriver(ids.owner);
      const booking = await makeBooking({ driverId: driver.id });

      const response = await call("delete", `/assign/${booking.id}`);

      expect(response.status).toBe(200);
      const stored = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(stored).toMatchObject({
        driverId: null,
        driverName: null,
        driverPhone: null,
      });
    });

    it("refuses a booking on another owner's vehicle", async () => {
      const driver = await makeDriver(ids.otherOwner);
      const booking = await makeBooking({
        vehicle: otherVehicleId,
        driverId: driver.id,
      });

      const response = await call("delete", `/assign/${booking.id}`);

      expect(response.status).toBe(403);
      const stored = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(stored?.driverId).toBe(driver.id);
    });

    it("returns 404 for an unknown booking", async () => {
      const response = await call("delete", `/assign/${MISSING_CUID}`);
      expect(response.status).toBe(404);
    });
  });

  describe("GET /drivers/available", () => {
    const windowStart = new Date(Date.now() + 600 * DAY);
    const windowEnd = new Date(windowStart.getTime() + 2 * DAY);
    const query = (extra = "") =>
      call(
        "get",
        `/available?startDate=${windowStart.toISOString()}&endDate=${windowEnd.toISOString()}${extra}`,
      );

    it("requires both dates", async () => {
      const response = await call("get", `/available?startDate=${windowStart.toISOString()}`);
      expect(response.status).toBe(400);
    });

    it("lists active drivers without a conflicting booking", async () => {
      const free = await makeDriver(ids.owner, { name: "Available Free" });
      const busy = await makeDriver(ids.owner, { name: "Available Busy" });
      const inactive = await makeDriver(ids.owner, {
        name: "Available Inactive",
        status: "INACTIVE",
      });
      const busyBooking = await makeBooking({
        driverId: busy.id,
        start: windowStart,
      });

      const response = await query();

      expect(response.status).toBe(200);
      const listed = (response.body.data.drivers as Array<{ id: string }>).map(
        (d) => d.id,
      );
      expect(listed).toContain(free.id);
      expect(listed).not.toContain(busy.id);
      expect(listed).not.toContain(inactive.id);

      const excluding = await query(`&excludeBookingId=${busyBooking.id}`);
      const listedExcluding = (
        excluding.body.data.drivers as Array<{ id: string }>
      ).map((d) => d.id);
      expect(listedExcluding).toContain(busy.id);
    });
  });
});
