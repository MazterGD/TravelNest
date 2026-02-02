import { type Request, type Response, type NextFunction } from "express";
import * as authService from "./auth.service.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { setCSRFToken } from "../../middleware/csrf.js";
import { ResponseHelper } from "../../utils/response.js";

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
