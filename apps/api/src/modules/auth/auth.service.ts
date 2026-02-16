import bcrypt from "bcryptjs";
import crypto from "crypto";
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

export type OAuthProvider = "google" | "facebook";

interface OAuthStatePayload {
  provider: OAuthProvider;
  returnTo: string;
}

interface OAuthProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
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

// ============================================
// OAuth Helpers
// ============================================

export const createOAuthStateToken = (payload: OAuthStatePayload) =>
  jwt.sign(payload, config.oauth.stateSecret, {
    expiresIn: "10m",
  } as SignOptions);

export const verifyOAuthStateToken = (token: string): OAuthStatePayload =>
  jwt.verify(token, config.oauth.stateSecret) as OAuthStatePayload;

export const getOAuthAuthorizationUrl = (
  provider: OAuthProvider,
  state: string,
) => {
  if (provider === "google") {
    if (!config.oauth.google.clientId || !config.oauth.google.redirectUri) {
      throw ApiError.internal("Google OAuth is not configured");
    }

    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      redirect_uri: config.oauth.google.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (!config.oauth.facebook.clientId || !config.oauth.facebook.redirectUri) {
    throw ApiError.internal("Facebook OAuth is not configured");
  }

  const params = new URLSearchParams({
    client_id: config.oauth.facebook.clientId,
    redirect_uri: config.oauth.facebook.redirectUri,
    response_type: "code",
    scope: "email,public_profile",
    state,
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
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
// OAuth Login
// ============================================

export const getGoogleProfileFromCode = async (code: string) => {
  if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
    throw ApiError.internal("Google OAuth is not configured");
  }

  const tokenParams = new URLSearchParams({
    client_id: config.oauth.google.clientId,
    client_secret: config.oauth.google.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.oauth.google.redirectUri,
  });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    throw ApiError.badRequest("Failed to exchange Google authorization code");
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    id_token?: string;
  };

  if (!tokenData.access_token) {
    throw ApiError.badRequest("Google access token missing in response");
  }

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );

  if (!profileResponse.ok) {
    throw ApiError.badRequest("Failed to fetch Google user profile");
  }

  const profile = (await profileResponse.json()) as {
    email?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };

  if (!profile.email) {
    throw ApiError.badRequest("Google account did not return an email");
  }

  return {
    email: profile.email,
    firstName: profile.given_name || "TraveNest",
    lastName: profile.family_name || "User",
    avatarUrl: profile.picture || null,
  } satisfies OAuthProfile;
};

export const getFacebookProfileFromCode = async (code: string) => {
  if (!config.oauth.facebook.clientId || !config.oauth.facebook.clientSecret) {
    throw ApiError.internal("Facebook OAuth is not configured");
  }

  const tokenParams = new URLSearchParams({
    client_id: config.oauth.facebook.clientId,
    client_secret: config.oauth.facebook.clientSecret,
    redirect_uri: config.oauth.facebook.redirectUri,
    code,
  });

  const tokenResponse = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams.toString()}`,
  );

  if (!tokenResponse.ok) {
    throw ApiError.badRequest("Failed to exchange Facebook authorization code");
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
  };

  if (!tokenData.access_token) {
    throw ApiError.badRequest("Facebook access token missing in response");
  }

  const profileParams = new URLSearchParams({
    fields: "id,email,first_name,last_name,picture",
    access_token: tokenData.access_token,
  });

  const profileResponse = await fetch(
    `https://graph.facebook.com/me?${profileParams.toString()}`,
  );

  if (!profileResponse.ok) {
    throw ApiError.badRequest("Failed to fetch Facebook user profile");
  }

  const profile = (await profileResponse.json()) as {
    email?: string;
    first_name?: string;
    last_name?: string;
    picture?: { data?: { url?: string } };
  };

  if (!profile.email) {
    throw ApiError.badRequest("Facebook account did not return an email");
  }

  return {
    email: profile.email,
    firstName: profile.first_name || "TraveNest",
    lastName: profile.last_name || "User",
    avatarUrl: profile.picture?.data?.url || null,
  } satisfies OAuthProfile;
};

export const loginWithOAuthProfile = async (profile: OAuthProfile) => {
  const email = profile.email.toLowerCase().trim();
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    const sanitizedFirstName = xss(profile.firstName.trim());
    const sanitizedLastName = xss(profile.lastName.trim());

    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: sanitizedFirstName || "TraveNest",
        lastName: sanitizedLastName || "User",
        phone: null,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        isVerified: true,
        avatar: profile.avatarUrl || null,
        lastLoginAt: new Date(),
      },
    });
  } else {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60),
      );
      throw ApiError.forbidden(
        `Account is locked. Try again in ${minutesLeft} minute(s).`,
        "ACCOUNT_LOCKED",
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw ApiError.forbidden(
        user.status === UserStatus.SUSPENDED
          ? "Your account has been suspended"
          : "Your account is not active",
      );
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        avatar: user.avatar || profile.avatarUrl || null,
        isVerified: true,
      },
    });
  }

  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return {
    user: excludePassword(user),
    ...tokens,
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
