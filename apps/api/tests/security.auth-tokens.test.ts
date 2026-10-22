/**
 * Security regression tests: access-token validation (AUTH-1).
 * Any JWT signed with the access secret used to authenticate even when it
 * named no user, and the OAuth state token was signed with that same secret.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { createOAuthStateToken } from "../src/modules/auth/auth.service";

const API_BASE = "/api/v1";
const EMAIL = "sec.tokens.customer@example.com";

describe("Access token validation", () => {
  let customerId = "";

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const customer = await prisma.user.create({
      data: {
        email: EMAIL,
        password: "hashed",
        firstName: "Token",
        lastName: "Customer",
        role: "CUSTOMER",
        status: "ACTIVE",
        tokenVersion: 3,
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it("rejects a token that carries no user id", async () => {
    const token = jwt.sign({ role: "CUSTOMER" }, config.jwt.secret, {
      expiresIn: "1h",
    });

    const response = await request(app)
      .get(`${API_BASE}/notifications`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("rejects an OAuth state token used as a bearer token", async () => {
    const state = createOAuthStateToken({
      provider: "google",
      returnTo: "http://localhost:3000/en",
    });

    expect(() => jwt.verify(state, config.jwt.secret)).toThrow();

    const response = await request(app)
      .get(`${API_BASE}/notifications`)
      .set("Authorization", `Bearer ${state}`);

    expect(response.status).toBe(401);
  });

  it("rejects a token for a user that does not exist", async () => {
    const token = jwt.sign(
      { id: "cdoesnotexist000000000000", email: EMAIL, role: "CUSTOMER" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );

    const response = await request(app)
      .get(`${API_BASE}/notifications`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ id: customerId, email: EMAIL, role: "CUSTOMER" }),
    ).toString("base64url");

    const response = await request(app)
      .get(`${API_BASE}/notifications`)
      .set("Authorization", `Bearer ${header}.${body}.`);

    expect(response.status).toBe(401);
  });

  it("rejects a token whose tokenVersion is stale", async () => {
    const token = jwt.sign(
      { id: customerId, email: EMAIL, role: "CUSTOMER", tokenVersion: 2 },
      config.jwt.secret,
      { expiresIn: "1h" },
    );

    const response = await request(app)
      .get(`${API_BASE}/notifications`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("TOKEN_INVALIDATED");
  });

  it("accepts a valid token for an active user", async () => {
    const token = jwt.sign(
      { id: customerId, email: EMAIL, role: "CUSTOMER", tokenVersion: 3 },
      config.jwt.secret,
      { expiresIn: "1h" },
    );

    const response = await request(app)
      .get(`${API_BASE}/notifications`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it("treats an invalid token on an optional-auth route as anonymous", async () => {
    const token = jwt.sign({ role: "ADMIN" }, config.jwt.secret, {
      expiresIn: "1h",
    });

    const response = await request(app)
      .get(`${API_BASE}/vehicles`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});
