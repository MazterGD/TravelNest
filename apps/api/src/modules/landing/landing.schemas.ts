import { z } from "zod";

const locationSchema = z.object({
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1, "City is required").max(100),
  district: z.string().trim().min(1, "District is required").max(100),
});

export const submitContactSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name is required").max(100),
    email: z.string().trim().email("Valid email is required").max(254),
    phone: z.string().trim().max(30).optional(),
    subject: z.string().trim().min(2, "Subject is required").max(150),
    message: z.string().trim().min(10, "Message is too short").max(2000),
  }),
});

export const routeEstimateSchema = z.object({
  body: z.object({
    pickupLocation: locationSchema,
    dropoffLocation: locationSchema,
    intermediateStops: z.array(locationSchema).optional().default([]),
    isRoundTrip: z.boolean().optional().default(false),
  }),
});

export type SubmitContactInput = z.infer<typeof submitContactSchema>["body"];
export type RouteEstimateInput = z.infer<typeof routeEstimateSchema>["body"];
