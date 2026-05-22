import { z } from "zod";

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listFaqsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    isPublished: z.coerce.boolean().optional(),
  }),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const faqIdParamsSchema = z.object({
  params: z.object({
    faqId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const createFaqSchema = z.object({
  body: z.object({
    question: z.string().trim().min(5).max(300),
    answer: z.string().trim().min(5).max(5000),
    category: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isPublished: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateFaqSchema = z.object({
  params: z.object({
    faqId: z.string().trim().min(1),
  }),
  body: z
    .object({
      question: z.string().trim().min(5).max(300).optional(),
      answer: z.string().trim().min(5).max(5000).optional(),
      category: z.string().trim().max(80).optional(),
      sortOrder: z.number().int().min(0).optional(),
      isPublished: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
  query: z.object({}).optional(),
});

export type CreateFaqInput = z.infer<typeof createFaqSchema>["body"];
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>["body"];
