/**
 * Security regression tests: OTP codes and password-reset links are
 * credentials and must never reach the logs outside development
 * (AUTH-2, AUTH-3).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";
const EMAIL = "sec.logging.user@example.com";

const loggedText = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");

describe("Credentials are not logged", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.user.create({
      data: {
        email: EMAIL,
        password: "hashed",
        firstName: "Log",
        lastName: "User",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.otpToken.deleteMany({ where: { email: EMAIL } });
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: EMAIL } },
    });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it("does not log the OTP code", async () => {
    const spy = vi.spyOn(console, "log");

    const response = await request(app)
      .post(`${API_BASE}/auth/otp/send`)
      .send({ identifier: EMAIL, purpose: "LOGIN" });

    expect(response.status).toBe(200);
    const output = loggedText(spy);
    expect(output).not.toMatch(/\[OTP:/);
    expect(output).not.toContain(EMAIL);
  });

  it("does not log the password reset link", async () => {
    const spy = vi.spyOn(console, "log");

    const response = await request(app)
      .post(`${API_BASE}/auth/forgot-password`)
      .send({ email: EMAIL });

    expect(response.status).toBe(200);
    const output = loggedText(spy);
    expect(output).not.toContain("reset-password?token=");
    expect(output).not.toContain(EMAIL);
  });
});
