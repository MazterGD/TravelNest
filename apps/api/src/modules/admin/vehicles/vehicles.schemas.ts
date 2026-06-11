import { z } from "zod";

export const adminVehiclesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().max(200).optional(),
    type: z.enum(["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"]).optional(),
    isActive: z
      .string()
      .transform((v) => v === "true")
      .optional(),
  }),
});
