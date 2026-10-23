/**
 * Payment lookups for the paying customer, bank transfer details and the
 * PayHere merchant refund call.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { executePayHereRefund } from "../src/modules/payment/payment.service";

const API_BASE = "/api/v1";
const PREFIX = `payment-api-${Date.now()}`;
const PLATE = "PAZ-4321";
const DAY = 24 * 60 * 60 * 1000;

describe("Payment API", () => {
  const users = { customer: "", stranger: "", owner: "" };
  const tokens = { ...users };
  const payments: string[] = [];

  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });

  const cleanup = async () => {
    const ids = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { licensePlate: PLATE } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    for (const [key, role] of [
      ["customer", "CUSTOMER"],
      ["stranger", "CUSTOMER"],
      ["owner", "VEHICLE_OWNER"],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: key,
          lastName: "Tester",
          role,
          status: "ACTIVE",
          isVerified: true,
        },
      });
      users[key] = user.id;
      tokens[key] = jwt.sign({ id: user.id, email: user.email, role }, config.jwt.secret, {
        expiresIn: "1h",
      });
    }
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: users.owner,
        name: `${PREFIX} bus`,
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: PLATE,
        seats: 40,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
      },
    });
    for (let i = 0; i < 3; i++) {
      const booking = await prisma.booking.create({
        data: {
          customerId: users.customer,
          vehicleId: vehicle.id,
          startDate: new Date(Date.now() + (10 + i * 5) * DAY),
          endDate: new Date(Date.now() + (11 + i * 5) * DAY),
          pickupLocation: "Colombo",
          totalAmount: 10000 * (i + 1),
          status: "CONFIRMED",
        },
      });
      const payment = await prisma.payment.create({
        data: {
          userId: users.customer,
          bookingId: booking.id,
          amount: 10000 * (i + 1),
          status: "COMPLETED",
          method: "CARD",
          createdAt: new Date(Date.now() - (3 - i) * 60_000),
        },
      });
      payments.push(payment.id);
    }
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("GET /payments/:id and POST /payments/confirm", () => {
    it("shows the payer their own payment", async () => {
      const byId = await request(app).get(`${API_BASE}/payments/${payments[0]}`).set(auth("customer"));
      const confirmed = await request(app)
        .post(`${API_BASE}/payments/confirm`)
        .set(auth("customer"))
        .send({ paymentId: payments[0] });

      expect(byId.status).toBe(200);
      expect(byId.body.data.payment).toMatchObject({ id: payments[0], amount: 10000, status: "completed" });
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.data.payment.id).toBe(payments[0]);
    });

    it("keeps other users out and 404s unknown payments", async () => {
      const byId = await request(app).get(`${API_BASE}/payments/${payments[0]}`).set(auth("stranger"));
      const confirm = await request(app)
        .post(`${API_BASE}/payments/confirm`)
        .set(auth("stranger"))
        .send({ paymentId: payments[0] });
      const missingById = await request(app)
        .get(`${API_BASE}/payments/missing-payment`)
        .set(auth("customer"));
      const missingConfirm = await request(app)
        .post(`${API_BASE}/payments/confirm`)
        .set(auth("customer"))
        .send({ paymentId: "missing-payment" });

      expect(byId.status).toBe(403);
      expect(confirm.status).toBe(403);
      expect(missingById.status).toBe(404);
      expect(missingConfirm.status).toBe(404);
    });

    it("requires a payment id to confirm", async () => {
      const res = await request(app).post(`${API_BASE}/payments/confirm`).set(auth("customer")).send({});

      expect(res.status).toBe(422);
    });
  });

  describe("GET /payments/my-payments", () => {
    it("pages the caller's payments, newest first", async () => {
      const res = await request(app)
        .get(`${API_BASE}/payments/my-payments?page=2&limit=2`)
        .set(auth("customer"));

      expect(res.status).toBe(200);
      expect(res.body.data.payments.map((p: { id: string }) => p.id)).toEqual([payments[0]]);
      expect(res.body.data.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });

    it("falls back to sane paging for bad values", async () => {
      const res = await request(app)
        .get(`${API_BASE}/payments/my-payments?page=-4&limit=5000`)
        .set(auth("customer"));

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 100 });
    });

    it("shows nothing to another customer", async () => {
      const res = await request(app).get(`${API_BASE}/payments/my-payments`).set(auth("stranger"));

      expect(res.body.data.payments).toEqual([]);
    });
  });

  it("gives signed-in users the bank transfer details", async () => {
    const res = await request(app).get(`${API_BASE}/payments/bank-details`).set(auth("customer"));
    const guest = await request(app).get(`${API_BASE}/payments/bank-details`);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data)).toContain(JSON.stringify(config.bankDetails).slice(1, 20));
    expect(guest.status).toBe(401);
  });
});

describe("executePayHereRefund", () => {
  const original = { ...config.payhere };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  afterEach(() => {
    Object.assign(config.payhere, original);
    vi.restoreAllMocks();
  });

  const withCredentials = (mode = "sandbox") =>
    Object.assign(config.payhere, { appId: "app-id", appSecret: "app-secret", mode });

  it("refuses to run without PayHere app credentials", async () => {
    Object.assign(config.payhere, { appId: "", appSecret: "" });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(executePayHereRefund("pay_1", 100, "Cancelled")).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("gets a token, then asks PayHere to refund the amount", async () => {
    withCredentials();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ access_token: "tok" }))
      .mockResolvedValueOnce(json({ status: 1, msg: "ok" }));

    await executePayHereRefund("pay_1", 2500, "Trip cancelled");

    const [tokenUrl, tokenInit] = fetchSpy.mock.calls[0];
    expect(String(tokenUrl)).toMatch(/sandbox\.payhere\.lk\/merchant\/v1\/oauth\/token$/);
    expect((tokenInit?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("app-id:app-secret").toString("base64")}`,
    );
    const [refundUrl, refundInit] = fetchSpy.mock.calls[1];
    expect(String(refundUrl)).toMatch(/\/payment\/refund$/);
    expect((refundInit?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(String(refundInit?.body))).toEqual({
      payment_id: "pay_1",
      description: "Trip cancelled",
      amount: 2500,
    });
  });

  it("uses the live API in live mode", async () => {
    withCredentials("live");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ access_token: "tok" }))
      .mockResolvedValueOnce(json({ status: 1, msg: "ok" }));

    await executePayHereRefund("pay_1", 100, "x");

    expect(String(fetchSpy.mock.calls[0][0])).not.toContain("sandbox");
    expect(String(fetchSpy.mock.calls[1][0])).not.toContain("sandbox");
  });

  it.each([
    ["the token request fails", [json({ error: "nope" }, 401)], /access token/],
    ["the refund request fails", [json({ access_token: "tok" }), json({ error: "bad" }, 400)], /refund failed/],
    ["PayHere rejects the refund", [json({ access_token: "tok" }), json({ status: -1, msg: "Too late" })], /Too late/],
  ])("throws when %s", async (_label, responses, message) => {
    withCredentials();
    const spy = vi.spyOn(globalThis, "fetch");
    for (const response of responses) spy.mockResolvedValueOnce(response);

    await expect(executePayHereRefund("pay_1", 100, "x")).rejects.toThrow(message);
  });
});
