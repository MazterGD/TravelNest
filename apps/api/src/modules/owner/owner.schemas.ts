import { z } from "zod";

// Vehicle document schema
const vehicleDocumentSchema = z.object({
  type: z.enum(["DRIVING_LICENSE", "INSURANCE", "REGISTRATION_CERTIFICATE"]),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().positive("File size must be positive"),
  mimeType: z.string().min(1, "MIME type is required"),
  url: z.string().url("Document URL is required"),
});

// Vehicle photo schema
const vehiclePhotoSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().positive("File size must be positive"),
  mimeType: z.string().min(1, "MIME type is required"),
  isPrimary: z.boolean().default(false),
  url: z.string().url("Photo URL is required"),
});

// Vehicle data schema
const vehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(1, "Registration number is required")
    .max(20, "Registration number must be at most 20 characters"),
  vehicleType: z.enum(["luxury", "semi-luxury", "standard", "mini"]),
  make: z.string().min(1, "Make is required").max(50),
  model: z.string().min(1, "Model is required").max(50),
  year: z
    .number()
    .int()
    .min(1990, "Year must be 1990 or later")
    .max(new Date().getFullYear() + 1),
  seatingCapacity: z
    .number()
    .int()
    .min(1, "Seating capacity must be at least 1")
    .max(100),
  acType: z.enum(["full-ac", "ac", "non-ac"]),
  photos: z.array(vehiclePhotoSchema).optional().default([]),
  documents: z
    .array(vehicleDocumentSchema)
    .min(3, "Vehicle documents are required"),
});

// Owner document schema
const ownerDocumentSchema = z.object({
  type: z.enum(["NIC", "PROFILE_PHOTO"]),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().positive("File size must be positive"),
  mimeType: z.string().min(1, "MIME type is required"),
  url: z.string().url("Document URL is required"),
});

// Address schema
const addressSchema = z.object({
  address: z.string().min(1, "Address is required").max(255),
  city: z.string().min(1, "City is required").max(100),
  district: z.string().min(1, "District is required").max(100),
  postalCode: z.string().optional(),
  baseLocation: z.string().min(1, "Base location is required").max(100),
});

// Full owner registration schema
export const ownerRegistrationSchema = z.object({
  body: z.object({
    // Personal information
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters")
      .max(50),
    lastName: z
      .string()
      .trim()
      .min(2, "Last name must be at least 2 characters")
      .max(50),
    email: z.string().trim().email("Invalid email address").max(254),
    phone: z.string().trim().min(1, "Phone number is required").max(20),
    nicNumber: z.string().trim().min(1, "NIC number is required").max(20),

    // Password
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    confirmPassword: z.string().min(1, "Confirm password is required"),

    // Address
    address: addressSchema,

    // Owner documents (NIC, Profile Photo)
    ownerDocuments: z
      .array(ownerDocumentSchema)
      .min(2, "Owner documents are required"),

    // Vehicles (at least one required)
    vehicles: z.array(vehicleSchema).min(1, "At least one vehicle is required"),
  }),
});

// Type exports
export type OwnerRegistrationInput = z.infer<
  typeof ownerRegistrationSchema
>["body"];
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type VehicleDocumentInput = z.infer<typeof vehicleDocumentSchema>;
export type VehiclePhotoInput = z.infer<typeof vehiclePhotoSchema>;
export type OwnerDocumentInput = z.infer<typeof ownerDocumentSchema>;
export type AddressInput = z.infer<typeof addressSchema>;

// Update profile schemas
export const updatePersonalInfoSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    phone: z.string().min(1).max(20).optional(),
    nicNumber: z.string().min(1).max(20).optional(),
  }),
});

export const updateAddressSchema = z.object({
  body: z.object({
    address: z.string().min(1).max(255).optional(),
    city: z.string().min(1).max(100).optional(),
    district: z.string().min(1).max(100).optional(),
    postalCode: z.string().optional(),
    baseLocation: z.string().min(1).max(100).optional(),
  }),
});

export type UpdatePersonalInfoInput = z.infer<
  typeof updatePersonalInfoSchema
>["body"];
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>["body"];
