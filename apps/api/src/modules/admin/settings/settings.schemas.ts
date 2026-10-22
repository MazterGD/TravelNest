import { z } from "zod";

const jsonRecordSchema = z.record(z.string(), z.unknown());

// Values other modules compute money and refunds from must stay in range.
const paymentSettingsSchema = z
  .object({
    commissionRate: z.number().min(0).max(1).optional(),
  })
  .catchall(z.unknown());

const hours = z.number().min(0).max(24 * 365);

const bookingSettingsSchema = z
  .object({
    autoCancelUnpaidHours: z.number().min(1).max(24 * 30).optional(),
    refundFullHours: hours.optional(),
    refundPartialHours: hours.optional(),
    refundPartialPercent: z.number().min(0).max(100).optional(),
  })
  .catchall(z.unknown())
  .refine(
    (value) =>
      value.refundFullHours === undefined ||
      value.refundPartialHours === undefined ||
      value.refundFullHours >= value.refundPartialHours,
    {
      message: "The full-refund window must be at least the partial-refund window",
      path: ["refundFullHours"],
    },
  );

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
      paymentSettings: paymentSettingsSchema.optional(),
      bookingSettings: bookingSettingsSchema.optional(),
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
