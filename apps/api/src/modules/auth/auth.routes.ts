import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getCSRFToken, csrfProtection } from "../../middleware/csrf.js";
import { config } from "../../config/index.js";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.schemas.js";

const router = Router();

// Stricter rate limiting for auth endpoints to prevent brute force attacks
const authRateLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs, // 15 minutes
  max: config.authRateLimitMaxRequests, // 10 attempts
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts. Please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in test environment
  skip: () => config.env === "test",
});

// Public routes with stricter rate limiting
router.get("/csrf-token", getCSRFToken); // Get CSRF token
router.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  authController.register,
);
router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  authController.login,
);
router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  authController.refreshToken,
);
router.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  authRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// Protected routes with CSRF protection
router.post("/logout", authenticate, csrfProtection, authController.logout);
router.get("/me", authenticate, authController.getCurrentUser);
router.put(
  "/change-password",
  authenticate,
  csrfProtection,
  validate(changePasswordSchema),
  authController.changePassword,
);

export default router;
