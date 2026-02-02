import { z } from "zod";

/**
 * Schema for updating user personal information
 */
export const updatePersonalInfoSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name must be less than 50 characters")
      .optional(),
    lastName: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name must be less than 50 characters")
      .optional(),
    phone: z
      .string()
      .min(10, "Phone number must be at least 10 characters")
      .max(15, "Phone number must be less than 15 characters")
      .optional(),
    nicNumber: z
      .string()
      .min(9, "NIC must be at least 9 characters")
      .max(12, "NIC must be less than 12 characters")
      .optional(),
  }),
});

/**
 * Schema for updating user address
 */
export const updateAddressSchema = z.object({
  body: z.object({
    address: z
      .string()
      .max(200, "Address must be less than 200 characters")
      .optional(),
    city: z.string().max(50, "City must be less than 50 characters").optional(),
    district: z
      .string()
      .max(50, "District must be less than 50 characters")
      .optional(),
    postalCode: z
      .string()
      .max(10, "Postal code must be less than 10 characters")
      .optional(),
  }),
});

/**
 * Schema for changing password
 */
export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z
        .string()
        .min(8, "New password must be at least 8 characters")
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          "Password must contain uppercase, lowercase, and number",
        ),
      confirmPassword: z.string().min(1, "Confirm password is required"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

// Export types
export type UpdatePersonalInfoInput = z.infer<
  typeof updatePersonalInfoSchema
>["body"];
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
