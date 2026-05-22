import { z } from "zod";

export const createPaymentIntentSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
    method: z.enum(["CARD", "BANK_TRANSFER", "CASH"], {
      required_error: "Payment method is required",
    }),
    amount: z.number().positive().optional(),
  }),
});

export const confirmPaymentSchema = z.object({
  body: z.object({
    paymentId: z.string().min(1, "Payment ID is required"),
  }),
});

export const refundPaymentSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Payment ID is required"),
  }),
  body: z.object({
    amount: z.number().positive().optional(),
    reason: z.string().min(3, "Refund reason is required").max(500),
  }),
});

export const uploadReceiptSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Payment ID is required"),
  }),
});
