import { z } from "zod";

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const userRoleSchema = z.enum(["CUSTOMER", "VEHICLE_OWNER", "ADMIN"]);
const platformNotificationStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "SENT",
  "FAILED",
  "CANCELLED",
]);
const platformNotificationChannelSchema = z.enum(["IN_APP", "EMAIL", "SMS"]);

const optionalTargetUserIdsSchema = z
  .array(z.string().trim().min(1))
  .max(10000)
  .optional()
  .transform((value) => (value ? Array.from(new Set(value)) : undefined));

export const listPlatformNotificationsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(200).optional(),
    status: platformNotificationStatusSchema.optional(),
    channel: platformNotificationChannelSchema.optional(),
    targetRole: userRoleSchema.optional(),
  }),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const platformNotificationIdParamsSchema = z.object({
  params: z.object({
    notificationId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const createPlatformNotificationSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(160),
    message: z.string().trim().min(5).max(5000),
    type: z.string().trim().min(2).max(80).optional(),
    channel: platformNotificationChannelSchema.optional(),
    targetRole: userRoleSchema.optional(),
    targetUserIds: optionalTargetUserIdsSchema,
    scheduledFor: z.coerce.date().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const resendPlatformNotificationSchema = z.object({
  params: z.object({
    notificationId: z.string().trim().min(1),
  }),
  body: z.object({
    title: z.string().trim().min(2).max(160).optional(),
    message: z.string().trim().min(5).max(5000).optional(),
    type: z.string().trim().min(2).max(80).optional(),
    channel: platformNotificationChannelSchema.optional(),
    targetRole: userRoleSchema.optional(),
    targetUserIds: optionalTargetUserIdsSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  query: z.object({}).optional(),
});

export type PlatformNotificationStatusInput = z.infer<
  typeof platformNotificationStatusSchema
>;
export type PlatformNotificationChannelInput = z.infer<
  typeof platformNotificationChannelSchema
>;
export type UserRoleInput = z.infer<typeof userRoleSchema>;
export type CreatePlatformNotificationInput = z.infer<
  typeof createPlatformNotificationSchema
>["body"];
export type ResendPlatformNotificationInput = z.infer<
  typeof resendPlatformNotificationSchema
>["body"];
