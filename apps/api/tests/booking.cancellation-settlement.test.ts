/**
 * Customer cancellation of a paid booking: the owner keeps the share the
 * refund policy does not return to the customer (ADR-005). Uses the default
 * policy (100% >= 14 days, 50% >= 7 days, otherwise 0%).
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
  customer: "cancel.settle.customer@example.com",
  owner: "cancel.settle.owner@example.com",
};
const PAID = 40000;
const DAY = 24 * 60 * 60 * 1000;

describe("Customer cancellation settlement", () => {
  let customerId = "";
  let vehicleId = "";
  let customerToken = "";

  const cleanup = async () => {
    const owner = await prisma.user.findUnique({
      where: { email: EMAILS.owner },
    });
    if (owner) {
      await prisma.settlement.deleteMany({ where: { ownerId: owner.id } });
    }
    await prisma.vehicle.deleteMany({ where: { licensePlate: "CXL-SET-1" } });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(EMAILS) } },
    });
  };

  beforeAll(async () => {
    await cleanup();
    const customer = await prisma.user.create({
      data: {
        email: EMAILS.customer,
        password: "hashed",
        firstName: "Cancel",
        lastName: "Customer",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    customerId = customer.id;
    const owner = await prisma.user.create({
      data: {
        email: EMAILS.owner,
        password: "hashed",
        firstName: "Cancel",
        lastName: "Owner",
        role: "VEHICLE_OWNER",
        status: "ACTIVE",
        isVerified: true,
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: owner.id,
        name: "Settlement Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "CXL-SET-1",
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
    customerToken = jwt.sign(
      { id: customerId, email: EMAILS.customer, role: "CUSTOMER" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  });

  afterAll(cleanup);

  const paidBookingStartingIn = async (days: number) => {
    const startDate = new Date(Date.now() + days * DAY);
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        startDate,
        endDate: new Date(startDate.getTime() + DAY),
        pickupLocation: "Colombo",
        dropoffLocation: "Kandy",
        totalAmount: PAID,
        status: "PENDING",
        payment: {
          create: {
            userId: customerId,
            amount: PAID,
            currency: "LKR",
            status: "COMPLETED",
            method: "BANK_TRANSFER",
          },
        },
      },
    });
    await applyPaymentCompletion(booking.id);
    return booking.id;
  };

  const cancel = (bookingId: string) =>
    request(app)
      .patch(`${API_BASE}/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Plans changed" });

  const settlementLine = (bookingId: string) =>
    prisma.settlementBooking.findFirst({ where: { bookingId } });

  it("accrues the paid booking before cancellation", async () => {
    const bookingId = await paidBookingStartingIn(30);
    const line = await settlementLine(bookingId);
    expect(line?.amount).toBe(PAID);
  });

  it("removes the owner's line on a full refund", async () => {
    const bookingId = await paidBookingStartingIn(20);

    const response = await cancel(bookingId);

    expect(response.status).toBe(200);
    expect(response.body.data.booking.refund.policyPercent).toBe(100);
    expect(await settlementLine(bookingId)).toBeNull();
  });

  it("keeps the retained half for the owner on a 50% refund", async () => {
    const bookingId = await paidBookingStartingIn(10);

    const response = await cancel(bookingId);

    expect(response.status).toBe(200);
    expect(response.body.data.booking.refund.amount).toBe(PAID / 2);
    const line = await settlementLine(bookingId);
    expect(line?.amount).toBe(PAID / 2);
    expect(line!.commission + line!.net).toBe(PAID / 2);
  });

  it("keeps the full amount for the owner when nothing is refunded", async () => {
    const bookingId = await paidBookingStartingIn(2);

    const response = await cancel(bookingId);

    expect(response.status).toBe(200);
    expect(response.body.data.booking.refund.amount).toBe(0);
    const line = await settlementLine(bookingId);
    expect(line?.amount).toBe(PAID);
  });

  it("releases the vehicle calendar block on cancellation", async () => {
    const bookingId = await paidBookingStartingIn(25);

    await cancel(bookingId);

    const block = await prisma.vehicleAvailability.findFirst({
      where: { vehicleId, reason: `Booking ${bookingId}` },
    });
    expect(block).toBeNull();
  });
});
