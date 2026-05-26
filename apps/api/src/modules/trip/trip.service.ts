import { prisma } from "@travenest/database";
import type { TripStatus, VehicleType } from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";

export interface LocationInput {
  address?: string;
  city?: string;
  district?: string;
  lat?: number;
  lng?: number;
}

export interface TripStopInput {
  id?: string;
  location: LocationInput;
}

export interface CreateTripData {
  title?: string;
  pickupLocation: string | LocationInput;
  dropoffLocation?: string | LocationInput;
  intermediateStops?: TripStopInput[];
  startDate: string | Date;
  endDate?: string | Date;
  startTime?: string;
  isRoundTrip?: boolean;
  passengerCount: number;
  vehicleTypePreference?: VehicleType;
  needsAC?: boolean;
  specialRequests?: string;
  estimatedDistance?: string;
  estimatedDuration?: string;
  itineraryStops?: any[];
  itineraryRoute?: any;
}

export interface UpdateTripData extends Partial<CreateTripData> {}

export interface ListTripsQuery {
  status?: TripStatus;
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}

const normalizeLocationString = (
  location?: string | LocationInput,
): string => {
  if (!location) return "";
  if (typeof location === "string") return location.trim();
  return [location.address, location.city, location.district]
    .filter(Boolean)
    .join(", ");
};

const extractLocationFields = (
  location?: string | LocationInput,
): {
  display: string;
  city: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
} => {
  if (!location) {
    return { display: "", city: null, district: null, lat: null, lng: null };
  }
  if (typeof location === "string") {
    const trimmed = location.trim();
    return {
      display: trimmed,
      city: trimmed.split(",")[0]?.trim() || null,
      district: null,
      lat: null,
      lng: null,
    };
  }
  return {
    display: normalizeLocationString(location),
    city: location.city?.trim() || null,
    district: location.district?.trim() || null,
    lat: typeof location.lat === "number" ? location.lat : null,
    lng: typeof location.lng === "number" ? location.lng : null,
  };
};

const generateTripCode = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await prisma.trip.count({
    where: { tripCode: { startsWith: `TRP-${year}` } },
  });
  return `TRP-${year}-${String(count + 1).padStart(3, "0")}`;
};

const validateDates = (start: Date, end: Date) => {
  if (Number.isNaN(start.getTime())) {
    throw ApiError.badRequest("Invalid start date");
  }
  if (Number.isNaN(end.getTime())) {
    throw ApiError.badRequest("Invalid end date");
  }
  // Allow today (clamp by day, not minute) so a same-day trip planned this
  // morning isn't rejected.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (start < todayStart) {
    throw ApiError.badRequest("Start date must be today or in the future");
  }
  if (end < start) {
    throw ApiError.badRequest("End date cannot be before start date");
  }
};

const ACTIVE_TRIP_STATUSES: TripStatus[] = ["PLANNING", "AWAITING_QUOTES"];

const tripWithQuotationsInclude = {
  quotations: {
    include: {
      vehicle: {
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          year: true,
          seats: true,
          images: true,
          type: true,
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
    orderBy: { createdAt: "desc" as const },
  },
} as const;

/**
 * Create a new trip plan for the customer.
 * Defaults the end date to the start date for single-day trips.
 */
export const createTrip = async (
  customerId: string,
  data: CreateTripData,
) => {
  const pickup = extractLocationFields(data.pickupLocation);
  if (!pickup.display) {
    throw ApiError.badRequest("Pickup location is required");
  }

  const dropoff = extractLocationFields(data.dropoffLocation);

  const startDate = new Date(data.startDate);
  const endDate = data.endDate ? new Date(data.endDate) : startDate;
  validateDates(startDate, endDate);

  const tripCode = await generateTripCode();

  const trip = await prisma.trip.create({
    data: {
      tripCode,
      customerId,
      title: data.title?.trim() || null,
      pickupLocation: pickup.display,
      pickupCity: pickup.city,
      pickupDistrict: pickup.district,
      pickupLatitude: pickup.lat,
      pickupLongitude: pickup.lng,
      dropoffLocation: dropoff.display || null,
      dropoffCity: dropoff.city,
      dropoffDistrict: dropoff.district,
      dropoffLatitude: dropoff.lat,
      dropoffLongitude: dropoff.lng,
      startDate,
      endDate,
      startTime: data.startTime || null,
      isRoundTrip: data.isRoundTrip ?? false,
      passengerCount: data.passengerCount,
      vehicleTypePreference: data.vehicleTypePreference ?? null,
      needsAC: data.needsAC ?? true,
      specialRequests: data.specialRequests?.trim() || null,
      estimatedDistance: data.estimatedDistance || null,
      estimatedDuration: data.estimatedDuration || null,
      itineraryStops: data.itineraryStops ?? undefined,
      itineraryRoute: data.itineraryRoute ?? undefined,
      intermediateStops: data.intermediateStops
        ? (data.intermediateStops as any)
        : undefined,
      status: "PLANNING",
    },
  });

  return trip;
};

/**
 * List trips for the customer.
 */
export const listTrips = async (
  customerId: string,
  query: ListTripsQuery,
) => {
  const { status, page = 1, limit = 20, activeOnly = false } = query;
  const skip = (page - 1) * limit;

  const where: any = { customerId };
  if (status) {
    where.status = status;
  } else if (activeOnly) {
    where.status = { in: ACTIVE_TRIP_STATUSES };
  }

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ status: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { quotations: true },
        },
        quotations: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            vehicleId: true,
          },
        },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  return {
    trips,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single trip by id, with all quotation responses attached.
 */
export const getTripById = async (tripId: string, userId: string) => {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripWithQuotationsInclude,
  });

  if (!trip) {
    throw ApiError.notFound("Trip not found");
  }

  if (trip.customerId !== userId) {
    throw ApiError.forbidden("Unauthorized to view this trip");
  }

  // Auto-expire trips whose end date has passed without acceptance.
  if (
    trip.endDate < new Date() &&
    (trip.status === "PLANNING" || trip.status === "AWAITING_QUOTES")
  ) {
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: "EXPIRED" },
    });
    trip.status = "EXPIRED";
  }

  return trip;
};

/**
 * Update a trip while it is still editable (PLANNING / AWAITING_QUOTES).
 * Pending quotations on this trip are updated to keep the snapshot consistent.
 */
export const updateTrip = async (
  tripId: string,
  userId: string,
  data: UpdateTripData,
) => {
  const existing = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!existing) {
    throw ApiError.notFound("Trip not found");
  }
  if (existing.customerId !== userId) {
    throw ApiError.forbidden("Unauthorized to edit this trip");
  }
  if (existing.status !== "PLANNING" && existing.status !== "AWAITING_QUOTES") {
    throw ApiError.badRequest(
      "This trip can no longer be edited — it has been confirmed, completed, cancelled, or expired.",
    );
  }

  const updateData: any = {};

  if (data.title !== undefined) updateData.title = data.title?.trim() || null;

  if (data.pickupLocation !== undefined) {
    const pickup = extractLocationFields(data.pickupLocation);
    if (!pickup.display) {
      throw ApiError.badRequest("Pickup location cannot be empty");
    }
    updateData.pickupLocation = pickup.display;
    updateData.pickupCity = pickup.city;
    updateData.pickupDistrict = pickup.district;
    updateData.pickupLatitude = pickup.lat;
    updateData.pickupLongitude = pickup.lng;
  }

  if (data.dropoffLocation !== undefined) {
    const dropoff = extractLocationFields(data.dropoffLocation);
    updateData.dropoffLocation = dropoff.display || null;
    updateData.dropoffCity = dropoff.city;
    updateData.dropoffDistrict = dropoff.district;
    updateData.dropoffLatitude = dropoff.lat;
    updateData.dropoffLongitude = dropoff.lng;
  }

  if (data.startDate !== undefined || data.endDate !== undefined) {
    const startDate = data.startDate
      ? new Date(data.startDate)
      : existing.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : startDate;
    validateDates(startDate, endDate);
    updateData.startDate = startDate;
    updateData.endDate = endDate;
  }

  if (data.startTime !== undefined)
    updateData.startTime = data.startTime || null;
  if (data.isRoundTrip !== undefined)
    updateData.isRoundTrip = data.isRoundTrip;
  if (data.passengerCount !== undefined)
    updateData.passengerCount = data.passengerCount;
  if (data.vehicleTypePreference !== undefined)
    updateData.vehicleTypePreference = data.vehicleTypePreference ?? null;
  if (data.needsAC !== undefined) updateData.needsAC = data.needsAC;
  if (data.specialRequests !== undefined)
    updateData.specialRequests = data.specialRequests?.trim() || null;
  if (data.estimatedDistance !== undefined)
    updateData.estimatedDistance = data.estimatedDistance || null;
  if (data.estimatedDuration !== undefined)
    updateData.estimatedDuration = data.estimatedDuration || null;
  if (data.itineraryStops !== undefined)
    updateData.itineraryStops = data.itineraryStops as any;
  if (data.itineraryRoute !== undefined)
    updateData.itineraryRoute = data.itineraryRoute as any;
  if (data.intermediateStops !== undefined)
    updateData.intermediateStops = data.intermediateStops as any;

  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: updateData,
    include: tripWithQuotationsInclude,
  });

  return trip;
};

/**
 * Cancel a trip. Only allowed while no quotation has been accepted.
 */
export const cancelTrip = async (tripId: string, userId: string) => {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    throw ApiError.notFound("Trip not found");
  }
  if (trip.customerId !== userId) {
    throw ApiError.forbidden("Unauthorized to cancel this trip");
  }
  if (trip.status === "CONFIRMED") {
    throw ApiError.badRequest(
      "This trip already has a confirmed booking. Cancel the booking instead.",
    );
  }
  if (
    trip.status === "CANCELLED" ||
    trip.status === "COMPLETED" ||
    trip.status === "EXPIRED"
  ) {
    return trip;
  }

  return prisma.trip.update({
    where: { id: tripId },
    data: { status: "CANCELLED" },
  });
};

/**
 * Resolve an active trip the customer could attach a new quotation to.
 * Returns trips that haven't been confirmed and whose end date hasn't passed.
 * Used by the New Quotation page to offer "reuse" of existing trip details.
 */
export const getActiveTripsForCustomer = async (customerId: string) => {
  const now = new Date();
  return prisma.trip.findMany({
    where: {
      customerId,
      status: { in: ACTIVE_TRIP_STATUSES },
      endDate: { gte: now },
    },
    orderBy: [{ startDate: "asc" }],
    take: 10,
  });
};

/**
 * Mark a trip as AWAITING_QUOTES (called when a quotation is attached to a
 * PLANNING trip). Idempotent.
 */
export const markTripAwaitingQuotes = async (tripId: string) => {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return null;
  if (trip.status === "PLANNING") {
    return prisma.trip.update({
      where: { id: tripId },
      data: { status: "AWAITING_QUOTES" },
    });
  }
  return trip;
};

/**
 * Mark a trip as CONFIRMED after a quotation acceptance.
 */
export const markTripConfirmed = async (tripId: string) => {
  return prisma.trip.update({
    where: { id: tripId },
    data: { status: "CONFIRMED" },
  });
};
