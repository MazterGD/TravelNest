import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import xss from "xss";
import prisma from "@travenest/database";
import { config } from "../../config/index.js";
import { ApiError } from "../../middleware/errorHandler.js";
import type { RegisterInput, LoginInput } from "./auth.schemas.js";

// ============================================
// Enums (matching Prisma schema)
// ============================================
export enum UserRole {
  CUSTOMER = "CUSTOMER",
  VEHICLE_OWNER = "VEHICLE_OWNER",
  ADMIN = "ADMIN",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
}

// ============================================
// Types
// ============================================
interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Token Generation
// ============================================

/**
 * Generate JWT access and refresh tokens
 */
export const generateTokens = (user: {
  id: string;
  email: string;
  role: string;
  tokenVersion?: number;
}) => {
  const payload: TokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  // Add tokenVersion if provided (for invalidation on password change)
  if (user.tokenVersion !== undefined) {
    (payload as any).tokenVersion = user.tokenVersion;
  }

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as SignOptions);
  const refreshToken = jwt.sign(
    { id: user.id, tokenVersion: user.tokenVersion },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiresIn,
    } as SignOptions,
  );

  return { accessToken, refreshToken };
};

/**
 * Exclude password from user object
 */
const excludePassword = (user: {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser => {
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// ============================================
// Auth Operations
// ============================================

/**
 * Register a new user
 */
export const registerUser = async (data: RegisterInput) => {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    throw ApiError.conflict("Email already registered");
  }

  // Hash password with bcrypt (12 rounds)
  const hashedPassword = await bcrypt.hash(data.password, 12);

  // Map frontend role to database role
  const dbRole = mapRoleToDb(data.role);

  // Sanitize user inputs to prevent XSS attacks
  const sanitizedFirstName = xss(data.firstName.trim());
  const sanitizedLastName = xss(data.lastName.trim());

  // Create user in database
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      phone: data.phone || null,
      role: dbRole,
      status: UserStatus.ACTIVE,
      isVerified: false,
    },
  });

  // Generate tokens with tokenVersion
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  // Return user without password
  return {
    user: excludePassword(user),
    ...tokens,
  };
};

/**
 * Login user with email and password
 */
export const loginUser = async (data: LoginInput) => {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (!user) {
    throw ApiError.unauthorized(
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / (1000 * 60),
    );
    throw ApiError.forbidden(
      `Account is locked. Try again in ${minutesLeft} minute(s).`,
      "ACCOUNT_LOCKED",
    );
  }

  // Check if user is active
  if (user.status !== UserStatus.ACTIVE) {
    throw ApiError.forbidden(
      user.status === UserStatus.SUSPENDED
        ? "Your account has been suspended"
        : "Your account is not active",
    );
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(data.password, user.password);
  if (!isPasswordValid) {
    // Increment failed login attempts
    const failedAttempts = user.failedLoginAttempts + 1;
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCK_DURATION_MINUTES = 15;

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      // Lock account for 15 minutes
      const lockedUntil = new Date(
        Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
      );

      // Use updateMany to avoid P2025 error if record was deleted
      await prisma.user.updateMany({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
      });

      throw ApiError.forbidden(
        `Too many failed login attempts. Account locked for ${LOCK_DURATION_MINUTES} minutes.`,
        "ACCOUNT_LOCKED",
      );
    } else {
      // Update failed attempts - use updateMany to avoid P2025 error if record was deleted
      await prisma.user.updateMany({
        where: { id: user.id },
        data: { failedLoginAttempts: failedAttempts },
      });

      throw ApiError.unauthorized(
        "Invalid email or password",
        "INVALID_CREDENTIALS",
      );
    }
  }

  // Reset failed login attempts on successful login and unlock account
  // Use updateMany to avoid P2025 error if record was deleted
  await prisma.user.updateMany({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // Generate tokens with tokenVersion for invalidation on password change
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  // Return user without password
  return {
    user: excludePassword(user),
    ...tokens,
  };
};

/**
 * Refresh access token using refresh token
 * Implements token rotation: issues new refresh token and invalidates old one
 */
export const refreshUserTokens = async (refreshToken: string) => {
  if (!refreshToken) {
    throw ApiError.unauthorized("Refresh token is required");
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as {
      id: string;
      tokenVersion?: number;
    };

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw ApiError.forbidden("Account is not active");
    }

    // Validate token version (if token was issued before password change, reject it)
    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      throw ApiError.unauthorized(
        "Token has been invalidated. Please login again.",
        "TOKEN_INVALIDATED",
      );
    }

    // Generate NEW tokens (token rotation)
    // Old refresh token is now invalid, client must use new one
    const newTokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return newTokens;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized("Refresh token has expired", "TOKEN_EXPIRED");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.unauthorized("Invalid refresh token");
    }
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (id: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return excludePassword(user);
};

/**
 * Change user password
 */
export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    throw ApiError.badRequest("Current password is incorrect");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password and increment tokenVersion to invalidate all existing tokens
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      tokenVersion: user.tokenVersion + 1, // Invalidate all existing tokens
    },
  });

  return { message: "Password changed successfully. Please login again." };
};

/**
 * Generate password reset token
 */
export const generatePasswordResetToken = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Don't reveal if user exists (security best practice)
  if (!user) {
    return { message: "If the email exists, a reset link will be sent" };
  }

  // Generate random token (use crypto for cryptographic randomness)
  const crypto = await import("crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");

  // Hash token before storing in database
  const hashedToken = await bcrypt.hash(rawToken, 10);

  // Store hashed token in database with 1-hour expiry
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt,
    },
  });

  // TODO: Send email with rawToken (not hashedToken)
  // In development, log a masked token for debugging
  if (config.env === "development") {
    const maskedToken = `${rawToken.substring(0, 8)}...${rawToken.substring(rawToken.length - 8)}`;
    console.log(
      `Password reset requested for ${email}. Token (masked): ${maskedToken}`,
    );
    console.log(`Reset URL: ${config.appUrl}/reset-password?token=<token>`);
  }

  return { message: "If the email exists, a reset link will be sent" };
};

/**
 * Reset password with token (single-use token from database)
 */
export const resetUserPassword = async (token: string, newPassword: string) => {
  // Find all valid (non-expired, non-used) reset tokens
  const resetTokens = await prisma.passwordResetToken.findMany({
    where: {
      expiresAt: { gt: new Date() },
      usedAt: null,
    },
    include: {
      user: true,
    },
  });

  // Find matching token by comparing hashes
  let matchedResetToken = null;
  for (const resetToken of resetTokens) {
    const isMatch = await bcrypt.compare(token, resetToken.token);
    if (isMatch) {
      matchedResetToken = resetToken;
      break;
    }
  }

  if (!matchedResetToken) {
    throw ApiError.badRequest("Invalid or expired reset token");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password, increment tokenVersion, and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: matchedResetToken.userId },
      data: {
        password: hashedPassword,
        tokenVersion: matchedResetToken.user.tokenVersion + 1, // Invalidate all tokens
        failedLoginAttempts: 0, // Reset failed attempts
        lockedUntil: null, // Unlock account if locked
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: matchedResetToken.id },
      data: { usedAt: new Date() }, // Mark as used (single-use)
    }),
  ]);

  return {
    message:
      "Password reset successfully. Please login with your new password.",
  };
};

// ============================================
// Helper Functions
// ============================================

/**
 * Map frontend role string to database UserRole enum
 */
function mapRoleToDb(role?: "customer" | "owner"): UserRole {
  switch (role) {
    case "owner":
      return UserRole.VEHICLE_OWNER;
    case "customer":
    default:
      return UserRole.CUSTOMER;
  }
}
