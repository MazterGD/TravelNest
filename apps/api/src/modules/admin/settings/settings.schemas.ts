import { z } from "zod";

const jsonRecordSchema = z.record(z.string(), z.unknown());

const vehicleTypePricingSchema = z.object({
  pricePerDay: z.number().nonnegative(),
  pricePerKm: z.number().nonnegative(),
  fuelCostPerKm: z.number().nonnegative(),
});

const pricingSettingsSchema = z.object({
  ORDINARY: vehicleTypePricingSchema,
  SEMI_LUXURY: vehicleTypePricingSchema,
  LUXURY_AC: vehicleTypePricingSchema,
});

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
      pricingSettings: pricingSettingsSchema.optional(),
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
