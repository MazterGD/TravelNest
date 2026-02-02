import { prisma } from "@travenest/database";
import type { QuotationStatus, VehicleType } from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";

export interface QuotationQuery {
  status?: QuotationStatus;
  page?: number;
  limit?: number;
}

export interface CreateQuotationRequestData {
  vehicleType?: VehicleType;
  startDate: string | Date;
  endDate: string | Date;
  startTime?: string;
  pickupLocation: string;
  dropoffLocation?: string;
  passengerCount?: number;
  estimatedDistance?: string;
  estimatedDuration?: string;
  specialRequests?: string;
}

export interface SendQuotationData {
  vehicleId: string;
  startTime: string;
  estimatedDistance: string;
  estimatedDuration: string;
  vehicleRentalCost: number;
  driverCost: number;
  fuelCost: number;
  tollCharges: number;
  permitFees: number;
  customItems?: Array<{ description: string; amount: number }>;
  subtotal: number;
  tax: number;
  totalAmount: number;
  additionalNotes?: string;
  validityDays: number;
}

export interface RespondToQuotationData {
  status: "ACCEPTED" | "REJECTED";
  rejectionReason?: string;
}

/**
 * Get quotation requests for owner (PENDING status)
 * Filters to show only requests that match owner's vehicle capabilities
 */
export const getOwnerQuotationRequests = async (
  ownerId: string,
  query: QuotationQuery,
) => {
  const { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  // First, get the owner's vehicles to know their capabilities
  const ownerVehicles = await prisma.vehicle.findMany({
    where: { ownerId, isActive: true },
    select: {
      id: true,
      type: true,
      seats: true,
    },
  });

  // Get the vehicle types and max capacity the owner can serve
  const ownerVehicleTypes = [...new Set(ownerVehicles.map((v) => v.type))];
  const maxSeats = Math.max(...ownerVehicles.map((v) => v.seats), 0);

  const where: any = {
    OR: [
      // Quotations for owner's specific vehicles
      { vehicle: { ownerId } },
      // PENDING requests that match owner's vehicle capabilities
      {
        AND: [
          { status: "PENDING" },
          { vehicleId: null },
          // Only show requests that owner can fulfill
          ownerVehicleTypes.length > 0
            ? {
                OR: [
                  { vehicleType: { in: ownerVehicleTypes } },
                  { vehicleType: null }, // Generic requests
                ],
              }
            : { vehicleType: null },
          // Only show if owner has vehicles with enough capacity
          maxSeats > 0
            ? {
                OR: [
                  { passengerCount: { lte: maxSeats } },
                  { passengerCount: null },
                ],
              }
            : { passengerCount: null },
        ],
      },
    ],
  };

  if (status) {
    where.status = status;
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            licensePlate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.quotation.count({ where }),
  ]);

  return {
    quotations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get sent quotations by owner (SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED)
 */
export const getOwnerSentQuotations = async (
  ownerId: string,
  query: QuotationQuery,
) => {
  const { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where: any = {
    vehicle: { ownerId },
    status: {
      in: ["SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"],
    },
  };

  if (status) {
    where.status = status;
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            licensePlate: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
    }),
    prisma.quotation.count({ where }),
  ]);

  return {
    quotations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get customer's quotation requests
 */
export const getCustomerQuotations = async (
  customerId: string,
  query: QuotationQuery,
) => {
  const { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where: any = { customerId };

  if (status) {
    where.status = status;
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      skip,
      take: limit,
      include: {
        vehicle: {
          select: {
            id: true,
            licensePlate: true,

            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.quotation.count({ where }),
  ]);

  return {
    quotations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single quotation by ID
 */
export const getQuotationById = async (
  quotationId: string,
  userId: string,
  userRole: string,
) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          licensePlate: true,

          year: true,

          pricePerDay: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!quotation) {
    throw new Error("Quotation not found");
  }

  // Check authorization
  const isCustomer = quotation.customerId === userId;
  // Vehicle must be included in the query above to check ownership
  let isOwner = false;
  const quotationWithVehicle = quotation as typeof quotation & {
    vehicle?: { ownerId: string };
  };
  if (quotation.vehicleId && quotationWithVehicle.vehicle) {
    isOwner = quotationWithVehicle.vehicle.ownerId === userId;
  }
  const isAdmin = userRole === "admin";

  if (!isCustomer && !isOwner && !isAdmin) {
    throw new Error("Unauthorized to view this quotation");
  }

  // Mark as viewed if customer is viewing for the first time
  if (isCustomer && quotation.status === "SENT" && !quotation.viewedAt) {
    await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        status: "VIEWED",
        viewedAt: new Date(),
      },
    });
    quotation.status = "VIEWED";
    quotation.viewedAt = new Date();
  }

  return quotation;
};

/**
 * Create a new quotation request (customer)
 * With proper input validation
 */
export const createQuotationRequest = async (
  customerId: string,
  data: CreateQuotationRequestData,
) => {
  // Validate required fields
  if (!data.pickupLocation) {
    throw ApiError.badRequest("Pickup location is required");
  }
  if (!data.startDate) {
    throw ApiError.badRequest("Start date is required");
  }

  // Validate dates
  const startDate = new Date(data.startDate);
  const endDate = data.endDate ? new Date(data.endDate) : startDate;
  const now = new Date();

  if (startDate < now) {
    throw ApiError.badRequest("Start date must be in the future");
  }

  if (endDate < startDate) {
    throw ApiError.badRequest("End date cannot be before start date");
  }

  // Validate passenger count
  if (
    data.passengerCount !== undefined &&
    (data.passengerCount < 1 || data.passengerCount > 100)
  ) {
    throw ApiError.badRequest("Passenger count must be between 1 and 100");
  }

  // Generate quotation ID
  const currentYear = new Date().getFullYear();
  const count = await prisma.quotation.count({
    where: {
      quotationId: {
        startsWith: `QUO-${currentYear}`,
      },
    },
  });
  const quotationId = `QUO-${currentYear}-${String(count + 1).padStart(3, "0")}`;

  // Create quotation with only allowed fields (whitelist approach)
  const quotation = await prisma.quotation.create({
    data: {
      quotationId,
      customerId,
      vehicleType: data.vehicleType || null,
      startDate,
      endDate,
      startTime: data.startTime || null,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation || null,
      passengerCount: data.passengerCount || null,
      estimatedDistance: data.estimatedDistance || null,
      estimatedDuration: data.estimatedDuration || null,
      specialRequests: data.specialRequests || null,
      status: "PENDING",
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return quotation;
};

/**
 * Send quotation (owner responds to request)
 */
export const sendQuotation = async (
  quotationId: string,
  ownerId: string,
  data: SendQuotationData,
) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
  });

  if (!quotation) {
    throw new Error("Quotation not found");
  }

  if (quotation.status !== "PENDING") {
    throw new Error("Can only respond to pending quotations");
  }

  // Verify vehicle belongs to owner
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: data.vehicleId },
  });

  if (!vehicle || vehicle.ownerId !== ownerId) {
    throw new Error("Invalid vehicle or unauthorized");
  }

  // Calculate validUntil date
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + data.validityDays);

  const updated = await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      ...data,
      validUntil,
      status: "SENT",
      sentAt: new Date(),
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          licensePlate: true,
        },
      },
    },
  });

  return updated;
};

/**
 * Respond to quotation (customer accepts/rejects)
 * If accepted, automatically creates a booking
 */
export const respondToQuotation = async (
  quotationId: string,
  customerId: string,
  data: RespondToQuotationData,
) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      vehicle: true,
    },
  });

  if (!quotation) {
    throw ApiError.notFound("Quotation not found");
  }

  if (quotation.customerId !== customerId) {
    throw ApiError.forbidden("Unauthorized to respond to this quotation");
  }

  if (quotation.status !== "SENT" && quotation.status !== "VIEWED") {
    throw ApiError.badRequest("Can only respond to sent/viewed quotations");
  }

  if (!quotation.vehicle) {
    throw ApiError.badRequest("Quotation has no vehicle assigned");
  }

  // Check if quotation has expired
  if (quotation.validUntil && new Date(quotation.validUntil) < new Date()) {
    // Auto-update status to expired
    await prisma.quotation.update({
      where: { id: quotationId },
      data: { status: "EXPIRED" },
    });
    throw ApiError.badRequest(
      "This quotation has expired. Please request a new quotation.",
    );
  }

  // If accepting, check vehicle availability for the booking dates
  if (data.status === "ACCEPTED") {
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        vehicleId: quotation.vehicleId!,
        status: { in: ["PENDING", "CONFIRMED", "ONGOING"] },
        OR: [
          {
            // New booking starts during existing booking
            startDate: { lte: quotation.endDate },
            endDate: { gte: quotation.startDate },
          },
        ],
      },
    });

    if (conflictingBooking) {
      throw ApiError.conflict(
        "Sorry, this vehicle is no longer available for the selected dates. Please request a new quotation.",
      );
    }

    // Use transaction to ensure atomicity - both quotation update and booking creation succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Update quotation status
      const updated = await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: data.status,
          rejectionReason: data.rejectionReason,
          respondedAt: new Date(),
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              licensePlate: true,
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Create booking within the same transaction
      const booking = await tx.booking.create({
        data: {
          customerId: quotation.customerId,
          vehicleId: quotation.vehicleId!,
          startDate: quotation.startDate,
          endDate: quotation.endDate,
          pickupLocation: quotation.pickupLocation,
          dropoffLocation: quotation.dropoffLocation,
          totalPassengers: quotation.passengerCount,
          totalAmount: quotation.totalAmount || 0,
          status: "CONFIRMED",
          notes: `Booking created from quotation ${quotation.quotationId}. ${quotation.specialRequests || ""}`,
        },
      });

      return {
        ...updated,
        booking: {
          id: booking.id,
          status: booking.status,
        },
      };
    });

    return result;
  }

  // For rejection, just update the quotation status (no transaction needed)
  const updated = await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      status: data.status,
      rejectionReason: data.rejectionReason,
      respondedAt: new Date(),
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          licensePlate: true,

          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return updated;
};

/**
 * Get all quotations (admin only)
 */
export const getAllQuotations = async (query: QuotationQuery) => {
  const { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            licensePlate: true,

            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.quotation.count({ where }),
  ]);

  return {
    quotations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
