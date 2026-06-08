import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import xss from "xss";
import prisma from "@travenest/database";
import { config } from "../../config/index.js";
import { ApiError } from "../../middleware/errorHandler.js";
import type {
  RegisterInput,
  LoginInput,
  SendOtpInput,
  VerifyOtpInput,
} from "./auth.schemas.js";

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

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeIdentifier = (identifier: string) => identifier.trim();

const isEmailIdentifier = (identifier: string) => EMAIL_REGEX.test(identifier);

const maskIdentifier = (identifier: string) => {
  if (isEmailIdentifier(identifier)) {
    const [name, domain] = identifier.split("@");
    if (!name || !domain) return "***";
    const visible = name.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
  }

  if (identifier.length <= 4) {
    return "*".repeat(identifier.length);
  }

  return `${"*".repeat(identifier.length - 4)}${identifier.slice(-4)}`;
};

// ============================================
// Token Generation
// ============================================

// ============================================
// Token lifetime configuration (DB-overridable)
// ============================================

const TTL_CACHE_MS = 60_000;
let cachedTokenTtls: { accessTtl: string; refreshTtl: string; at: number } | null =
  null;

/**
 * Access/refresh token validity periods. Read from PlatformConfig
 * (`auth.accessTokenTtl` / `auth.refreshTokenTtl`) so they are configurable at
 * runtime through the database, falling back to env-configured defaults.
 * Cached briefly to avoid a DB round-trip on every token issuance.
 */
export const getTokenTtls = async (): Promise<{
  accessTtl: string;
  refreshTtl: string;
}> => {
  if (cachedTokenTtls && Date.now() - cachedTokenTtls.at < TTL_CACHE_MS) {
    return { accessTtl: cachedTokenTtls.accessTtl, refreshTtl: cachedTokenTtls.refreshTtl };
  }

  let accessTtl = config.jwt.expiresIn;
  let refreshTtl = config.jwt.refreshExpiresIn;

  try {
    const rows = await prisma.platformConfig.findMany({
      where: {
        key: { in: ["auth.accessTokenTtl", "auth.refreshTokenTtl"] },
        isActive: true,
      },
      select: { key: true, value: true },
    });
    for (const row of rows) {
      const value = typeof row.value === "string" ? row.value.trim() : "";
      if (!value) continue;
      if (row.key === "auth.accessTokenTtl") accessTtl = value;
      if (row.key === "auth.refreshTokenTtl") refreshTtl = value;
    }
  } catch {
    // DB unavailable — keep env-configured defaults.
  }

  cachedTokenTtls = { accessTtl, refreshTtl, at: Date.now() };
  return { accessTtl, refreshTtl };
};

const TTL_UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Convert a TTL string ("15m", "1h", "30d") or bare seconds to milliseconds. */
export const ttlToMs = (ttl: string): number => {
  const match = /^(\d+)\s*([smhdw])$/i.exec(ttl.trim());
  if (match) {
    return Number(match[1]) * TTL_UNIT_MS[match[2].toLowerCase()];
  }
  const seconds = Number(ttl);
  return Number.isFinite(seconds) ? seconds * 1000 : 30 * TTL_UNIT_MS.d;
};

/** Persistent ("remember me") refresh-cookie maxAge, derived from the refresh TTL. */
export const getRefreshCookieMaxAgeMs = async (): Promise<number> =>
  ttlToMs((await getTokenTtls()).refreshTtl);

/**
 * Generate JWT access and refresh tokens. The `remember` preference is embedded
 * in the refresh token so it survives token rotation (refresh keeps the session
 * persistent-or-not without any server-side state).
 */
export const generateTokens = async (
  user: {
    id: string;
    email: string;
    role: string;
    tokenVersion?: number;
  },
  options: { remember?: boolean } = {},
) => {
  const { accessTtl, refreshTtl } = await getTokenTtls();
  const remember = options.remember ?? true;

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
    expiresIn: accessTtl,
  } as SignOptions);
  const refreshToken = jwt.sign(
    { id: user.id, tokenVersion: user.tokenVersion, remember },
    config.jwt.refreshSecret,
    {
      expiresIn: refreshTtl,
    } as SignOptions,
  );

  return { accessToken, refreshToken, remember };
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
  const tokens = await generateTokens({
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

  // Block suspended/inactive accounts; PENDING_VERIFICATION owners are allowed
  // through so the frontend can route them to the pending-approval page.
  if (
    user.status !== UserStatus.ACTIVE &&
    user.status !== UserStatus.PENDING_VERIFICATION
  ) {
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

  // Generate tokens with tokenVersion for invalidation on password change.
  // The "remember me" preference (default on) controls session persistence.
  const tokens = await generateTokens(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    { remember: data.rememberMe ?? true },
  );

  // Return user without password
  return {
    user: excludePassword(user),
    ...tokens,
  };
};

export const sendOtpCode = async (data: SendOtpInput) => {
  const identifier = normalizeIdentifier(data.identifier);
  const isEmail = isEmailIdentifier(identifier);

  let user = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;

  if (data.purpose === "LOGIN") {
    user = isEmail
      ? await prisma.user.findUnique({
          where: { email: identifier.toLowerCase() },
        })
      : await prisma.user.findFirst({
          where: { phone: identifier },
        });

    if (
      !user ||
      (user.status !== UserStatus.ACTIVE &&
        user.status !== UserStatus.PENDING_VERIFICATION)
    ) {
      return {
        sent: true,
        destination: maskIdentifier(identifier),
        expiresInSeconds: OTP_EXPIRY_MS / 1000,
      };
    }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = await bcrypt.hash(code, 10);

  await prisma.otpToken.updateMany({
    where: {
      usedAt: null,
      purpose: data.purpose,
      OR: [
        ...(isEmail ? [{ email: identifier.toLowerCase() }] : []),
        ...(!isEmail ? [{ phone: identifier }] : []),
      ],
    },
    data: {
      usedAt: new Date(),
    },
  });

  await prisma.otpToken.create({
    data: {
      userId: user?.id,
      email: isEmail ? identifier.toLowerCase() : null,
      phone: isEmail ? null : identifier,
      code: hashedCode,
      purpose: data.purpose,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  if (config.env === "development") {
    console.log(`[OTP:${data.purpose}] ${identifier} -> ${code}`);
  }

  return {
    sent: true,
    destination: maskIdentifier(identifier),
    expiresInSeconds: OTP_EXPIRY_MS / 1000,
  };
};

export const verifyOtpCode = async (data: VerifyOtpInput) => {
  const identifier = normalizeIdentifier(data.identifier);
  const isEmail = isEmailIdentifier(identifier);

  const otpRecord = await prisma.otpToken.findFirst({
    where: {
      usedAt: null,
      purpose: data.purpose,
      expiresAt: { gt: new Date() },
      OR: [
        ...(isEmail ? [{ email: identifier.toLowerCase() }] : []),
        ...(!isEmail ? [{ phone: identifier }] : []),
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otpRecord) {
    throw ApiError.badRequest("Invalid or expired OTP");
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.forbidden("Too many OTP attempts. Please request a new code.");
  }

  const isValid = await bcrypt.compare(data.code, otpRecord.code);

  if (!isValid) {
    await prisma.otpToken.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    throw ApiError.badRequest("Invalid OTP code");
  }

  await prisma.otpToken.update({
    where: { id: otpRecord.id },
    data: {
      usedAt: new Date(),
    },
  });

  if (data.purpose !== "LOGIN") {
    return { verified: true };
  }

  const user = otpRecord.userId
    ? await prisma.user.findUnique({ where: { id: otpRecord.userId } })
    : isEmail
      ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
      : await prisma.user.findFirst({ where: { phone: identifier } });

  if (!user) {
    throw ApiError.unauthorized("User account not found for OTP login");
  }

  if (
    user.status !== UserStatus.ACTIVE &&
    user.status !== UserStatus.PENDING_VERIFICATION
  ) {
    throw ApiError.forbidden(
      user.status === UserStatus.SUSPENDED
        ? "Your account has been suspended"
        : "Your account is not active",
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const tokens = await generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return {
    verified: true,
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
      remember?: boolean;
    };

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    if (
      user.status !== UserStatus.ACTIVE &&
      user.status !== UserStatus.PENDING_VERIFICATION
    ) {
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
    const newTokens = await generateTokens(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      { remember: decoded.remember ?? true },
    );

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

    if (
      user.status !== UserStatus.ACTIVE &&
      user.status !== UserStatus.PENDING_VERIFICATION
    ) {
      throw ApiError.forbidden(
        user.status === UserStatus.SUSPENDED
          ? "Your account has been suspended"
          : "Your account is not active",
      );
    }

    // Vehicle owners must be approved by an admin — OAuth login must not
    // auto-verify them. Preserve their existing isVerified flag.
    const isOwner = user.role === UserRole.VEHICLE_OWNER;

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        avatar: user.avatar || profile.avatarUrl || null,
        isVerified: isOwner ? user.isVerified : true,
      },
    });
  }

  const tokens = await generateTokens({
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
