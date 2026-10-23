import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "@travenest/database";
import { config } from "../config/index.js";
import { ApiError } from "./errorHandler.js";

// ============================================
// Enums (matching Prisma schema)
// ============================================
export enum UserRole {
  CUSTOMER = "CUSTOMER",
  VEHICLE_OWNER = "VEHICLE_OWNER",
  ADMIN = "ADMIN",
}

// ============================================
// Type Definitions
// ============================================

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  tokenVersion?: number;
  iat: number;
  exp: number;
}

// ============================================
// Authentication Middleware
// ============================================

const extractToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.accessToken;
};

/**
 * Verify an access token and resolve the user it belongs to. Every token must
 * name an existing user: a JWT signed with the same secret but carrying no
 * user id (e.g. another token type) must never authenticate a request.
 */
const resolveTokenUser = async (
  token: string,
): Promise<NonNullable<Request["user"]>> => {
  const decoded = jwt.verify(token, config.jwt.secret, {
    algorithms: ["HS256"],
  }) as JwtPayload;

  if (typeof decoded.id !== "string" || !decoded.id) {
    throw ApiError.unauthorized("Invalid token");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { tokenVersion: true, status: true },
  });

  if (!user) {
    throw ApiError.unauthorized("User not found");
  }

  if (user.status !== "ACTIVE" && user.status !== "PENDING_VERIFICATION") {
    throw ApiError.forbidden("Account is not active");
  }

  // Ensures the token is invalidated after a password change
  if (
    decoded.tokenVersion !== undefined &&
    decoded.tokenVersion !== user.tokenVersion
  ) {
    throw ApiError.unauthorized(
      "Token has been invalidated. Please login again.",
      "TOKEN_INVALIDATED",
    );
  }

  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
  };
};

/**
 * Require authentication - fails if no valid token
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw ApiError.unauthorized("Access denied. No token provided.");
    }

    req.user = await resolveTokenUser(token);

    next();
  } catch (error) {
    // TokenExpiredError extends JsonWebTokenError, so it MUST be checked first —
    // otherwise expired tokens fall into the generic branch and lose the
    // TOKEN_EXPIRED code the web client keys its silent refresh on.
    if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized("Token expired", "TOKEN_EXPIRED"));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized("Invalid token"));
    } else {
      next(error);
    }
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (token) {
      req.user = await resolveTokenUser(token);
    }
  } catch {
    // Continue without user if token is invalid
    req.user = undefined;
  }

  next();
};

// ============================================
// Authorization Middleware (RBAC)
// ============================================

// Role strings that can be used in routes
type RoleString = "customer" | "owner" | "admin";

// Map string roles to UserRole enum
const roleMap: Record<RoleString, UserRole> = {
  customer: UserRole.CUSTOMER,
  owner: UserRole.VEHICLE_OWNER,
  admin: UserRole.ADMIN,
};

/**
 * Role-based authorization - check if user has required role
 * @param allowedRoles - Array of roles that can access the resource (accepts both enum and string)
 */
export const authorize = (...allowedRoles: (UserRole | RoleString)[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized("Authentication required"));
      return;
    }

    // Convert string roles to UserRole enum values
    const normalizedRoles = allowedRoles.map((role) =>
      typeof role === "string" && role in roleMap
        ? roleMap[role as RoleString]
        : role,
    );

    if (!normalizedRoles.includes(req.user.role)) {
      next(
        ApiError.forbidden("You do not have permission to perform this action"),
      );
      return;
    }

    next();
  };
};

// ============================================
// Role Check Helpers
// ============================================

/**
 * Check if user is a customer
 */
export const isCustomer = authorize(UserRole.CUSTOMER);

/**
 * Check if user is a vehicle owner
 */
export const isVehicleOwner = authorize(UserRole.VEHICLE_OWNER);

/**
 * Check if user is an admin
 */
export const isAdmin = authorize(UserRole.ADMIN);
