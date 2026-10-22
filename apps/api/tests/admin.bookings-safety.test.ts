/**
 * Admin booking overrides (ADM-2, ADM-3, ADR-002): status changes follow the
 * booking lifecycle, confirming a booking requires its money to be in, and
 * cancel-with-refund refunds only money actually received, once.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "admin.booking.safety";
const AMOUNT = 45000;
const DAY = 24 * 60 * 60 * 1000;

type AdminRole = "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN";

describe("Admin booking safety", () => {
  let customerId = "";
  let ownerId = "";
  let vehicleId = "";
  const tokens: Partial<Record<AdminRole, string>> = {};
  let dayOffset = 5;

  const cleanup = async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.settlement.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { licensePlate: "ADM-SAFE-1" } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  const createAdmin = async (adminRole: AdminRole) => {
    const admin = await prisma.user.create({
      data: {
        email: `${PREFIX}.${adminRole.toLowerCase()}@example.com`,
        password: "hashed",
        firstName: "Safety",
        lastName: adminRole,
        role: "ADMIN",
        adminRole,
        status: "ACTIVE",
      },
    });
    await prisma.adminPermission.createMany({
      data: ["admin.bookings.update_status", "admin.bookings.cancel_refund"].map(
        (permission) => ({ adminId: admin.id, permission, grantedBy: admin.id }),
      ),
    });
    tokens[adminRole] = jwt.sign(
      { id: admin.id, email: admin.email, role: "ADMIN" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  };

  beforeAll(async () => {
    await cleanup();
    const customer = await prisma.user.create({
      data: {
        email: `${PREFIX}.customer@example.com`,
        password: "hashed",
        firstName: "Safety",
        lastName: "Customer",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    customerId = customer.id;
    const owner = await prisma.user.create({
      data: {
        email: `${PREFIX}.owner@example.com`,
        password: "hashed",
        firstName: "Safety",
        lastName: "Owner",
        role: "VEHICLE_OWNER",
        status: "ACTIVE",
        isVerified: true,
      },
    });
    ownerId = owner.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId,
        name: "Admin Safety Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "ADM-SAFE-1",
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
      },
    });
    vehicleId = vehicle.id;
    await createAdmin("MODERATOR");
    await createAdmin("FINANCE_ADMIN");
  });

  afterAll(cleanup);

  const createBooking = async (
    status: "PENDING" | "CONFIRMED" | "COMPLETED",
    payment?: {
      method: "CASH" | "BANK_TRANSFER" | "CARD";
      status: "PENDING" | "PROCESSING" | "COMPLETED";
    },
  ) => {
    dayOffset += 3;
    const startDate = new Date(Date.now() + dayOffset * DAY);
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        startDate,
        endDate: new Date(startDate.getTime() + DAY),
        pickupLocation: "Colombo",
        totalAmount: AMOUNT,
        status,
        ...(payment && {
          payment: {
            create: {
              userId: customerId,
              amount: AMOUNT,
              currency: "LKR",
              ...payment,
            },
          },
        }),
      },
    });
    return booking.id;
  };

  const setStatus = (bookingId: string, status: string, role: AdminRole) =>
    request(app)
      .patch(`${API_BASE}/admin/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${tokens[role]}`)
      .send({ status });

  const cancelWithRefund = (bookingId: string, body: object = {}) =>
    request(app)
      .post(`${API_BASE}/admin/bookings/${bookingId}/cancel-with-refund`)
      .set("Authorization", `Bearer ${tokens.FINANCE_ADMIN}`)
      .send({ refundReason: "Admin decision", ...body });

  describe("status override", () => {
    it("refuses to confirm a booking without a payment", async () => {
      const bookingId = await createBooking("PENDING");

      const response = await setStatus(bookingId, "CONFIRMED", "FINANCE_ADMIN");

      expect(response.status).toBe(400);
    });

    it("lets only finance admins confirm a received bank transfer", async () => {
      const bookingId = await createBooking("PENDING", {
        method: "BANK_TRANSFER",
        status: "PROCESSING",
      });

      const denied = await setStatus(bookingId, "CONFIRMED", "MODERATOR");
      expect(denied.status).toBe(403);

      const allowed = await setStatus(bookingId, "CONFIRMED", "FINANCE_ADMIN");
      expect(allowed.status).toBe(200);
      expect(allowed.body.data.status).toBe("CONFIRMED");

      const payment = await prisma.payment.findUnique({ where: { bookingId } });
      expect(payment?.status).toBe("COMPLETED");
      expect(
        await prisma.vehicleAvailability.findFirst({
          where: { reason: `Booking ${bookingId}` },
        }),
      ).not.toBeNull();
      expect(
        (await prisma.settlementBooking.findFirst({ where: { bookingId } }))
          ?.amount,
      ).toBe(AMOUNT);
    });

    it("refuses to move a booking out of a final state", async () => {
      const bookingId = await createBooking("COMPLETED");

      const response = await setStatus(bookingId, "CONFIRMED", "FINANCE_ADMIN");

      expect(response.status).toBe(400);
    });

    it("sends paid cancellations through cancel with refund", async () => {
      const bookingId = await createBooking("CONFIRMED", {
        method: "BANK_TRANSFER",
        status: "COMPLETED",
      });

      const response = await setStatus(bookingId, "CANCELLED", "MODERATOR");

      expect(response.status).toBe(400);
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.status).toBe("CONFIRMED");
    });
  });

  describe("cancel with refund", () => {
    it("does not record a refund for money that was never received", async () => {
      const bookingId = await createBooking("PENDING", {
        method: "BANK_TRANSFER",
        status: "PENDING",
      });

      const response = await cancelWithRefund(bookingId);

      expect(response.status).toBe(200);
      const payment = await prisma.payment.findUnique({ where: { bookingId } });
      expect(payment?.status).toBe("PENDING");
      expect(payment?.refundAmount).toBeNull();
    });

    it("rejects a refund amount on an unpaid booking", async () => {
      const bookingId = await createBooking("PENDING", {
        method: "BANK_TRANSFER",
        status: "PENDING",
      });

      const response = await cancelWithRefund(bookingId, { refundAmount: 1000 });

      expect(response.status).toBe(400);
    });

    it("refunds once when two cancellations race", async () => {
      const bookingId = await createBooking("CONFIRMED", {
        method: "BANK_TRANSFER",
        status: "COMPLETED",
      });

      const responses = await Promise.all([
        cancelWithRefund(bookingId),
        cancelWithRefund(bookingId),
      ]);

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses[0]).toBe(200);
      expect(statuses[1]).toBeGreaterThanOrEqual(400);
      const refundNotifications = await prisma.notification.count({
        where: {
          userId: customerId,
          type: "booking_refund",
          data: { path: ["bookingId"], equals: bookingId },
        },
      });
      expect(refundNotifications).toBe(1);
    });
  });
});
