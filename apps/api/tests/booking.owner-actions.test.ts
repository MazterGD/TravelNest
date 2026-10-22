/**
 * Owner booking actions (PAY-4, PAY-11, ADR-002): reject refunds and unwinds a
 * paid booking, confirm is only for cash collected on site, and only an
 * ongoing trip can be completed.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { applyPaymentCompletion } from "../src/modules/payment/payment.service";

const API_BASE = "/api/v1";
const EMAILS = {
  customer: "owner.actions.customer@example.com",
  owner: "owner.actions.owner@example.com",
  otherOwner: "owner.actions.other@example.com",
};
const AMOUNT = 30000;
const DAY = 24 * 60 * 60 * 1000;

describe("Owner booking actions", () => {
  let customerId = "";
  let vehicleId = "";
  let ownerToken = "";
  let otherOwnerToken = "";
  let dayOffset = 10;

  const cleanup = async () => {
    const owner = await prisma.user.findUnique({
      where: { email: EMAILS.owner },
    });
    if (owner) {
      await prisma.settlement.deleteMany({ where: { ownerId: owner.id } });
    }
    await prisma.vehicle.deleteMany({ where: { licensePlate: "OWN-ACT-1" } });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(EMAILS) } },
    });
  };

  const makeUser = (email: string, role: "CUSTOMER" | "VEHICLE_OWNER") =>
    prisma.user.create({
      data: {
        email,
        password: "hashed",
        firstName: "Owner",
        lastName: "Actions",
        role,
        status: "ACTIVE",
        isVerified: true,
      },
    });

  const tokenFor = (user: { id: string; email: string; role: string }) =>
    jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: "1h" },
    );

  beforeAll(async () => {
    await cleanup();
    const customer = await makeUser(EMAILS.customer, "CUSTOMER");
    customerId = customer.id;
    const owner = await makeUser(EMAILS.owner, "VEHICLE_OWNER");
    const otherOwner = await makeUser(EMAILS.otherOwner, "VEHICLE_OWNER");
    ownerToken = tokenFor(owner);
    otherOwnerToken = tokenFor(otherOwner);
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: owner.id,
        name: "Owner Action Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "OWN-ACT-1",
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
  });

  afterAll(cleanup);

  const createBooking = async (
    status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED",
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

  const ownerCall = (path: string, token = ownerToken, body: object = {}) =>
    request(app)
      .patch(`${API_BASE}/bookings/${path}`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  describe("reject", () => {
    it("refunds a paid booking in full and unwinds calendar and settlement", async () => {
      const bookingId = await createBooking("PENDING", {
        method: "BANK_TRANSFER",
        status: "COMPLETED",
      });
      await applyPaymentCompletion(bookingId);

      const response = await ownerCall(`${bookingId}/reject`, ownerToken, {
        reason: "Vehicle breakdown",
      });

      expect(response.status).toBe(200);
      const payment = await prisma.payment.findUnique({ where: { bookingId } });
      expect(payment?.status).toBe("REFUNDED");
      expect(payment?.refundAmount).toBe(AMOUNT);
      expect(
        await prisma.vehicleAvailability.findFirst({
          where: { reason: `Booking ${bookingId}` },
        }),
      ).toBeNull();
      expect(
        await prisma.settlementBooking.findFirst({ where: { bookingId } }),
      ).toBeNull();
    });

    it("refuses to cancel a completed or ongoing trip", async () => {
      for (const status of ["COMPLETED", "ONGOING"] as const) {
        const bookingId = await createBooking(status);
        const response = await ownerCall(`${bookingId}/reject`);
        expect(response.status).toBe(400);
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(booking?.status).toBe(status);
      }
    });

    it("forbids another owner from cancelling the booking", async () => {
      const bookingId = await createBooking("PENDING");

      const response = await ownerCall(
        `${bookingId}/reject`,
        otherOwnerToken,
      );

      expect(response.status).toBe(403);
    });
  });

  describe("confirm (cash)", () => {
    it("confirms a cash booking and books it like a paid booking", async () => {
      const bookingId = await createBooking("PENDING", {
        method: "CASH",
        status: "PENDING",
      });

      const response = await ownerCall(`${bookingId}/confirm`);

      expect(response.status).toBe(200);
      expect(response.body.data.booking.status).toBe("CONFIRMED");
      const payment = await prisma.payment.findUnique({ where: { bookingId } });
      expect(payment?.status).toBe("COMPLETED");
      expect(
        await prisma.vehicleAvailability.findFirst({
          where: { reason: `Booking ${bookingId}` },
        }),
      ).not.toBeNull();
      const line = await prisma.settlementBooking.findFirst({
        where: { bookingId },
      });
      expect(line?.amount).toBe(AMOUNT);
    });

    it("does not let the owner confirm a bank transfer or an unpaid booking", async () => {
      const bankId = await createBooking("PENDING", {
        method: "BANK_TRANSFER",
        status: "PROCESSING",
      });
      const unpaidId = await createBooking("PENDING");

      for (const bookingId of [bankId, unpaidId]) {
        const response = await ownerCall(`${bookingId}/confirm`);
        expect(response.status).toBe(400);
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(booking?.status).toBe("PENDING");
      }
    });
  });

  describe("complete", () => {
    it("refuses to complete a confirmed trip that has not started", async () => {
      const bookingId = await createBooking("CONFIRMED");

      const response = await ownerCall(`${bookingId}/complete`);

      expect(response.status).toBe(400);
    });

    it("completes an ongoing trip", async () => {
      const bookingId = await createBooking("ONGOING");

      const response = await ownerCall(`${bookingId}/complete`);

      expect(response.status).toBe(200);
      expect(response.body.data.booking.status).toBe("COMPLETED");
    });
  });
});
