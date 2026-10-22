/**
 * Login and OTP-login responses do not reveal whether an email has an
 * account or what state it is in (AUTH-9).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";
const SUSPENDED = "enumeration.suspended@example.com";
const UNKNOWN = "enumeration.nobody@example.com";

describe("Account enumeration", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: SUSPENDED } });
    await prisma.user.create({
      data: {
        email: SUSPENDED,
        password: await bcrypt.hash("Correct123!", 4),
        firstName: "Enum",
        lastName: "Suspended",
        role: "CUSTOMER",
        status: "SUSPENDED",
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: SUSPENDED } });
    await prisma.otpToken.deleteMany({
      where: { email: { in: [SUSPENDED, UNKNOWN] } },
    });
  });

  const sendLoginOtp = (identifier: string) =>
    request(app)
      .post(`${API_BASE}/auth/otp/send`)
      .send({ identifier, purpose: "LOGIN" });

  it("answers an OTP request for an unknown email like a real one, without sending", async () => {
    const response = await sendLoginOtp(UNKNOWN);

    expect(response.status).toBe(200);
    expect(response.body.data.sent).toBe(true);
    expect(await prisma.otpToken.count({ where: { email: UNKNOWN } })).toBe(0);
  });

  it("answers an OTP request for a suspended account the same way", async () => {
    const response = await sendLoginOtp(SUSPENDED);

    expect(response.status).toBe(200);
    expect(await prisma.otpToken.count({ where: { email: SUSPENDED } })).toBe(0);
  });

  it("does not reveal a suspended account to a wrong password", async () => {
    const response = await request(app)
      .post(`${API_BASE}/auth/login`)
      .send({ email: SUSPENDED, password: "Wrong123!" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});
