/**
 * Password reset tokens (AUTH-7): looked up by hash, single-use even under
 * concurrent requests, and a reset revokes the user's other reset links.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";
const EMAIL = "reset.token.user@example.com";
const NEW_PASSWORD = "NewPassword123!";

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

describe("Password reset tokens", () => {
  let userId = "";

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        password: "hashed",
        firstName: "Reset",
        lastName: "User",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  const issueToken = async (expiresInMs = 60 * 60 * 1000) => {
    const raw = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId,
        token: sha256(raw),
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });
    return raw;
  };

  const reset = (token: string) =>
    request(app)
      .post(`${API_BASE}/auth/reset-password`)
      .send({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });

  it("stores only a hash of the emailed token", async () => {
    await request(app)
      .post(`${API_BASE}/auth/forgot-password`)
      .send({ email: EMAIL });

    const stored = await prisma.passwordResetToken.findFirst({
      where: { userId },
    });
    expect(stored?.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resets the password once and revokes other reset links", async () => {
    const token = await issueToken();
    const other = await issueToken();

    const first = await reset(token);
    const reuse = await reset(token);
    const otherLink = await reset(other);

    expect(first.status).toBe(200);
    expect(reuse.status).toBe(400);
    expect(otherLink.status).toBe(400);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.password).not.toBe("hashed");
    expect(user?.tokenVersion).toBe(1);
  });

  it("accepts a token only once when two resets race", async () => {
    const token = await issueToken();

    const responses = await Promise.all([reset(token), reset(token)]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);
  });

  it("rejects an expired token", async () => {
    const token = await issueToken(-1000);

    expect((await reset(token)).status).toBe(400);
  });
});
