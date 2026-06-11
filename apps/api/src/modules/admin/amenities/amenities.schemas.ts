import { z } from "zod";

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const amenityCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[A-Z0-9_-]+$/);

export const listAmenitiesSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(200).optional(),
    includeInactive: z.coerce.boolean().optional(),
  }),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const amenityIdParamsSchema = z.object({
  params: z.object({
    amenityId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const createAmenitySchema = z.object({
  body: z.object({
    code: amenityCodeSchema,
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    icon: z.string().trim().max(100).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateAmenitySchema = z.object({
  params: z.object({
    amenityId: z.string().trim().min(1),
  }),
  body: z
    .object({
      code: amenityCodeSchema.optional(),
      name: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().max(500).optional(),
      icon: z.string().trim().max(100).optional(),
      sortOrder: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
  query: z.object({}).optional(),
});

export type CreateAmenityInput = z.infer<typeof createAmenitySchema>["body"];
export type UpdateAmenityInput = z.infer<typeof updateAmenitySchema>["body"];
