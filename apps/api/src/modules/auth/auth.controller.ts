import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import * as authService from "./auth.service.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { setCSRFToken } from "../../middleware/csrf.js";
import { ResponseHelper } from "../../utils/response.js";
import { config } from "../../config/index.js";
import { authCookieOptions } from "../../utils/cookies.js";

const getAppBaseUrl = () =>
  config.appUrl.endsWith("/") ? config.appUrl : `${config.appUrl}/`;

const getDefaultReturnTo = () =>
  new URL("auth/callback", getAppBaseUrl()).toString();

const getSafeReturnTo = (returnTo?: string) => {
  const fallback = getDefaultReturnTo();

  if (!returnTo) {
    return fallback;
  }

  try {
    const baseUrl = new URL(getAppBaseUrl());
    const resolved = returnTo.startsWith("/")
      ? new URL(returnTo, baseUrl)
      : new URL(returnTo);

    if (resolved.origin !== baseUrl.origin) {
      return fallback;
    }

    return resolved.toString();
  } catch {
    return fallback;
  }
};

const buildReturnToWithParams = (
  returnTo: string,
  params: Record<string, string>,
) => {
  const url = new URL(returnTo);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

/**
 * Set the HTTP-only refresh-token cookie. When `remember` is true the cookie is
 * persistent (maxAge = refresh-token TTL); otherwise it is a session cookie that
 * the browser clears on close.
 */
const setRefreshCookie = (
  res: Response,
  token: string,
  options: { remember: boolean; maxAgeMs: number },
) => {
  res.cookie("refreshToken", token, {
    ...authCookieOptions(),
    httpOnly: true,
    ...(options.remember ? { maxAge: options.maxAgeMs } : {}),
  });
};

// Register a new user
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);

  // Set refresh token as HTTP-only cookie
  res.cookie("refreshToken", result.refreshToken, {
    ...authCookieOptions(),
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Set CSRF token
  setCSRFToken(res);

  return ResponseHelper.created(res, {
    user: result.user,
    accessToken: result.accessToken,
  });
});

// Login user
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body);

  // Persistent cookie when "remember me" is on; session cookie otherwise.
  const maxAgeMs = await authService.getRefreshCookieMaxAgeMs();
  setRefreshCookie(res, result.refreshToken, {
    remember: result.remember,
    maxAgeMs,
  });

  // Set CSRF token
  setCSRFToken(res);

  return ResponseHelper.success(res, {
    user: result.user,
    accessToken: result.accessToken,
  });
});

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.sendOtpCode(req.body);
  return ResponseHelper.success(res, result, "OTP sent successfully");
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyOtpCode(req.body);

  if (
    "accessToken" in result &&
    "refreshToken" in result &&
    "user" in result
  ) {
    res.cookie("refreshToken", result.refreshToken, {
      ...authCookieOptions(),
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    setCSRFToken(res);

    return ResponseHelper.success(res, {
      verified: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  return ResponseHelper.success(res, {
    verified: true,
    ...("registrationToken" in result && {
      registrationToken: result.registrationToken,
    }),
  });
});

// Refresh tokens
export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    const tokens = await authService.refreshUserTokens(token);

    // Preserve the original "remember me" preference across token rotation.
    const maxAgeMs = await authService.getRefreshCookieMaxAgeMs();
    setRefreshCookie(res, tokens.refreshToken, {
      remember: tokens.remember,
      maxAgeMs,
    });

    return ResponseHelper.success(res, {
      accessToken: tokens.accessToken,
    });
  },
);

// Logout user
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  // Clear refresh token cookie
  res.clearCookie("refreshToken", {
    ...authCookieOptions(),
    httpOnly: true,
  });

  return ResponseHelper.success(res, null, "Logged out successfully");
});

// Get current user
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await authService.getUserById(req.user!.id);

    return ResponseHelper.success(res, { user });
  },
);

// Change password
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changeUserPassword(
      req.user!.id,
      currentPassword,
      newPassword,
    );

    return ResponseHelper.success(res, null, result.message);
  },
);

// Forgot password
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await authService.generatePasswordResetToken(req.body.email);

    return ResponseHelper.success(res, null, result.message);
  },
);

// Reset password
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, password } = req.body;
    const result = await authService.resetUserPassword(token, password);

    return ResponseHelper.success(res, null, result.message);
  },
);

// The OAuth state is bound to the browser that started the flow through this
// short-lived cookie, so a callback URL produced in someone else's browser
// cannot sign the victim into the attacker's account (login CSRF).
const OAUTH_NONCE_COOKIE = "oauthNonce";

const issueOAuthNonce = (res: Response) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  res.cookie(OAUTH_NONCE_COOKIE, nonce, {
    ...authCookieOptions(),
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
  });
  return nonce;
};

const readCallbackState = (
  req: Request,
  res: Response,
  provider: "google" | "facebook",
): { valid: boolean; returnTo: string } => {
  const state = req.query.state;
  const nonce = req.cookies?.[OAUTH_NONCE_COOKIE];
  res.clearCookie(OAUTH_NONCE_COOKIE, { ...authCookieOptions(), httpOnly: true });

  if (typeof state !== "string" || !state || typeof nonce !== "string") {
    return { valid: false, returnTo: getDefaultReturnTo() };
  }

  try {
    const parsed = authService.verifyOAuthStateToken(state);
    if (parsed.provider !== provider || parsed.nonce !== nonce) {
      return { valid: false, returnTo: getDefaultReturnTo() };
    }
    return { valid: true, returnTo: parsed.returnTo };
  } catch {
    return { valid: false, returnTo: getDefaultReturnTo() };
  }
};

// OAuth (Google/Facebook) Start
export const startGoogleOAuth = asyncHandler(
  async (req: Request, res: Response) => {
    const returnTo = getSafeReturnTo(req.query.returnTo as string | undefined);
    const state = authService.createOAuthStateToken({
      provider: "google",
      returnTo,
      nonce: issueOAuthNonce(res),
    });
    const authUrl = authService.getOAuthAuthorizationUrl("google", state);
    return res.redirect(authUrl);
  },
);

export const startFacebookOAuth = asyncHandler(
  async (req: Request, res: Response) => {
    const returnTo = getSafeReturnTo(req.query.returnTo as string | undefined);
    const state = authService.createOAuthStateToken({
      provider: "facebook",
      returnTo,
      nonce: issueOAuthNonce(res),
    });
    const authUrl = authService.getOAuthAuthorizationUrl("facebook", state);
    return res.redirect(authUrl);
  },
);

// OAuth (Google/Facebook) Callback
export const handleGoogleCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const providerError = req.query.error as string | undefined;

    const { valid, returnTo } = readCallbackState(req, res, "google");
    if (!valid) {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "INVALID_STATE" }),
      );
    }

    if (providerError) {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "OAUTH_DENIED" }),
      );
    }

    if (!code) {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "MISSING_CODE" }),
      );
    }

    try {
      const profile = await authService.getGoogleProfileFromCode(code);
      const result = await authService.loginWithOAuthProfile(profile);

      res.cookie("refreshToken", result.refreshToken, {
        ...authCookieOptions(),
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      setCSRFToken(res);

      return res.redirect(
        buildReturnToWithParams(returnTo, { provider: "google" }),
      );
    } catch {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "PROFILE_ERROR" }),
      );
    }
  },
);

export const handleFacebookCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const providerError = req.query.error as string | undefined;

    const { valid, returnTo } = readCallbackState(req, res, "facebook");
    if (!valid) {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "INVALID_STATE" }),
      );
    }

    if (providerError) {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "OAUTH_DENIED" }),
      );
    }

    if (!code) {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "MISSING_CODE" }),
      );
    }

    try {
      const profile = await authService.getFacebookProfileFromCode(code);
      const result = await authService.loginWithOAuthProfile(profile);

      res.cookie("refreshToken", result.refreshToken, {
        ...authCookieOptions(),
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      setCSRFToken(res);

      return res.redirect(
        buildReturnToWithParams(returnTo, { provider: "facebook" }),
      );
    } catch {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "PROFILE_ERROR" }),
      );
    }
  },
);
