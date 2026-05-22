import { z } from "zod";

const userVerificationStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
]);

const documentStatusSchema = z.enum(["PENDING", "VERIFIED", "REJECTED"]);

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listOwnerVerificationsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(150).optional(),
    status: userVerificationStatusSchema.optional(),
    documentStatus: documentStatusSchema.optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const listVehicleVerificationsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(150).optional(),
    documentStatus: documentStatusSchema.optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const ownerIdParamsSchema = z.object({
  params: z.object({
    ownerId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const vehicleIdParamsSchema = z.object({
  params: z.object({
    vehicleId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const entityIdParamsSchema = z.object({
  params: z.object({
    entityId: z.string().trim().min(1),
  }),
  query: paginationQuerySchema,
  body: z.object({}).optional(),
});

export const approveVerificationSchema = z.object({
  params: z.object({
    ownerId: z.string().trim().min(1).optional(),
    vehicleId: z.string().trim().min(1).optional(),
  }),
  body: z.object({
    note: z.string().trim().max(300).optional(),
  }),
  query: z.object({}).optional(),
});

export const rejectVerificationSchema = z.object({
  params: z.object({
    ownerId: z.string().trim().min(1).optional(),
    vehicleId: z.string().trim().min(1).optional(),
  }),
  body: z.object({
    reason: z.string().trim().min(3).max(300),
  }),
  query: z.object({}).optional(),
});

export const requestResubmissionSchema = z.object({
  params: z.object({
    ownerId: z.string().trim().min(1),
  }),
  body: z.object({
    reason: z.string().trim().min(3).max(300),
  }),
  query: z.object({}).optional(),
});

export type ApproveVerificationInput = z.infer<typeof approveVerificationSchema>["body"];
export type RejectVerificationInput = z.infer<typeof rejectVerificationSchema>["body"];
export type RequestResubmissionInput = z.infer<typeof requestResubmissionSchema>["body"];
