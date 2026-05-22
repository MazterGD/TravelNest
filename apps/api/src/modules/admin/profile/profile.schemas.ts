import { z } from "zod";

const emptyObjectSchema = z.object({}).optional();

export const getAdminProfileSchema = z.object({
  params: emptyObjectSchema,
  body: emptyObjectSchema,
  query: emptyObjectSchema,
});

export const updateAdminProfileSchema = z.object({
  params: emptyObjectSchema,
  query: emptyObjectSchema,
  body: z
    .object({
      firstName: z.string().trim().min(2).max(50).optional(),
      lastName: z.string().trim().min(2).max(50).optional(),
      phone: z.string().trim().min(7).max(20).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
});

export const changeAdminPasswordSchema = z.object({
  params: emptyObjectSchema,
  query: emptyObjectSchema,
  body: z
    .object({
      currentPassword: z.string().min(8).max(120),
      newPassword: z.string().min(8).max(120),
      confirmPassword: z.string().min(8).max(120),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: "New password and confirmation must match",
      path: ["confirmPassword"],
    })
    .refine((value) => value.currentPassword !== value.newPassword, {
      message: "New password must be different from current password",
      path: ["newPassword"],
    }),
});

export const getAdminActivitySchema = z.object({
  params: emptyObjectSchema,
  body: emptyObjectSchema,
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    action: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["success", "failure"]).optional(),
  }),
});

export const getAdminPermissionsSchema = z.object({
  params: emptyObjectSchema,
  body: emptyObjectSchema,
  query: emptyObjectSchema,
});

export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>["body"];
export type ChangeAdminPasswordInput = z.infer<
  typeof changeAdminPasswordSchema
>["body"];
