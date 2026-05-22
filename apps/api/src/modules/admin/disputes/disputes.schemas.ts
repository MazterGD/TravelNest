import { z } from "zod";

const disputeStatusSchema = z.enum([
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
  "CLOSED",
  "ESCALATED",
]);

const disputePrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const disputeTypeSchema = z.enum([
  "BOOKING_QUALITY_ISSUE",
  "CANCELLATION_DISPUTE",
  "PAYMENT_ISSUE",
  "VEHICLE_CONDITION",
  "BEHAVIOR_COMPLAINT",
  "SERVICE_NOT_PROVIDED",
  "OTHER",
]);

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listDisputesSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(200).optional(),
    status: disputeStatusSchema.optional(),
    priority: disputePrioritySchema.optional(),
    type: disputeTypeSchema.optional(),
    assignedTo: z.string().trim().min(1).optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const disputeIdParamsSchema = z.object({
  params: z.object({
    disputeId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const assignDisputeSchema = z.object({
  params: z.object({
    disputeId: z.string().trim().min(1),
  }),
  body: z.object({
    assignedTo: z.string().trim().min(1),
    note: z.string().trim().max(500).optional(),
  }),
  query: z.object({}).optional(),
});

export const updateDisputePrioritySchema = z.object({
  params: z.object({
    disputeId: z.string().trim().min(1),
  }),
  body: z.object({
    priority: disputePrioritySchema,
    note: z.string().trim().max(500).optional(),
  }),
  query: z.object({}).optional(),
});

export const updateDisputeStatusSchema = z.object({
  params: z.object({
    disputeId: z.string().trim().min(1),
  }),
  body: z.object({
    status: disputeStatusSchema,
    note: z.string().trim().max(500).optional(),
  }),
  query: z.object({}).optional(),
});

export const addDisputeMessageSchema = z.object({
  params: z.object({
    disputeId: z.string().trim().min(1),
  }),
  body: z.object({
    message: z.string().trim().min(3).max(3000),
    isInternalNote: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
});

export const resolveDisputeSchema = z.object({
  params: z.object({
    disputeId: z.string().trim().min(1),
  }),
  body: z.object({
    resolution: z.string().trim().min(3).max(3000),
    resolutionType: z.string().trim().min(2).max(120).optional(),
    resolutionAmount: z.number().positive().optional(),
  }),
  query: z.object({}).optional(),
});

export type DisputeStatusInput = z.infer<typeof updateDisputeStatusSchema>["body"];
export type DisputePriorityInput = z.infer<typeof updateDisputePrioritySchema>["body"];
export type AssignDisputeInput = z.infer<typeof assignDisputeSchema>["body"];
export type AddDisputeMessageInput = z.infer<typeof addDisputeMessageSchema>["body"];
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>["body"];
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;
export type DisputePriority = z.infer<typeof disputePrioritySchema>;
export type DisputeType = z.infer<typeof disputeTypeSchema>;
