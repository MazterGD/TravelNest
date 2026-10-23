/**
 * Owner dashboard: verification by admins, documents, revenue, reviews,
 * analytics, earnings and the payout bank account.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = `owner-dash-${Date.now()}`;
const PLATE_PREFIX = "ODZ";
const DAY = 24 * 60 * 60 * 1000;

describe("Owner dashboard", () => {
  const users = {
    owner: "",
    other: "",
    pending: "",
    customer: "",
    superAdmin: "",
    support: "",
  };
  const tokens = { ...users };
  const vehicles = { busy: "", quiet: "", foreign: "" };
  const bookings: string[] = [];
  let plateSeq = 0;

  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (path: string, who: keyof typeof tokens = "owner") =>
    request(app).get(`${API_BASE}/owner${path}`).set(auth(who));

  const makeVehicle = (ownerId: string, name: string, isActive = true) =>
    prisma.vehicle.create({
      data: {
        ownerId,
        name,
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: `${PLATE_PREFIX}-${1000 + ++plateSeq}`,
        seats: 40,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
        isActive,
        isAvailable: isActive,
      },
    });

  const makeBooking = async (
    vehicleId: string,
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED",
    totalAmount: number,
    startInDays = -10,
  ) => {
    const booking = await prisma.booking.create({
      data: {
        customerId: users.customer,
        vehicleId,
        startDate: new Date(Date.now() + startInDays * DAY),
        endDate: new Date(Date.now() + (startInDays + 1) * DAY),
        pickupLocation: "Colombo",
        dropoffLocation: "Kandy",
        totalAmount,
        status,
      },
    });
    bookings.push(booking.id);
    return booking;
  };

  const makeReview = (
    bookingId: string,
    vehicleId: string,
    rating: number,
    ownerResponse: string | null = null,
  ) =>
    prisma.review.create({
      data: {
        bookingId,
        vehicleId,
        customerId: users.customer,
        rating,
        ratingVehicleCondition: rating,
        ratingDriverBehavior: rating,
        ratingPunctuality: rating,
        ratingCleanliness: rating,
        ratingValueForMoney: rating,
        comment: `${PREFIX} review`,
        ownerResponse,
      },
    });

  const cleanup = async () => {
    const found = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = found.map((u) => u.id);
    const vehicleIds = (
      await prisma.vehicle.findMany({
        where: { OR: [{ ownerId: { in: ids } }, { licensePlate: { startsWith: `${PLATE_PREFIX}-` } }] },
        select: { id: true },
      })
    ).map((v) => v.id);
    await prisma.review.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.payment.deleteMany({ where: { booking: { vehicleId: { in: vehicleIds } } } });
    await prisma.booking.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicleDocument.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.settlement.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.ownerBankAccount.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.ownerDocument.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.adminPermission.deleteMany({ where: { adminId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    const create = async (
      key: keyof typeof users,
      role: "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN",
      extra: { isVerified?: boolean; adminRole?: "SUPER_ADMIN" | "SUPPORT_ADMIN" } = {},
    ) => {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: key,
          lastName: "Tester",
          role,
          status: extra.isVerified === false ? "PENDING_VERIFICATION" : "ACTIVE",
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
    await create("pending", "VEHICLE_OWNER", { isVerified: false });
    await create("customer", "CUSTOMER");
    await create("superAdmin", "ADMIN", { adminRole: "SUPER_ADMIN" });
    await create("support", "ADMIN", { adminRole: "SUPPORT_ADMIN" });

    vehicles.busy = (await makeVehicle(users.owner, "Busy Bus")).id;
    vehicles.quiet = (await makeVehicle(users.owner, "Quiet Bus", false)).id;
    vehicles.foreign = (await makeVehicle(users.other, "Foreign Bus")).id;

    const done1 = await makeBooking(vehicles.busy, "COMPLETED", 30000);
    const done2 = await makeBooking(vehicles.busy, "COMPLETED", 20000, -20);
    await makeBooking(vehicles.busy, "CONFIRMED", 15000, 5);
    await makeBooking(vehicles.quiet, "CANCELLED", 9000);
    const foreignDone = await makeBooking(vehicles.foreign, "COMPLETED", 99000);

    await makeReview(done1.id, vehicles.busy, 5, "Thank you!");
    await makeReview(done2.id, vehicles.busy, 3);
    await makeReview(foreignDone.id, vehicles.foreign, 1);

    await prisma.payment.create({
      data: {
        userId: users.customer,
        bookingId: done1.id,
        amount: 30000,
        status: "COMPLETED",
        method: "CARD",
      },
    });
    await prisma.payment.create({
      data: {
        userId: users.customer,
        bookingId: done2.id,
        amount: 20000,
        status: "REFUNDED",
        method: "BANK_TRANSFER",
      },
    });
    await prisma.payment.create({
      data: { userId: users.customer, bookingId: foreignDone.id, amount: 99000, status: "COMPLETED" },
    });

    await prisma.settlement.create({
      data: {
        settlementCode: `${PREFIX}-S1`,
        ownerId: users.owner,
        period: "2026-09",
        totalBookings: 2,
        grossAmount: 50000,
        commissionAmount: 5000,
        netAmount: 45000,
        status: "PENDING",
      },
    });
    await prisma.settlement.create({
      data: {
        settlementCode: `${PREFIX}-S2`,
        ownerId: users.owner,
        period: "2026-08",
        totalBookings: 1,
        grossAmount: 10000,
        commissionAmount: 1000,
        netAmount: 9000,
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("PATCH /owner/:id/verify", () => {
    const verify = (ownerId: string, body: object, who: keyof typeof tokens = "superAdmin") =>
      request(app).patch(`${API_BASE}/owner/${ownerId}/verify`).set(auth(who)).send(body);

    it("lets a super admin verify an owner and activates their fleet", async () => {
      const vehicle = await makeVehicle(users.pending, "Pending Bus", false);
      await prisma.ownerDocument.create({
        data: {
          ownerId: users.pending,
          type: "NIC",
          url: `storage://private/owner-documents/${PREFIX}/nic.pdf`,
          fileName: "nic.pdf",
          fileSize: 10,
          mimeType: "application/pdf",
        },
      });

      const res = await verify(users.pending, { isVerified: true });

      expect(res.status).toBe(200);
      expect(res.body.data.owner.password).toBeUndefined();
      const owner = await prisma.user.findUnique({ where: { id: users.pending } });
      expect(owner).toMatchObject({ isVerified: true, status: "ACTIVE", verifiedBy: users.superAdmin });
      const bus = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
      expect(bus).toMatchObject({ isActive: true, isAvailable: true });
      const docs = await prisma.ownerDocument.findMany({ where: { ownerId: users.pending } });
      expect(docs.every((d) => d.status === "VERIFIED")).toBe(true);
    });

    it("can revoke a verification", async () => {
      const res = await verify(users.pending, { isVerified: false });

      expect(res.status).toBe(200);
      const owner = await prisma.user.findUnique({ where: { id: users.pending } });
      expect(owner).toMatchObject({ isVerified: false, status: "PENDING_VERIFICATION", verifiedBy: null });
      expect(owner?.rejectedAt).not.toBeNull();
    });

    it("requires the verification permission, not just any admin role", async () => {
      const denied = await verify(users.pending, { isVerified: true }, "support");
      expect(denied.status).toBe(403);

      await prisma.adminPermission.create({
        data: {
          adminId: users.support,
          permission: "admin.verifications.approve",
          grantedBy: users.superAdmin,
        },
      });
      const allowed = await verify(users.pending, { isVerified: true }, "support");
      expect(allowed.status).toBe(200);
    });

    it("rejects bad input, non-owners, unknown users and non-admins", async () => {
      expect((await verify(users.pending, { isVerified: "yes" })).status).toBe(422);
      expect((await verify(users.customer, { isVerified: true })).status).toBe(400);
      expect((await verify("missing-user", { isVerified: true })).status).toBe(404);
      expect((await verify(users.pending, { isVerified: true }, "owner")).status).toBe(403);
    });
  });

  describe("documents", () => {
    it("lists and removes only the caller's own documents", async () => {
      const mine = await prisma.ownerDocument.create({
        data: {
          ownerId: users.owner,
          type: "DRIVING_LICENSE",
          url: `storage://private/owner-documents/${PREFIX}/dl.pdf`,
          fileName: "dl.pdf",
          fileSize: 10,
          mimeType: "application/pdf",
        },
      });
      const theirs = await prisma.ownerDocument.create({
        data: {
          ownerId: users.other,
          type: "NIC",
          url: `storage://private/owner-documents/${PREFIX}/other.pdf`,
          fileName: "other.pdf",
          fileSize: 10,
          mimeType: "application/pdf",
        },
      });

      const list = await get("/documents");
      expect(list.status).toBe(200);
      const ids = JSON.stringify(list.body.data);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);

      const foreign = await request(app)
        .delete(`${API_BASE}/owner/documents/${theirs.id}`)
        .set(auth("owner"));
      const missing = await request(app)
        .delete(`${API_BASE}/owner/documents/missing-doc`)
        .set(auth("owner"));
      const removed = await request(app)
        .delete(`${API_BASE}/owner/documents/${mine.id}`)
        .set(auth("owner"));

      expect(foreign.status).toBe(403);
      expect(missing.status).toBe(404);
      expect(removed.status).toBe(200);
      const row = await prisma.ownerDocument.findUnique({ where: { id: mine.id } });
      expect(row?.isRemoved).toBe(true);
      expect((await prisma.ownerDocument.findUnique({ where: { id: theirs.id } }))?.isRemoved).toBe(false);
    });
  });

  describe("dashboard widgets", () => {
    it("charts six months of completed revenue", async () => {
      const res = await get("/dashboard/revenue-chart");

      expect(res.status).toBe(200);
      const months = res.body.data.chartData ?? res.body.data;
      expect(months).toHaveLength(6);
      const total = months.reduce((sum: number, m: { revenue: number }) => sum + m.revenue, 0);
      expect(total).toBe(50000);
    });

    it("shows the latest reviews of the owner's own vehicles", async () => {
      const res = await get("/dashboard/recent-reviews");

      expect(res.status).toBe(200);
      const reviews = res.body.data.reviews ?? res.body.data;
      expect(reviews).toHaveLength(2);
      expect(reviews.map((r: { vehicleName: string }) => r.vehicleName)).toEqual(["Busy Bus", "Busy Bus"]);
    });
  });

  describe("reviews", () => {
    it("pages and filters the owner's reviews", async () => {
      const all = await get("/reviews");
      const fiveStar = await get("/reviews?rating=5");
      const answered = await get("/reviews?hasResponse=true");
      const unanswered = await get("/reviews?hasResponse=false&page=1&limit=1");

      expect(all.status).toBe(200);
      expect(all.body.data.pagination.total).toBe(2);
      expect(fiveStar.body.data.reviews.map((r: { rating: number }) => r.rating)).toEqual([5]);
      expect(answered.body.data.reviews[0].ownerResponse).toBe("Thank you!");
      expect(unanswered.body.data.reviews).toHaveLength(1);
      expect(unanswered.body.data.reviews[0].rating).toBe(3);
      expect(unanswered.body.data.pagination).toMatchObject({ page: 1, limit: 1, total: 1, totalPages: 1 });
    });

    it("summarises ratings and response rate", async () => {
      const res = await get("/reviews/summary");

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        averageRating: 4,
        totalReviews: 2,
        pendingResponses: 1,
        responseRate: 50,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
      });
      expect(res.body.data.dimensionAverages.punctuality).toBe(4);
    });

    it("returns an empty summary for an owner with no reviews", async () => {
      const res = await get("/reviews/summary", "pending");

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ averageRating: 0, totalReviews: 0, responseRate: 0 });
      expect(res.body.data.dimensionAverages.cleanliness).toBeNull();
    });
  });

  describe("analytics", () => {
    it("summarises revenue, bookings and fleet use", async () => {
      const res = await get("/analytics/overview");

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        totalRevenue: 50000,
        totalBookings: 4,
        completedBookings: 2,
        completionRate: 50,
        totalVehicles: 2,
        activeVehicles: 1,
        fleetUtilization: 50,
        averageRating: 4,
      });
    });

    it("reports zeros for a new owner", async () => {
      const res = await get("/analytics/overview", "other");

      expect(res.status).toBe(200);
      const empty = await request(app)
        .get(`${API_BASE}/owner/analytics/overview`)
        .set(auth("pending"));
      expect(empty.body.data).toMatchObject({ totalBookings: 0, completionRate: 0, averageRating: 0 });
    });

    it("charts six months of revenue and bookings", async () => {
      const res = await get("/analytics/revenue");

      expect(res.status).toBe(200);
      const months = res.body.data.revenue ?? res.body.data;
      expect(months).toHaveLength(6);
      expect(months.reduce((s: number, m: { bookings: number }) => s + m.bookings, 0)).toBe(4);
    });

    it("ranks vehicles by revenue", async () => {
      const res = await get("/analytics/vehicles");

      expect(res.status).toBe(200);
      const rows = res.body.data.vehicles ?? res.body.data;
      expect(rows.map((v: { id: string }) => v.id)).toEqual([vehicles.busy, vehicles.quiet]);
      expect(rows[0]).toMatchObject({ totalBookings: 3, completedBookings: 2, revenue: 50000, averageRating: 4, reviewCount: 2 });
      expect(rows[1]).toMatchObject({ revenue: 0, averageRating: 0, isActive: false });
    });

    it("lists one vehicle's bookings only for its owner", async () => {
      const mine = await get(`/analytics/vehicles/${vehicles.busy}/bookings`);
      const foreign = await get(`/analytics/vehicles/${vehicles.foreign}/bookings`);

      expect(mine.status).toBe(200);
      expect((mine.body.data.bookings ?? mine.body.data)).toHaveLength(3);
      expect(foreign.status).toBe(200);
      expect((foreign.body.data.bookings ?? foreign.body.data)).toHaveLength(0);
    });
  });

  describe("earnings", () => {
    it("summarises completed earnings and the unpaid settlement balance", async () => {
      const res = await get("/earnings/summary");

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ lifetimeEarnings: 50000, pendingBalance: 45000 });
      expect(res.body.data.thisYearEarnings).toBeGreaterThanOrEqual(res.body.data.thisMonthEarnings);
    });

    it("lists only the owner's payments, with filters", async () => {
      const all = await get("/earnings/transactions");
      const refunded = await get("/earnings/transactions?status=REFUNDED");
      const future = await get(
        `/earnings/transactions?from=${new Date(Date.now() + DAY).toISOString()}&to=${new Date(Date.now() + 2 * DAY).toISOString()}`,
      );
      const bad = await get("/earnings/transactions?status=LOST");

      expect(all.status).toBe(200);
      expect(all.body.data.total).toBe(2);
      expect(all.body.data.transactions[0]).toMatchObject({ route: "Colombo → Kandy", currency: "LKR" });
      expect(all.body.data.transactions[0].bookingRef).toMatch(/^BK-/);
      expect(refunded.body.data.transactions.map((t: { status: string }) => t.status)).toEqual(["REFUNDED"]);
      expect(future.body.data).toMatchObject({ total: 0, totalPages: 1 });
      expect(bad.status).toBe(422);
    });

    it("lists settlements without bank details", async () => {
      const res = await get("/earnings/settlements");

      expect(res.status).toBe(200);
      const rows = res.body.data.settlements ?? res.body.data;
      expect(rows).toHaveLength(2);
      const paid = rows.find((s: { status: string }) => s.status === "COMPLETED");
      expect(paid.processedAt).not.toBeNull();
      expect(JSON.stringify(rows)).not.toMatch(/accountNumber/);
    });
  });

  describe("bank account", () => {
    it("starts empty, then stores the number encrypted and shows it masked", async () => {
      const empty = await get("/bank-account");
      expect(empty.status).toBe(200);
      expect(empty.body.data?.account ?? empty.body.data).toBeNull();

      const saved = await request(app)
        .put(`${API_BASE}/owner/bank-account`)
        .set(auth("owner"))
        .send({
          accountHolderName: "  Nuwan <b>Perera</b> ",
          accountNumber: "1234-5678 9012",
          bankName: "Bank of Ceylon",
          branchName: "Kandy",
        });

      expect(saved.status).toBe(200);
      const account = saved.body.data.account ?? saved.body.data;
      expect(account).toMatchObject({
        accountHolderName: "Nuwan Perera",
        bankName: "Bank of Ceylon",
        branchName: "Kandy",
        bankCode: null,
        isPrimary: true,
      });
      expect(account.accountNumberMasked).toMatch(/9012$/);
      expect(account.accountNumberMasked).not.toContain("1234");

      const stored = await prisma.ownerBankAccount.findFirst({ where: { ownerId: users.owner } });
      expect(stored?.accountNumber).not.toContain("123456789012");
    });

    it("replaces the previous account and masks unreadable numbers as null", async () => {
      await request(app)
        .put(`${API_BASE}/owner/bank-account`)
        .set(auth("owner"))
        .send({ accountHolderName: "Nuwan Perera", accountNumber: "99887766", bankName: "HNB", bankCode: "7083", branchCode: "001" });

      expect(await prisma.ownerBankAccount.count({ where: { ownerId: users.owner } })).toBe(1);

      await prisma.ownerBankAccount.updateMany({
        where: { ownerId: users.owner },
        data: { accountNumber: "enc:v1:broken" },
      });
      const res = await get("/bank-account");
      expect((res.body.data.account ?? res.body.data).accountNumberMasked).toBeNull();
    });

    it("rejects an account number with letters", async () => {
      const res = await request(app)
        .put(`${API_BASE}/owner/bank-account`)
        .set(auth("owner"))
        .send({ accountHolderName: "Nuwan", accountNumber: "ABC12345", bankName: "HNB" });

      expect(res.status).toBe(422);
    });
  });

  it("keeps customers out of the owner dashboard", async () => {
    expect((await get("/earnings/summary", "customer")).status).toBe(403);
    expect((await get("/analytics/overview", "customer")).status).toBe(403);
  });
});
