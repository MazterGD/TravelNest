import bcrypt from "bcryptjs";
import xss from "xss";
import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { generateTokens, UserRole, UserStatus } from "../auth/auth.service.js";
import type { OwnerRegistrationInput, VehicleInput } from "./owner.schemas.js";

// Allowed MIME types for validation
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validate file MIME type
 */
const validateMimeType = (
  mimeType: string,
  allowedTypes: string[],
  fileName: string,
) => {
  if (!allowedTypes.includes(mimeType)) {
    throw ApiError.badRequest(
      `Invalid file type for ${fileName}: ${mimeType}. Allowed types: ${allowedTypes.join(", ")}`,
    );
  }
};

/**
 * Validate file size
 */
const validateFileSize = (fileSize: number, fileName: string) => {
  if (fileSize > MAX_FILE_SIZE) {
    throw ApiError.badRequest(`File ${fileName} exceeds maximum size of 5MB`);
  }
  if (fileSize <= 0) {
    throw ApiError.badRequest(`Invalid file size for ${fileName}`);
  }
};

// Map vehicle type to database enum
// Valid VehicleType enum values: ORDINARY, SEMI_LUXURY, LUXURY_AC
const mapVehicleType = (type: string) => {
  const typeMap: Record<string, string> = {
    luxury: "LUXURY_AC",
    "semi-luxury": "SEMI_LUXURY",
    standard: "ORDINARY",
    mini: "ORDINARY",
  };
  return typeMap[type] || "ORDINARY";
};

// Map document type string to database enum
const mapDocumentType = (type: string) => {
  const typeMap: Record<string, string> = {
    NIC: "NIC",
    PROFILE_PHOTO: "PROFILE_PHOTO",
    DRIVING_LICENSE: "DRIVING_LICENSE",
    INSURANCE: "INSURANCE",
    REGISTRATION_CERTIFICATE: "REGISTRATION_CERTIFICATE",
  };
  return typeMap[type] || type;
};

const requireDocumentTypes = (types: string[], required: string[]) => {
  const missing = required.filter((type) => !types.includes(type));
  if (missing.length > 0) {
    throw ApiError.badRequest(
      `Missing required documents: ${missing.join(", ")}`,
    );
  }
};

/**
 * Register a new bus owner with vehicles
 */
export const registerOwner = async (data: OwnerRegistrationInput) => {
  // Validate password confirmation
  if (data.password !== data.confirmPassword) {
    throw ApiError.badRequest("Passwords do not match");
  }

  // Validate owner documents
  for (const doc of data.ownerDocuments) {
    validateMimeType(
      doc.mimeType,
      doc.type === "PROFILE_PHOTO"
        ? ALLOWED_IMAGE_TYPES
        : ALLOWED_DOCUMENT_TYPES,
      doc.fileName,
    );
    validateFileSize(doc.fileSize, doc.fileName);
    if (!doc.url) {
      throw ApiError.badRequest("Owner document URL is required");
    }
  }

  requireDocumentTypes(
    data.ownerDocuments.map((doc) => doc.type),
    ["NIC", "PROFILE_PHOTO"],
  );

  // Validate vehicle photos and documents
  for (const vehicle of data.vehicles) {
    if (vehicle.photos && vehicle.photos.length > 0) {
      for (const photo of vehicle.photos) {
        validateMimeType(photo.mimeType, ALLOWED_IMAGE_TYPES, photo.fileName);
        validateFileSize(photo.fileSize, photo.fileName);
      }
    }
    for (const doc of vehicle.documents) {
      validateMimeType(doc.mimeType, ALLOWED_DOCUMENT_TYPES, doc.fileName);
      validateFileSize(doc.fileSize, doc.fileName);
      if (!doc.url) {
        throw ApiError.badRequest("Vehicle document URL is required");
      }
    }

    requireDocumentTypes(
      vehicle.documents.map((doc) => doc.type),
      ["DRIVING_LICENSE", "INSURANCE", "REGISTRATION_CERTIFICATE"],
    );
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    throw ApiError.conflict("Email already registered");
  }

  // Check if any vehicle registration number already exists
  for (const vehicle of data.vehicles) {
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { licensePlate: vehicle.registrationNumber },
    });
    if (existingVehicle) {
      throw ApiError.conflict(
        `Vehicle with registration number ${vehicle.registrationNumber} already exists`,
      );
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 12);

  // Sanitize inputs - use stripIgnoreTag to fully remove script/img tags
  const sanitizedFirstName = xss(data.firstName.trim(), {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
  });
  const sanitizedLastName = xss(data.lastName.trim(), {
    whiteList: {},
    stripIgnoreTag: true,
  });
  const sanitizedNicNumber = xss(data.nicNumber.trim(), {
    whiteList: {},
    stripIgnoreTag: true,
  });

  // Create owner with all related data in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        phone: data.phone || null,
        nicNumber: sanitizedNicNumber,
        role: UserRole.VEHICLE_OWNER,
        status: UserStatus.PENDING_VERIFICATION,
        isVerified: false,
      },
    });

    // Create owner documents (if provided - optional for registration)
    for (const doc of data.ownerDocuments) {
      await tx.ownerDocument.create({
        data: {
          ownerId: user.id,
          type: mapDocumentType(doc.type) as any,
          url: doc.url,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          status: "PENDING",
        },
      });
    }

    // Create vehicles with documents and photos
    for (const vehicleData of data.vehicles) {
      const vehicle = await tx.vehicle.create({
        data: {
          ownerId: user.id,
          name: `${vehicleData.make} ${vehicleData.model}`,
          type: mapVehicleType(vehicleData.vehicleType) as any,
          brand: xss(vehicleData.make.trim()),
          model: xss(vehicleData.model.trim()),
          year: vehicleData.year,
          licensePlate: xss(vehicleData.registrationNumber.trim()),
          seats: vehicleData.seatingCapacity,
          acType: vehicleData.acType,
          fuelType: "DIESEL", // Default for buses
          transmission: "MANUAL", // Default for buses
          location: data.address.baseLocation,
          pricePerDay: 0, // To be set later by owner
          isAvailable: false, // Not available until verified
          isActive: false, // Not active until verified
          images: [], // Will be populated from photos
        },
      });

      // Create vehicle documents (if provided - optional for registration)
      for (const doc of vehicleData.documents) {
        await tx.vehicleDocument.create({
          data: {
            vehicleId: vehicle.id,
            type: mapDocumentType(doc.type) as any,
            url: doc.url,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            status: "PENDING",
          },
        });
      }

      // Create vehicle photos (if provided - optional for registration)
      if (vehicleData.photos && vehicleData.photos.length > 0) {
        for (let i = 0; i < vehicleData.photos.length; i++) {
          const photo = vehicleData.photos[i];
          if (!photo.url) {
            throw ApiError.badRequest("Vehicle photo URL is required");
          }
          await tx.vehiclePhoto.create({
            data: {
              vehicleId: vehicle.id,
              url: photo.url,
              fileName: photo.fileName,
              fileSize: photo.fileSize,
              mimeType: photo.mimeType,
              isPrimary: i === 0 || photo.isPrimary,
              sortOrder: i,
            },
          });
        }
      }
    }

    return user;
  });

  // Generate tokens
  const tokens = generateTokens(result);

  // Return user without password
  const { password: _, ...userWithoutPassword } = result;

  return {
    user: userWithoutPassword,
    ...tokens,
  };
};

/**
 * Get owner profile with vehicles and documents
 */
export const getOwnerProfile = async (ownerId: string) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    include: {
      documents: true,
      vehicles: {
        include: {
          documents: true,
          photos: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!owner) {
    throw ApiError.notFound("Owner not found");
  }

  // Remove password from response
  const { password: _, ...ownerWithoutPassword } = owner;

  return ownerWithoutPassword;
};

/**
 * Update owner verification status (admin only)
 */
export const updateOwnerVerification = async (
  ownerId: string,
  isVerified: boolean,
  adminId: string,
) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
  });

  if (!owner) {
    throw ApiError.notFound("Owner not found");
  }

  if (owner.role !== UserRole.VEHICLE_OWNER) {
    throw ApiError.badRequest("User is not a vehicle owner");
  }

  // Update user verification status
  const updatedOwner = await prisma.user.update({
    where: { id: ownerId },
    data: {
      isVerified,
      status: isVerified ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
      verifiedAt: isVerified ? new Date() : null,
      verifiedBy: isVerified ? adminId : null,
      rejectedAt: !isVerified ? new Date() : null,
    },
  });

  // If verified, activate all vehicles
  if (isVerified) {
    await prisma.vehicle.updateMany({
      where: { ownerId },
      data: {
        isActive: true,
        isAvailable: true,
      },
    });

    // Update all documents as verified
    await prisma.ownerDocument.updateMany({
      where: { ownerId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedBy: adminId,
      },
    });

    await prisma.vehicleDocument.updateMany({
      where: {
        vehicle: { ownerId },
      },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedBy: adminId,
      },
    });
  }

  const { password: _, ...ownerWithoutPassword } = updatedOwner;
  return ownerWithoutPassword;
};

/**
 * Update owner personal information
 */
export const updatePersonalInfo = async (
  ownerId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    nicNumber?: string;
  },
) => {
  const sanitizedData: any = {};

  if (data.firstName) sanitizedData.firstName = xss(data.firstName.trim());
  if (data.lastName) sanitizedData.lastName = xss(data.lastName.trim());
  if (data.phone) sanitizedData.phone = xss(data.phone.trim());
  if (data.nicNumber) sanitizedData.nicNumber = xss(data.nicNumber.trim());

  const updatedUser = await prisma.user.update({
    where: { id: ownerId },
    data: sanitizedData,
  });

  const { password, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

/**
 * Update owner address information
 */
export const updateAddress = async (
  ownerId: string,
  data: {
    address?: string;
    city?: string;
    district?: string;
    postalCode?: string;
    baseLocation?: string;
  },
) => {
  const sanitizedData: any = {};

  if (data.address) sanitizedData.address = xss(data.address.trim());
  if (data.city) sanitizedData.city = xss(data.city.trim());
  if (data.district) sanitizedData.district = xss(data.district.trim());
  if (data.postalCode) sanitizedData.postalCode = xss(data.postalCode.trim());
  if (data.baseLocation)
    sanitizedData.baseLocation = xss(data.baseLocation.trim());

  const updatedUser = await prisma.user.update({
    where: { id: ownerId },
    data: sanitizedData,
  });

  const { password, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

/**
 * Get dashboard statistics for owner
 */
export const getDashboardStats = async (ownerId: string) => {
  const [totalVehicles, activeVehicles, totalBookings, pendingBookings] =
    await Promise.all([
      prisma.vehicle.count({
        where: { ownerId },
      }),
      prisma.vehicle.count({
        where: { ownerId, isActive: true },
      }),
      prisma.booking.count({
        where: {
          vehicle: { ownerId },
        },
      }),
      prisma.booking.count({
        where: {
          vehicle: { ownerId },
          status: "PENDING",
        },
      }),
    ]);

  return {
    totalVehicles,
    activeVehicles,
    totalBookings,
    pendingBookings,
  };
};
