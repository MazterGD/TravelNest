import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Invalid email address")
      .max(254, "Email must be at most 254 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    firstName: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name must be at most 50 characters"),
    lastName: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name must be at most 50 characters"),
    phone: z.string().optional(),
    role: z.enum(["customer", "owner"]).default("customer"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
    // Default-on; when false the session ends on logout or browser close.
    rememberMe: z.boolean().optional(),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(), // Optional in body as it can come from cookies
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
  }),
});

export const sendOtpSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(1, "Identifier is required"),
    purpose: z.enum(["LOGIN", "REGISTRATION", "PHONE_VERIFICATION"]),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(1, "Identifier is required"),
    code: z
      .string()
      .trim()
      .length(6, "OTP must be 6 digits")
      .regex(/^\d{6}$/, "OTP must contain only digits"),
    purpose: z.enum(["LOGIN", "REGISTRATION", "PHONE_VERIFICATION"]),
  }),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
export type SendOtpInput = z.infer<typeof sendOtpSchema>["body"];
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>["body"];
