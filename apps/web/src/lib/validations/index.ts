import { z } from "zod";

// ============================================
// Auth Schemas
// ============================================
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain uppercase, lowercase, and number",
      ),
    confirmPassword: z.string(),
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number")
      .optional()
      .or(z.literal("")),
    role: z.enum(["customer", "owner"]).default("customer"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Location Schema
export const locationSchema = z.object({
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City is required"),
  district: z.string().min(2, "District is required"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// Quotation Request Schema
export const quotationRequestSchema = z
  .object({
    pickupLocation: locationSchema,
    dropoffLocation: locationSchema,
    pickupDate: z.string().refine((date) => new Date(date) > new Date(), {
      message: "Pickup date must be in the future",
    }),
    pickupTime: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    returnDate: z.string().optional(),
    returnTime: z.string().optional(),
    isRoundTrip: z.boolean().default(false),
    passengerCount: z.number().min(1, "At least 1 passenger required").max(100),
    vehicleType: z.enum(["mini_bus", "standard_bus", "luxury_bus", "coach"]),
    specialRequests: z.string().max(500).optional(),
    luggageCount: z.number().min(0).default(0),
    needsAC: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.isRoundTrip) {
        return data.returnDate && data.returnTime;
      }
      return true;
    },
    {
      message: "Return date and time required for round trips",
      path: ["returnDate"],
    },
  );

// Vehicle Schema
export const vehicleSchema = z.object({
  registrationNumber: z.string().min(5, "Invalid registration number"),
  type: z.enum(["mini_bus", "standard_bus", "luxury_bus", "coach"]),
  brand: z.string().min(2, "Brand is required"),
  model: z.string().min(2, "Model is required"),
  year: z
    .number()
    .min(1990)
    .max(new Date().getFullYear() + 1),
  seatingCapacity: z.number().min(10).max(60),
  hasAC: z.boolean().default(false),
  hasWifi: z.boolean().default(false),
  hasTV: z.boolean().default(false),
  hasToilet: z.boolean().default(false),
  pricePerKm: z.number().min(0),
  pricePerDay: z.number().min(0),
  images: z.array(z.string()).min(1, "At least one image required"),
  description: z.string().max(1000).optional(),
});

// Quotation Response Schema
export const quotationResponseSchema = z.object({
  vehicleId: z.string(),
  startTime: z.string(),
  estimatedDistance: z.string(),
  estimatedDuration: z.string(),
  vehicleRentalCost: z.number().min(0),
  driverCost: z.number().min(0),
  fuelCost: z.number().min(0),
  tollCharges: z.number().min(0),
  permitFees: z.number().min(0),
  customItems: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number().min(0),
      }),
    )
    .optional()
    .default([]),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  totalAmount: z.number().min(0),
  additionalNotes: z.string().max(500).optional(),
  validityDays: z.number().min(1).max(30),
});

// Review Schema
export const reviewSchema = z.object({
  bookingId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters")
    .max(500),
});

// Contact Form Schema
export const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z
    .string()
    .min(20, "Message must be at least 20 characters")
    .max(1000),
});

// Profile Update Schema
export const profileUpdateSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .optional(),
  avatar: z.string().url().optional(),
  address: locationSchema.optional(),
});

// Export types
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type QuotationRequestInput = z.infer<typeof quotationRequestSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type QuotationResponseInput = z.infer<typeof quotationResponseSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
