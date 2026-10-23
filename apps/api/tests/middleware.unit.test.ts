/**
 * Shared middleware: error-to-response mapping, CSRF checks outside the test
 * environment and role authorization.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { ApiError, errorHandler, notFoundHandler } from "../src/middleware/errorHandler";
import { csrfProtection, getCSRFToken } from "../src/middleware/csrf";
import { authorize } from "../src/middleware/auth";

const fakeRes = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    cookies: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    cookie(name: string, value: unknown) {
      this.cookies[name] = value;
      return this;
    },
  };
  return res;
};

const fakeReq = (overrides: Partial<Request> = {}) =>
  ({ method: "POST", path: "/x", originalUrl: "/x", headers: {}, cookies: {}, ...overrides }) as Request;

const handle = (err: Error) => {
  const res = fakeRes();
  errorHandler(err, fakeReq({ headers: { "x-request-id": "req-1" } }), res as unknown as Response, vi.fn());
  return res as { statusCode: number; body: { error: Record<string, unknown>; meta: Record<string, unknown> } };
};

const prismaError = (code: string) =>
  Object.assign(new Error("db"), { name: "PrismaClientKnownRequestError", code });

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["an API error", ApiError.notFound("Trip not found"), 404, "Trip not found"],
    ["a duplicate record", prismaError("P2002"), 409, "A record with this value already exists"],
    ["a missing record", prismaError("P2025"), 404, "Record not found"],
    ["another database error", prismaError("P2003"), 400, "Database operation failed"],
    ["an invalid JWT", new jwt.JsonWebTokenError("bad"), 401, "Invalid authentication token"],
    ["an expired JWT", new jwt.TokenExpiredError("old", new Date()), 401, "Authentication token has expired"],
    ["an unexpected error", new Error("boom"), 500, "An unexpected error occurred"],
  ])("maps %s", (_label, err, status, message) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = handle(err);

    expect(res.statusCode).toBe(status);
    expect(res.body.error.message).toBe(message);
    expect(res.body.meta.requestId).toBe("req-1");
    expect(res.body.error.stack).toBeUndefined();
  });

  it("words not-found errors once, whether given a noun or a sentence", () => {
    expect(ApiError.notFound("Booking").message).toBe("Booking not found");
    expect(ApiError.notFound("Trip not found").message).toBe("Trip not found");
    expect(ApiError.notFound().message).toBe("Resource not found");
  });

  it("lists Zod issues as field details", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = z.object({ age: z.number() }).safeParse({ age: "x" });

    const res = handle(parsed.success ? new Error() : parsed.error);

    expect(res.statusCode).toBe(422);
    expect(res.body.error.details).toEqual([
      expect.objectContaining({ field: "age", code: "invalid_type" }),
    ]);
  });

  it("includes the stack only in development and never leaks a 500's message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");

    const res = handle(new Error("secret internals"));

    expect(res.body.error.stack).toContain("secret internals");
    expect(res.body.error.message).toBe("An unexpected error occurred");
    vi.unstubAllEnvs();
  });

  it("answers unknown routes with 404", () => {
    const next = vi.fn();

    notFoundHandler(fakeReq({ originalUrl: "/nope" }), fakeRes() as unknown as Response, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
  });
});

describe("csrfProtection outside tests", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const check = (req: Partial<Request>) => {
    vi.stubEnv("NODE_ENV", "production");
    const next = vi.fn() as unknown as NextFunction;
    try {
      csrfProtection(fakeReq(req), fakeRes() as unknown as Response, next);
      return { passed: (next as unknown as ReturnType<typeof vi.fn>).mock.calls.length === 1 };
    } catch (err) {
      return { error: err as ApiError };
    }
  };

  it("lets safe methods through without a token", () => {
    expect(check({ method: "GET" }).passed).toBe(true);
  });

  it("accepts a matching header and cookie", () => {
    expect(
      check({ headers: { "x-csrf-token": "abc" }, cookies: { "csrf-token": "abc" } }).passed,
    ).toBe(true);
  });

  it.each([
    ["no cookie", { headers: { "x-csrf-token": "abc" } }, /cookie/],
    ["no header", { cookies: { "csrf-token": "abc" } }, /header/],
    ["a different token", { headers: { "x-csrf-token": "abd" }, cookies: { "csrf-token": "abc" } }, /Invalid/],
    ["a token of another length", { headers: { "x-csrf-token": "abcdef" }, cookies: { "csrf-token": "abc" } }, /Invalid/],
  ])("refuses %s", (_label, req, message) => {
    const { error } = check(req as Partial<Request>);

    expect(error?.statusCode).toBe(403);
    expect(error?.message).toMatch(message);
  });

  it("hands out a readable token cookie", () => {
    const res = fakeRes();

    getCSRFToken(fakeReq({ method: "GET" }), res as unknown as Response);

    const token = (res.body as { data: { csrfToken: string } }).data.csrfToken;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.cookies["csrf-token"]).toBe(token);
  });
});

describe("authorize", () => {
  it("requires a signed-in user", () => {
    const next = vi.fn();

    authorize("admin")(fakeReq(), fakeRes() as unknown as Response, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });
});
