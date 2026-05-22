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
  vehicleType: z.enum(["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"]),
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
  acType: z.enum(["FULL_AC", "AC", "NON_AC"]),
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

const businessInfoSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  businessType: z.string().trim().min(2).max(80),
  businessRegNumber: z.string().trim().min(2).max(80),
  tinNumber: z.string().trim().min(2).max(80),
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

    // Business info
    businessInfo: businessInfoSchema.optional(),

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
    businessName: z.string().trim().min(2).max(120).optional(),
    businessType: z.string().trim().min(2).max(80).optional(),
    businessRegNumber: z.string().trim().min(2).max(80).optional(),
    tinNumber: z.string().trim().min(2).max(80).optional(),
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

export const addOwnerDocumentSchema = z.object({
  body: z.object({
    type: z.enum(["NIC", "PROFILE_PHOTO"]),
    url: z.string().url("Document URL is required"),
    fileName: z.string().min(1, "File name is required"),
    fileSize: z.number().positive("File size must be positive"),
    mimeType: z.string().min(1, "MIME type is required"),
  }),
});

export type AddOwnerDocumentInput = z.infer<
  typeof addOwnerDocumentSchema
>["body"];

// Earnings transaction history query (status / date filters + pagination)
export const earningsTransactionsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    status: z
      .enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED"])
      .optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
});

export type EarningsTransactionsQuery = z.infer<
  typeof earningsTransactionsQuerySchema
>["query"];

// Owner bank account upsert (used for settlement payouts)
export const upsertBankAccountSchema = z.object({
  body: z.object({
    accountHolderName: z
      .string()
      .trim()
      .min(2, "Account holder name is required")
      .max(120),
    accountNumber: z
      .string()
      .trim()
      .min(5, "Account number is required")
      .max(40)
      .regex(/^[0-9\s-]+$/, "Account number may only contain digits"),
    bankName: z.string().trim().min(2, "Bank name is required").max(120),
    bankCode: z.string().trim().min(1).max(40).optional(),
    branchName: z.string().trim().min(1).max(120).optional(),
    branchCode: z.string().trim().min(1).max(40).optional(),
  }),
});

export type UpsertBankAccountInput = z.infer<
  typeof upsertBankAccountSchema
>["body"];
