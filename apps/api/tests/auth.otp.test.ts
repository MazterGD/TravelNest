/**
 * Email OTP hardening (AUTH-8): resends are throttled per address, the
 * attempt limit holds under parallel guesses and a code works only once.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";
const EMAIL = "otp.hardening@example.com";
const PURPOSE = "REGISTRATION";

describe("Email OTP", () => {
  beforeEach(async () => {
    await prisma.otpToken.deleteMany({ where: { email: EMAIL } });
  });

  afterAll(async () => {
    await prisma.otpToken.deleteMany({ where: { email: EMAIL } });
  });

  const send = () =>
    request(app)
      .post(`${API_BASE}/auth/otp/send`)
      .send({ identifier: EMAIL, purpose: PURPOSE });

  const verify = (code: string) =>
    request(app)
      .post(`${API_BASE}/auth/otp/verify`)
      .send({ identifier: EMAIL, code, purpose: PURPOSE });

  const storeCode = async (code: string) => {
    await prisma.otpToken.create({
      data: {
        email: EMAIL,
        code: await bcrypt.hash(code, 4),
        purpose: PURPOSE,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
  };

  it("refuses a second code for the same address within the cooldown", async () => {
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
  });

  it("enforces the attempt limit even for parallel guesses", async () => {
    await storeCode("123456");

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) => verify(String(200000 + i))),
    );

    const record = await prisma.otpToken.findFirst({ where: { email: EMAIL } });
    expect(record?.attempts).toBe(5);
    expect(responses.filter((r) => r.status === 403)).toHaveLength(5);

    // The real code no longer works once the attempts are used up.
    expect((await verify("123456")).status).toBe(403);
  });

  it("accepts a correct code only once", async () => {
    await storeCode("654321");

    const responses = await Promise.all([verify("654321"), verify("654321")]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);
  });
});
