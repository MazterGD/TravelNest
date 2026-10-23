/**
 * Admin dashboard: role/permission gate, KPI overview, monthly charts (range
 * clamping + bucket counts), merged activity feed and pending-action severity.
 * Platform-wide figures are asserted as deltas around this file's fixtures.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "admin.dashboard.ov";
const TAG = `dash${Date.now().toString(36)}`;
const DAY = 24 * 60 * 60 * 1000;

type AdminRole = "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN";

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

describe("Admin dashboard", () => {
  const tokens: Partial<Record<AdminRole | "CUSTOMER", string>> = {};
  let ownerVerifiedId = "";
  let customerId = "";
  let vehicleId = "";
  let bookingSeq = 0;

  const sign = (id: string, email: string, role: string) =>
    jwt.sign({ id, email, role }, config.jwt.secret, { expiresIn: "1h" });

  const createUser = (
    label: string,
    role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER",
    extra: { adminRole?: AdminRole; isVerified?: boolean; status?: "ACTIVE" | "INACTIVE" } = {},
  ) =>
    prisma.user.create({
      data: {
        email: `${PREFIX}.${label}.${TAG}@example.com`,
        password: "hashed",
        firstName: "Dash",
        lastName: label,
        role,
        status: extra.status ?? "ACTIVE",
        adminRole: extra.adminRole,
        isVerified: extra.isVerified ?? false,
      },
    });

  const createBooking = (status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED") => {
    bookingSeq += 1;
    return prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        startDate: new Date(Date.now() + (10 + bookingSeq) * DAY),
        endDate: new Date(Date.now() + (11 + bookingSeq) * DAY),
        pickupLocation: "Colombo",
        totalAmount: 10000,
        status,
      },
    });
  };

  const cleanup = async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: ids } }, { entityType: TAG }] },
    });
    await prisma.adminPermission.deleteMany({ where: { adminId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  const get = (path: string, who: AdminRole | "CUSTOMER" = "SUPER_ADMIN") =>
    request(app)
      .get(`${API_BASE}/admin/dashboard${path}`)
      .set("Authorization", `Bearer ${tokens[who]}`);

  beforeAll(async () => {
    await cleanup();
    for (const role of ["SUPER_ADMIN", "MODERATOR", "FINANCE_ADMIN", "SUPPORT_ADMIN"] as const) {
      const admin = await createUser(role.toLowerCase(), "ADMIN", { adminRole: role, isVerified: true });
      tokens[role] = sign(admin.id, admin.email, "ADMIN");
      if (role === "FINANCE_ADMIN" || role === "SUPPORT_ADMIN") {
        await prisma.adminPermission.create({
          data: { adminId: admin.id, permission: "dashboard.view", grantedBy: admin.id },
        });
      }
    }
    const customer = await createUser("customer", "CUSTOMER");
    customerId = customer.id;
    tokens.CUSTOMER = sign(customer.id, customer.email, "CUSTOMER");
    const owner = await createUser("owner", "VEHICLE_OWNER", { isVerified: true });
    ownerVerifiedId = owner.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: owner.id,
        name: `${TAG} Coach`,
        type: "SEMI_LUXURY",
        brand: "Lanka",
        model: "Coach",
        year: 2021,
        licensePlate: `${TAG}-1`.toUpperCase(),
        seats: 35,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 20000,
        location: "Kandy",
        images: [],
        amenities: [],
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(cleanup);

  describe("access control", () => {
    it("rejects non-admin users", async () => {
      const response = await get("", "CUSTOMER");
      expect(response.status).toBe(403);
    });

    it("requires the dashboard.view permission for non-super admins", async () => {
      const denied = await get("", "MODERATOR");
      const finance = await get("", "FINANCE_ADMIN");
      const support = await get("/pending-actions", "SUPPORT_ADMIN");

      expect(denied.status).toBe(403);
      expect(finance.status).toBe(200);
      expect(support.status).toBe(200);
    });
  });

  it("counts new users, vehicles, bookings and payments in the overview", async () => {
    const before = (await get("")).body.data;

    await createUser("owner-unverified", "VEHICLE_OWNER");
    await createUser("inactive", "CUSTOMER", { status: "INACTIVE" });
    await prisma.vehicle.create({
      data: {
        ownerId: ownerVerifiedId,
        name: `${TAG} Spare`,
        type: "ORDINARY",
        brand: "Lanka",
        model: "Mini",
        year: 2019,
        licensePlate: `${TAG}-2`.toUpperCase(),
        seats: 20,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 10000,
        location: "Galle",
        images: [],
        amenities: [],
        isActive: false,
      },
    });
    const pending = await createBooking("PENDING");
    const completed = await createBooking("COMPLETED");
    await prisma.payment.create({
      data: { userId: customerId, bookingId: completed.id, amount: 1500.5, status: "COMPLETED" },
    });
    await prisma.payment.create({
      data: { userId: customerId, bookingId: pending.id, amount: 900, status: "FAILED" },
    });

    const response = await get("");
    const after = response.body.data;

    expect(response.status).toBe(200);
    expect(after.users.total - before.users.total).toBe(2);
    expect(after.users.active - before.users.active).toBe(1);
    expect(after.users.owners - before.users.owners).toBe(1);
    expect(after.users.verifiedOwners).toBe(before.users.verifiedOwners);
    expect(after.users.ownerVerificationRate).toBeCloseTo(
      (after.users.verifiedOwners / after.users.owners) * 100,
      1,
    );
    expect(after.vehicles.total - before.vehicles.total).toBe(1);
    expect(after.vehicles.active).toBe(before.vehicles.active);
    expect(after.bookings.total - before.bookings.total).toBe(2);
    expect(after.bookings.pending - before.bookings.pending).toBe(1);
    expect(after.bookings.completed - before.bookings.completed).toBe(1);
    expect(after.bookings.completionRate).toBeCloseTo(
      (after.bookings.completed / after.bookings.total) * 100,
      1,
    );
    expect(after.finance.totalRevenue - before.finance.totalRevenue).toBeCloseTo(1500.5, 2);
    expect(after.finance.successfulPaymentCount - before.finance.successfulPaymentCount).toBe(1);
    expect(after.finance.failedPaymentCount - before.finance.failedPaymentCount).toBe(1);
  });

  describe("charts", () => {
    it("clamps the month range to 3..24 and defaults to 6", async () => {
      const [tooFew, tooMany, junk] = await Promise.all([
        get("/charts/revenue?months=1"),
        get("/charts/users?months=99"),
        get("/charts/bookings?months=abc"),
      ]);

      expect(tooFew.body.data).toHaveLength(3);
      expect(tooMany.body.data).toHaveLength(24);
      expect(junk.body.data).toHaveLength(6);
      expect(tooFew.body.data[2].key).toBe(currentMonthKey());
      expect(tooFew.body.data[0].month).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    });

    it("buckets this month's revenue, bookings and signups", async () => {
      const month = currentMonthKey();
      const pick = (rows: Array<{ key: string }>) => rows.find((row) => row.key === month)!;

      const revenueBefore = pick((await get("/charts/revenue?months=3")).body.data);
      const usersBefore = pick((await get("/charts/users?months=3")).body.data);
      const trendsBefore = pick((await get("/charts/bookings?months=3")).body.data);

      await createUser("chart-admin", "ADMIN", { adminRole: "MODERATOR" });
      await createUser("chart-owner", "VEHICLE_OWNER");
      await createUser("chart-customer", "CUSTOMER");
      const statuses = ["PENDING", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"] as const;
      const bookings = [];
      for (const status of statuses) bookings.push(await createBooking(status));
      await prisma.payment.create({
        data: { userId: customerId, bookingId: bookings[3].id, amount: 250.25, status: "COMPLETED" },
      });
      await prisma.payment.create({
        data: { userId: customerId, bookingId: bookings[4].id, amount: 999, status: "REFUNDED" },
      });

      const revenue = pick((await get("/charts/revenue?months=3")).body.data);
      const users = pick((await get("/charts/users?months=3")).body.data);
      const trends = pick((await get("/charts/bookings?months=3")).body.data);

      expect(revenue.revenue - revenueBefore.revenue).toBeCloseTo(250.25, 2);
      expect(revenue.bookings - revenueBefore.bookings).toBe(5);
      expect(users).toMatchObject({
        total: usersBefore.total + 3,
        admins: usersBefore.admins + 1,
        owners: usersBefore.owners + 1,
        customers: usersBefore.customers + 1,
      });
      expect(trends).toMatchObject({
        total: trendsBefore.total + 5,
        pending: trendsBefore.pending + 1,
        confirmed: trendsBefore.confirmed + 1,
        ongoing: trendsBefore.ongoing + 1,
        completed: trendsBefore.completed + 1,
        cancelled: trendsBefore.cancelled + 1,
      });
    });

    it("reports zeroed buckets for months without activity", async () => {
      const response = await get("/charts/bookings?months=24");
      const oldest = response.body.data[0];

      expect(oldest).toMatchObject({
        total: 0,
        pending: 0,
        confirmed: 0,
        ongoing: 0,
        completed: 0,
        cancelled: 0,
      });
      const users = await get("/charts/users?months=24");
      expect(users.body.data[0]).toMatchObject({ total: 0, customers: 0, owners: 0, admins: 0 });
      const revenue = await get("/charts/revenue?months=24");
      expect(revenue.body.data[0]).toMatchObject({ revenue: 0, bookings: 0 });
    });
  });

  describe("activity feed", () => {
    it("merges bookings, signups and audit entries newest first", async () => {
      const booking = await createBooking("CONFIRMED");
      const actor = await createUser("actor", "CUSTOMER");
      const now = Date.now();
      const actorLog = await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: "CUSTOMER",
          action: "BOOKING_CREATE",
          entityType: TAG,
          entityId: "x",
          createdAt: new Date(now + 60_000),
        },
      });
      const anonymousLog = await prisma.auditLog.create({
        data: {
          action: "SYSTEM_SWEEP",
          entityType: TAG,
          entityId: "y",
          status: "failure",
          createdAt: new Date(now + 120_000),
        },
      });

      const response = await get("/activity-feed?limit=50");
      const events = response.body.data as Array<{
        id: string;
        type: string;
        description: string;
        timestamp: string;
        status?: string;
      }>;

      expect(response.status).toBe(200);
      expect(events.length).toBeLessThanOrEqual(50);
      expect(events[0]).toMatchObject({
        id: `audit-${anonymousLog.id}`,
        description: "A user performed SYSTEM_SWEEP",
        status: "failure",
      });
      expect(events[1]).toMatchObject({
        id: `audit-${actorLog.id}`,
        description: "Dash actor performed BOOKING_CREATE",
      });
      expect(events.find((e) => e.id === `booking-${booking.id}`)?.description).toBe(
        `Dash customer created a booking for ${TAG} Coach`,
      );
      expect(events.find((e) => e.id === `user-${actor.id}`)?.description).toBe(
        "Dash actor joined as CUSTOMER",
      );
      const times = events.map((e) => new Date(e.timestamp).getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    });

    it("clamps the limit to 1..100 and defaults to 20", async () => {
      const [one, fallback, capped] = await Promise.all([
        get("/activity-feed?limit=-5"),
        get("/activity-feed"),
        get("/activity-feed?limit=1000"),
      ]);

      expect(one.body.data).toHaveLength(1);
      expect(fallback.body.data.length).toBeLessThanOrEqual(20);
      expect(fallback.body.data.length).toBeGreaterThan(1);
      expect(capped.body.data.length).toBeLessThanOrEqual(100);
    });
  });

  it("grades pending actions by count", async () => {
    const pendingBefore = (await get("/pending-actions")).body.data.find(
      (a: { id: string }) => a.id === "pending-bookings",
    ).count;
    for (let i = 0; i < 20; i += 1) await createBooking("PENDING");

    const response = await get("/pending-actions");
    const actions = response.body.data as Array<{ id: string; count: number; severity: string; href: string }>;

    expect(response.status).toBe(200);
    expect(actions.map((a) => a.id)).toEqual([
      "owner-approvals",
      "vehicle-approvals",
      "pending-bookings",
      "failed-payments",
      "open-disputes",
      "pending-settlements",
    ]);
    const pending = actions.find((a) => a.id === "pending-bookings")!;
    expect(pending.count).toBe(pendingBefore + 20);
    expect(pending.severity).toBe("high");
    for (const action of actions) {
      const expected = action.count >= 20 ? "high" : action.count >= 5 ? "medium" : "low";
      expect(action.severity).toBe(expected);
    }
  });
});
