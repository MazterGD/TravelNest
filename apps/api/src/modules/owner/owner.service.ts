import bcrypt from "bcryptjs";
import xss from "xss";
import prisma, {
  encryptSettlementBankValue,
  decryptSettlementBankValue,
  maskSettlementBankAccountNumber,
} from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { deleteByUrl } from "../../utils/storage.js";
import { generateTokens, UserRole, UserStatus } from "../auth/auth.service.js";
import type {
  OwnerRegistrationInput,
  VehicleInput,
  AddOwnerDocumentInput,
  EarningsTransactionsQuery,
  UpsertBankAccountInput,
} from "./owner.schemas.js";

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
    ORDINARY: "ORDINARY",
    SEMI_LUXURY: "SEMI_LUXURY",
    LUXURY_AC: "LUXURY_AC",
    luxury: "LUXURY_AC",
    "semi-luxury": "SEMI_LUXURY",
    standard: "ORDINARY",
    mini: "ORDINARY",
  };
  return typeMap[type] || "ORDINARY";
};

const mapAcType = (acType: string) => {
  const acTypeMap: Record<string, string> = {
    FULL_AC: "full-ac",
    AC: "ac",
    NON_AC: "non-ac",
    "full-ac": "full-ac",
    ac: "ac",
    "non-ac": "non-ac",
  };

  return acTypeMap[acType] || "ac";
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
  const sanitizedBusinessInfo = data.businessInfo
    ? {
        businessName: xss(data.businessInfo.businessName.trim(), {
          whiteList: {},
          stripIgnoreTag: true,
        }),
        businessType: xss(data.businessInfo.businessType.trim(), {
          whiteList: {},
          stripIgnoreTag: true,
        }),
        businessRegNumber: xss(data.businessInfo.businessRegNumber.trim(), {
          whiteList: {},
          stripIgnoreTag: true,
        }),
        tinNumber: xss(data.businessInfo.tinNumber.trim(), {
          whiteList: {},
          stripIgnoreTag: true,
        }),
      }
    : null;

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
        businessName: sanitizedBusinessInfo?.businessName || null,
        businessType: sanitizedBusinessInfo?.businessType || null,
        businessRegNumber: sanitizedBusinessInfo?.businessRegNumber || null,
        tinNumber: sanitizedBusinessInfo?.tinNumber || null,
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
          acType: mapAcType(vehicleData.acType),
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

        // Sync vehicle.images with the primary photo URL so all downstream
        // queries that fall back to the images field can find the cover photo.
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { images: [vehicleData.photos[0].url] },
        });
      }
    }

    return user;
  });

  // Generate tokens
  const tokens = await generateTokens(result);

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
    businessName?: string;
    businessType?: string;
    businessRegNumber?: string;
    tinNumber?: string;
  },
) => {
  const sanitizedData: any = {};

  if (data.firstName) sanitizedData.firstName = xss(data.firstName.trim());
  if (data.lastName) sanitizedData.lastName = xss(data.lastName.trim());
  if (data.phone) sanitizedData.phone = xss(data.phone.trim());
  if (data.nicNumber) sanitizedData.nicNumber = xss(data.nicNumber.trim());
  if (data.businessName)
    sanitizedData.businessName = xss(data.businessName.trim());
  if (data.businessType)
    sanitizedData.businessType = xss(data.businessType.trim());
  if (data.businessRegNumber)
    sanitizedData.businessRegNumber = xss(data.businessRegNumber.trim());
  if (data.tinNumber) sanitizedData.tinNumber = xss(data.tinNumber.trim());

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
 * List all owner documents
 */
export const getOwnerDocuments = async (ownerId: string) => {
  return prisma.ownerDocument.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Add (or replace) an owner document of a given type.
 * Only one document of each type is kept — the previous one is deleted first.
 */
export const addOwnerDocument = async (
  ownerId: string,
  data: AddOwnerDocumentInput,
) => {
  validateMimeType(
    data.mimeType,
    data.type === "PROFILE_PHOTO"
      ? ALLOWED_IMAGE_TYPES
      : ALLOWED_DOCUMENT_TYPES,
    data.fileName,
  );
  validateFileSize(data.fileSize, data.fileName);

  return prisma.$transaction(async (tx) => {
    const existingDocuments = await tx.ownerDocument.findMany({
      where: { ownerId, type: data.type as any },
      select: { url: true },
    });

    for (const existingDocument of existingDocuments) {
      await deleteByUrl(existingDocument.url);
    }

    await tx.ownerDocument.deleteMany({
      where: { ownerId, type: data.type as any },
    });

    return tx.ownerDocument.create({
      data: {
        ownerId,
        type: data.type as any,
        url: data.url,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        status: "PENDING",
      },
    });
  });
};

/**
 * Delete an owner document by ID (ownership-verified)
 */
export const deleteOwnerDocument = async (ownerId: string, docId: string) => {
  const doc = await prisma.ownerDocument.findUnique({ where: { id: docId } });

  if (!doc) {
    throw ApiError.notFound("Document not found");
  }

  if (doc.ownerId !== ownerId) {
    throw ApiError.forbidden("You do not own this document");
  }

  await deleteByUrl(doc.url);
  await prisma.ownerDocument.delete({ where: { id: docId } });
};

/**
 * Get revenue chart data for the last 6 months
 */
export const getRevenueChart = async (ownerId: string) => {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    };
  });

  const results = await Promise.all(
    months.map(({ start, end }) =>
      prisma.booking.aggregate({
        where: {
          vehicle: { ownerId },
          status: "COMPLETED",
          updatedAt: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
      }),
    ),
  );

  return months.map(({ label }, i) => ({
    month: label,
    revenue: results[i]._sum.totalAmount ?? 0,
  }));
};

/**
 * Get the 5 most recent reviews across all owner vehicles
 */
export const getRecentReviews = async (ownerId: string) => {
  const reviews = await prisma.review.findMany({
    where: { vehicle: { ownerId } },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      vehicle: { select: { name: true, licensePlate: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    vehicleName: r.vehicle.name || r.vehicle.licensePlate,
    customerName:
      `${r.customer.firstName} ${r.customer.lastName}`.trim() || "Customer",
    ownerResponse: r.ownerResponse,
  }));
};

/**
 * Get dashboard statistics for owner
 */
export const getDashboardStats = async (ownerId: string) => {
  const [
    totalVehicles,
    activeVehicles,
    inactiveVehicles,
    pendingReviewVehicles,
    totalBookings,
    pendingBookings,
    activeBookings,
    pendingQuotes,
    completedRevenue,
    reviewStats,
  ] = await Promise.all([
    prisma.vehicle.count({
      where: { ownerId },
    }),
    prisma.vehicle.count({
      where: { ownerId, isActive: true, isAvailable: true },
    }),
    prisma.vehicle.count({
      where: { ownerId, isActive: true, isAvailable: false },
    }),
    prisma.vehicle.count({
      where: { ownerId, isActive: false },
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
    prisma.booking.count({
      where: {
        vehicle: { ownerId },
        status: { in: ["CONFIRMED", "ONGOING"] },
      },
    }),
    prisma.quotation.count({
      where: {
        status: "PENDING",
        OR: [{ vehicle: { ownerId } }, { vehicleId: null }],
      },
    }),
    prisma.booking.aggregate({
      where: {
        vehicle: { ownerId },
        status: "COMPLETED",
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.review.aggregate({
      where: {
        vehicle: { ownerId },
      },
      _avg: {
        rating: true,
      },
    }),
  ]);

  const utilization =
    totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

  return {
    // Legacy fields retained for backward compatibility and existing tests.
    totalVehicles,
    activeVehicles,
    totalBookings,
    pendingBookings,

    // New dashboard metrics consumed by the owner web module.
    totalRevenue: completedRevenue._sum.totalAmount ?? 0,
    activeBookings,
    pendingQuotes,
    averageRating: Number((reviewStats._avg.rating ?? 0).toFixed(1)),
    fleetStats: {
      active: activeVehicles,
      inactive: inactiveVehicles,
      pendingReview: pendingReviewVehicles,
      utilization,
    },
  };
};

export interface OwnerReviewQuery {
  page?: number;
  limit?: number;
  rating?: number;
  hasResponse?: string;
}

export const getOwnerReviews = async (
  ownerId: string,
  query: OwnerReviewQuery,
) => {
  const { page = 1, limit = 10, rating, hasResponse } = query;
  const skip = (page - 1) * limit;

  const where: {
    vehicle: { ownerId: string };
    rating?: number;
    ownerResponse?: { not: null } | null;
  } = { vehicle: { ownerId } };

  if (rating) where.rating = rating;
  if (hasResponse === "true") where.ownerResponse = { not: null };
  if (hasResponse === "false") where.ownerResponse = null;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { firstName: true, lastName: true, avatar: true } },
        vehicle: { select: { id: true, name: true, licensePlate: true } },
        booking: { select: { startDate: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return {
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      dimensions: {
        vehicleCondition: r.ratingVehicleCondition,
        driverBehavior: r.ratingDriverBehavior,
        punctuality: r.ratingPunctuality,
        cleanliness: r.ratingCleanliness,
        valueForMoney: r.ratingValueForMoney,
      },
      title: r.title,
      comment: r.comment,
      isRecommended: r.isRecommended,
      ownerResponse: r.ownerResponse,
      createdAt: r.createdAt.toISOString(),
      tripDate: r.booking.startDate.toISOString(),
      customerName: `${r.customer.firstName} ${r.customer.lastName.charAt(0)}.`,
      customerAvatar: r.customer.avatar,
      vehicleId: r.vehicle.id,
      vehicleName: r.vehicle.name || r.vehicle.licensePlate,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getOwnerReviewSummary = async (ownerId: string) => {
  const [aggregate, dimAggregate, ratingGroups, pendingCount] =
    await Promise.all([
      prisma.review.aggregate({
        where: { vehicle: { ownerId } },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.review.aggregate({
        where: { vehicle: { ownerId } },
        _avg: {
          ratingVehicleCondition: true,
          ratingDriverBehavior: true,
          ratingPunctuality: true,
          ratingCleanliness: true,
          ratingValueForMoney: true,
        },
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: { vehicle: { ownerId } },
        _count: { id: true },
      }),
      prisma.review.count({
        where: { vehicle: { ownerId }, ownerResponse: null },
      }),
    ]);

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingGroups.forEach((g) => {
    distribution[g.rating] = g._count.id;
  });

  const totalReviews = aggregate._count.id;
  const responded = totalReviews - pendingCount;

  const round1 = (v: number | null) =>
    v !== null ? parseFloat(v.toFixed(1)) : null;

  return {
    averageRating: parseFloat((aggregate._avg.rating ?? 0).toFixed(1)),
    totalReviews,
    pendingResponses: pendingCount,
    responseRate:
      totalReviews > 0 ? Math.round((responded / totalReviews) * 100) : 0,
    ratingDistribution: distribution,
    dimensionAverages: {
      vehicleCondition: round1(dimAggregate._avg.ratingVehicleCondition),
      driverBehavior: round1(dimAggregate._avg.ratingDriverBehavior),
      punctuality: round1(dimAggregate._avg.ratingPunctuality),
      cleanliness: round1(dimAggregate._avg.ratingCleanliness),
      valueForMoney: round1(dimAggregate._avg.ratingValueForMoney),
    },
  };
};

export const getAnalyticsOverview = async (ownerId: string) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
  );

  const [
    totalRevenueAgg,
    thisMonthRevenueAgg,
    lastMonthRevenueAgg,
    totalBookings,
    completedBookings,
    totalVehicles,
    activeVehicles,
    avgRatingAgg,
  ] = await Promise.all([
    prisma.booking.aggregate({
      where: { vehicle: { ownerId }, status: "COMPLETED" },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: {
        vehicle: { ownerId },
        status: "COMPLETED",
        updatedAt: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: {
        vehicle: { ownerId },
        status: "COMPLETED",
        updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { totalAmount: true },
    }),
    prisma.booking.count({ where: { vehicle: { ownerId } } }),
    prisma.booking.count({
      where: { vehicle: { ownerId }, status: "COMPLETED" },
    }),
    prisma.vehicle.count({ where: { ownerId } }),
    prisma.vehicle.count({ where: { ownerId, isActive: true } }),
    prisma.review.aggregate({
      where: { vehicle: { ownerId } },
      _avg: { rating: true },
    }),
  ]);

  const lastMonth = lastMonthRevenueAgg._sum.totalAmount ?? 0;
  const thisMonth = thisMonthRevenueAgg._sum.totalAmount ?? 0;
  const revenueGrowth =
    lastMonth > 0
      ? parseFloat((((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1))
      : 0;

  return {
    totalRevenue: totalRevenueAgg._sum.totalAmount ?? 0,
    thisMonthRevenue: thisMonth,
    revenueGrowth,
    totalBookings,
    completedBookings,
    completionRate:
      totalBookings > 0
        ? Math.round((completedBookings / totalBookings) * 100)
        : 0,
    totalVehicles,
    activeVehicles,
    fleetUtilization:
      totalVehicles > 0
        ? Math.round((activeVehicles / totalVehicles) * 100)
        : 0,
    averageRating: parseFloat((avgRatingAgg._avg.rating ?? 0).toFixed(1)),
  };
};

export const getAnalyticsRevenue = async (ownerId: string) => {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    };
  });

  const [revenueResults, bookingResults] = await Promise.all([
    Promise.all(
      months.map(({ start, end }) =>
        prisma.booking.aggregate({
          where: {
            vehicle: { ownerId },
            status: "COMPLETED",
            updatedAt: { gte: start, lte: end },
          },
          _sum: { totalAmount: true },
        }),
      ),
    ),
    Promise.all(
      months.map(({ start, end }) =>
        prisma.booking.count({
          where: { vehicle: { ownerId }, createdAt: { gte: start, lte: end } },
        }),
      ),
    ),
  ]);

  return months.map(({ label }, i) => ({
    month: label,
    revenue: revenueResults[i]._sum.totalAmount ?? 0,
    bookings: bookingResults[i],
  }));
};

export const getAnalyticsVehicles = async (ownerId: string) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId },
    select: {
      id: true,
      name: true,
      licensePlate: true,
      isActive: true,
      bookings: {
        select: { id: true, totalAmount: true, status: true },
      },
      reviews: {
        select: { rating: true },
      },
    },
  });

  return vehicles
    .map((v) => {
      const completedBookings = v.bookings.filter(
        (b) => b.status === "COMPLETED",
      );
      const revenue = completedBookings.reduce(
        (sum, b) => sum + (b.totalAmount ?? 0),
        0,
      );
      const avgRating =
        v.reviews.length > 0
          ? parseFloat(
              (
                v.reviews.reduce((sum, r) => sum + r.rating, 0) /
                v.reviews.length
              ).toFixed(1),
            )
          : 0;
      return {
        id: v.id,
        name: v.name || v.licensePlate,
        isActive: v.isActive,
        totalBookings: v.bookings.length,
        completedBookings: completedBookings.length,
        revenue,
        averageRating: avgRating,
        reviewCount: v.reviews.length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
};

/**
 * Booking history for a single vehicle — guards ownership before returning rows.
 * Returns the 100 most recent bookings, newest first.
 */
export const getAnalyticsVehicleBookings = async (
  ownerId: string,
  vehicleId: string,
) => {
  const bookings = await prisma.booking.findMany({
    where: { vehicleId, vehicle: { ownerId } },
    select: {
      id: true,
      startDate: true,
      totalAmount: true,
      status: true,
    },
    orderBy: { startDate: "desc" },
    take: 100,
  });

  return bookings.map((b) => ({
    id: b.id,
    date: b.startDate.toISOString(),
    amount: b.totalAmount,
    status: b.status,
  }));
};

/**
 * Earnings summary — lifetime / this-month / this-year completed-booking earnings
 * plus the balance still pending settlement payout.
 */
export const getEarningsSummary = async (ownerId: string) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [lifetimeAgg, monthAgg, yearAgg, pendingAgg] = await Promise.all([
    prisma.booking.aggregate({
      where: { vehicle: { ownerId }, status: "COMPLETED" },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: {
        vehicle: { ownerId },
        status: "COMPLETED",
        updatedAt: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: {
        vehicle: { ownerId },
        status: "COMPLETED",
        updatedAt: { gte: startOfYear },
      },
      _sum: { totalAmount: true },
    }),
    prisma.settlement.aggregate({
      where: { ownerId, status: { in: ["PENDING", "PROCESSING"] } },
      _sum: { netAmount: true },
    }),
  ]);

  return {
    lifetimeEarnings: lifetimeAgg._sum.totalAmount ?? 0,
    thisMonthEarnings: monthAgg._sum.totalAmount ?? 0,
    thisYearEarnings: yearAgg._sum.totalAmount ?? 0,
    pendingBalance: pendingAgg._sum.netAmount ?? 0,
  };
};

/**
 * Paginated payment history scoped to the owner's vehicles, with optional
 * payment-status and created-date range filters.
 */
export const getTransactions = async (
  ownerId: string,
  query: EarningsTransactionsQuery,
) => {
  const { page = 1, limit = 10, status, from, to } = query;
  const skip = (page - 1) * limit;

  const where: {
    booking: { vehicle: { ownerId: string } };
    status?: EarningsTransactionsQuery["status"];
    createdAt?: { gte?: Date; lte?: Date };
  } = { booking: { vehicle: { ownerId } } };

  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          select: {
            id: true,
            pickupLocation: true,
            dropoffLocation: true,
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    transactions: payments.map((p) => ({
      id: p.id,
      date: p.createdAt.toISOString(),
      bookingId: p.bookingId,
      bookingRef: `BK-${p.bookingId.slice(0, 8).toUpperCase()}`,
      route:
        p.booking.pickupLocation && p.booking.dropoffLocation
          ? `${p.booking.pickupLocation} → ${p.booking.dropoffLocation}`
          : p.booking.pickupLocation || "—",
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: p.status,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

/**
 * Settlement payout history for the owner. Bank fields are intentionally
 * omitted — the list view only needs period / amounts / status.
 */
export const getSettlements = async (ownerId: string) => {
  const settlements = await prisma.settlement.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });

  return settlements.map((s) => ({
    id: s.id,
    settlementCode: s.settlementCode,
    period: s.period,
    totalBookings: s.totalBookings,
    grossAmount: s.grossAmount,
    commissionAmount: s.commissionAmount,
    netAmount: s.netAmount,
    status: s.status,
    processedAt: s.processedAt ? s.processedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  }));
};

/**
 * Shape an OwnerBankAccount row for the client — the stored account number is
 * encrypted at rest, so it is decrypted then re-masked to the last 4 digits.
 */
const serializeBankAccount = (account: {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string | null;
  branchName: string | null;
  branchCode: string | null;
  isPrimary: boolean;
  updatedAt: Date;
}) => {
  let accountNumberMasked: string | null = null;
  try {
    accountNumberMasked = maskSettlementBankAccountNumber(
      decryptSettlementBankValue(account.accountNumber),
    );
  } catch {
    // Decryption failure (malformed ciphertext or key rotation) — return null mask
    // rather than crash the entire earnings page.
    accountNumberMasked = null;
  }

  return {
    id: account.id,
    accountHolderName: account.accountHolderName,
    accountNumberMasked,
    bankName: account.bankName,
    bankCode: account.bankCode,
    branchName: account.branchName,
    branchCode: account.branchCode,
    isPrimary: account.isPrimary,
    updatedAt: account.updatedAt.toISOString(),
  };
};

/**
 * Get the owner's saved bank account — account number masked to last 4 digits.
 */
export const getBankAccount = async (ownerId: string) => {
  const account = await prisma.ownerBankAccount.findFirst({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });

  return account ? serializeBankAccount(account) : null;
};

/**
 * Create or replace the owner's bank account. The account number is encrypted
 * at rest via settlementBankEncryption.ts; one primary account per owner is
 * enforced by atomically replacing any existing record.
 */
export const upsertBankAccount = async (
  ownerId: string,
  data: UpsertBankAccountInput,
) => {
  const sanitize = (value: string) =>
    xss(value.trim(), { whiteList: {}, stripIgnoreTag: true });

  const encryptedAccountNumber = encryptSettlementBankValue(
    data.accountNumber.replace(/[\s-]/g, ""),
  );

  if (!encryptedAccountNumber) {
    throw ApiError.badRequest("A valid account number is required");
  }

  const account = await prisma.$transaction(async (tx) => {
    await tx.ownerBankAccount.deleteMany({ where: { ownerId } });

    return tx.ownerBankAccount.create({
      data: {
        ownerId,
        accountHolderName: sanitize(data.accountHolderName),
        accountNumber: encryptedAccountNumber,
        bankName: sanitize(data.bankName),
        bankCode: data.bankCode ? sanitize(data.bankCode) : null,
        branchName: data.branchName ? sanitize(data.branchName) : null,
        branchCode: data.branchCode ? sanitize(data.branchCode) : null,
        isPrimary: true,
      },
    });
  });

  return serializeBankAccount(account);
};
