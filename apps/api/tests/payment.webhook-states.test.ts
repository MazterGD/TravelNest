/**
 * PayHere webhook state handling (PAY-5): terminal payment states are sticky
 * and money received for a cancelled booking never confirms it.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";
const EMAILS = {
  customer: "webhook.states.customer@example.com",
  owner: "webhook.states.owner@example.com",
};
const AMOUNT = 25000;
const DAY = 24 * 60 * 60 * 1000;

const md5 = (value: string) =>
  crypto.createHash("md5").update(value).digest("hex").toUpperCase();

let paymentSeq = 0;

const sendWebhook = (paymentId: string, statusCode: string) => {
  const merchantId = process.env.PAYHERE_MERCHANT_ID || "";
  const amount = AMOUNT.toFixed(2);
  const md5sig = md5(
    `${merchantId}${paymentId}${amount}LKR${md5(
      process.env.PAYHERE_MERCHANT_SECRET || "",
    )}`,
  );
  return request(app).post(`${API_BASE}/payments/webhook`).send({
    merchant_id: merchantId,
    order_id: paymentId,
    payment_id: `PH-STATE-${Date.now()}-${paymentSeq++}`,
    payhere_amount: amount,
    payhere_currency: "LKR",
    status_code: statusCode,
    md5sig,
    method: "VISA",
  });
};

describe("PayHere webhook state handling", () => {
  let customerId = "";
  let vehicleId = "";

  const cleanup = async () => {
    const owner = await prisma.user.findUnique({
      where: { email: EMAILS.owner },
    });
    if (owner) {
      await prisma.settlement.deleteMany({ where: { ownerId: owner.id } });
    }
    await prisma.vehicle.deleteMany({ where: { licensePlate: "WH-STATE-1" } });
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
        firstName: "Hook",
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
        firstName: "Hook",
        lastName: "Owner",
        role: "VEHICLE_OWNER",
        status: "ACTIVE",
        isVerified: true,
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: owner.id,
        name: "Webhook Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "WH-STATE-1",
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

  const bookingWithPayment = async (
    bookingStatus: "PENDING" | "CANCELLED",
    paymentStatus: "PROCESSING" | "REFUNDED",
    startInDays: number,
  ) => {
    const startDate = new Date(Date.now() + startInDays * DAY);
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        startDate,
        endDate: new Date(startDate.getTime() + DAY),
        pickupLocation: "Colombo",
        totalAmount: AMOUNT,
        status: bookingStatus,
        payment: {
          create: {
            userId: customerId,
            amount: AMOUNT,
            currency: "LKR",
            status: paymentStatus,
            method: "CARD",
          },
        },
      },
      include: { payment: true },
    });
    return { bookingId: booking.id, paymentId: booking.payment!.id };
  };

  const state = async (bookingId: string, paymentId: string) => ({
    booking: await prisma.booking.findUnique({ where: { id: bookingId } }),
    payment: await prisma.payment.findUnique({ where: { id: paymentId } }),
    block: await prisma.vehicleAvailability.findFirst({
      where: { vehicleId, reason: `Booking ${bookingId}` },
    }),
    settlementLine: await prisma.settlementBooking.findFirst({
      where: { bookingId },
    }),
  });

  it("confirms the booking, blocks dates and accrues the settlement", async () => {
    const { bookingId, paymentId } = await bookingWithPayment(
      "PENDING",
      "PROCESSING",
      10,
    );

    const response = await sendWebhook(paymentId, "2");

    expect(response.status).toBe(200);
    const after = await state(bookingId, paymentId);
    expect(after.payment?.status).toBe("COMPLETED");
    expect(after.booking?.status).toBe("CONFIRMED");
    expect(after.block).not.toBeNull();
    expect(after.settlementLine?.amount).toBe(AMOUNT);
  });

  it("ignores a failure notification that arrives after completion", async () => {
    const { bookingId, paymentId } = await bookingWithPayment(
      "PENDING",
      "PROCESSING",
      12,
    );
    await sendWebhook(paymentId, "2");

    const response = await sendWebhook(paymentId, "-2");

    expect(response.status).toBe(200);
    const after = await state(bookingId, paymentId);
    expect(after.payment?.status).toBe("COMPLETED");
    expect(after.booking?.status).toBe("CONFIRMED");
  });

  it("does not resurrect a refunded payment", async () => {
    const { bookingId, paymentId } = await bookingWithPayment(
      "PENDING",
      "REFUNDED",
      14,
    );

    await sendWebhook(paymentId, "2");

    const after = await state(bookingId, paymentId);
    expect(after.payment?.status).toBe("REFUNDED");
    expect(after.booking?.status).toBe("PENDING");
    expect(after.settlementLine).toBeNull();
  });

  it("records money received for a cancelled booking as owed back", async () => {
    const { bookingId, paymentId } = await bookingWithPayment(
      "CANCELLED",
      "PROCESSING",
      16,
    );

    const response = await sendWebhook(paymentId, "2");

    expect(response.status).toBe(200);
    const after = await state(bookingId, paymentId);
    expect(after.booking?.status).toBe("CANCELLED");
    expect(after.block).toBeNull();
    expect(after.settlementLine).toBeNull();
    expect(after.payment?.status).toBe("REFUNDED");
    expect(after.payment?.refundAmount).toBe(AMOUNT);
  });
});
