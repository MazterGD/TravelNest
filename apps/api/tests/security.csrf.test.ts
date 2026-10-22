/**
 * Security regression tests: CSRF double-submit protection (ADM-1, INF-5,
 * AUTH-11). The middleware is skipped when NODE_ENV=test, so these tests run
 * requests with NODE_ENV temporarily set to "development".
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { csrfProtection } from "../src/middleware/csrf";
import { ApiError } from "../src/middleware/errorHandler";

const API_BASE = "/api/v1";
const ADMIN_EMAIL = "sec.csrf.admin@example.com";
const CUSTOMER_EMAIL = "sec.csrf.customer@example.com";
const CSRF = "a".repeat(64);

const withCsrfEnforced = async <T>(fn: () => Promise<T>): Promise<T> => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    process.env.NODE_ENV = original;
  }
};

describe("csrfProtection middleware", () => {
  afterEach(() => {
    process.env.NODE_ENV = "test";
  });

  const run = (headerToken: string | undefined, cookieToken: string) => {
    process.env.NODE_ENV = "development";
    const req = {
      method: "POST",
      path: "/x",
      headers: headerToken ? { "x-csrf-token": headerToken } : {},
      cookies: { "csrf-token": cookieToken },
    } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    try {
      csrfProtection(req, {} as Response, next);
      return { error: null, next };
    } catch (error) {
      return { error, next };
    }
  };

  it("rejects a header token of a different length with 403, not a crash", () => {
    const { error, next } = run("short", CSRF);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a same-length token that does not match", () => {
    const { error } = run("b".repeat(64), CSRF);

    expect((error as ApiError).statusCode).toBe(403);
  });

  it("accepts a matching token", () => {
    const { error, next } = run(CSRF, CSRF);

    expect(error).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("CSRF coverage on authenticated routes", () => {
  let adminToken = "";
  let customerToken = "";

  const cleanup = () =>
    prisma.user.deleteMany({
      where: {
        email: {
          in: [ADMIN_EMAIL, CUSTOMER_EMAIL, "sec.csrf.newadmin@example.com"],
        },
      },
    });

  beforeAll(async () => {
    await cleanup();
    const admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: "hashed",
        firstName: "Csrf",
        lastName: "Admin",
        role: "ADMIN",
        adminRole: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });
    const customer = await prisma.user.create({
      data: {
        email: CUSTOMER_EMAIL,
        password: "hashed",
        firstName: "Csrf",
        lastName: "Customer",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    adminToken = jwt.sign(
      { id: admin.id, email: admin.email, role: "ADMIN" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
    customerToken = jwt.sign(
      { id: customer.id, email: customer.email, role: "CUSTOMER" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  });

  afterAll(cleanup);

  it("blocks a cross-site admin mutation that carries no CSRF token", async () => {
    const response = await withCsrfEnforced(() =>
      request(app)
        .post(`${API_BASE}/admin/admins`)
        .set("Authorization", `Bearer ${adminToken}`)
        .type("form")
        .send({
          email: "sec.csrf.newadmin@example.com",
          password: "Password123!",
          firstName: "Evil",
          lastName: "Admin",
          adminRole: "SUPER_ADMIN",
        }),
    );

    expect(response.status).toBe(403);
    const created = await prisma.user.findUnique({
      where: { email: "sec.csrf.newadmin@example.com" },
    });
    expect(created).toBeNull();
  });

  it("lets an admin mutation through with a matching CSRF token", async () => {
    const response = await withCsrfEnforced(() =>
      request(app)
        .post(`${API_BASE}/admin/admins`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Cookie", `csrf-token=${CSRF}`)
        .set("x-csrf-token", CSRF)
        .send({}),
    );

    // Past CSRF, the empty body fails validation instead.
    expect(response.status).not.toBe(403);
  });

  it("blocks profile, password and account mutations without a token", async () => {
    const calls = [
      request(app).patch(`${API_BASE}/users/profile/personal`).send({}),
      request(app).patch(`${API_BASE}/users/profile/address`).send({}),
      request(app).post(`${API_BASE}/users/change-password`).send({}),
      request(app).delete(`${API_BASE}/users/account`),
    ];

    for (const call of calls) {
      const response = await withCsrfEnforced(() =>
        call.set("Authorization", `Bearer ${customerToken}`),
      );
      expect(response.status).toBe(403);
    }

    const customer = await prisma.user.findUnique({
      where: { email: CUSTOMER_EMAIL },
    });
    expect(customer).not.toBeNull();
  });
});
