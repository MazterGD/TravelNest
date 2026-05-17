import { z } from "zod";

// Allowed MIME types for validation
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Vehicle photo schema
const vehiclePhotoSchema = z.object({
  url: z.string().url("Invalid URL"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z
    .number()
    .positive("File size must be positive")
    .max(MAX_FILE_SIZE, "File size cannot exceed 5MB"),
  mimeType: z
    .string()
    .refine(
      (type) => ALLOWED_IMAGE_TYPES.includes(type),
      `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    ),
  isPrimary: z.boolean().optional(),
});

// Vehicle document schema
const vehicleDocumentSchema = z.object({
  url: z.string().url("Invalid URL"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z
    .number()
    .positive("File size must be positive")
    .max(MAX_FILE_SIZE, "File size cannot exceed 5MB"),
  mimeType: z
    .string()
    .refine(
      (type) => ALLOWED_DOCUMENT_TYPES.includes(type),
      `Invalid file type. Allowed types: ${ALLOWED_DOCUMENT_TYPES.join(", ")}`,
    ),
  type: z.enum(["INSURANCE", "REGISTRATION_CERTIFICATE", "DRIVING_LICENSE"]),
  expiryDate: z.string().datetime().optional(),
});

// Create vehicle schema - Bus rental platform only
export const createVehicleSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().optional(),
    type: z.enum(["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"]),
    brand: z.string().min(2, "Brand is required"),
    model: z.string().min(1, "Model is required"),
    year: z
      .number()
      .int()
      .min(1990, "Year must be 1990 or later")
      .max(new Date().getFullYear() + 1, "Invalid year"),
    licensePlate: z
      .string()
      .min(3, "License plate is required")
      .regex(
        /^[A-Z]{2,3}-\d{4}$/,
        "Invalid license plate format (e.g., WP-1234)",
      ),
    color: z.string().optional(),
    seats: z.number().int().min(10).max(100, "Buses must have 10-100 seats"),
    fuelType: z.enum(["DIESEL"]).default("DIESEL"),
    transmission: z.enum(["MANUAL"]).default("MANUAL"),
    acType: z.enum(["full-ac", "ac", "non-ac"]),
    condition: z.enum(["excellent", "good", "fair"]).optional(),
    mileage: z.number().int().min(0).optional(),
    pricePerDay: z.number().positive("Price per day must be positive"),
    pricePerKm: z.number().positive().optional(),
    driverAllowance: z.number().min(0).optional(),
    location: z.string().min(2, "Location is required"),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    amenities: z.array(z.string()).optional(),
    features: z.record(z.boolean()).optional(),
  }),
});

// Update vehicle schema - Bus rental platform only
export const updateVehicleSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    type: z.enum(["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"]).optional(),
    brand: z.string().min(2).optional(),
    model: z.string().min(1).optional(),
    year: z
      .number()
      .int()
      .min(1990)
      .max(new Date().getFullYear() + 1)
      .optional(),
    licensePlate: z
      .string()
      .min(3, "License plate is required")
      .regex(
        /^[A-Z]{2,3}-\d{4}$/,
        "Invalid license plate format (e.g., WP-1234)",
      )
      .optional(),
    color: z.string().optional(),
    seats: z.number().int().min(10).max(100).optional(),
    fuelType: z.enum(["DIESEL"]).optional(),
    transmission: z.enum(["MANUAL"]).optional(),
    acType: z.enum(["full-ac", "ac", "non-ac"]).optional(),
    condition: z.enum(["excellent", "good", "fair"]).optional(),
    mileage: z.number().int().min(0).optional(),
    pricePerDay: z.number().positive().optional(),
    pricePerKm: z.number().positive().optional(),
    driverAllowance: z.number().min(0).optional(),
    location: z.string().min(2).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    amenities: z.array(z.string()).optional(),
    features: z.record(z.boolean()).optional(),
    isAvailable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().cuid("Invalid vehicle ID"),
  }),
});

// Upload photos schema
export const uploadPhotosSchema = z.object({
  body: z.object({
    photos: z
      .array(vehiclePhotoSchema)
      .min(1, "At least one photo is required")
      .max(10, "Maximum 10 photos allowed"),
  }),
  params: z.object({
    id: z.string().cuid("Invalid vehicle ID"),
  }),
});

// Upload documents schema
export const uploadDocumentsSchema = z.object({
  body: z.object({
    documents: z
      .array(vehicleDocumentSchema)
      .min(1, "At least one document is required"),
  }),
  params: z.object({
    id: z.string().cuid("Invalid vehicle ID"),
  }),
});

// Get vehicle by ID schema
export const getVehicleByIdSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid vehicle ID"),
  }),
});

// Delete vehicle schema
export const deleteVehicleSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid vehicle ID"),
  }),
});

export const getVehicleAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid vehicle ID"),
  }),
  query: z.object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format")
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const getSimilarVehiclesSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid vehicle ID"),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(12).optional(),
  }),
});
