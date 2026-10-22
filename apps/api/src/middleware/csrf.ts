import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { ApiError } from "./errorHandler.js";

/**
 * Simple CSRF Protection Middleware
 *
 * For production, consider using a full CSRF library like csurf
 * This is a basic implementation for state-changing operations
 */

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf-token";

// timingSafeEqual throws on length mismatch, which would surface as a 500.
const tokensMatch = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Generate a CSRF token
 */
export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Set CSRF token cookie
 * Call this on login/register to set the token
 */
export const setCSRFToken = (res: Response): string => {
  const token = generateCSRFToken();

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // Must be false so JavaScript can read it for the header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  return token;
};

/**
 * CSRF protection middleware
 * Validates CSRF token for state-changing operations
 */
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip CSRF check for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF check in test environment
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  const tokenFromHeader = req.headers[CSRF_HEADER] as string;
  const tokenFromCookie = req.cookies[CSRF_COOKIE];

  if (!tokenFromCookie) {
    throw ApiError.forbidden("CSRF token missing from cookie");
  }

  if (!tokenFromHeader) {
    throw ApiError.forbidden("CSRF token missing from header");
  }

  if (
    typeof tokenFromHeader !== "string" ||
    !tokensMatch(tokenFromHeader, tokenFromCookie)
  ) {
    throw ApiError.forbidden("Invalid CSRF token");
  }

  next();
};

/**
 * Optional CSRF protection (logs warning instead of blocking)
 * Use this for gradual rollout
 */
export const csrfProtectionOptional = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip in test environment
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  const tokenFromHeader = req.headers[CSRF_HEADER] as string;
  const tokenFromCookie = req.cookies[CSRF_COOKIE];

  if (!tokenFromCookie || !tokenFromHeader) {
    console.warn(
      `[CSRF Warning] Missing CSRF token for ${req.method} ${req.path}`,
    );
    return next();
  }

  if (!tokensMatch(String(tokenFromHeader), String(tokenFromCookie))) {
    console.warn(
      `[CSRF Warning] Invalid CSRF token for ${req.method} ${req.path}`,
    );
  }

  next();
};

/**
 * Endpoint to get CSRF token
 * Add this as a route: GET /api/v1/csrf-token
 */
export const getCSRFToken = (req: Request, res: Response) => {
  const token = setCSRFToken(res);

  res.json({
    success: true,
    data: {
      csrfToken: token,
    },
  });
};
