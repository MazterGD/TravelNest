import { prisma } from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { deleteByUrl } from "../../utils/storage.js";
import xss from "xss";

/**
 * Vehicle Service
 * Handles all business logic for vehicle management
 */

// Allowed MIME types
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
  fileType: string,
) => {
  if (!allowedTypes.includes(mimeType)) {
    throw ApiError.badRequest(
      `Invalid ${fileType} type: ${mimeType}. Allowed types: ${allowedTypes.join(", ")}`,
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

interface VehicleCreateInput {
  name: string;
  licensePlate: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  seats: number;
  color?: string;
  acType: string;
  condition?: string;
  fuelType?: string;
  transmission?: string;
  description?: string;
  pricePerKm?: number;
  pricePerDay: number;
  driverAllowance?: number;
  location: string;
  amenities?: string[];
  features?: Record<string, boolean>;
}

interface VehicleUpdateInput extends Partial<VehicleCreateInput> {
  isAvailable?: boolean;
  isActive?: boolean;
}

/**
 * Map frontend vehicle type to database enum
 * Now uses direct Prisma enum values: ORDINARY, SEMI_LUXURY, LUXURY_AC
 */
const mapVehicleType = (type: string): string => {
  // Validate and return the type directly (schema ensures valid values)
  const validTypes = ["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"];
  if (validTypes.includes(type)) {
    return type;
  }
  // Fallback mapping for legacy values
  const mapping: Record<string, string> = {
    luxury: "LUXURY_AC",
    "semi-luxury": "SEMI_LUXURY",
    standard: "ORDINARY",
    ordinary: "ORDINARY",
  };
  return mapping[type.toLowerCase()] || "ORDINARY";
};

/**
 * Map AC type to boolean/string
 */
const mapACType = (acType: string): string => {
  const mapping: Record<string, string> = {
    "full-ac": "full-ac",
    ac: "ac",
    "non-ac": "non-ac",
  };
  return mapping[acType] || "ac";
};

/**
 * Get all vehicles with filters
 */
export const getAllVehicles = async (filters: {
  type?: string;
  location?: string;
  district?: string;
  acType?: string;
  amenities?: string[];
  minSeats?: number;
  maxSeats?: number;
  available?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}) => {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(48, Math.max(1, filters.limit || 12));
  const skip = (page - 1) * limit;

  const where: any = {
    isActive: true,
    isAvailable: true,
  };

  if (filters.type) {
    where.type = mapVehicleType(filters.type);
  }

  if (filters.location) {
    where.location = {
      contains: filters.location,
      mode: "insensitive",
    };
  }

  if (filters.district) {
    where.location = {
      contains: filters.district,
      mode: "insensitive",
    };
  }

  if (filters.acType) {
    where.acType = {
      equals: filters.acType.toLowerCase().replace(/_/g, "-"),
      mode: "insensitive",
    };
  }

  if (filters.amenities && filters.amenities.length > 0) {
    where.amenities = {
      hasEvery: filters.amenities,
    };
  }

  if (filters.minSeats || filters.maxSeats) {
    where.seats = {};
    if (filters.minSeats) where.seats.gte = filters.minSeats;
    if (filters.maxSeats) where.seats.lte = filters.maxSeats;
  }

  if (filters.available !== undefined) {
    where.isAvailable = filters.available;
  }

  const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
  const sortBy = filters.sortBy || "newest";

  let orderBy: any = { createdAt: "desc" };
  if (sortBy === "price") {
    orderBy = { pricePerDay: sortOrder };
  }
  if (sortBy === "capacity") {
    orderBy = { seats: sortOrder };
  }
  if (sortBy === "rating") {
    orderBy = { reviews: { _count: sortOrder } };
  }
  if (sortBy === "newest") {
    orderBy = { createdAt: sortOrder };
  }

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip,
      take: limit,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            isVerified: true,
            businessName: true,
          },
        },
        photos: {
          where: { isPrimary: true },
          take: 1,
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
      orderBy,
    }),
    prisma.vehicle.count({ where }),
  ]);

  // Calculate average ratings
  const normalizedVehicles = vehicles.map((vehicle) => ({
    ...vehicle,
    averageRating:
      vehicle.reviews.length > 0
        ? vehicle.reviews.reduce((acc, r) => acc + r.rating, 0) /
          vehicle.reviews.length
        : 0,
    reviewCount: vehicle.reviews.length,
  }));

  return {
    vehicles: normalizedVehicles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

/**
 * Get vehicle by ID with full details
 */
export const getVehicleById = async (id: string) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          isVerified: true,
          businessName: true,
          baseLocation: true,
        },
      },
      photos: {
        orderBy: { sortOrder: "asc" },
      },
      documents: true,
      reviews: {
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  // Calculate average rating
  const averageRating =
    vehicle.reviews.length > 0
      ? vehicle.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) /
        vehicle.reviews.length
      : 0;

  return {
    ...vehicle,
    averageRating,
    reviewCount: vehicle.reviews.length,
  };
};

/**
 * Get all vehicles for current owner
 */
export const getMyVehicles = async (ownerId: string) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId },
    include: {
      photos: {
        where: { isPrimary: true },
        take: 1,
      },
      documents: {
        select: {
          id: true,
          type: true,
          status: true,
        },
      },
      reviews: {
        select: {
          rating: true,
        },
      },
      _count: {
        select: {
          bookings: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return vehicles.map((vehicle) => ({
    ...vehicle,
    averageRating:
      vehicle.reviews.length > 0
        ? vehicle.reviews.reduce((acc, r) => acc + r.rating, 0) /
          vehicle.reviews.length
        : 0,
    reviewCount: vehicle.reviews.length,
    bookingCount: vehicle._count.bookings,
  }));
};

/**
 * Create a new vehicle
 */
export const createVehicle = async (
  ownerId: string,
  data: VehicleCreateInput,
) => {
  // Check if registration number already exists
  const existing = await prisma.vehicle.findUnique({
    where: { licensePlate: data.licensePlate.toUpperCase() },
  });

  if (existing) {
    throw ApiError.conflict(
      `Vehicle with license plate ${data.licensePlate} already exists`,
    );
  }

  // Check if owner is verified
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
  });

  if (!owner || !owner.isVerified) {
    throw ApiError.forbidden(
      "Your account must be verified before adding vehicles",
    );
  }

  // Create vehicle
  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId,
      name: xss(data.name),
      type: mapVehicleType(data.type) as any,
      brand: xss(data.brand),
      model: xss(data.model),
      year: data.year,
      licensePlate: xss(data.licensePlate.toUpperCase()),
      seats: data.seats,
      doors: 2, // Default for buses
      color: data.color ? xss(data.color) : null,
      acType: mapACType(data.acType),
      fuelType: "DIESEL", // Default for buses
      transmission: "MANUAL", // Default for buses
      description: data.description ? xss(data.description) : null,
      pricePerDay: data.pricePerDay,
      pricePerKm: data.pricePerKm || null,
      driverAllowance: data.driverAllowance || null,
      location: xss(data.location),
      amenities: data.amenities || [],
      features: [],
      isAvailable: owner.isVerified, // Auto-available if owner is verified
      isActive: owner.isVerified, // Auto-active if owner is verified
      images: [], // Will be updated via photo upload
    },
    include: {
      photos: true,
      documents: true,
    },
  });

  return vehicle;
};

/**
 * Update vehicle
 */
export const updateVehicle = async (
  id: string,
  ownerId: string,
  data: VehicleUpdateInput,
) => {
  // Check ownership
  const existing = await prisma.vehicle.findUnique({
    where: { id },
  });

  if (!existing) {
    throw ApiError.notFound("Vehicle not found");
  }

  if (existing.ownerId !== ownerId) {
    throw ApiError.forbidden("You can only update your own vehicles");
  }

  // Prepare update data
  const updateData: any = {};

  if (data.name) updateData.name = xss(data.name);
  if (data.brand || data.model) {
    updateData.name = `${data.brand || existing.brand} ${data.model || existing.model}`;
  }
  if (data.type) updateData.type = mapVehicleType(data.type) as any;
  if (data.licensePlate) updateData.licensePlate = xss(data.licensePlate);
  if (data.brand) updateData.brand = xss(data.brand);
  if (data.model) updateData.model = xss(data.model);
  if (data.year) updateData.year = data.year;
  if (data.seats) updateData.seats = data.seats;
  if (data.color) updateData.color = xss(data.color);
  if (data.acType) updateData.acType = mapACType(data.acType);
  if (data.condition) updateData.condition = xss(data.condition);
  if (data.description !== undefined)
    updateData.description = data.description ? xss(data.description) : null;
  if (data.pricePerDay) updateData.pricePerDay = data.pricePerDay;
  if (data.pricePerKm) updateData.pricePerKm = data.pricePerKm;
  if (data.driverAllowance !== undefined)
    updateData.driverAllowance = data.driverAllowance;
  if (data.location) updateData.location = xss(data.location);
  if (data.amenities) updateData.amenities = data.amenities;
  if (data.features) updateData.features = data.features;
  if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: updateData,
    include: {
      photos: true,
      documents: true,
    },
  });

  return vehicle;
};

/**
 * Delete vehicle
 */
export const deleteVehicle = async (id: string, ownerId: string) => {
  // Check ownership
  const existing = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      bookings: {
        where: {
          status: {
            in: ["PENDING", "CONFIRMED", "ONGOING"],
          },
        },
      },
      documents: true,
      photos: true,
    },
  });

  if (!existing) {
    throw ApiError.notFound("Vehicle not found");
  }

  if (existing.ownerId !== ownerId) {
    throw ApiError.forbidden("You can only delete your own vehicles");
  }

  // Check for active bookings
  if (existing.bookings.length > 0) {
    throw ApiError.badRequest(
      "Cannot delete vehicle with active or pending bookings. Please complete or cancel all bookings first.",
    );
  }

  const fileUrls = [
    ...existing.documents.map((doc) => doc.url),
    ...existing.photos.map((photo) => photo.url),
  ];

  await Promise.all(fileUrls.map((url) => deleteByUrl(url)));

  // Hard delete - remove the vehicle and all related data
  await prisma.vehicle.delete({
    where: { id },
  });

  return { message: "Vehicle deleted successfully" };
};

/**
 * Upload vehicle photos
 */
export const uploadVehiclePhotos = async (
  vehicleId: string,
  ownerId: string,
  photos: Array<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    isPrimary?: boolean;
  }>,
) => {
  // Validate MIME types and file sizes
  photos.forEach((photo) => {
    validateMimeType(photo.mimeType, ALLOWED_IMAGE_TYPES, "image");
    validateFileSize(photo.fileSize, photo.fileName);
  });

  // Check ownership
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  if (vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden("You can only upload photos to your own vehicles");
  }

  // Get current photo count
  const existingPhotos = await prisma.vehiclePhoto.findMany({
    where: { vehicleId },
  });

  const nextSortOrder = existingPhotos.length;

  // Check if any new photo is marked as primary
  const hasNewPrimary = photos.some((p) => p.isPrimary);

  // If a new primary photo is being added, unmark all existing primary photos
  if (hasNewPrimary) {
    await prisma.vehiclePhoto.updateMany({
      where: { vehicleId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  // Create photo records within a transaction
  const createdPhotos = await prisma.$transaction(async (tx) => {
    return Promise.all(
      photos.map((photo, index) =>
        tx.vehiclePhoto.create({
          data: {
            vehicleId,
            url: photo.url,
            fileName: photo.fileName,
            fileSize: photo.fileSize,
            mimeType: photo.mimeType,
            isPrimary:
              existingPhotos.length === 0 && index === 0
                ? true
                : photo.isPrimary || false,
            sortOrder: nextSortOrder + index,
          },
        }),
      ),
    );
  });

  // Update vehicle images array with primary photo URL
  const primaryPhoto = createdPhotos.find((p) => p.isPrimary);
  if (primaryPhoto) {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        images: [primaryPhoto.url],
      },
    });
  }

  return createdPhotos;
};

/**
 * Upload vehicle documents
 */
export const uploadVehicleDocuments = async (
  vehicleId: string,
  ownerId: string,
  documents: Array<{
    type: string;
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>,
) => {
  // Validate MIME types and file sizes
  documents.forEach((doc) => {
    validateMimeType(doc.mimeType, ALLOWED_DOCUMENT_TYPES, "document");
    validateFileSize(doc.fileSize, doc.fileName);
  });

  // Check ownership
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  if (vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden(
      "You can only upload documents to your own vehicles",
    );
  }

  const docTypes = documents.map((doc) => doc.type as any);
  const existingDocs = await prisma.vehicleDocument.findMany({
    where: {
      vehicleId,
      type: { in: docTypes },
    },
  });

  await Promise.all(existingDocs.map((doc) => deleteByUrl(doc.url)));
  await prisma.vehicleDocument.deleteMany({
    where: {
      vehicleId,
      type: { in: docTypes },
    },
  });

  // Create document records within a transaction
  const createdDocs = await prisma.$transaction(async (tx) => {
    return Promise.all(
      documents.map((doc) =>
        tx.vehicleDocument.create({
          data: {
            vehicleId,
            type: doc.type as any,
            url: doc.url,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            status: "PENDING",
          },
        }),
      ),
    );
  });

  return createdDocs;
};

/**
 * Toggle vehicle availability
 */
export const toggleVehicleAvailability = async (
  id: string,
  ownerId: string,
  available: boolean,
) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  if (vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden(
      "You can only update availability of your own vehicles",
    );
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: { isAvailable: available },
  });

  return updated;
};

/**
 * Toggle vehicle active status (isActive)
 */
export const toggleVehicleStatus = async (
  id: string,
  ownerId: string,
  isActive: boolean,
  isAdmin = false,
) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  if (!isAdmin && vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden("You can only update status of your own vehicles");
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: { isActive },
  });

  return updated;
};

export const getVehicleAvailability = async (
  vehicleId: string,
  month?: string,
) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true },
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  const monthValue = month && /^\d{4}-\d{2}$/.test(month)
    ? month
    : new Date().toISOString().slice(0, 7);

  const [year, monthNumber] = monthValue.split("-").map(Number);
  const startDate = new Date(year, monthNumber - 1, 1);
  const endDate = new Date(year, monthNumber, 0, 23, 59, 59, 999);

  const [blocked, booked] = await Promise.all([
    prisma.vehicleAvailability.findMany({
      where: {
        vehicleId,
        isBlocked: true,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        vehicleId,
        status: { in: ["PENDING", "CONFIRMED", "ONGOING"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return {
    month: monthValue,
    blocked,
    booked,
  };
};

export const getSimilarVehicles = async (vehicleId: string, limit = 4) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      type: true,
      location: true,
      pricePerDay: true,
    },
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  const candidates = await prisma.vehicle.findMany({
    where: {
      id: { not: vehicleId },
      isActive: true,
      isAvailable: true,
      OR: [{ type: vehicle.type }, { location: vehicle.location }],
    },
    include: {
      owner: {
        select: {
          firstName: true,
          lastName: true,
          isVerified: true,
          businessName: true,
        },
      },
      photos: {
        where: { isPrimary: true },
        take: 1,
      },
      reviews: {
        select: {
          rating: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return candidates.map((candidate) => {
    const reviewCount = candidate.reviews.length;
    const averageRating = reviewCount
      ? candidate.reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviewCount
      : 0;

    return {
      ...candidate,
      averageRating: Number(averageRating.toFixed(1)),
      reviewCount,
    };
  });
};
