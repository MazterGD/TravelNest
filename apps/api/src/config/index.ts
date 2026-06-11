import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";

// Load environment variables (local .env and repo root .env)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });

// Generate secure random secret for development only
const getJWTSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  // Generate random secret for development
  return `dev-secret-${crypto.randomBytes(32).toString("hex")}`;
};

const getJWTRefreshSecret = () => {
  if (process.env.JWT_REFRESH_SECRET) {
    return process.env.JWT_REFRESH_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_REFRESH_SECRET is required in production");
  }
  // Generate random secret for development
  return `dev-refresh-secret-${crypto.randomBytes(32).toString("hex")}`;
};

const port = parseInt(process.env.PORT || "5000", 10);
const apiVersion = process.env.API_VERSION || "v1";
const appUrl = process.env.APP_URL || "http://localhost:3000";
const apiBaseUrl =
  process.env.API_BASE_URL || `http://localhost:${port}/api/${apiVersion}`;
const jwtSecret = getJWTSecret();
const jwtRefreshSecret = getJWTRefreshSecret();
const oauthStateSecret = process.env.OAUTH_STATE_SECRET || jwtSecret;
const oauthRedirectBase = apiBaseUrl;
const oauthRedirectGoogle =
  process.env.GOOGLE_REDIRECT_URI ||
  `${oauthRedirectBase}/auth/oauth/google/callback`;
const oauthRedirectFacebook =
  process.env.FACEBOOK_REDIRECT_URI ||
  `${oauthRedirectBase}/auth/oauth/facebook/callback`;

export const config = {
  // Server
  env: process.env.NODE_ENV || "development",
  port,
  apiVersion,
  appUrl,

  // Database
  databaseUrl: process.env.DATABASE_URL || "",

  // JWT
  jwt: {
    secret: jwtSecret,
    expiresIn:
      process.env.JWT_ACCESS_EXPIRY || process.env.JWT_EXPIRES_IN || "1h",
    refreshSecret: jwtRefreshSecret,
    refreshExpiresIn:
      process.env.JWT_REFRESH_EXPIRY ||
      process.env.JWT_REFRESH_EXPIRES_IN ||
      "30d",
  },

  // OAuth (Google/Facebook)
  oauth: {
    stateSecret: oauthStateSecret,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectUri: oauthRedirectGoogle,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
      redirectUri: oauthRedirectFacebook,
    },
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || appUrl,

  // Email
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "noreply@travenest.com",
  },

  // PayHere Payment Gateway
  payhere: {
    merchantId: process.env.PAYHERE_MERCHANT_ID || "",
    merchantSecret: process.env.PAYHERE_MERCHANT_SECRET || "",
    appId: process.env.PAYHERE_APP_ID || "",
    appSecret: process.env.PAYHERE_APP_SECRET || "",
    mode: process.env.PAYHERE_MODE || "sandbox", // 'sandbox' or 'live'
    notifyUrl: process.env.PAYHERE_NOTIFY_URL || "",
    returnUrl: process.env.PAYHERE_RETURN_URL || "",
    cancelUrl: process.env.PAYHERE_CANCEL_URL || "",
  },

  // Bank transfer details (for manual payments)
  bankDetails: {
    bankName: process.env.BANK_NAME || "",
    accountName: process.env.BANK_ACCOUNT_NAME || "",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
    branch: process.env.BANK_BRANCH || "",
    referenceHint:
      process.env.BANK_REFERENCE_HINT ||
      "Use your booking reference as the payment note.",
  },

  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880", 10), // 5MB
    uploadDir: process.env.UPLOAD_DIR || "uploads",
  },

  // Supabase Storage
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "",
    bucket: process.env.SUPABASE_BUCKET || "travenest",
    publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  },

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes
  rateLimitMaxRequests: parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || "100",
    10,
  ),

  // Auth-specific Rate Limiting (stricter for login/register)
  authRateLimitWindowMs: parseInt(
    process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000",
    10,
  ), // 15 minutes
  authRateLimitMaxRequests: parseInt(
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || "10",
    10,
  ), // 10 attempts per 15 minutes

  // Sri Lankan Bus Rental Pricing Rules (in LKR)
  // These are industry standards for validating quotation pricing
  pricingRules: {
    // Per-kilometer rates by vehicle type
    perKmRate: {
      ORDINARY: { min: 50, max: 80, default: 65 },
      SEMI_LUXURY: { min: 80, max: 120, default: 100 },
      LUXURY_AC: { min: 120, max: 180, default: 150 },
    },
    // Daily driver allowance (batta)
    driverAllowance: {
      min: 2000,
      max: 5000,
      default: 3000,
    },
    // Minimum booking requirements
    minimumBooking: {
      kilometers: 100,
      hours: 8,
    },
    // Fuel cost estimation (LKR per km based on diesel prices)
    fuelCostPerKm: {
      ORDINARY: { min: 15, max: 25, default: 20 },
      SEMI_LUXURY: { min: 18, max: 30, default: 24 },
      LUXURY_AC: { min: 25, max: 40, default: 32 },
    },
    // Tolerance percentage for pricing validation (allow 20% variance)
    validationTolerance: 0.2,
  },

  // OSRM (self-hosted routing engine)
  osrm: {
    baseUrl: process.env.OSRM_BASE_URL || "http://127.0.0.1:5001",
    timeoutMs: parseInt(process.env.OSRM_TIMEOUT_MS || "15000", 10),
  },
} as const;

// Validate required environment variables in production
if (config.env === "production") {
  const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}
