import { prisma } from "@travenest/database";
import type { QuotationStatus, VehicleType } from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { config } from "../../config/index.js";

// Pricing validation types
interface PricingValidationResult {
  isValid: boolean;
  warnings: string[];
  suggestions: {
    fuelCost?: { min: number; max: number; suggested: number };
    driverCost?: { min: number; max: number; suggested: number };
    vehicleRentalCost?: { min: number; max: number; suggested: number };
  };
}

/**
 * Validate quotation pricing against Sri Lankan bus rental industry standards
 * Returns warnings but doesn't block submission (owners know their costs better)
 */
const validateQuotationPricing = (
  data: SendQuotationData,
  vehicleType: VehicleType,
  estimatedDistanceKm: number,
  tripDays: number,
): PricingValidationResult => {
  const { pricingRules } = config;
  const warnings: string[] = [];
  const suggestions: PricingValidationResult["suggestions"] = {};

  // Get rates for this vehicle type
  const fuelRates =
    pricingRules.fuelCostPerKm[vehicleType] ||
    pricingRules.fuelCostPerKm.ORDINARY;
  const perKmRates =
    pricingRules.perKmRate[vehicleType] || pricingRules.perKmRate.ORDINARY;
  const driverRates = pricingRules.driverAllowance;
  const tolerance = pricingRules.validationTolerance;

  // Validate minimum booking distance
  if (estimatedDistanceKm < pricingRules.minimumBooking.kilometers) {
    warnings.push(
      `Distance (${estimatedDistanceKm}km) is below industry minimum of ${pricingRules.minimumBooking.kilometers}km. Consider applying minimum km charges.`,
    );
  }

  // Validate fuel cost
  if (data.fuelCost && estimatedDistanceKm > 0) {
    const expectedMinFuel = fuelRates.min * estimatedDistanceKm;
    const expectedMaxFuel = fuelRates.max * estimatedDistanceKm;
    const suggestedFuel = fuelRates.default * estimatedDistanceKm;

    suggestions.fuelCost = {
      min: Math.round(expectedMinFuel),
      max: Math.round(expectedMaxFuel),
      suggested: Math.round(suggestedFuel),
    };

    // Allow tolerance for owner's actual fuel costs
    if (data.fuelCost < expectedMinFuel * (1 - tolerance)) {
      warnings.push(
        `Fuel cost (LKR ${data.fuelCost}) seems low for ${estimatedDistanceKm}km. Suggested: LKR ${Math.round(suggestedFuel)}`,
      );
    } else if (data.fuelCost > expectedMaxFuel * (1 + tolerance)) {
      warnings.push(
        `Fuel cost (LKR ${data.fuelCost}) is higher than typical for ${estimatedDistanceKm}km. Consider reviewing.`,
      );
    }
  }

  // Validate driver cost (daily allowance * trip days)
  if (data.driverCost && tripDays > 0) {
    const expectedMinDriver = driverRates.min * tripDays;
    const expectedMaxDriver = driverRates.max * tripDays;
    const suggestedDriver = driverRates.default * tripDays;

    suggestions.driverCost = {
      min: Math.round(expectedMinDriver),
      max: Math.round(expectedMaxDriver),
      suggested: Math.round(suggestedDriver),
    };

    if (data.driverCost < expectedMinDriver * (1 - tolerance)) {
      warnings.push(
        `Driver cost (LKR ${data.driverCost}) seems low for ${tripDays} day(s). Typical range: LKR ${expectedMinDriver}-${expectedMaxDriver}`,
      );
    } else if (data.driverCost > expectedMaxDriver * (1 + tolerance)) {
      warnings.push(
        `Driver cost (LKR ${data.driverCost}) is higher than typical. Consider reviewing.`,
      );
    }
  }

  // Validate vehicle rental cost (per km rate * distance)
  if (data.vehicleRentalCost && estimatedDistanceKm > 0) {
    const expectedMinRental = perKmRates.min * estimatedDistanceKm;
    const expectedMaxRental = perKmRates.max * estimatedDistanceKm;
    const suggestedRental = perKmRates.default * estimatedDistanceKm;

    suggestions.vehicleRentalCost = {
      min: Math.round(expectedMinRental),
      max: Math.round(expectedMaxRental),
      suggested: Math.round(suggestedRental),
    };

    if (data.vehicleRentalCost < expectedMinRental * (1 - tolerance)) {
      warnings.push(
        `Vehicle rental (LKR ${data.vehicleRentalCost}) seems low for ${vehicleType} over ${estimatedDistanceKm}km.`,
      );
    }
  }

  return {
    isValid: true, // We return warnings but don't block - owners know their costs
    warnings,
    suggestions,
  };
};

/**
 * Get pricing suggestions for a quotation based on vehicle type and trip details
 * Used by owners to get recommended pricing before sending a quotation
 */
export const getPricingSuggestions = async (
  quotationId: string,
  vehicleId: string,
  ownerId: string,
) => {
  const [quotation, vehicle] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id: quotationId },
    }),
    prisma.vehicle.findUnique({
      where: { id: vehicleId },
    }),
  ]);

  if (!quotation) {
    throw ApiError.notFound("Quotation not found");
  }

  if (!vehicle || vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden("Invalid vehicle or unauthorized");
  }

  const { pricingRules } = config;

  // Parse estimated distance
  const estimatedDistanceKm =
    parseFloat(quotation.estimatedDistance?.replace(/[^\d.]/g, "") || "0") ||
    pricingRules.minimumBooking.kilometers;

  // Calculate trip days
  const tripDays = Math.max(
    1,
    Math.ceil(
      (quotation.endDate.getTime() - quotation.startDate.getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );

  // Get rates for this vehicle type
  const fuelRates =
    pricingRules.fuelCostPerKm[vehicle.type] ||
    pricingRules.fuelCostPerKm.ORDINARY;
  const perKmRates =
    pricingRules.perKmRate[vehicle.type] || pricingRules.perKmRate.ORDINARY;
  const driverRates = pricingRules.driverAllowance;

  // Calculate suggested values
  const suggestedFuelCost = Math.round(fuelRates.default * estimatedDistanceKm);
  const suggestedDriverCost = Math.round(driverRates.default * tripDays);
  const suggestedVehicleRental = Math.round(
    perKmRates.default * estimatedDistanceKm,
  );

  // Use vehicle's configured rates if available
  const vehicleFuelCost = vehicle.fuelCostPerKm
    ? Math.round(vehicle.fuelCostPerKm * estimatedDistanceKm)
    : suggestedFuelCost;
  const vehicleDriverAllowance = vehicle.driverAllowance
    ? Math.round(vehicle.driverAllowance * tripDays)
    : suggestedDriverCost;
  const vehicleRentalCost = vehicle.pricePerKm
    ? Math.round(vehicle.pricePerKm * estimatedDistanceKm)
    : suggestedVehicleRental;

  return {
    quotationId: quotation.id,
    vehicleId: vehicle.id,
    vehicleType: vehicle.type,
    tripDetails: {
      estimatedDistanceKm,
      tripDays,
      startDate: quotation.startDate,
      endDate: quotation.endDate,
    },
    minimumBooking: {
      kilometers: pricingRules.minimumBooking.kilometers,
      hours: pricingRules.minimumBooking.hours,
      meetsMinimum:
        estimatedDistanceKm >= pricingRules.minimumBooking.kilometers,
    },
    suggestions: {
      vehicleRentalCost: {
        min: Math.round(perKmRates.min * estimatedDistanceKm),
        max: Math.round(perKmRates.max * estimatedDistanceKm),
        suggested: vehicleRentalCost,
        perKm: vehicle.pricePerKm || perKmRates.default,
      },
      driverCost: {
        min: Math.round(driverRates.min * tripDays),
        max: Math.round(driverRates.max * tripDays),
        suggested: vehicleDriverAllowance,
        perDay: vehicle.driverAllowance || driverRates.default,
      },
      fuelCost: {
        min: Math.round(fuelRates.min * estimatedDistanceKm),
        max: Math.round(fuelRates.max * estimatedDistanceKm),
        suggested: vehicleFuelCost,
        perKm: vehicle.fuelCostPerKm || fuelRates.default,
      },
    },
    estimatedTotal:
      vehicleRentalCost + vehicleDriverAllowance + vehicleFuelCost,
  };
};

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
    // Convert status to uppercase to match Prisma enum (PENDING, SENT, etc.)
    where.status = (status as string).toUpperCase();
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
    // Convert status to uppercase to match Prisma enum (PENDING, SENT, etc.)
    where.status = (status as string).toUpperCase();
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
    // Convert status to uppercase to match Prisma enum (PENDING, SENT, etc.)
    where.status = (status as string).toUpperCase();
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
    throw ApiError.notFound("Quotation not found");
  }

  // Check and auto-update expiry status if quotation has expired
  if (
    quotation.validUntil &&
    new Date(quotation.validUntil) < new Date() &&
    quotation.status !== "EXPIRED" &&
    quotation.status !== "ACCEPTED" &&
    quotation.status !== "REJECTED"
  ) {
    // Auto-update status to expired
    await prisma.quotation.update({
      where: { id: quotationId },
      data: { status: "EXPIRED" },
    });
    quotation.status = "EXPIRED";
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
    throw ApiError.forbidden("Unauthorized to view this quotation");
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
 * Includes pricing validation based on Sri Lankan bus rental standards
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
    throw ApiError.notFound("Quotation not found");
  }

  if (quotation.status !== "PENDING") {
    throw ApiError.badRequest("Can only respond to pending quotations");
  }

  // Verify vehicle belongs to owner
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: data.vehicleId },
  });

  if (!vehicle || vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden("Invalid vehicle or unauthorized");
  }

  // Parse estimated distance for validation
  const estimatedDistanceKm =
    parseFloat(data.estimatedDistance?.replace(/[^\d.]/g, "") || "0") ||
    parseFloat(quotation.estimatedDistance?.replace(/[^\d.]/g, "") || "0") ||
    100; // Default to minimum 100km if not specified

  // Calculate trip days
  const startDate = quotation.startDate;
  const endDate = quotation.endDate;
  const tripDays = Math.max(
    1,
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1,
  );

  // Validate pricing against industry standards
  const pricingValidation = validateQuotationPricing(
    data,
    vehicle.type,
    estimatedDistanceKm,
    tripDays,
  );

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

  // Return quotation with pricing warnings and suggestions
  return {
    ...updated,
    pricingValidation: {
      warnings: pricingValidation.warnings,
      suggestions: pricingValidation.suggestions,
    },
  };
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

  // If accepting, use transaction to ensure atomicity and prevent race conditions
  if (data.status === "ACCEPTED") {
    // Use transaction to ensure atomicity - availability check, quotation update, and booking creation
    // all succeed or fail together. This prevents TOCTOU race conditions.
    const result = await prisma.$transaction(async (tx) => {
      // Check vehicle availability INSIDE the transaction to prevent race conditions
      const conflictingBooking = await tx.booking.findFirst({
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
          // Include trip details from quotation
          estimatedDistance: quotation.estimatedDistance,
          estimatedDuration: quotation.estimatedDuration,
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
    // Convert status to uppercase to match Prisma enum (PENDING, SENT, etc.)
    where.status = (status as string).toUpperCase();
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
