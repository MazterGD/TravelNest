/**
 * Payment API Tests
 * Covers intent creation, PayHere webhook, and refunds
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh";
process.env.PAYHERE_MERCHANT_ID = "TEST_MERCHANT";
process.env.PAYHERE_MERCHANT_SECRET = "TEST_SECRET";
process.env.PAYHERE_NOTIFY_URL =
  "http://localhost:5000/api/v1/payments/webhook";
process.env.PAYHERE_RETURN_URL = "http://localhost:3000/en/payments/return";
process.env.PAYHERE_CANCEL_URL = "http://localhost:3000/en/payments/cancel";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import app from "../src/app";
import { prisma } from "./setup";
import { config } from "../src/config/index.js";

const API_BASE = "/api/v1";

const md5 = (value: string) =>
  crypto.createHash("md5").update(value).digest("hex").toUpperCase();

const buildPayHereSignature = (
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  secret: string,
) => {
  const hashedSecret = md5(secret);
  return md5(`${merchantId}${orderId}${amount}${currency}${hashedSecret}`);
};

describe("Payment API", () => {
  let customerId = "";
  let ownerId = "";
  let vehicleId = "";
  let bookingId = "";
  let paymentId = "";
  let authToken = "";

  beforeAll(async () => {
    const customer = await prisma.user.create({
      data: {
        email: "payment.customer@example.com",
        password: "hashed",
        firstName: "Pay",
        lastName: "Customer",
        role: "CUSTOMER",
        status: "ACTIVE",
        isVerified: true,
      },
    });
    customerId = customer.id;

    const owner = await prisma.user.create({
      data: {
        email: "payment.owner@example.com",
        password: "hashed",
        firstName: "Pay",
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
        name: "Payment Test Vehicle",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "PAY-1001",
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: ["https://example.com/vehicle.jpg"],
        amenities: [],
      },
    });
    vehicleId = vehicle.id;

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 172800000),
        pickupLocation: "Colombo",
        dropoffLocation: "Kandy",
        totalAmount: 50000,
        status: "PENDING",
      },
    });
    bookingId = booking.id;

    authToken = jwt.sign(
      { id: customerId, email: customer.email, role: "CUSTOMER" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { bookingId } });
    await prisma.booking.deleteMany({ where: { id: bookingId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["payment.customer@example.com", "payment.owner@example.com"],
        },
      },
    });
  });

  it("creates a PayHere payment intent", async () => {
    const response = await request(app)
      .post(`${API_BASE}/payments/create-intent`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ bookingId, method: "CARD" });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.payment.id).toBeDefined();
    expect(response.body.data.payhere.actionUrl).toBeDefined();

    paymentId = response.body.data.payment.id;
  });

  it("processes PayHere webhook and completes payment", async () => {
    const amount = "50000.00";
    const signature = buildPayHereSignature(
      process.env.PAYHERE_MERCHANT_ID || "",
      paymentId,
      amount,
      "LKR",
      process.env.PAYHERE_MERCHANT_SECRET || "",
    );

    const response = await request(app)
      .post(`${API_BASE}/payments/webhook`)
      .send({
        merchant_id: process.env.PAYHERE_MERCHANT_ID,
        order_id: paymentId,
        payment_id: "PH123456",
        payhere_amount: amount,
        payhere_currency: "LKR",
        status_code: "2",
        md5sig: signature,
        method: "VISA",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.payment.status).toBe("completed");
  });

  it("refunds a completed payment", async () => {
    const response = await request(app)
      .post(`${API_BASE}/payments/${paymentId}/refund`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ reason: "Customer requested refund" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.payment.status).toBe("refunded");
  });
});
