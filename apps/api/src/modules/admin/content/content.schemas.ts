import { z } from "zod";

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const contentSlugParamsSchema = z.object({
  params: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9-_]+$/),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const listContentPagesSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(200).optional(),
    isPublished: z.coerce.boolean().optional(),
  }),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const updateContentPageSchema = z.object({
  params: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9-_]+$/),
  }),
  body: z
    .object({
      title: z.string().trim().min(2).max(200).optional(),
      content: z.unknown().optional(),
      excerpt: z.string().trim().max(500).optional(),
      seoTitle: z.string().trim().max(200).optional(),
      seoDescription: z.string().trim().max(500).optional(),
      isPublished: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
  query: z.object({}).optional(),
});

export type UpdateContentPageInput = z.infer<typeof updateContentPageSchema>["body"];
