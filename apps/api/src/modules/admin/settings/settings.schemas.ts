import { z } from "zod";

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const getPlatformSettingsSchema = z.object({
  query: z.object({}).optional(),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const updatePlatformSettingsSchema = z.object({
  body: z
    .object({
      generalSettings: jsonRecordSchema.optional(),
      notificationSettings: jsonRecordSchema.optional(),
      paymentSettings: jsonRecordSchema.optional(),
      bookingSettings: jsonRecordSchema.optional(),
      securitySettings: jsonRecordSchema.optional(),
      mapSettings: jsonRecordSchema.optional(),
      maintenanceMode: z.boolean().optional(),
      maintenanceMessage: z.string().trim().max(1000).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type UpdatePlatformSettingsInput = z.infer<
  typeof updatePlatformSettingsSchema
>["body"];
