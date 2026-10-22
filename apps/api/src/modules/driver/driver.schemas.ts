import { z } from "zod";

export const createDriverSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    phone: z
      .string()
      .regex(/^[\d+\-\s]{9,15}$/, "Invalid phone number format")
      .transform((v) => v.trim()),
    photoUrl: z.string().url("Invalid photo URL").optional().nullable(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
  }),
});

export const updateDriverSchema = z.object({
  params: z.object({ id: z.string().cuid("Invalid driver ID") }),
  body: z
    .object({
      name: z.string().min(2).max(100).optional(),
      phone: z
        .string()
        .regex(/^[\d+\-\s]{9,15}$/, "Invalid phone number format")
        .transform((v) => v.trim())
        .optional(),
      photoUrl: z.string().url().optional().nullable(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .strict(),
});

export const driverIdParamSchema = z.object({
  params: z.object({ id: z.string().cuid("Invalid driver ID") }),
});

export const assignDriverToBookingSchema = z.object({
  params: z.object({ bookingId: z.string().cuid("Invalid booking ID") }),
  body: z.object({
    driverId: z.string().cuid("Invalid driver ID"),
  }),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>["body"];
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>["body"];
