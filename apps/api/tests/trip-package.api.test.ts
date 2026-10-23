/**
 * Trip packages: public browsing with filters and sorting, owner management
 * scoped to the owner's own packages and vehicles, soft delete (ADR-006), and
 * customer booking with capacity, availability and date-overlap checks.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { bookTripPackage } from "../src/modules/trip-package/trip-package.service";

const API_BASE = "/api/v1";
const PREFIX = "trip.package";
const PLATE_PREFIX = "TPKG-";
const TAG = "Zqxpkg";
const DAY = 24 * 60 * 60 * 1000;
const UNKNOWN_CUID = "cl000000000000000000000000";

describe("Trip packages API", () => {
  const users = { owner: "", otherOwner: "", customer: "", admin: "" };
  const tokens = { ...users };
  const vehicles = { main: "", small: "", inactive: "", unavailable: "", foreign: "" };
  let plateSeq = 0;
  let bookingDay = 20;

  const roles = {
    owner: "VEHICLE_OWNER",
    otherOwner: "VEHICLE_OWNER",
    customer: "CUSTOMER",
    admin: "ADMIN",
  } as const;

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: { startsWith: PLATE_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  const makeVehicle = (
    ownerId: string,
    seats: number,
    flags: { isActive?: boolean; isAvailable?: boolean; type?: "ORDINARY" | "LUXURY_AC" } = {},
  ) =>
    prisma.vehicle.create({
      data: {
        ownerId,
        name: `Package Bus ${plateSeq + 1}`,
        type: flags.type ?? "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: `${PLATE_PREFIX}${++plateSeq}`,
        seats,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
        isActive: flags.isActive ?? true,
        isAvailable: flags.isAvailable ?? true,
      },
    });

  const makePackage = (
    overrides: Partial<{
      ownerId: string;
      vehicleId: string;
      title: string;
      description: string;
      startLocation: string;
      endLocation: string;
      durationDays: number;
      price: number;
      minPassengers: number;
      maxPassengers: number;
      isActive: boolean;
      isRemoved: boolean;
      createdAt: Date;
    }> = {},
  ) =>
    prisma.tripPackage.create({
      data: {
        ownerId: users.owner,
        vehicleId: vehicles.main,
        title: `${TAG} Package`,
        startLocation: "Colombo",
        endLocation: "Kandy",
        durationDays: 2,
        price: 50000,
        minPassengers: 10,
        maxPassengers: 30,
        ...overrides,
      },
    });

  const auth = (role: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[role]}` });

  beforeAll(async () => {
    await cleanup();
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: "Package",
          lastName: key,
          role: roles[key],
          status: "ACTIVE",
        },
      });
      users[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: roles[key] },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }
    vehicles.main = (await makeVehicle(users.owner, 30, { type: "LUXURY_AC" })).id;
    vehicles.small = (await makeVehicle(users.owner, 12)).id;
    vehicles.inactive = (await makeVehicle(users.owner, 30, { isActive: false })).id;
    vehicles.unavailable = (await makeVehicle(users.owner, 30, { isAvailable: false })).id;
    vehicles.foreign = (await makeVehicle(users.otherOwner, 30)).id;
    await prisma.vehiclePhoto.create({
      data: {
        vehicleId: vehicles.main,
        url: "https://example.com/primary.webp",
        fileName: "primary.webp",
        fileSize: 100,
        mimeType: "image/webp",
        isPrimary: true,
      },
    });
  });

  afterAll(cleanup);

  describe("GET /packages (public browse)", () => {
    const ids: Record<string, string> = {};

    beforeAll(async () => {
      ids.cheapShort = (
        await makePackage({
          title: `${TAG} Cheap coast run`,
          startLocation: "Galle",
          endLocation: "Matara",
          durationDays: 1,
          price: 10000,
          minPassengers: 5,
          maxPassengers: 12,
          vehicleId: vehicles.small,
        })
      ).id;
      ids.midHill = (
        await makePackage({
          title: `${TAG} Hill escape`,
          description: "Tea estates and waterfalls",
          startLocation: "Colombo",
          endLocation: "Nuwara Eliya",
          durationDays: 3,
          price: 60000,
          minPassengers: 15,
          maxPassengers: 30,
        })
      ).id;
      ids.expensiveLong = (
        await makePackage({
          title: `${TAG} Grand tour`,
          startLocation: "Colombo",
          endLocation: "Jaffna",
          durationDays: 5,
          price: 150000,
          minPassengers: 20,
          maxPassengers: 30,
        })
      ).id;
      ids.inactive = (
        await makePackage({ title: `${TAG} Paused`, isActive: false, price: 30000 })
      ).id;
      ids.removed = (await makePackage({ title: `${TAG} Removed`, isRemoved: true })).id;
      ids.foreign = (
        await makePackage({
          ownerId: users.otherOwner,
          vehicleId: vehicles.foreign,
          title: `${TAG} Other owner`,
        })
      ).id;
    });

    const browse = (query: string) => request(app).get(`${API_BASE}/packages?${query}`);
    const idsOf = (response: request.Response) =>
      response.body.data.packages.map((p: { id: string }) => p.id).sort();
    const emptyOwnerFilter = "ownerId=";

    it("lists packages with vehicle, primary photo and owner, hiding removed ones", async () => {
      const response = await browse(`ownerId=${users.owner}`);

      expect(response.status).toBe(200);
      expect(idsOf(response)).toEqual(
        [ids.cheapShort, ids.midHill, ids.expensiveLong, ids.inactive].sort(),
      );
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 12,
        total: 4,
        totalPages: 1,
      });
      const hill = response.body.data.packages.find((p: { id: string }) => p.id === ids.midHill);
      expect(hill.vehicle).toMatchObject({
        id: vehicles.main,
        type: "LUXURY_AC",
        photos: [{ url: "https://example.com/primary.webp", isPrimary: true }],
      });
      expect(hill.owner).toMatchObject({ id: users.owner, firstName: "Package" });
    });

    it("ignores an empty filter value", async () => {
      const response = await browse(`${emptyOwnerFilter}&search=${TAG}`);

      expect(response.body.data.pagination.total).toBe(5);
    });

    it.each([
      ["start location (case-insensitive)", "startLocation=galle", ["cheapShort"]],
      ["end location", "endLocation=ELIYA", ["midHill"]],
      ["duration", "durationDays=5", ["expensiveLong"]],
      ["active packages only", "isActive=true", ["cheapShort", "midHill", "expensiveLong"]],
      ["inactive packages only", "isActive=false", ["inactive"]],
      ["groups that fit the package minimum", "maxPassengers=12", ["cheapShort", "inactive"]],
      ["groups within the package maximum", "minPassengers=13", ["midHill", "expensiveLong", "inactive"]],
      ["a passenger range", "minPassengers=13&maxPassengers=15", ["midHill", "inactive"]],
      ["a minimum price", "minPrice=60000", ["midHill", "expensiveLong"]],
      ["a maximum price", "maxPrice=30000", ["cheapShort", "inactive"]],
      ["a price range", "minPrice=20000&maxPrice=100000", ["midHill", "inactive"]],
      ["vehicle type", "vehicleType=LUXURY_AC", ["midHill", "expensiveLong", "inactive"]],
      ["search across description", "search=waterfalls", ["midHill"]],
      ["search combined with passengers", "search=grand&minPassengers=25", ["expensiveLong"]],
    ])("filters by %s", async (_label, query, expected) => {
      const response = await browse(`ownerId=${users.owner}&${query}`);

      expect(response.status).toBe(200);
      expect(idsOf(response)).toEqual(expected.map((key) => ids[key]).sort());
    });

    it("finds another owner's package by owner id", async () => {
      const response = await browse(`ownerId=${users.otherOwner}`);

      expect(idsOf(response)).toEqual([ids.foreign]);
    });

    it.each([
      ["price ascending", "sortBy=price&sortOrder=asc", ["cheapShort", "inactive", "midHill", "expensiveLong"]],
      ["price descending", "sortBy=price", ["expensiveLong", "midHill", "inactive", "cheapShort"]],
      ["duration ascending", "sortBy=duration&sortOrder=asc&isActive=true", ["cheapShort", "midHill", "expensiveLong"]],
      ["newest first", "sortBy=newest&sortOrder=desc&isActive=true", ["expensiveLong", "midHill", "cheapShort"]],
      ["creation by default", "isActive=true", ["expensiveLong", "midHill", "cheapShort"]],
      ["oldest first", "sortBy=newest&sortOrder=asc&isActive=true", ["cheapShort", "midHill", "expensiveLong"]],
    ])("sorts by %s", async (_label, query, expected) => {
      const response = await browse(`ownerId=${users.owner}&${query}`);

      expect(response.body.data.packages.map((p: { id: string }) => p.id)).toEqual(
        expected.map((key) => ids[key]),
      );
    });

    it("pages results", async () => {
      const response = await browse(`ownerId=${users.owner}&page=2&limit=3&sortBy=price&sortOrder=asc`);

      expect(response.body.data.packages.map((p: { id: string }) => p.id)).toEqual([
        ids.expensiveLong,
      ]);
      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 3,
        total: 4,
        totalPages: 2,
      });
    });

    it("neutralises markup in text filters", async () => {
      const response = await browse(`ownerId=${users.owner}&search=${encodeURIComponent("<script>alert(1)</script>")}`);

      expect(response.status).toBe(200);
      expect(response.body.data.packages).toEqual([]);
    });
  });

  describe("GET /packages/:id", () => {
    it("returns a package with its vehicle and owner", async () => {
      const pkg = await makePackage();

      const response = await request(app).get(`${API_BASE}/packages/${pkg.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.tripPackage).toMatchObject({
        id: pkg.id,
        vehicle: { id: vehicles.main },
        owner: { id: users.owner },
      });
    });

    it("hides a removed package", async () => {
      const pkg = await makePackage({ isRemoved: true });

      const response = await request(app).get(`${API_BASE}/packages/${pkg.id}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 for an unknown package", async () => {
      const response = await request(app).get(`${API_BASE}/packages/${UNKNOWN_CUID}`);

      expect(response.status).toBe(404);
    });

    it("rejects a malformed id", async () => {
      const response = await request(app).get(`${API_BASE}/packages/not-a-cuid!`);

      expect(response.status).toBe(422);
    });
  });

  describe("GET /packages/owner/my", () => {
    it("returns only the caller's live packages", async () => {
      const owner = await prisma.user.create({
        data: {
          email: `${PREFIX}.solo@example.com`,
          password: "hashed",
          firstName: "Solo",
          lastName: "Owner",
          role: "VEHICLE_OWNER",
          status: "ACTIVE",
        },
      });
      const vehicle = await makeVehicle(owner.id, 20);
      const older = await makePackage({
        ownerId: owner.id,
        vehicleId: vehicle.id,
        maxPassengers: 20,
        createdAt: new Date(Date.now() - 60_000),
      });
      const newer = await makePackage({ ownerId: owner.id, vehicleId: vehicle.id, maxPassengers: 20 });
      await makePackage({ ownerId: owner.id, vehicleId: vehicle.id, maxPassengers: 20, isRemoved: true });
      const token = jwt.sign(
        { id: owner.id, email: owner.email, role: "VEHICLE_OWNER" },
        config.jwt.secret,
        { expiresIn: "1h" },
      );

      const response = await request(app)
        .get(`${API_BASE}/packages/owner/my`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.packages.map((p: { id: string }) => p.id)).toEqual([
        newer.id,
        older.id,
      ]);
      expect(response.body.data.packages[0].vehicle.id).toBe(vehicle.id);
    });

    it("refuses a customer", async () => {
      const response = await request(app)
        .get(`${API_BASE}/packages/owner/my`)
        .set(auth("customer"));

      expect(response.status).toBe(403);
    });

    it("requires authentication", async () => {
      const response = await request(app).get(`${API_BASE}/packages/owner/my`);

      expect(response.status).toBe(401);
    });
  });

  describe("POST /packages", () => {
    const valid = () => ({
      vehicleId: vehicles.main,
      title: "Cultural triangle",
      description: "Sigiriya and Dambulla",
      startLocation: "Colombo",
      endLocation: "Sigiriya",
      durationDays: 2,
      price: 75000,
      minPassengers: 10,
      maxPassengers: 30,
    });

    const create = (role: keyof typeof tokens, body: object) =>
      request(app).post(`${API_BASE}/packages`).set(auth(role)).send(body);

    it("creates a package for the owner's vehicle", async () => {
      const response = await create("owner", valid());

      expect(response.status).toBe(201);
      const created = response.body.data.tripPackage;
      expect(created).toMatchObject({ ...valid(), ownerId: users.owner, isActive: true });
      const stored = await prisma.tripPackage.findUnique({ where: { id: created.id } });
      expect(stored?.ownerId).toBe(users.owner);
    });

    it("inherits an inactive vehicle's status unless told otherwise", async () => {
      const inherited = await create("owner", { ...valid(), vehicleId: vehicles.inactive });
      const explicit = await create("owner", {
        ...valid(),
        vehicleId: vehicles.inactive,
        isActive: true,
      });

      expect(inherited.status).toBe(201);
      expect(inherited.body.data.tripPackage.isActive).toBe(false);
      expect(explicit.body.data.tripPackage.isActive).toBe(true);
    });

    it("refuses another owner's vehicle", async () => {
      const response = await create("owner", { ...valid(), vehicleId: vehicles.foreign });

      expect(response.status).toBe(403);
      expect(await prisma.tripPackage.count({ where: { vehicleId: vehicles.foreign, title: "Cultural triangle" } })).toBe(0);
    });

    it("refuses an unknown vehicle", async () => {
      const response = await create("owner", { ...valid(), vehicleId: UNKNOWN_CUID });

      expect(response.status).toBe(403);
    });

    it("refuses an admin creating on an owner's vehicle", async () => {
      const response = await create("admin", valid());

      expect(response.status).toBe(403);
    });

    it("rejects more passengers than the vehicle seats", async () => {
      const response = await create("owner", { ...valid(), vehicleId: vehicles.small, maxPassengers: 13 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe("Max passengers exceeds vehicle capacity");
    });

    it("refuses a customer", async () => {
      const response = await create("customer", valid());

      expect(response.status).toBe(403);
    });

    it.each([
      ["a minimum above the maximum", { minPassengers: 20, maxPassengers: 10 }],
      ["a malformed vehicle id", { vehicleId: "bus-1" }],
      ["a zero price", { price: 0 }],
      ["a short title", { title: "ab" }],
      ["a zero-day duration", { durationDays: 0 }],
      ["an overlong description", { description: "x".repeat(501) }],
    ])("rejects %s", async (_label, override) => {
      const response = await create("owner", { ...valid(), ...override });

      expect(response.status).toBe(422);
    });
  });

  describe("PATCH /packages/:id", () => {
    const update = (role: keyof typeof tokens, id: string, body: object) =>
      request(app).patch(`${API_BASE}/packages/${id}`).set(auth(role)).send(body);

    it("updates the owner's package", async () => {
      const pkg = await makePackage();

      const response = await update("owner", pkg.id, {
        title: "Renamed",
        description: "New description",
        startLocation: "Negombo",
        endLocation: "Trincomalee",
        durationDays: 4,
        price: 90000,
        minPassengers: 12,
        maxPassengers: 28,
        isActive: false,
      });

      expect(response.status).toBe(200);
      const stored = await prisma.tripPackage.findUnique({ where: { id: pkg.id } });
      expect(stored).toMatchObject({
        title: "Renamed",
        description: "New description",
        startLocation: "Negombo",
        endLocation: "Trincomalee",
        durationDays: 4,
        price: 90000,
        minPassengers: 12,
        maxPassengers: 28,
        isActive: false,
        vehicleId: vehicles.main,
      });
    });

    it("moves the package to another of the owner's vehicles", async () => {
      const pkg = await makePackage({ maxPassengers: 12, minPassengers: 5 });

      const response = await update("owner", pkg.id, { vehicleId: vehicles.small });

      expect(response.status).toBe(200);
      expect(response.body.data.tripPackage.vehicleId).toBe(vehicles.small);
    });

    it("accepts the package's current vehicle unchanged", async () => {
      const pkg = await makePackage();

      const response = await update("owner", pkg.id, { vehicleId: vehicles.main, price: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data.tripPackage.price).toBe(1);
    });

    it("rejects a new vehicle too small for the package", async () => {
      const pkg = await makePackage({ maxPassengers: 30 });

      const response = await update("owner", pkg.id, { vehicleId: vehicles.small });

      expect(response.status).toBe(400);
      const stored = await prisma.tripPackage.findUnique({ where: { id: pkg.id } });
      expect(stored?.vehicleId).toBe(vehicles.main);
    });

    it.each([
      ["another owner's vehicle", () => vehicles.foreign],
      ["an unknown vehicle", () => UNKNOWN_CUID],
    ])("refuses moving to %s", async (_label, target) => {
      const pkg = await makePackage();

      const response = await update("owner", pkg.id, { vehicleId: target() });

      expect(response.status).toBe(403);
    });

    it("rejects a minimum above the stored maximum", async () => {
      const pkg = await makePackage({ minPassengers: 10, maxPassengers: 20 });

      const response = await update("owner", pkg.id, { minPassengers: 25 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe("Max passengers must be >= min passengers");
    });

    it("rejects a maximum above the vehicle's seats", async () => {
      const pkg = await makePackage();

      const response = await update("owner", pkg.id, { maxPassengers: 31 });

      expect(response.status).toBe(400);
    });

    it("refuses another owner and leaves the package unchanged", async () => {
      const pkg = await makePackage();

      const response = await update("otherOwner", pkg.id, { price: 1 });

      expect(response.status).toBe(403);
      const stored = await prisma.tripPackage.findUnique({ where: { id: pkg.id } });
      expect(stored?.price).toBe(50000);
    });

    it("refuses a customer", async () => {
      const pkg = await makePackage();

      const response = await update("customer", pkg.id, { price: 1 });

      expect(response.status).toBe(403);
    });

    it("returns 404 for an unknown or removed package", async () => {
      const removed = await makePackage({ isRemoved: true });

      expect((await update("owner", UNKNOWN_CUID, { price: 1 })).status).toBe(404);
      expect((await update("owner", removed.id, { price: 1 })).status).toBe(404);
    });

    it.each([
      ["a minimum above the maximum", { minPassengers: 20, maxPassengers: 10 }],
      ["a negative price", { price: -5 }],
    ])("rejects %s", async (_label, body) => {
      const pkg = await makePackage();

      const response = await update("owner", pkg.id, body);

      expect(response.status).toBe(422);
    });

    it("rejects a malformed id", async () => {
      const response = await update("owner", "nope", { price: 1 });

      expect(response.status).toBe(422);
    });
  });

  describe("DELETE /packages/:id", () => {
    const remove = (role: keyof typeof tokens, id: string) =>
      request(app).delete(`${API_BASE}/packages/${id}`).set(auth(role));

    const bookOn = (tripPackageId: string, status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED") => {
      bookingDay += 7;
      const startDate = new Date(Date.now() + bookingDay * DAY);
      return prisma.booking.create({
        data: {
          customerId: users.customer,
          vehicleId: vehicles.main,
          tripPackageId,
          startDate,
          endDate: new Date(startDate.getTime() + DAY),
          pickupLocation: "Colombo",
          totalAmount: 50000,
          status,
        },
      });
    };

    it("soft-deletes the package and keeps finished bookings linked", async () => {
      const pkg = await makePackage();
      const past = await bookOn(pkg.id, "COMPLETED");
      await bookOn(pkg.id, "CANCELLED");

      const response = await remove("owner", pkg.id);

      expect(response.status).toBe(200);
      const stored = await prisma.tripPackage.findUnique({ where: { id: pkg.id } });
      expect(stored?.isRemoved).toBe(true);
      expect(stored?.removedAt).toBeInstanceOf(Date);
      const booking = await prisma.booking.findUnique({ where: { id: past.id } });
      expect(booking?.tripPackageId).toBe(pkg.id);
      expect((await request(app).get(`${API_BASE}/packages/${pkg.id}`)).status).toBe(404);
      expect((await remove("owner", pkg.id)).status).toBe(404);
    });

    it.each(["PENDING", "CONFIRMED", "ONGOING"] as const)(
      "refuses while a %s booking exists",
      async (status) => {
        const pkg = await makePackage();
        await bookOn(pkg.id, status);

        const response = await remove("owner", pkg.id);

        expect(response.status).toBe(400);
        const stored = await prisma.tripPackage.findUnique({ where: { id: pkg.id } });
        expect(stored?.isRemoved).toBe(false);
      },
    );

    it("refuses another owner", async () => {
      const pkg = await makePackage();

      const response = await remove("otherOwner", pkg.id);

      expect(response.status).toBe(403);
      const stored = await prisma.tripPackage.findUnique({ where: { id: pkg.id } });
      expect(stored?.isRemoved).toBe(false);
    });

    it("refuses a customer", async () => {
      const pkg = await makePackage();

      expect((await remove("customer", pkg.id)).status).toBe(403);
    });

    it("returns 404 for an unknown package", async () => {
      expect((await remove("owner", UNKNOWN_CUID)).status).toBe(404);
    });

    it("rejects a malformed id", async () => {
      expect((await remove("owner", "nope")).status).toBe(422);
    });
  });

  describe("POST /packages/:id/book", () => {
    const at = (days: number) => {
      const date = new Date(Date.now() + days * DAY);
      date.setUTCHours(0, 0, 0, 0);
      return date.toISOString();
    };

    const book = (role: keyof typeof tokens, id: string, body: object) =>
      request(app).post(`${API_BASE}/packages/${id}/book`).set(auth(role)).send(body);

    it("creates a pending booking spanning the package's duration", async () => {
      const pkg = await makePackage({ durationDays: 3, price: 80000 });
      const startDate = at(200);

      const response = await book("customer", pkg.id, {
        startDate,
        passengerCount: 15,
        notes: "Window seats please",
      });

      expect(response.status).toBe(201);
      const { booking } = response.body.data;
      expect(booking).toMatchObject({
        customerId: users.customer,
        vehicleId: vehicles.main,
        tripPackageId: pkg.id,
        startDate,
        endDate: new Date(Date.parse(startDate) + 2 * DAY).toISOString(),
        pickupLocation: "Colombo",
        dropoffLocation: "Kandy",
        totalPassengers: 15,
        totalAmount: 80000,
        status: "PENDING",
        notes: "Window seats please",
      });
      expect(await prisma.booking.count({ where: { id: booking.id } })).toBe(1);
    });

    it("books a one-day package as a single day", async () => {
      const pkg = await makePackage({ durationDays: 1 });
      const startDate = at(230);

      const response = await book("customer", pkg.id, { startDate, passengerCount: 10 });

      expect(response.status).toBe(201);
      expect(response.body.data.booking.endDate).toBe(startDate);
    });

    it("refuses dates that overlap an active booking on the vehicle", async () => {
      const pkg = await makePackage({ durationDays: 2 });
      const first = await book("customer", pkg.id, { startDate: at(260), passengerCount: 10 });

      const response = await book("customer", pkg.id, { startDate: at(261), passengerCount: 10 });

      expect(first.status).toBe(201);
      expect(response.status).toBe(409);
      expect(await prisma.booking.count({ where: { tripPackageId: pkg.id } })).toBe(1);
    });

    it.each([
      ["inactive package", { isActive: false }, /not currently available/],
      ["package on an inactive vehicle", { vehicleId: "inactive" }, /not currently available/],
      ["package on an unavailable vehicle", { vehicleId: "unavailable" }, /vehicle is not available/],
    ] as const)("refuses an %s", async (_label, override, message) => {
      const pkg = await makePackage({
        ...("isActive" in override ? { isActive: override.isActive } : {}),
        ...("vehicleId" in override ? { vehicleId: vehicles[override.vehicleId] } : {}),
      });

      const response = await book("customer", pkg.id, { startDate: at(300), passengerCount: 10 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(message);
    });

    it.each([
      ["below the minimum", 9],
      ["above the maximum", 31],
    ])("refuses a group %s", async (_label, passengerCount) => {
      const pkg = await makePackage();

      const response = await book("customer", pkg.id, { startDate: at(310), passengerCount });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/Passenger count/);
    });

    it("refuses a start date in the past", async () => {
      const pkg = await makePackage();

      const response = await book("customer", pkg.id, { startDate: at(-2), passengerCount: 10 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe("Start date must be in the future");
    });

    it("refuses an unparseable start date at the service layer", async () => {
      const pkg = await makePackage();

      await expect(
        bookTripPackage(pkg.id, users.customer, { startDate: "garbage", passengerCount: 10 }),
      ).rejects.toMatchObject({ statusCode: 400, message: "Invalid start date" });
    });

    it("returns 404 for a removed package", async () => {
      const pkg = await makePackage({ isRemoved: true });

      const response = await book("customer", pkg.id, { startDate: at(320), passengerCount: 10 });

      expect(response.status).toBe(404);
    });

    it("refuses an owner", async () => {
      const pkg = await makePackage();

      const response = await book("owner", pkg.id, { startDate: at(330), passengerCount: 10 });

      expect(response.status).toBe(403);
    });

    it.each([
      ["a date-only start date", { startDate: "2030-01-01", passengerCount: 10 }],
      ["zero passengers", { startDate: "2030-01-01T00:00:00.000Z", passengerCount: 0 }],
      ["overlong notes", { startDate: "2030-01-01T00:00:00.000Z", passengerCount: 10, notes: "x".repeat(501) }],
    ])("rejects %s", async (_label, body) => {
      const pkg = await makePackage();

      const response = await book("customer", pkg.id, body);

      expect(response.status).toBe(422);
    });
  });
});
