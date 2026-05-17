import { z } from "zod";

const moderationStatusSchema = z.enum(["ACTIVE", "HIDDEN", "DELETED"]);
const reportResolutionStatusSchema = z.enum(["RESOLVED", "DISMISSED"]);

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listModerationQueueSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(200).optional(),
    status: moderationStatusSchema.optional(),
    flaggedOnly: z.coerce.boolean().optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const reviewIdParamsSchema = z.object({
  params: z.object({
    reviewId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const updateReviewStatusSchema = z.object({
  params: z.object({
    reviewId: z.string().trim().min(1),
  }),
  body: z
    .object({
      status: moderationStatusSchema,
      reason: z.string().trim().max(500).optional(),
    })
    .refine(
      (value) => {
        if (value.status === "ACTIVE") {
          return true;
        }

        return Boolean(value.reason && value.reason.trim().length >= 3);
      },
      {
        message: "Reason must be provided for non-active moderation status",
        path: ["reason"],
      },
    ),
  query: z.object({}).optional(),
});

export const resolveReviewReportSchema = z.object({
  params: z.object({
    reviewId: z.string().trim().min(1),
  }),
  body: z.object({
    status: reportResolutionStatusSchema,
    resolution: z.string().trim().min(3).max(500),
  }),
  query: z.object({}).optional(),
});

export type ReviewModerationStatus = z.infer<typeof moderationStatusSchema>;
export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusSchema>["body"];
export type ResolveReviewReportInput = z.infer<typeof resolveReviewReportSchema>["body"];
