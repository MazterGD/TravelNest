/**
 * Sequential codes (QUO-/TRP-) retry on a duplicate instead of failing the
 * request when two submissions pick the same number.
 */
import { describe, it, expect, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { createWithSequentialCode, yearSequence } from "../src/utils/sequentialCode";

const duplicate = (target: unknown) => Object.assign(new Error("dup"), { code: "P2002", meta: { target } });

describe("createWithSequentialCode", () => {
  it("formats year sequences", () => {
    expect(yearSequence("QUO", 2026, 7)).toBe("QUO-2026-007");
    expect(yearSequence("TRP", 2026, 1234)).toBe("TRP-2026-1234");
  });

  it("tries the next number after a duplicate on the code column", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(duplicate(["quotationId"]))
      .mockRejectedValueOnce(duplicate("quotations_quotationId_key"))
      .mockResolvedValueOnce("ok");

    const result = await createWithSequentialCode("quotationId", async () => 10, (n) => `Q-${n}`, create);

    expect(result).toBe("ok");
    expect(create.mock.calls.map((call) => call[0])).toEqual(["Q-10", "Q-11", "Q-12"]);
  });

  it("does not retry other errors or duplicates on other columns", async () => {
    const otherColumn = vi.fn().mockRejectedValue(duplicate(["email"]));
    const otherError = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(createWithSequentialCode("quotationId", async () => 1, String, otherColumn)).rejects.toMatchObject({
      code: "P2002",
    });
    await expect(createWithSequentialCode("quotationId", async () => 1, String, otherError)).rejects.toThrow("boom");
    expect(otherColumn).toHaveBeenCalledTimes(1);
    expect(otherError).toHaveBeenCalledTimes(1);
  });

  it("gives up after five attempts", async () => {
    const create = vi.fn().mockRejectedValue(duplicate(["tripCode"]));

    await expect(createWithSequentialCode("tripCode", async () => 1, String, create)).rejects.toMatchObject({
      code: "P2002",
    });
    expect(create).toHaveBeenCalledTimes(5);
  });
});

describe("quotation requests with a taken code", () => {
  const PREFIX = `seq-code-${Date.now()}`;

  afterAll(async () => {
    const users = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.quotation.deleteMany({ where: { customerId: { in: users } } });
    await prisma.trip.deleteMany({ where: { customerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("still succeeds when the next quotation and trip codes are already used", async () => {
    const customer = await prisma.user.create({
      data: { email: `${PREFIX}.c@example.com`, password: "x", firstName: "S", lastName: "C", role: "CUSTOMER", status: "ACTIVE" },
    });
    const token = jwt.sign({ id: customer.id, email: customer.email, role: "CUSTOMER" }, config.jwt.secret, {
      expiresIn: "1h",
    });
    const year = new Date().getFullYear();
    const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    // Take the number one past the count, the code the next request computes.
    const takenQuote = yearSequence(
      "QUO",
      year,
      (await prisma.quotation.count({ where: { quotationId: { startsWith: `QUO-${year}` } } })) + 2,
    );
    const takenTrip = yearSequence(
      "TRP",
      year,
      (await prisma.trip.count({ where: { tripCode: { startsWith: `TRP-${year}` } } })) + 2,
    );
    await prisma.trip.create({
      data: { tripCode: takenTrip, customerId: customer.id, pickupLocation: "Colombo", startDate: start, endDate: start, passengerCount: 1 },
    });
    await prisma.quotation.create({
      data: { quotationId: takenQuote, customerId: customer.id, startDate: start, endDate: start, pickupLocation: "Colombo" },
    });

    const res = await request(app)
      .post("/api/v1/quotations")
      .set("Authorization", `Bearer ${token}`)
      .send({ pickupLocation: "Colombo", startDate: start.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.data.quotation.quotationId).not.toBe(takenQuote);
    const trip = await prisma.trip.findUnique({ where: { id: res.body.data.quotation.tripId } });
    expect(trip?.tripCode).not.toBe(takenTrip);
  });
});
