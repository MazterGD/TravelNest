/**
 * Vehicle lifecycle: listing creation, photos, documents, pause/resume,
 * activation requests, the availability calendar and similar vehicles.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = `veh-life-${Date.now()}`;
const PLATE_PREFIX = "VLZ";
const DAY = 24 * 60 * 60 * 1000;

const photoUrl = (name: string) => `https://cdn.example.com/${PREFIX}/${name}`;

describe("Vehicle lifecycle", () => {
  const users = { owner: "", other: "", unverified: "", customer: "", admin: "" };
  const tokens = { ...users };
  let plateSeq = 1000;

  const nextPlate = () => `${PLATE_PREFIX}-${++plateSeq}`;
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });

  const makeVehicle = (
    ownerId: string,
    overrides: Partial<{
      type: "ORDINARY" | "SEMI_LUXURY" | "LUXURY_AC";
      location: string;
      isActive: boolean;
      isAvailable: boolean;
    }> = {},
  ) =>
    prisma.vehicle.create({
      data: {
        ownerId,
        name: `${PREFIX} Bus ${plateSeq}`,
        type: overrides.type ?? "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: nextPlate(),
        seats: 40,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: overrides.location ?? `${PREFIX}-town`,
        images: [],
        amenities: [],
        isActive: overrides.isActive ?? true,
        isAvailable: overrides.isAvailable ?? true,
      },
    });

  const makeBooking = (vehicleId: string, status: string, startInDays = 10) =>
    prisma.booking.create({
      data: {
        customerId: users.customer,
        vehicleId,
        startDate: new Date(Date.now() + startInDays * DAY),
        endDate: new Date(Date.now() + (startInDays + 1) * DAY),
        pickupLocation: "Colombo",
        totalAmount: 20000,
        status: status as never,
      },
    });

  const cleanup = async () => {
    const owners = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = owners.map((u) => u.id);
    const vehicleWhere = {
      OR: [{ ownerId: { in: ids } }, { licensePlate: { startsWith: `${PLATE_PREFIX}-` } }],
    };
    const vehicles = await prisma.vehicle.findMany({ where: vehicleWhere, select: { id: true } });
    const vehicleIds = vehicles.map((v) => v.id);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicleAvailability.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehiclePhoto.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicleDocument.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.review.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    const create = async (
      key: keyof typeof users,
      role: "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN",
      extra: { isVerified?: boolean; adminRole?: "SUPER_ADMIN" } = {},
    ) => {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: key,
          lastName: "Tester",
          role,
          status: "ACTIVE",
          isVerified: extra.isVerified ?? true,
          adminRole: extra.adminRole,
        },
      });
      users[key] = user.id;
      tokens[key] = jwt.sign({ id: user.id, email: user.email, role }, config.jwt.secret, {
        expiresIn: "1h",
      });
    };
    await create("owner", "VEHICLE_OWNER");
    await create("other", "VEHICLE_OWNER");
    await create("unverified", "VEHICLE_OWNER", { isVerified: false });
    await create("customer", "CUSTOMER");
    await create("admin", "ADMIN", { adminRole: "SUPER_ADMIN" });
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("GET /vehicles/pricing-config", () => {
    it("returns the platform rate for every vehicle type", async () => {
      const res = await request(app).get(`${API_BASE}/vehicles/pricing-config`);

      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body.data);
      for (const type of ["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"]) {
        expect(body).toContain(type);
      }
    });
  });

  describe("POST /vehicles", () => {
    const payload = (overrides: Record<string, unknown> = {}) => ({
      name: "Hill Country Cruiser",
      type: "SEMI_LUXURY",
      brand: "Ashok Leyland",
      model: "Viking",
      year: 2021,
      licensePlate: nextPlate(),
      seats: 45,
      acType: "ac",
      location: "Kandy",
      driverAllowance: 3500,
      amenities: ["wifi"],
      ...overrides,
    });

    it("creates an active listing priced from the platform rates", async () => {
      const body = payload({ color: "Blue", description: "Comfortable <script>alert(1)</script>coach" });
      const res = await request(app).post(`${API_BASE}/vehicles`).set(auth("owner")).send(body);

      expect(res.status).toBe(201);
      const stored = await prisma.vehicle.findUnique({ where: { id: res.body.data.vehicle.id } });
      expect(stored).toMatchObject({
        ownerId: users.owner,
        type: "SEMI_LUXURY",
        licensePlate: body.licensePlate,
        acType: "ac",
        driverAllowance: 3500,
        isActive: true,
        isAvailable: true,
        color: "Blue",
      });
      expect(stored?.description).not.toContain("<script>");
      expect(stored?.pricePerDay).toBeGreaterThan(0);
    });

    it("marks a luxury vehicle fully air-conditioned whatever AC type was sent", async () => {
      const res = await request(app)
        .post(`${API_BASE}/vehicles`)
        .set(auth("owner"))
        .send(payload({ type: "LUXURY_AC", acType: "non-ac" }));

      expect(res.status).toBe(201);
      expect(res.body.data.vehicle.acType).toBe("full-ac");
    });

    it("refuses a duplicate licence plate", async () => {
      const existing = await makeVehicle(users.other);

      const res = await request(app)
        .post(`${API_BASE}/vehicles`)
        .set(auth("owner"))
        .send(payload({ licensePlate: existing.licensePlate }));

      expect(res.status).toBe(409);
    });

    it("refuses an owner who is not yet verified", async () => {
      const res = await request(app)
        .post(`${API_BASE}/vehicles`)
        .set(auth("unverified"))
        .send(payload());

      expect(res.status).toBe(403);
    });

    it("rejects customers and invalid listings", async () => {
      const asCustomer = await request(app)
        .post(`${API_BASE}/vehicles`)
        .set(auth("customer"))
        .send(payload());
      const badPlate = await request(app)
        .post(`${API_BASE}/vehicles`)
        .set(auth("owner"))
        .send(payload({ licensePlate: "nope" }));

      expect(asCustomer.status).toBe(403);
      expect(badPlate.status).toBe(422);
    });
  });

  describe("DELETE /vehicles/:id/photos/:photoId", () => {
    it("removes the primary photo and promotes the next one", async () => {
      const vehicle = await makeVehicle(users.owner);
      const primary = await prisma.vehiclePhoto.create({
        data: { vehicleId: vehicle.id, fileName: "p.jpg", fileSize: 1, mimeType: "image/jpeg", url: photoUrl("a.jpg"), isPrimary: true, sortOrder: 0 },
      });
      const next = await prisma.vehiclePhoto.create({
        data: { vehicleId: vehicle.id, fileName: "p.jpg", fileSize: 1, mimeType: "image/jpeg", url: photoUrl("b.jpg"), isPrimary: false, sortOrder: 1 },
      });

      const res = await request(app)
        .delete(`${API_BASE}/vehicles/${vehicle.id}/photos/${primary.id}`)
        .set(auth("owner"));

      expect(res.status).toBe(200);
      const removed = await prisma.vehiclePhoto.findUnique({ where: { id: primary.id } });
      expect(removed?.isRemoved).toBe(true);
      const promoted = await prisma.vehiclePhoto.findUnique({ where: { id: next.id } });
      expect(promoted?.isPrimary).toBe(true);
      const stored = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
      expect(stored?.images).toEqual([next.url]);
    });

    it("clears the cover image when the last photo goes, and is idempotent", async () => {
      const vehicle = await makeVehicle(users.owner);
      const only = await prisma.vehiclePhoto.create({
        data: { vehicleId: vehicle.id, fileName: "p.jpg", fileSize: 1, mimeType: "image/jpeg", url: photoUrl("c.jpg"), isPrimary: true, sortOrder: 0 },
      });
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { images: [only.url] } });

      const first = await request(app)
        .delete(`${API_BASE}/vehicles/${vehicle.id}/photos/${only.id}`)
        .set(auth("owner"));
      const again = await request(app)
        .delete(`${API_BASE}/vehicles/${vehicle.id}/photos/${only.id}`)
        .set(auth("owner"));

      expect(first.status).toBe(200);
      expect(again.status).toBe(200);
      const stored = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
      expect(stored?.images).toEqual([]);
    });

    it("keeps other owners out", async () => {
      const vehicle = await makeVehicle(users.owner);
      const photo = await prisma.vehiclePhoto.create({
        data: { vehicleId: vehicle.id, fileName: "p.jpg", fileSize: 1, mimeType: "image/jpeg", url: photoUrl("d.jpg"), isPrimary: true, sortOrder: 0 },
      });

      const res = await request(app)
        .delete(`${API_BASE}/vehicles/${vehicle.id}/photos/${photo.id}`)
        .set(auth("other"));

      expect(res.status).toBe(403);
      const stored = await prisma.vehiclePhoto.findUnique({ where: { id: photo.id } });
      expect(stored?.isRemoved).toBe(false);
    });
  });

  describe("POST /vehicles/:id/documents/metadata", () => {
    const doc = (name: string, overrides: Record<string, unknown> = {}) => ({
      type: "INSURANCE",
      url: `storage://private/vehicle-documents/${PREFIX}/${name}`,
      fileName: name,
      fileSize: 1024,
      mimeType: "application/pdf",
      ...overrides,
    });

    it("stores documents as pending and keeps the replaced one as removed", async () => {
      const vehicle = await makeVehicle(users.owner);
      const old = await prisma.vehicleDocument.create({
        data: {
          vehicleId: vehicle.id,
          type: "INSURANCE",
          url: `storage://private/vehicle-documents/${PREFIX}/old.pdf`,
          fileName: "old.pdf",
          fileSize: 10,
          mimeType: "application/pdf",
        },
      });

      const res = await request(app)
        .post(`${API_BASE}/vehicles/${vehicle.id}/documents/metadata`)
        .set(auth("owner"))
        .send({ documents: [doc("ins.pdf"), doc("reg.pdf", { type: "REGISTRATION_CERTIFICATE" })] });

      expect(res.status).toBe(200);
      const docs = await prisma.vehicleDocument.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { createdAt: "asc" },
      });
      expect(docs.find((d) => d.id === old.id)?.isRemoved).toBe(true);
      const live = docs.filter((d) => !d.isRemoved);
      expect(live.map((d) => d.type).sort()).toEqual(["INSURANCE", "REGISTRATION_CERTIFICATE"]);
      expect(live.every((d) => d.status === "PENDING")).toBe(true);
    });

    it("refuses another owner's vehicle and external links", async () => {
      const vehicle = await makeVehicle(users.owner);

      const stranger = await request(app)
        .post(`${API_BASE}/vehicles/${vehicle.id}/documents/metadata`)
        .set(auth("other"))
        .send({ documents: [doc("x.pdf")] });
      const external = await request(app)
        .post(`${API_BASE}/vehicles/${vehicle.id}/documents/metadata`)
        .set(auth("owner"))
        .send({ documents: [doc("y.pdf", { url: "https://evil.example.com/y.pdf" })] });

      expect(stranger.status).toBe(403);
      expect(external.status).toBe(422);
      expect(await prisma.vehicleDocument.count({ where: { vehicleId: vehicle.id } })).toBe(0);
    });
  });

  describe("PATCH /vehicles/:id/availability", () => {
    it("pauses and resumes an idle vehicle", async () => {
      const vehicle = await makeVehicle(users.owner);

      const pause = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/availability`)
        .set(auth("owner"))
        .send({ available: false });
      const resume = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/availability`)
        .set(auth("owner"))
        .send({ available: true });

      expect(pause.status).toBe(200);
      expect(pause.body.data.vehicle.isAvailable).toBe(false);
      expect(resume.status).toBe(200);
      expect(resume.body.data.vehicle.isAvailable).toBe(true);
    });

    it("rejects a missing or non-boolean availability", async () => {
      const vehicle = await makeVehicle(users.owner);

      for (const body of [{ available: "yes" }, {}]) {
        const res = await request(app)
          .patch(`${API_BASE}/vehicles/${vehicle.id}/availability`)
          .set(auth("owner"))
          .send(body);

        expect(res.status).toBe(422);
      }
      const status = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/status`)
        .set(auth("owner"))
        .send({ isActive: "no" });
      expect(status.status).toBe(422);
    });

    it("will not pause a vehicle with active bookings", async () => {
      const vehicle = await makeVehicle(users.owner);
      await makeBooking(vehicle.id, "CONFIRMED");

      const res = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/availability`)
        .set(auth("owner"))
        .send({ available: false });

      expect(res.status).toBe(400);
      const stored = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
      expect(stored?.isAvailable).toBe(true);
    });

    it("keeps other owners out and 404s unknown vehicles", async () => {
      const vehicle = await makeVehicle(users.owner);

      const stranger = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/availability`)
        .set(auth("other"))
        .send({ available: false });
      const missing = await request(app)
        .patch(`${API_BASE}/vehicles/missing-vehicle/availability`)
        .set(auth("owner"))
        .send({ available: false });

      expect(stranger.status).toBe(403);
      expect(missing.status).toBe(404);
    });
  });

  describe("activation requests", () => {
    it("files a request, tells the moderators and can be withdrawn", async () => {
      const vehicle = await makeVehicle(users.owner, { isActive: false, isAvailable: false });

      const requested = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/request-activation`)
        .set(auth("owner"));

      expect(requested.status).toBe(200);
      expect(
        await prisma.notification.count({
          where: { userId: users.admin, type: "vehicle_activation_requested" },
        }),
      ).toBe(1);

      const duplicate = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/request-activation`)
        .set(auth("owner"));
      expect(duplicate.status).toBe(400);

      const cancelled = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/cancel-activation`)
        .set(auth("owner"));
      expect(cancelled.status).toBe(200);
      const stored = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
      expect(stored).toMatchObject({ isActive: false, isAvailable: false });

      const nothingPending = await request(app)
        .patch(`${API_BASE}/vehicles/${vehicle.id}/cancel-activation`)
        .set(auth("owner"));
      expect(nothingPending.status).toBe(400);
    });

    it("refuses requests for active, foreign or unknown vehicles", async () => {
      const active = await makeVehicle(users.owner);
      const inactive = await makeVehicle(users.owner, { isActive: false, isAvailable: false });

      const call = (action: string, id: string, who: keyof typeof tokens = "owner") =>
        request(app).patch(`${API_BASE}/vehicles/${id}/${action}`).set(auth(who));

      expect((await call("request-activation", active.id)).status).toBe(400);
      expect((await call("cancel-activation", active.id)).status).toBe(400);
      expect((await call("request-activation", inactive.id, "other")).status).toBe(403);
      expect((await call("cancel-activation", inactive.id, "other")).status).toBe(403);
      expect((await call("request-activation", "missing-vehicle")).status).toBe(404);
      expect((await call("cancel-activation", "missing-vehicle")).status).toBe(404);
    });
  });

  describe("GET /vehicles/:id/availability", () => {
    it("lists blocked dates and active bookings for the month", async () => {
      const vehicle = await makeVehicle(users.owner);
      const start = new Date(Date.now() + 40 * DAY);
      const month = start.toISOString().slice(0, 7);
      const booking = await prisma.booking.create({
        data: {
          customerId: users.customer,
          vehicleId: vehicle.id,
          startDate: start,
          endDate: new Date(start.getTime() + DAY),
          pickupLocation: "Colombo",
          totalAmount: 20000,
          status: "CONFIRMED",
        },
      });
      await prisma.booking.create({
        data: {
          customerId: users.customer,
          vehicleId: vehicle.id,
          startDate: start,
          endDate: new Date(start.getTime() + DAY),
          pickupLocation: "Colombo",
          totalAmount: 20000,
          status: "CANCELLED",
        },
      });
      await prisma.vehicleAvailability.create({
        data: {
          vehicleId: vehicle.id,
          startDate: start,
          endDate: new Date(start.getTime() + DAY),
          isBlocked: true,
          reason: "Service",
        },
      });

      const res = await request(app).get(`${API_BASE}/vehicles/${vehicle.id}/availability?month=${month}`);

      expect(res.status).toBe(200);
      expect(res.body.data.month).toBe(month);
      expect(res.body.data.booked.map((b: { id: string }) => b.id)).toEqual([booking.id]);
      expect(res.body.data.blocked).toHaveLength(1);
      expect(res.body.data.blocked[0].reason).toBe("Service");
    });

    it("falls back to the current month and 404s unknown vehicles", async () => {
      const vehicle = await makeVehicle(users.owner);

      const current = await request(app).get(`${API_BASE}/vehicles/${vehicle.id}/availability`);
      expect(current.status).toBe(200);
      expect(current.body.data.month).toBe(new Date().toISOString().slice(0, 7));

      const missing = await request(app).get(
        `${API_BASE}/vehicles/cm0000000000000000000000/availability`,
      );
      expect(missing.status).toBe(404);
    });
  });

  describe("GET /vehicles/:id/similar", () => {
    it("suggests other live vehicles of the same type or town with their rating", async () => {
      const town = `${PREFIX}-similar`;
      const base = await makeVehicle(users.owner, { type: "LUXURY_AC", location: town });
      const sameType = await makeVehicle(users.other, { type: "LUXURY_AC", location: "Elsewhere" });
      const sameTown = await makeVehicle(users.other, { type: "ORDINARY", location: town });
      const paused = await makeVehicle(users.other, { type: "LUXURY_AC", location: town, isAvailable: false });
      const booking = await makeBooking(sameTown.id, "COMPLETED", -5);
      await prisma.review.create({
        data: {
          bookingId: booking.id,
          vehicleId: sameTown.id,
          customerId: users.customer,
          rating: 4,
          ratingVehicleCondition: 4,
          ratingDriverBehavior: 4,
          ratingPunctuality: 4,
          ratingCleanliness: 4,
          ratingValueForMoney: 4,
        },
      });

      const res = await request(app).get(`${API_BASE}/vehicles/${base.id}/similar?limit=12`);

      expect(res.status).toBe(200);
      const ids = res.body.data.vehicles.map((v: { id: string }) => v.id);
      expect(ids).toEqual(expect.arrayContaining([sameType.id, sameTown.id]));
      expect(ids).not.toContain(base.id);
      expect(ids).not.toContain(paused.id);
      const rated = res.body.data.vehicles.find((v: { id: string }) => v.id === sameTown.id);
      expect(rated).toMatchObject({ averageRating: 4, reviewCount: 1 });
    });

    it("404s an unknown vehicle", async () => {
      const res = await request(app).get(`${API_BASE}/vehicles/cm0000000000000000000000/similar`);

      expect(res.status).toBe(404);
    });
  });
});
