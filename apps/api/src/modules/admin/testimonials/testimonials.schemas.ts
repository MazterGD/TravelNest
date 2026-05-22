import { z } from "zod";

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listTestimonialsSchema = z.object({
  query: paginationQuerySchema.extend({
    includeInactive: z.coerce.boolean().optional(),
    search: z.string().trim().min(1).max(200).optional(),
  }),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const testimonialIdParamsSchema = z.object({
  params: z.object({
    testimonialId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const approveTestimonialSchema = z.object({
  params: z.object({
    testimonialId: z.string().trim().min(1),
  }),
  body: z.object({
    note: z.string().trim().max(500).optional(),
  }),
  query: z.object({}).optional(),
});

export const updateTestimonialSchema = z.object({
  params: z.object({
    testimonialId: z.string().trim().min(1),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      role: z.string().trim().min(2).max(120).optional(),
      organization: z.string().trim().min(2).max(160).optional(),
      imageUrl: z.string().trim().url().max(500).optional(),
      rating: z.number().int().min(1).max(5).optional(),
      quote: z.string().trim().min(5).max(2000).optional(),
      tripDetails: z.string().trim().max(500).optional(),
      sortOrder: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
  query: z.object({}).optional(),
});

export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>["body"];
