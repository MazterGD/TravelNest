import { z } from "zod";

const disputeTypeSchema = z.enum([
  "BOOKING_QUALITY_ISSUE",
  "CANCELLATION_DISPUTE",
  "PAYMENT_ISSUE",
  "VEHICLE_CONDITION",
  "BEHAVIOR_COMPLAINT",
  "SERVICE_NOT_PROVIDED",
  "OTHER",
]);

const disputeStatusSchema = z.enum([
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
  "CLOSED",
  "ESCALATED",
]);

export const createDisputeSchema = z.object({
  body: z.object({
    bookingId: z.string().trim().min(1, "Booking is required"),
    type: disputeTypeSchema,
    subject: z.string().trim().min(3, "Subject is too short").max(200),
    description: z
      .string()
      .trim()
      .min(10, "Please describe the issue in more detail")
      .max(3000),
    evidenceUrls: z.array(z.string().url()).max(5).optional(),
  }),
});

export const listMyDisputesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    status: disputeStatusSchema.optional(),
    role: z.enum(["all", "raised", "against"]).optional(),
  }),
});

export const disputeIdParamsSchema = z.object({
  params: z.object({
    disputeId: z.string().trim().min(1),
  }),
});

export const replyDisputeSchema = z.object({
  params: z.object({
    disputeId: z.string().trim().min(1),
  }),
  body: z.object({
    message: z.string().trim().min(3, "Message is too short").max(3000),
  }),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>["body"];
export type ListMyDisputesQuery = z.infer<typeof listMyDisputesSchema>["query"];
export type ReplyDisputeInput = z.infer<typeof replyDisputeSchema>["body"];
export type DisputeType = z.infer<typeof disputeTypeSchema>;
