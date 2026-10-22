/**
 * Registration requires proof of a verified email OTP (ADR-007), which
 * prevents registering someone else's email (account pre-hijacking).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";
import { createRegistrationProof } from "../src/modules/auth/auth.service";

const API_BASE = "/api/v1";
const EMAIL = "registration.proof@example.com";

const customer = {
  email: EMAIL,
  password: "Password123!",
  confirmPassword: "Password123!",
  firstName: "Proof",
  lastName: "Customer",
  role: "customer",
};

describe("Registration proof", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.otpToken.deleteMany({ where: { email: EMAIL } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.otpToken.deleteMany({ where: { email: EMAIL } });
  });

  const register = (body: object) =>
    request(app).post(`${API_BASE}/auth/register`).send(body);

  it("refuses to register without a verified email", async () => {
    const response = await register(customer);

    expect(response.status).toBe(422);
    expect(await prisma.user.findUnique({ where: { email: EMAIL } })).toBeNull();
  });

  it("refuses a proof issued for a different email", async () => {
    const response = await register({
      ...customer,
      registrationToken: createRegistrationProof("someone.else@example.com"),
    });

    expect(response.status).toBe(400);
  });

  it("refuses a forged proof", async () => {
    const response = await register({
      ...customer,
      registrationToken: "not-a-real-token",
    });

    expect(response.status).toBe(400);
  });

  it("registers with the proof returned by OTP verification", async () => {
    await prisma.otpToken.create({
      data: {
        email: EMAIL,
        code: await bcrypt.hash("246810", 4),
        purpose: "REGISTRATION",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const verified = await request(app)
      .post(`${API_BASE}/auth/otp/verify`)
      .send({ identifier: EMAIL, code: "246810", purpose: "REGISTRATION" });

    expect(verified.status).toBe(200);
    const registrationToken = verified.body.data.registrationToken;
    expect(registrationToken).toEqual(expect.any(String));

    const response = await register({ ...customer, registrationToken });

    expect(response.status).toBe(201);
  });

  it("requires the proof for owner registration too", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({ email: EMAIL });

    expect(response.status).toBe(422);
    expect(
      response.body.error.details.some(
        (d: { field: string }) => d.field === "registrationToken",
      ),
    ).toBe(true);
  });
});
