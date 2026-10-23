/**
 * Admin list filters and single-record lookups: audit logs, users, bookings,
 * disputes, review moderation, FAQs and testimonials.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1/admin";
const PREFIX = `admin-lookups-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;

describe("Admin lookups", () => {
  const ids = {
    admin: "",
    customer: "",
    owner: "",
    vehicle: "",
    booking: "",
    review: "",
    dispute: "",
    faq: "",
    testimonial: "",
    audit: "",
  };
  let token = "";

  const get = (path: string) => request(app).get(`${API_BASE}${path}`).set("Authorization", `Bearer ${token}`);
  const post = (path: string, body: object) =>
    request(app).post(`${API_BASE}${path}`).set("Authorization", `Bearer ${token}`).send(body);
  const patch = (path: string, body: object) =>
    request(app).patch(`${API_BASE}${path}`).set("Authorization", `Bearer ${token}`).send(body);

  const cleanup = async () => {
    const users = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.auditLog.deleteMany({ where: { OR: [{ adminId: { in: users } }, { entityId: { startsWith: PREFIX } }] } });
    await prisma.disputeMessage.deleteMany({ where: { dispute: { raisedBy: { in: users } } } });
    await prisma.dispute.deleteMany({ where: { raisedBy: { in: users } } });
    await prisma.review.deleteMany({ where: { customerId: { in: users } } });
    await prisma.payment.deleteMany({ where: { userId: { in: users } } });
    await prisma.vehicleAvailability.deleteMany({ where: { vehicle: { ownerId: { in: users } } } });
    await prisma.booking.deleteMany({ where: { customerId: { in: users } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.faq.deleteMany({ where: { question: { startsWith: PREFIX } } });
    await prisma.testimonial.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  };

  beforeAll(async () => {
    await cleanup();
    const make = (key: string, role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER", extra = {}) =>
      prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: key,
          lastName: "Tester",
          role,
          status: "ACTIVE",
          ...extra,
        },
      });
    ids.admin = (await make("admin", "ADMIN", { adminRole: "SUPER_ADMIN" })).id;
    ids.customer = (await make("customer", "CUSTOMER")).id;
    ids.owner = (await make("owner", "VEHICLE_OWNER", { status: "SUSPENDED" })).id;
    token = jwt.sign({ id: ids.admin, email: `${PREFIX}.admin@example.com`, role: "ADMIN" }, config.jwt.secret, {
      expiresIn: "1h",
    });

    ids.vehicle = (
      await prisma.vehicle.create({
        data: {
          ownerId: ids.owner,
          name: `${PREFIX} bus`,
          type: "ORDINARY",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: "ALZ-3344",
          seats: 40,
          fuelType: "DIESEL",
          transmission: "MANUAL",
          pricePerDay: 15000,
          location: "Colombo",
          images: [],
          amenities: [],
        },
      })
    ).id;
    const booking = await prisma.booking.create({
      data: {
        customerId: ids.customer,
        vehicleId: ids.vehicle,
        startDate: new Date(Date.now() - 5 * DAY),
        endDate: new Date(Date.now() - 4 * DAY),
        pickupLocation: `${PREFIX} Galle`,
        totalAmount: 18000,
        status: "COMPLETED",
        payment: { create: { userId: ids.customer, amount: 18000, status: "COMPLETED" } },
      },
    });
    ids.booking = booking.id;
    ids.review = (
      await prisma.review.create({
        data: {
          bookingId: booking.id,
          vehicleId: ids.vehicle,
          customerId: ids.customer,
          rating: 1,
          ratingVehicleCondition: 1,
          ratingDriverBehavior: 1,
          ratingPunctuality: 1,
          ratingCleanliness: 1,
          ratingValueForMoney: 1,
          comment: "Terrible trip",
        },
      })
    ).id;
    ids.dispute = (
      await prisma.dispute.create({
        data: {
          disputeCode: `DSP-${PREFIX}`,
          bookingId: booking.id,
          raisedBy: ids.customer,
          raisedAgainst: ids.owner,
          type: "OTHER",
          subject: `${PREFIX} late bus`,
          description: "Arrived late",
          evidenceUrls: [],
          status: "OPEN",
          priority: "LOW",
        },
      })
    ).id;
    ids.faq = (
      await prisma.faq.create({
        data: { question: `${PREFIX} How do I pay?`, answer: "By card", category: `${PREFIX}-cat`, isPublished: false },
      })
    ).id;
    ids.testimonial = (
      await prisma.testimonial.create({
        data: {
          name: `${PREFIX} Amara`,
          role: "Teacher",
          organization: "School",
          imageUrl: "https://cdn.example.com/a.jpg",
          quote: "Great trip",
          isActive: false,
        },
      })
    ).id;
    ids.audit = (
      await prisma.auditLog.create({
        data: {
          adminId: ids.admin,
          actorId: ids.admin,
          actorRole: "ADMIN",
          action: "UPDATE",
          entityType: "USER",
          entityId: `${PREFIX}-entity`,
          status: "failure",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("audit logs", () => {
    it("filters by every field and date range", async () => {
      const from = new Date(Date.now() - DAY).toISOString();
      const to = new Date(Date.now() + DAY).toISOString();
      const res = await get(
        `/audit-logs?adminId=${ids.admin}&actorId=${ids.admin}&actorRole=ADMIN&action=UPDATE&entityType=USER&entityId=${PREFIX}-entity&status=failure&dateFrom=${from}&dateTo=${to}&page=0&limit=500`,
      );

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body.data)).toContain(ids.audit);
    });

    it("rejects a malformed date", async () => {
      expect((await get("/audit-logs?dateFrom=yesterday")).status).toBe(400);
    });

    it("looks up one entry, a user's entries and an entity's entries", async () => {
      const one = await get(`/audit-logs/${ids.audit}`);
      const byUser = await get(`/audit-logs/user/${ids.admin}?page=1&limit=5`);
      const byEntity = await get(`/audit-logs/entity/USER/${PREFIX}-entity`);
      const missing = await get("/audit-logs/missing-log");

      expect(one.status).toBe(200);
      expect(JSON.stringify(one.body.data)).toContain(ids.audit);
      expect(JSON.stringify(byUser.body.data)).toContain(ids.audit);
      expect(JSON.stringify(byEntity.body.data)).toContain(ids.audit);
      expect(missing.status).toBe(404);
    });
  });

  describe("users and bookings", () => {
    it("filters users by role, status and search, and looks one up", async () => {
      const list = await get(`/users?role=VEHICLE_OWNER&status=SUSPENDED&search=${PREFIX}`);
      const one = await get(`/users/${ids.owner}`);
      const activity = await get(`/users/${ids.admin}/activity?page=1&limit=5`);

      expect(list.status).toBe(200);
      expect(JSON.stringify(list.body.data)).toContain(ids.owner);
      expect(JSON.stringify(list.body.data)).not.toContain(ids.customer);
      expect(one.body.data.ownerBookingCount).toBe(1);
      expect(activity.status).toBe(200);
      expect((await get("/users/missing-user")).status).toBe(404);
      expect((await get("/users/missing-user/activity")).status).toBe(404);
    });

    it("filters bookings by status, payment and trip dates", async () => {
      const from = new Date(Date.now() - 6 * DAY).toISOString();
      const to = new Date(Date.now() - 3 * DAY).toISOString();
      const res = await get(
        `/bookings?status=COMPLETED&paymentStatus=COMPLETED&startDateFrom=${from}&startDateTo=${to}&search=${PREFIX}`,
      );

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body.data)).toContain(ids.booking);
      expect((await get("/bookings/missing-booking")).status).toBe(404);
    });
  });

  describe("disputes", () => {
    it("filters and looks disputes up", async () => {
      const list = await get(`/disputes?status=OPEN&priority=LOW&type=OTHER&search=${PREFIX}`);
      const byCode = await get(`/disputes/DSP-${PREFIX}`);

      expect(list.status).toBe(200);
      expect(JSON.stringify(list.body.data)).toContain(ids.dispute);
      expect(byCode.status).toBe(200);
      expect((await get("/disputes/missing-dispute")).status).toBe(404);
    });

    it("raises priority with an internal note and refuses a non-admin assignee", async () => {
      const priority = await post(`/disputes/${ids.dispute}/priority`, { priority: "HIGH", note: "Customer called twice" });
      const badAssignee = await post(`/disputes/${ids.dispute}/assign`, { assignedTo: ids.customer });

      expect(priority.status).toBe(200);
      expect((await prisma.dispute.findUnique({ where: { id: ids.dispute } }))?.priority).toBe("HIGH");
      expect(
        await prisma.disputeMessage.count({ where: { disputeId: ids.dispute, isInternalNote: true } }),
      ).toBe(1);
      expect(badAssignee.status).toBe(422);
    });

    it.each([
      ["priority", { priority: "HIGH" }],
      ["status", { status: "RESOLVED" }],
      ["assign", { assignedTo: "anyone" }],
    ])("404s %s changes on an unknown dispute", async (action, body) => {
      expect((await post(`/disputes/missing-dispute/${action}`, body)).status).toBe(404);
    });
  });

  describe("review moderation", () => {
    it("flags low ratings and records hide decisions once", async () => {
      const flagged = await get(`/reviews/moderation?search=${PREFIX}&limit=50`);
      expect(flagged.status).toBe(200);
      expect(JSON.stringify(flagged.body.data)).toContain(ids.review);

      const hidden = await post(`/reviews/${ids.review}/status`, { status: "HIDDEN", reason: "Abusive" });
      const again = await post(`/reviews/${ids.review}/status`, { status: "HIDDEN", reason: "Abusive" });
      expect(hidden.status).toBe(200);
      expect(again.body.data.updated).toBe(false);

      const hiddenOnly = await get(`/reviews/moderation?status=HIDDEN&flaggedOnly=false&limit=100`);
      expect(JSON.stringify(hiddenOnly.body.data)).toContain(ids.review);

      const details = await get(`/reviews/${ids.review}`);
      expect(details.body.data.moderationStatus).toBe("HIDDEN");
      expect(details.body.data.moderationHistory.length).toBeGreaterThan(0);

      expect((await get("/reviews/missing-review")).status).toBe(404);
      expect((await post("/reviews/cm0000000000000000000000/status", { status: "HIDDEN", reason: "Abusive" })).status).toBe(404);
    });
  });

  describe("content lists", () => {
    it("filters FAQs, including unpublished ones", async () => {
      const res = await get(`/faqs?category=${PREFIX}-cat&isPublished=false&search=pay`);

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body.data)).toContain(ids.faq);
    });

    it("hides inactive testimonials unless asked", async () => {
      const active = await get(`/testimonials?search=${PREFIX}`);
      const all = await get(`/testimonials?includeInactive=true&search=${PREFIX}`);

      expect(JSON.stringify(active.body.data)).not.toContain(ids.testimonial);
      expect(JSON.stringify(all.body.data)).toContain(ids.testimonial);
      expect((await patch("/testimonials/cm0000000000000000000000", { quote: "Lovely journey" })).status).toBe(404);
      expect((await patch("/faqs/cm0000000000000000000000", { answer: "Pay by card" })).status).toBe(404);
    });
  });
});
