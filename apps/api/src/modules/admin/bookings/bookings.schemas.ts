import { z } from "zod";

const bookingStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);

const paymentStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
]);

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const listFilterSchema = z.object({
  search: z.string().trim().min(1).max(150).optional(),
  status: bookingStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
});

export const listBookingsSchema = z.object({
  query: paginationQuerySchema.extend(listFilterSchema.shape),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const bookingIdParamsSchema = z.object({
  params: z.object({
    bookingId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const updateBookingStatusSchema = z.object({
  params: z.object({
    bookingId: z.string().trim().min(1),
  }),
  body: z.object({
    status: bookingStatusSchema,
    reason: z.string().trim().max(300).optional(),
  }),
  query: z.object({}).optional(),
});

export const cancelWithRefundSchema = z.object({
  params: z.object({
    bookingId: z.string().trim().min(1),
  }),
  body: z.object({
    refundAmount: z.number().positive().optional(),
    refundReason: z.string().trim().min(1).max(300),
  }),
  query: z.object({}).optional(),
});

export const exportBookingsSchema = z.object({
  query: listFilterSchema,
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type BookingStatusUpdateInput = z.infer<typeof updateBookingStatusSchema>["body"];
export type CancelWithRefundInput = z.infer<typeof cancelWithRefundSchema>["body"];
