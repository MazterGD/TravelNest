import { prisma } from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";

export interface TripPackageFilters {
  startLocation?: string;
  endLocation?: string;
  minPassengers?: number;
  maxPassengers?: number;
  durationDays?: number;
  minPrice?: number;
  maxPrice?: number;
  vehicleType?: string;
  ownerId?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

interface TripPackageInput {
  vehicleId: string;
  title: string;
  description?: string;
  startLocation: string;
  endLocation: string;
  durationDays: number;
  price: number;
  minPassengers: number;
  maxPassengers: number;
  isActive?: boolean;
}

interface PackageBookingInput {
  startDate: string;
  passengerCount: number;
  notes?: string;
}

const prismaClient = prisma as any;

const buildSearchFilter = (search?: string) => {
  if (!search) return undefined;
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { startLocation: { contains: search, mode: "insensitive" } },
      { endLocation: { contains: search, mode: "insensitive" } },
    ],
  };
};

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export const getAllTripPackages = async (filters: TripPackageFilters) => {
  const {
    startLocation,
    endLocation,
    minPassengers,
    maxPassengers,
    durationDays,
    minPrice,
    maxPrice,
    vehicleType,
    ownerId,
    search,
    isActive,
    page = 1,
    limit = 12,
  } = filters;

  const skip = (page - 1) * limit;

  const where: any = {};

  if (startLocation) {
    where.startLocation = { contains: startLocation, mode: "insensitive" };
  }

  if (endLocation) {
    where.endLocation = { contains: endLocation, mode: "insensitive" };
  }

  if (durationDays) {
    where.durationDays = durationDays;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (minPassengers || maxPassengers) {
    where.AND = [];
    if (minPassengers) {
      where.AND.push({ maxPassengers: { gte: minPassengers } });
    }
    if (maxPassengers) {
      where.AND.push({ minPassengers: { lte: maxPassengers } });
    }
  }

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = minPrice;
    if (maxPrice) where.price.lte = maxPrice;
  }

  if (ownerId) {
    where.ownerId = ownerId;
  }

  const searchFilter = buildSearchFilter(search);
  if (searchFilter) {
    where.AND = [...(where.AND || []), searchFilter];
  }

  if (vehicleType) {
    where.vehicle = { type: vehicleType };
  }

  const [packages, total] = await Promise.all([
    prismaClient.tripPackage.findMany({
      where,
      skip,
      take: limit,
      include: {
        vehicle: {
          select: {
            id: true,
            name: true,
            type: true,
            seats: true,
            images: true,
            pricePerDay: true,
            location: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prismaClient.tripPackage.count({ where }),
  ]);

  return {
    packages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getTripPackageById = async (id: string) => {
  const tripPackage = await prismaClient.tripPackage.findUnique({
    where: { id },
    include: {
      vehicle: {
        select: {
          id: true,
          name: true,
          type: true,
          seats: true,
          images: true,
          pricePerDay: true,
          location: true,
        },
      },
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          isVerified: true,
        },
      },
    },
  });

  if (!tripPackage) {
    throw ApiError.notFound("Trip package not found");
  }

  return tripPackage;
};

export const getOwnerTripPackages = async (ownerId: string) => {
  const packages = await prismaClient.tripPackage.findMany({
    where: { ownerId },
    include: {
      vehicle: {
        select: {
          id: true,
          name: true,
          type: true,
          seats: true,
          images: true,
          pricePerDay: true,
          location: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return packages;
};

export const createTripPackage = async (
  ownerId: string,
  input: TripPackageInput,
) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: input.vehicleId },
    select: { ownerId: true, seats: true, isActive: true },
  });

  if (!vehicle || vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden("Vehicle not found or unauthorized");
  }

  if (input.maxPassengers > vehicle.seats) {
    throw ApiError.badRequest("Max passengers exceeds vehicle capacity");
  }

  return prismaClient.tripPackage.create({
    data: {
      ownerId,
      vehicleId: input.vehicleId,
      title: input.title,
      description: input.description,
      startLocation: input.startLocation,
      endLocation: input.endLocation,
      durationDays: input.durationDays,
      price: input.price,
      minPassengers: input.minPassengers,
      maxPassengers: input.maxPassengers,
      isActive: input.isActive ?? vehicle.isActive,
    },
  });
};

export const updateTripPackage = async (
  id: string,
  ownerId: string,
  input: Partial<TripPackageInput>,
) => {
  const existing = await prismaClient.tripPackage.findUnique({
    where: { id },
    include: { vehicle: { select: { ownerId: true, seats: true } } },
  });

  if (!existing) {
    throw ApiError.notFound("Trip package not found");
  }

  if (existing.ownerId !== ownerId) {
    throw ApiError.forbidden("Not authorized to update this package");
  }

  const maxPassengers = input.maxPassengers ?? existing.maxPassengers;
  const minPassengers = input.minPassengers ?? existing.minPassengers;

  if (maxPassengers < minPassengers) {
    throw ApiError.badRequest("Max passengers must be >= min passengers");
  }

  if (maxPassengers > existing.vehicle.seats) {
    throw ApiError.badRequest("Max passengers exceeds vehicle capacity");
  }

  if (input.vehicleId && input.vehicleId !== existing.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      select: { ownerId: true, seats: true, isActive: true },
    });

    if (!vehicle || vehicle.ownerId !== ownerId) {
      throw ApiError.forbidden("Vehicle not found or unauthorized");
    }

    if (maxPassengers > vehicle.seats) {
      throw ApiError.badRequest("Max passengers exceeds vehicle capacity");
    }
  }

  return prismaClient.tripPackage.update({
    where: { id },
    data: {
      vehicleId: input.vehicleId,
      title: input.title,
      description: input.description,
      startLocation: input.startLocation,
      endLocation: input.endLocation,
      durationDays: input.durationDays,
      price: input.price,
      minPassengers: input.minPassengers,
      maxPassengers: input.maxPassengers,
      isActive: input.isActive,
    },
  });
};

export const deleteTripPackage = async (id: string, ownerId: string) => {
  const existing = await prismaClient.tripPackage.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!existing) {
    throw ApiError.notFound("Trip package not found");
  }

  if (existing.ownerId !== ownerId) {
    throw ApiError.forbidden("Not authorized to delete this package");
  }

  await prismaClient.tripPackage.delete({ where: { id } });
};

export const bookTripPackage = async (
  packageId: string,
  customerId: string,
  input: PackageBookingInput,
) => {
  const tripPackage = await prismaClient.tripPackage.findUnique({
    where: { id: packageId },
    include: {
      vehicle: {
        select: { id: true, isAvailable: true, isActive: true },
      },
    },
  });

  if (!tripPackage) {
    throw ApiError.notFound("Trip package not found");
  }

  if (!tripPackage.isActive || !tripPackage.vehicle.isActive) {
    throw ApiError.badRequest("This package is not currently available");
  }

  if (!tripPackage.vehicle.isAvailable) {
    throw ApiError.badRequest("Selected vehicle is not available");
  }

  if (
    input.passengerCount < tripPackage.minPassengers ||
    input.passengerCount > tripPackage.maxPassengers
  ) {
    throw ApiError.badRequest(
      "Passenger count does not match package requirements",
    );
  }

  const startDate = new Date(input.startDate);
  if (Number.isNaN(startDate.getTime())) {
    throw ApiError.badRequest("Invalid start date");
  }

  if (startDate < new Date()) {
    throw ApiError.badRequest("Start date must be in the future");
  }

  const endDate = addDays(startDate, Math.max(tripPackage.durationDays - 1, 0));

  const booking = await prisma.booking.create({
    data: {
      customerId,
      vehicleId: tripPackage.vehicleId,
      tripPackageId: tripPackage.id,
      startDate,
      endDate,
      pickupLocation: tripPackage.startLocation,
      dropoffLocation: tripPackage.endLocation,
      totalPassengers: input.passengerCount,
      totalAmount: tripPackage.price,
      status: "PENDING",
      notes: input.notes,
    } as any,
  });

  return booking;
};
