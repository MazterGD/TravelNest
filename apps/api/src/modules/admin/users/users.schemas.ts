import { z } from "zod";

const userRoleSchema = z.enum(["CUSTOMER", "VEHICLE_OWNER", "ADMIN"]);
const userStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
]);
const adminRoleSchema = z.enum([
  "SUPER_ADMIN",
  "MODERATOR",
  "FINANCE_ADMIN",
  "SUPPORT_ADMIN",
]);

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listUsersSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(150).optional(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    adminRole: adminRoleSchema.optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const userIdParamsSchema = z.object({
  params: z.object({
    userId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const userActivitySchema = z.object({
  params: z.object({
    userId: z.string().trim().min(1),
  }),
  query: paginationQuerySchema,
  body: z.object({}).optional(),
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    userId: z.string().trim().min(1),
  }),
  body: z.object({
    status: userStatusSchema,
    reason: z.string().trim().max(300).optional(),
  }),
  query: z.object({}).optional(),
});

export const resetUserPasswordSchema = z.object({
  params: z.object({
    userId: z.string().trim().min(1),
  }),
  body: z.object({
    newPassword: z.string().min(8).max(128),
  }),
  query: z.object({}).optional(),
});

export const createAdminSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128),
    phone: z.string().trim().max(30).optional(),
    adminRole: adminRoleSchema,
    permissions: z.array(z.string().trim().min(1).max(120)).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const exportUsersSchema = z.object({
  query: z.object({
    search: z.string().trim().min(1).max(150).optional(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    adminRole: adminRoleSchema.optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>["body"];
export type UserStatusUpdateInput = z.infer<typeof updateUserStatusSchema>["body"];
