import { type Request, type Response, type NextFunction } from "express";
import * as authService from "./auth.service.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { setCSRFToken } from "../../middleware/csrf.js";
import { ResponseHelper } from "../../utils/response.js";
import { config } from "../../config/index.js";

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

// Register a new user
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);

  // Set refresh token as HTTP-only cookie
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
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

  // Set refresh token as HTTP-only cookie
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Set CSRF token
  setCSRFToken(res);

  return ResponseHelper.success(res, {
    user: result.user,
    accessToken: result.accessToken,
  });
});

// Refresh tokens
export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    const tokens = await authService.refreshUserTokens(token);

    // Set new refresh token as HTTP-only cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
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

// OAuth (Google/Facebook) Start
export const startGoogleOAuth = asyncHandler(
  async (req: Request, res: Response) => {
    const returnTo = getSafeReturnTo(req.query.returnTo as string | undefined);
    const state = authService.createOAuthStateToken({
      provider: "google",
      returnTo,
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
    });
    const authUrl = authService.getOAuthAuthorizationUrl("facebook", state);
    return res.redirect(authUrl);
  },
);

// OAuth (Google/Facebook) Callback
export const handleGoogleCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const providerError = req.query.error as string | undefined;

    let returnTo = getDefaultReturnTo();

    if (state) {
      try {
        const parsedState = authService.verifyOAuthStateToken(state);
        if (parsedState.provider !== "google") {
          return res.redirect(
            buildReturnToWithParams(returnTo, { error: "INVALID_STATE" }),
          );
        }
        returnTo = parsedState.returnTo;
      } catch {
        return res.redirect(
          buildReturnToWithParams(returnTo, { error: "INVALID_STATE" }),
        );
      }
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
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      setCSRFToken(res);

      return res.redirect(
        buildReturnToWithParams(returnTo, {
          accessToken: result.accessToken,
          provider: "google",
        }),
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
    const state = req.query.state as string | undefined;
    const providerError = req.query.error as string | undefined;

    let returnTo = getDefaultReturnTo();

    if (state) {
      try {
        const parsedState = authService.verifyOAuthStateToken(state);
        if (parsedState.provider !== "facebook") {
          return res.redirect(
            buildReturnToWithParams(returnTo, { error: "INVALID_STATE" }),
          );
        }
        returnTo = parsedState.returnTo;
      } catch {
        return res.redirect(
          buildReturnToWithParams(returnTo, { error: "INVALID_STATE" }),
        );
      }
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
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      setCSRFToken(res);

      return res.redirect(
        buildReturnToWithParams(returnTo, {
          accessToken: result.accessToken,
          provider: "facebook",
        }),
      );
    } catch {
      return res.redirect(
        buildReturnToWithParams(returnTo, { error: "PROFILE_ERROR" }),
      );
    }
  },
);
