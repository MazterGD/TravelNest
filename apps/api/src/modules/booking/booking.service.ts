import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";

export interface BookingQuery {
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Get customer's bookings
 */
export const getCustomerBookings = async (
  customerId: string,
  query: BookingQuery,
) => {
  const { status, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where: any = { customerId };

  if (status && typeof status === "string") {
    where.status = status.toUpperCase();
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      include: {
        vehicle: {
          select: {
            id: true,
            name: true,
            licensePlate: true,
            type: true,
            brand: true,
            model: true,
            seats: true,
            images: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            createdAt: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.booking.count({ where }),
  ]);

  // Transform to match frontend interface
  const transformedBookings = bookings.map((booking) => ({
    id: booking.id,
    bookingReference: `BK-${booking.id.slice(0, 8).toUpperCase()}`,
    customerId: booking.customerId,
    vehicleId: booking.vehicleId,
    ownerId: booking.vehicle.owner.id,
    status: booking.status.toLowerCase(),
    paymentStatus: booking.payment?.status?.toLowerCase() || "pending",
    startDate: booking.startDate.toISOString(),
    endDate: booking.endDate.toISOString(),
    passengerCount: booking.totalPassengers || 0,
    totalAmount: booking.totalAmount,
    paidAmount: booking.payment?.amount || 0,
    pickupLocation: {
      address: booking.pickupLocation,
      city: booking.pickupLocation.split(",")[0]?.trim() || "",
    },
    dropoffLocation: {
      address: booking.dropoffLocation || booking.pickupLocation,
      city:
        (booking.dropoffLocation || booking.pickupLocation)
          .split(",")[0]
          ?.trim() || "",
    },
    vehicleName: booking.vehicle.name,
    vehicleImage: booking.vehicle.images[0] || null,
    ownerName: `${booking.vehicle.owner.firstName} ${booking.vehicle.owner.lastName}`,
    ownerPhone: booking.vehicle.owner.phone || "",
    hasReview: !!booking.review,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  }));

  return {
    bookings: transformedBookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single booking by ID (customer)
 */
export const getBookingById = async (
  bookingId: string,
  userId: string,
  userRole: string,
) => {
  const prismaClient = prisma as any;
  const booking = await prismaClient.booking.findUnique({
    where: { id: bookingId },
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
          name: true,
          licensePlate: true,
          type: true,
          brand: true,
          model: true,
          seats: true,
          images: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      },
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          createdAt: true,
          bankReceiptUrl: true,
        },
      },
      review: true,
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  // Check authorization
  const isCustomer = booking.customerId === userId;
  const isOwner = booking.vehicle.ownerId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isCustomer && !isOwner && !isAdmin) {
    throw ApiError.forbidden("Not authorized to view this booking");
  }

  // Calculate payment breakdown
  const platformCommissionRate = 0.1;
  const platformCommission = booking.totalAmount * platformCommissionRate;
  const netAmount = booking.totalAmount - platformCommission;

  return {
    id: booking.id,
    bookingRef: `BK-${booking.id.slice(0, 8).toUpperCase()}`,
    customer: {
      id: booking.customer.id,
      name: `${booking.customer.firstName} ${booking.customer.lastName}`,
      phone: booking.customer.phone || "",
      email: booking.customer.email,
    },
    vehicle: {
      id: booking.vehicle.id,
      name: booking.vehicle.name,
      registration: booking.vehicle.licensePlate,
      type: booking.vehicle.type,
      brand: booking.vehicle.brand,
      model: booking.vehicle.model,
      capacity: booking.vehicle.seats,
      image: booking.vehicle.images[0] || null,
    },
    owner: {
      id: booking.vehicle.owner.id,
      name: `${booking.vehicle.owner.firstName} ${booking.vehicle.owner.lastName}`,
      phone: booking.vehicle.owner.phone || "",
      email: booking.vehicle.owner.email,
    },
    trip: {
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      pickupLocation: booking.pickupLocation,
      dropoffLocation: booking.dropoffLocation || booking.pickupLocation,
      passengers: booking.totalPassengers || 0,
    },
    payment: {
      id: booking.payment?.id || null,
      total: booking.totalAmount,
      paid: booking.payment?.amount || 0,
      status: booking.payment?.status?.toLowerCase() || "pending",
      method: booking.payment?.method || "Pending",
      receiptUrl: booking.payment?.bankReceiptUrl || null,
      platformCommission,
      netAmount,
    },
    status: booking.status.toLowerCase(),
    notes: booking.notes,
    cancelReason: booking.cancelReason,
    hasReview: !!booking.review,
    review: booking.review,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
};

/**
 * Cancel a booking (customer)
 */
export const cancelBooking = async (
  bookingId: string,
  customerId: string,
  reason: string,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      status: true,
      startDate: true,
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.customerId !== customerId) {
    throw ApiError.forbidden("Not authorized to cancel this booking");
  }

  // Check if booking can be cancelled
  const nonCancellableStatuses = ["ONGOING", "COMPLETED", "CANCELLED"];
  if (nonCancellableStatuses.includes(booking.status)) {
    throw ApiError.badRequest(
      `Cannot cancel booking with status: ${booking.status}`,
    );
  }

  // Check if booking is too close to start date (e.g., within 24 hours)
  const now = new Date();
  const startDate = new Date(booking.startDate);
  const hoursUntilStart =
    (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilStart < 24) {
    throw ApiError.badRequest(
      "Bookings cannot be cancelled within 24 hours of start time. Please contact support.",
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      cancelReason: reason,
    },
  });

  return updatedBooking;
};

/**
 * Create a booking from accepted quotation
 */
export const createBookingFromQuotation = async (
  customerId: string,
  quotationId: string,
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
    throw ApiError.forbidden(
      "Not authorized to create booking from this quotation",
    );
  }

  if (quotation.status !== "ACCEPTED") {
    throw ApiError.badRequest(
      "Only accepted quotations can be converted to bookings",
    );
  }

  if (!quotation.vehicleId || !quotation.vehicle) {
    throw ApiError.badRequest("Quotation does not have a vehicle assigned");
  }

  // Check if quotation has expired
  if (quotation.validUntil && new Date(quotation.validUntil) < new Date()) {
    throw ApiError.badRequest("This quotation has expired");
  }

  // CRITICAL: Check vehicle availability for the booking dates
  // This prevents double bookings when multiple customers accept quotes for overlapping dates
  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      vehicleId: quotation.vehicleId,
      status: { in: ["PENDING", "CONFIRMED", "ONGOING"] },
      // Check for any date overlap
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
      "Vehicle is no longer available for the selected dates. Another booking was made for this period.",
    );
  }

  // Create the booking within a transaction to ensure atomicity
  const booking = await prisma.$transaction(async (tx) => {
    // Double-check availability within transaction
    const existingBooking = await tx.booking.findFirst({
      where: {
        vehicleId: quotation.vehicleId!,
        status: { in: ["PENDING", "CONFIRMED", "ONGOING"] },
        startDate: { lte: quotation.endDate },
        endDate: { gte: quotation.startDate },
      },
    });

    if (existingBooking) {
      throw ApiError.conflict(
        "Vehicle is no longer available for the selected dates.",
      );
    }

    // Create the booking
    return tx.booking.create({
      data: {
        customerId,
        vehicleId: quotation.vehicleId!,
        startDate: quotation.startDate,
        endDate: quotation.endDate,
        pickupLocation: quotation.pickupLocation,
        dropoffLocation: quotation.dropoffLocation,
        totalPassengers: quotation.passengerCount,
        totalAmount: quotation.totalAmount || 0,
        status: "PENDING",
        notes: quotation.specialRequests,
        // Include trip details from quotation
        estimatedDistance: quotation.estimatedDistance,
        estimatedDuration: quotation.estimatedDuration,
      },
    });
  });

  return booking;
};

/**
 * Assign driver to booking (owner)
 */
export interface DriverInfo {
  driverName: string;
  driverPhone: string;
  driverLicense: string;
}

export const assignDriver = async (
  bookingId: string,
  ownerId: string,
  driverInfo: DriverInfo,
) => {
  // Verify booking exists and belongs to owner's vehicle
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      vehicle: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden("Not authorized to assign driver to this booking");
  }

  // Validate driver info
  if (!driverInfo.driverName || driverInfo.driverName.trim().length < 2) {
    throw ApiError.badRequest("Driver name is required");
  }

  if (
    !driverInfo.driverPhone ||
    !/^[\d+\-\s]{9,15}$/.test(driverInfo.driverPhone.replace(/\s/g, ""))
  ) {
    throw ApiError.badRequest("Valid driver phone number is required");
  }

  if (!driverInfo.driverLicense || driverInfo.driverLicense.trim().length < 5) {
    throw ApiError.badRequest("Valid driver license number is required");
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      driverName: driverInfo.driverName.trim(),
      driverPhone: driverInfo.driverPhone.trim(),
      driverLicense: driverInfo.driverLicense.trim().toUpperCase(),
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
          name: true,
          licensePlate: true,
        },
      },
    },
  });

  return updatedBooking;
};

/**
 * Get driver info for a booking (customer view)
 */
export const getDriverInfo = async (bookingId: string, userId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      driverName: true,
      driverPhone: true,
      driverLicense: true,
      status: true,
      vehicle: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  // Check authorization - customer, owner, or admin can view
  const isCustomer = booking.customerId === userId;
  const isOwner = booking.vehicle.ownerId === userId;

  if (!isCustomer && !isOwner) {
    throw ApiError.forbidden("Not authorized to view driver information");
  }

  // Only return driver info for confirmed/ongoing bookings
  if (!["CONFIRMED", "ONGOING"].includes(booking.status)) {
    return {
      bookingId: booking.id,
      driverAssigned: false,
      message:
        "Driver information will be available once the booking is confirmed",
    };
  }

  if (!booking.driverName) {
    return {
      bookingId: booking.id,
      driverAssigned: false,
      message:
        "Driver has not been assigned yet. The owner will update this before your trip.",
    };
  }

  return {
    bookingId: booking.id,
    driverAssigned: true,
    driver: {
      name: booking.driverName,
      phone: booking.driverPhone,
      license: booking.driverLicense,
    },
  };
};

/**
 * Trip Itinerary Management
 */
export interface ItineraryDay {
  dayNumber: number;
  date: Date | string;
  startLocation: string;
  endLocation: string;
  overnightStop?: string;
  description?: string;
  estimatedKm?: number;
  pickupPoints?: Array<{ location: string; time: string }>;
  dropoffPoints?: Array<{ location: string; time: string }>;
}

/**
 * Add or update trip itinerary (owner)
 */
export const updateTripItinerary = async (
  bookingId: string,
  ownerId: string,
  itinerary: ItineraryDay[],
) => {
  // Verify booking exists and belongs to owner's vehicle
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      vehicle: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.vehicle.ownerId !== ownerId) {
    throw ApiError.forbidden(
      "Not authorized to update itinerary for this booking",
    );
  }

  // Validate itinerary
  if (!itinerary || itinerary.length === 0) {
    throw ApiError.badRequest("At least one day of itinerary is required");
  }

  // Calculate trip days
  const tripDays =
    Math.ceil(
      (booking.endDate.getTime() - booking.startDate.getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;

  if (itinerary.length > tripDays) {
    throw ApiError.badRequest(
      `Itinerary has ${itinerary.length} days but trip is only ${tripDays} days`,
    );
  }

  // Use transaction to replace all itinerary days
  const result = await prisma.$transaction(async (tx) => {
    // Delete existing itinerary
    await tx.tripItinerary.deleteMany({
      where: { bookingId },
    });

    // Create new itinerary days
    const createdItinerary = await Promise.all(
      itinerary.map((day) =>
        tx.tripItinerary.create({
          data: {
            bookingId,
            dayNumber: day.dayNumber,
            date: new Date(day.date),
            startLocation: day.startLocation,
            endLocation: day.endLocation,
            overnightStop: day.overnightStop,
            description: day.description,
            estimatedKm: day.estimatedKm,
            pickupPoints: day.pickupPoints as any,
            dropoffPoints: day.dropoffPoints as any,
          },
        }),
      ),
    );

    return createdItinerary;
  });

  return result;
};

/**
 * Get trip itinerary for a booking
 */
export const getTripItinerary = async (bookingId: string, userId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      startDate: true,
      endDate: true,
      vehicle: {
        select: {
          ownerId: true,
        },
      },
      itinerary: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  // Check authorization
  const isCustomer = booking.customerId === userId;
  const isOwner = booking.vehicle.ownerId === userId;

  if (!isCustomer && !isOwner) {
    throw ApiError.forbidden("Not authorized to view trip itinerary");
  }

  const tripDays =
    Math.ceil(
      (booking.endDate.getTime() - booking.startDate.getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;

  return {
    bookingId: booking.id,
    tripDays,
    startDate: booking.startDate,
    endDate: booking.endDate,
    hasItinerary: booking.itinerary.length > 0,
    itinerary: booking.itinerary.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date,
      startLocation: day.startLocation,
      endLocation: day.endLocation,
      overnightStop: day.overnightStop,
      description: day.description,
      estimatedKm: day.estimatedKm,
      pickupPoints: day.pickupPoints,
      dropoffPoints: day.dropoffPoints,
    })),
  };
};
