import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { config } from "../../config/index.js";
import { executePayHereRefund } from "../payment/payment.service.js";
import {
  getConfiguredCommissionRate,
  reduceSettlementForBooking,
  removeSettlementForBooking,
} from "../payment/settlement.service.js";
import { dispatchNotification } from "../notification/notification.service.js";
import {
  bookingCancelledToOwner,
  bookingPlacedToCustomer,
  bookingRejectedToCustomer,
  bookingRequestedToOwner,
  driverAssignedToCustomer,
} from "../notification/notification.events.js";
import { stripRemovedSuffix } from "../../utils/softDelete.js";
import { lockVehicleForBooking } from "../../utils/locks.js";

/**
 * Time-based cancellation refund policy. Values are configurable by admins via
 * platform settings (booking settings); these are the fallback defaults.
 */
interface RefundPolicy {
  fullRefundHours: number;
  partialRefundHours: number;
  partialRefundPercent: number;
}

const DEFAULT_REFUND_POLICY: RefundPolicy = {
  fullRefundHours: 336, // >= 14 days before start -> 100%
  partialRefundHours: 168, // >= 7 days before start -> partial %
  partialRefundPercent: 50, // otherwise 0%
};

const getRefundPolicy = async (): Promise<RefundPolicy> => {
  const settings = await prisma.platformSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { bookingSettings: true },
  });
  const bs = settings?.bookingSettings as Record<string, unknown> | null | undefined;
  const num = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : fallback;
  return {
    fullRefundHours: num(bs?.refundFullHours, DEFAULT_REFUND_POLICY.fullRefundHours),
    partialRefundHours: num(
      bs?.refundPartialHours,
      DEFAULT_REFUND_POLICY.partialRefundHours,
    ),
    partialRefundPercent: num(
      bs?.refundPartialPercent,
      DEFAULT_REFUND_POLICY.partialRefundPercent,
    ),
  };
};

const computeRefundPercent = (
  policy: RefundPolicy,
  hoursUntilStart: number,
): number => {
  if (hoursUntilStart >= policy.fullRefundHours) return 100;
  if (hoursUntilStart >= policy.partialRefundHours) {
    return policy.partialRefundPercent;
  }
  return 0;
};

export interface BookingQuery {
  status?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  vehicleType?: string;
  sort?: string;
}

/**
 * Get customer's bookings
 */
export const getCustomerBookings = async (
  customerId: string,
  query: BookingQuery,
) => {
  const {
    status,
    page = 1,
    limit = 10,
    startDate,
    endDate,
    vehicleType,
    sort = "createdAt_desc",
  } = query;
  const skip = (page - 1) * limit;

  const where: any = { customerId };

  if (status && typeof status === "string") {
    where.status = status.toUpperCase();
  }

  if (startDate || endDate) {
    where.startDate = {};
    if (startDate) where.startDate.gte = new Date(startDate);
    if (endDate) where.startDate.lte = new Date(endDate);
  }

  if (vehicleType && typeof vehicleType === "string") {
    where.vehicle = { type: vehicleType.toUpperCase() };
  }

  const [sortField, sortDir] = sort.split("_");
  const sortDirection = sortDir === "asc" ? "asc" : "desc";
  const sortFieldMap: Record<string, string> = {
    createdAt: "createdAt",
    startDate: "startDate",
    totalAmount: "totalAmount",
  };
  const orderBy = {
    [sortFieldMap[sortField] || "createdAt"]: sortDirection,
  };

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
            isRemoved: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                isRemoved: true,
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
      orderBy,
    }),
    prisma.booking.count({ where }),
  ]);

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
    vehicleType: booking.vehicle.type,
    vehicleImage: booking.vehicle.images[0] || null,
    vehicleRemoved: booking.vehicle.isRemoved,
    ownerName: `${booking.vehicle.owner.firstName} ${booking.vehicle.owner.lastName}`,
    // A removed operator keeps their name on past trips but not their contact
    ownerPhone: booking.vehicle.owner.isRemoved
      ? ""
      : booking.vehicle.owner.phone || "",
    ownerRemoved: booking.vehicle.owner.isRemoved,
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
          isRemoved: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          name: true,
          licensePlate: true,
          isRemoved: true,
          type: true,
          brand: true,
          model: true,
          seats: true,
          images: true,
          amenities: true,
          features: true,
          fuelType: true,
          transmission: true,
          acType: true,
          year: true,
          color: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              avatar: true,
              createdAt: true,
              isRemoved: true,
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
          updatedAt: true,
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

  // Read commission rate from configured rules/settings instead of hardcoding.
  const platformCommissionRate = await getConfiguredCommissionRate();
  const platformCommission = booking.totalAmount * platformCommissionRate;
  const netAmount = booking.totalAmount - platformCommission;

  // Derive cost breakdown from the linked quotation (stored in notes as
  // "Booking created from quotation QUO-xxxxx").
  let breakdown: {
    basePrice: number;
    driverAllowance: number;
    additionalCharges: number;
    subtotal: number;
    tax: number;
    customItems: Array<{ description: string; amount: number }>;
  } | null = null;

  let itineraryStops: any[] | null = null;
  let itineraryRoute: any | null = null;
  let startTime: string | null = null;
  let tripEstimatedDistance: string | null = booking.estimatedDistance;
  let tripEstimatedDuration: string | null = booking.estimatedDuration;
  let pickupLatitude: number | null = null;
  let pickupLongitude: number | null = null;
  let dropoffLatitude: number | null = null;
  let dropoffLongitude: number | null = null;

  // Prefer the direct FK; fall back to the QUO- code embedded in notes for
  // legacy bookings created before the foreign key existed.
  const quotationIdMatch = booking.notes?.match(/(QUO-[\w-]+)/);
  const quotationWhere = booking.quotationId
    ? { id: booking.quotationId }
    : quotationIdMatch
      ? { quotationId: quotationIdMatch[1] }
      : null;
  if (quotationWhere) {
    const quotation = await prisma.quotation.findUnique({
      where: quotationWhere,
      select: {
        id: true,
        tripId: true,
        startTime: true,
        estimatedDistance: true,
        estimatedDuration: true,
        vehicleRentalCost: true,
        driverCost: true,
        fuelCost: true,
        tollCharges: true,
        permitFees: true,
        customItems: true,
        subtotal: true,
        tax: true,
        trip: {
          select: {
            pickupLatitude: true,
            pickupLongitude: true,
            dropoffLatitude: true,
            dropoffLongitude: true,
          },
        },
      },
    });
    if (quotation) {
      const additionalCharges =
        (quotation.fuelCost ?? 0) +
        (quotation.tollCharges ?? 0) +
        (quotation.permitFees ?? 0);
      const baseAndDriver =
        (quotation.vehicleRentalCost ?? 0) + (quotation.driverCost ?? 0);
      const hasAnyBreakdown =
        (quotation.vehicleRentalCost ?? 0) > 0 ||
        (quotation.driverCost ?? 0) > 0 ||
        additionalCharges > 0;

      if (hasAnyBreakdown) {
        breakdown = {
          basePrice: quotation.vehicleRentalCost ?? 0,
          driverAllowance: quotation.driverCost ?? 0,
          additionalCharges,
          subtotal: quotation.subtotal ?? baseAndDriver + additionalCharges,
          tax: quotation.tax ?? 0,
          customItems: Array.isArray(quotation.customItems)
            ? (quotation.customItems as any[])
            : [],
        };
      }

      startTime = quotation.startTime ?? null;
      tripEstimatedDistance =
        tripEstimatedDistance || quotation.estimatedDistance || null;
      tripEstimatedDuration =
        tripEstimatedDuration || quotation.estimatedDuration || null;

      // Pull pickup/dropoff coordinates from the linked Trip record so the
      // booking detail map can render the full route with correct start/end pins.
      if (quotation.trip) {
        pickupLatitude = quotation.trip.pickupLatitude ?? null;
        pickupLongitude = quotation.trip.pickupLongitude ?? null;
        dropoffLatitude = quotation.trip.dropoffLatitude ?? null;
        dropoffLongitude = quotation.trip.dropoffLongitude ?? null;
      }

      const [stopsRaw, routeRaw] = await Promise.all([
        (prisma as any)
          .$queryRawUnsafe(
            `SELECT "id", "stopOrder", "locationName", ST_AsGeoJSON(coordinates) as coordinates FROM "itinerary_stops" WHERE "quotationId" = $1 ORDER BY "stopOrder" ASC`,
            quotation.id,
          )
          .catch(() => []),
        (prisma as any)
          .$queryRawUnsafe(
            `SELECT "id", ST_AsGeoJSON("routeGeometry") as "routeGeometry" FROM "itinerary_routes" WHERE "quotationId" = $1`,
            quotation.id,
          )
          .catch(() => []),
      ]);

      if (stopsRaw && stopsRaw.length > 0) {
        itineraryStops = stopsRaw.map((s: any) => ({
          ...s,
          coordinates: s.coordinates
            ? JSON.parse(s.coordinates).coordinates
            : null,
        }));
      }

      if (routeRaw && routeRaw.length > 0) {
        itineraryRoute = {
          ...routeRaw[0],
          coordinates: routeRaw[0].routeGeometry
            ? JSON.parse(routeRaw[0].routeGeometry).coordinates
            : null,
        };
      }

      // Fallback: trip-level itinerary JSON (used when ItineraryStop rows
      // were not captured at quote time but the customer drew stops on the trip).
      if (
        (!itineraryStops || itineraryStops.length === 0) &&
        quotation.tripId
      ) {
        const trip = await prisma.trip.findUnique({
          where: { id: quotation.tripId },
          select: {
            startTime: true,
            itineraryStops: true,
            itineraryRoute: true,
            estimatedDistance: true,
            estimatedDuration: true,
            pickupLatitude: true,
            pickupLongitude: true,
            dropoffLatitude: true,
            dropoffLongitude: true,
          },
        });
        if (trip) {
          startTime = startTime || trip.startTime || null;
          tripEstimatedDistance =
            tripEstimatedDistance || trip.estimatedDistance || null;
          tripEstimatedDuration =
            tripEstimatedDuration || trip.estimatedDuration || null;
          if (Array.isArray(trip.itineraryStops)) {
            itineraryStops = (trip.itineraryStops as any[]).map((s: any) => ({
              locationName: s.locationName ?? s.name ?? null,
              stopOrder: s.order ?? s.stopOrder ?? null,
              coordinates:
                Array.isArray(s.coordinates) && s.coordinates.length === 2
                  ? s.coordinates
                  : s.lng != null && s.lat != null
                    ? [s.lng, s.lat]
                    : null,
            }));
          }
          if (
            !itineraryRoute &&
            trip.itineraryRoute &&
            typeof trip.itineraryRoute === "object"
          ) {
            itineraryRoute = trip.itineraryRoute as any;
          }
          if (pickupLatitude == null && trip.pickupLatitude != null) pickupLatitude = trip.pickupLatitude;
          if (pickupLongitude == null && trip.pickupLongitude != null) pickupLongitude = trip.pickupLongitude;
          if (dropoffLatitude == null && trip.dropoffLatitude != null) dropoffLatitude = trip.dropoffLatitude;
          if (dropoffLongitude == null && trip.dropoffLongitude != null) dropoffLongitude = trip.dropoffLongitude;
        }
      }
    }
  }

  // Aggregate owner reputation and trip count for trust display.
  const [ownerReviewAgg, ownerCompletedTrips] = await Promise.all([
    prisma.review.aggregate({
      where: { vehicle: { ownerId: booking.vehicle.ownerId } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.booking.count({
      where: {
        vehicle: { ownerId: booking.vehicle.ownerId },
        status: "COMPLETED",
      },
    }),
  ]);

  // Derived timeline from existing state. A persisted state-transitions
  // table is a roadmap item; until then, we surface the events we can
  // confidently anchor to existing timestamps.
  const timeline: Array<{
    event: string;
    timestamp: string;
    description?: string;
  }> = [];
  timeline.push({
    event: "booking_created",
    timestamp: booking.createdAt.toISOString(),
  });
  if (booking.payment?.status === "COMPLETED") {
    timeline.push({
      event: "payment_received",
      timestamp: (
        booking.payment.updatedAt ?? booking.payment.createdAt
      ).toISOString(),
      description: booking.payment.method || undefined,
    });
  }
  if (
    booking.status === "CONFIRMED" ||
    booking.status === "ONGOING" ||
    booking.status === "COMPLETED"
  ) {
    timeline.push({
      event: "booking_confirmed",
      timestamp: booking.updatedAt.toISOString(),
    });
  }
  if (booking.driverName) {
    timeline.push({
      event: "driver_assigned",
      timestamp: booking.updatedAt.toISOString(),
      description: booking.driverName,
    });
  }
  const now = new Date();
  if (
    (booking.status === "ONGOING" || booking.status === "COMPLETED") &&
    booking.startDate <= now
  ) {
    timeline.push({
      event: "trip_started",
      timestamp: booking.startDate.toISOString(),
    });
  }
  if (booking.status === "COMPLETED" && booking.endDate <= now) {
    timeline.push({
      event: "trip_completed",
      timestamp: booking.endDate.toISOString(),
    });
  }
  if (booking.status === "CANCELLED") {
    timeline.push({
      event: "booking_cancelled",
      timestamp: booking.updatedAt.toISOString(),
      description: booking.cancelReason || undefined,
    });
  }
  timeline.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (!startTime) {
    const hh = String(booking.startDate.getUTCHours()).padStart(2, "0");
    const mm = String(booking.startDate.getUTCMinutes()).padStart(2, "0");
    startTime = `${hh}:${mm}`;
  }

  return {
    id: booking.id,
    bookingRef: `BK-${booking.id.slice(0, 8).toUpperCase()}`,
    // Removed accounts (ADR-006) keep their name on past trips, not contacts.
    customer: {
      id: booking.customer.id,
      name: `${booking.customer.firstName} ${booking.customer.lastName}`,
      phone: booking.customer.isRemoved ? "" : booking.customer.phone || "",
      email: booking.customer.isRemoved ? "" : booking.customer.email,
      isRemoved: booking.customer.isRemoved,
    },
    vehicle: {
      id: booking.vehicle.id,
      name: booking.vehicle.name,
      registration: stripRemovedSuffix(booking.vehicle.licensePlate),
      isRemoved: booking.vehicle.isRemoved,
      type: booking.vehicle.type,
      brand: booking.vehicle.brand,
      model: booking.vehicle.model,
      year: booking.vehicle.year,
      color: booking.vehicle.color,
      capacity: booking.vehicle.seats,
      image: booking.vehicle.images[0] || null,
      images: booking.vehicle.images || [],
      amenities: booking.vehicle.amenities || [],
      features: booking.vehicle.features || null,
      fuelType: booking.vehicle.fuelType,
      transmission: booking.vehicle.transmission,
      acType: booking.vehicle.acType,
    },
    owner: {
      id: booking.vehicle.owner.id,
      name: `${booking.vehicle.owner.firstName} ${booking.vehicle.owner.lastName}`,
      phone: booking.vehicle.owner.isRemoved
        ? ""
        : booking.vehicle.owner.phone || "",
      email: booking.vehicle.owner.isRemoved ? "" : booking.vehicle.owner.email,
      isRemoved: booking.vehicle.owner.isRemoved,
      avatar: booking.vehicle.owner.avatar || null,
      memberSince: booking.vehicle.owner.createdAt.toISOString(),
      rating: ownerReviewAgg._avg.rating
        ? Number(ownerReviewAgg._avg.rating.toFixed(2))
        : 0,
      reviewCount: ownerReviewAgg._count._all,
      completedTrips: ownerCompletedTrips,
    },
    trip: {
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      startTime,
      pickupLocation: booking.pickupLocation,
      pickupLatitude,
      pickupLongitude,
      dropoffLocation: booking.dropoffLocation || booking.pickupLocation,
      dropoffLatitude,
      dropoffLongitude,
      passengers: booking.totalPassengers || 0,
      estimatedDistance: tripEstimatedDistance,
      estimatedDuration: tripEstimatedDuration,
      itineraryStops,
      itineraryRoute,
    },
    driver: booking.driverName
      ? {
          id: booking.driverId,
          name: booking.driverName,
          phone: booking.driverPhone,
          license: booking.driverLicense,
        }
      : null,
    payment: {
      id: booking.payment?.id || null,
      total: booking.totalAmount,
      paid: booking.payment?.amount || 0,
      status: booking.payment?.status?.toLowerCase() || "pending",
      method: booking.payment?.method || "Pending",
      receiptUrl: booking.payment?.bankReceiptUrl || null,
      paidAt: booking.payment?.updatedAt?.toISOString() || null,
      commissionRate: platformCommissionRate,
      platformCommission,
      netAmount,
      breakdown,
    },
    timeline,
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
 * Owner (or admin) cancels a booking. Allowed before the trip starts; a paid
 * booking is refunded in full because the cancellation is not the customer's
 * fault, the calendar is released and the owner's settlement line removed.
 */
export const cancelBookingByOwner = async (
  bookingId: string,
  actor: { id: string; role: string },
  reason?: string,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      customerId: true,
      vehicleId: true,
      vehicle: { select: { ownerId: true } },
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          method: true,
          payherePaymentId: true,
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking");
  }

  if (booking.vehicle.ownerId !== actor.id && actor.role !== "ADMIN") {
    throw ApiError.forbidden("Not authorized");
  }

  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    throw ApiError.badRequest(
      "Only pending or confirmed bookings can be cancelled.",
    );
  }

  const cancelReason = reason || "Rejected by owner";
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, status: booking.status },
    data: { status: "CANCELLED", cancelReason },
  });
  if (claimed.count !== 1) {
    throw ApiError.conflict("This booking was just updated. Please refresh.");
  }

  const payment = booking.payment;
  const refundAmount =
    payment && payment.status === "COMPLETED" ? payment.amount : 0;

  if (
    refundAmount > 0 &&
    payment?.method === "CARD" &&
    payment.payherePaymentId &&
    config.payhere.appId &&
    config.payhere.appSecret
  ) {
    try {
      await executePayHereRefund(
        payment.payherePaymentId,
        refundAmount,
        cancelReason,
      );
    } catch (error) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: booking.status, cancelReason: null },
      });
      throw error;
    }
  }

  const updatedBooking = await prisma.$transaction(async (tx) => {
    if (refundAmount > 0 && payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED", refundAmount, refundReason: cancelReason },
      });
    }

    await tx.vehicleAvailability.deleteMany({
      where: { vehicleId: booking.vehicleId, reason: `Booking ${bookingId}` },
    });

    await removeSettlementForBooking(tx, bookingId);

    return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  });

  dispatchNotification(
    bookingRejectedToCustomer(booking.customerId, { bookingId }),
  );

  return updatedBooking;
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
      vehicleId: true,
      status: true,
      startDate: true,
      vehicle: { select: { ownerId: true } },
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          method: true,
          payherePaymentId: true,
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.customerId !== customerId) {
    throw ApiError.forbidden("Not authorized to cancel this booking");
  }

  // Ongoing / completed / already-cancelled bookings can no longer be cancelled.
  const nonCancellableStatuses = ["ONGOING", "COMPLETED", "CANCELLED"];
  if (nonCancellableStatuses.includes(booking.status)) {
    throw ApiError.badRequest(
      `Cannot cancel booking with status: ${booking.status}`,
    );
  }

  // Time-based refund policy. A paid booking is refunded per how far ahead of
  // the trip the customer cancels; an unpaid PENDING reserve simply releases.
  const now = new Date();
  const hoursUntilStart =
    (new Date(booking.startDate).getTime() - now.getTime()) / (1000 * 60 * 60);
  const policy = await getRefundPolicy();
  const refundPercent = computeRefundPercent(policy, hoursUntilStart);

  const paidAmount =
    booking.payment && booking.payment.status === "COMPLETED"
      ? booking.payment.amount
      : 0;
  const refundAmount =
    paidAmount > 0 ? Math.round((paidAmount * refundPercent) / 100) : 0;

  // Claim the cancellation first so a concurrent cancel cannot also trigger a
  // gateway refund (ADR-004).
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, status: booking.status },
    data: { status: "CANCELLED", cancelReason: reason },
  });
  if (claimed.count !== 1) {
    throw ApiError.conflict("This booking was just updated. Please refresh.");
  }

  // Execute a real gateway refund for card payments when PayHere is configured;
  // otherwise the computed refund is recorded for the admin payout to honour.
  if (
    refundAmount > 0 &&
    booking.payment?.method === "CARD" &&
    booking.payment.payherePaymentId &&
    config.payhere.appId &&
    config.payhere.appSecret
  ) {
    try {
      await executePayHereRefund(
        booking.payment.payherePaymentId,
        refundAmount,
        reason || "Booking cancelled",
      );
    } catch (error) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: booking.status, cancelReason: null },
      });
      throw error;
    }
  }

  const updatedBooking = await prisma.$transaction(async (tx) => {
    if (refundAmount > 0 && booking.payment) {
      await tx.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: "REFUNDED",
          refundAmount,
          refundReason: reason || "Booking cancelled",
        },
      });
    }

    // Release the availability block created when the booking was paid.
    await tx.vehicleAvailability.deleteMany({
      where: { vehicleId: booking.vehicleId, reason: `Booking ${bookingId}` },
    });

    // The owner keeps the share the customer is not refunded (ADR-005); a full
    // refund or an unpaid reserve removes the settlement line entirely.
    await reduceSettlementForBooking(tx, bookingId, paidAmount - refundAmount);

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED", cancelReason: reason },
    });
  });

  dispatchNotification(
    bookingCancelledToOwner(booking.vehicle.ownerId, { bookingId }),
  );

  return {
    ...updatedBooking,
    refund: {
      policyPercent: refundPercent,
      amount: refundAmount,
      currency: "LKR",
    },
  };
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
    await lockVehicleForBooking(tx, quotation.vehicleId!);
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

    // Create the booking as a PENDING reserve, mirroring the accept flow so
    // both entry points produce identical bookings (FK + QUO- reference).
    return tx.booking.create({
      data: {
        customerId,
        vehicleId: quotation.vehicleId!,
        quotationId: quotation.id,
        startDate: quotation.startDate,
        endDate: quotation.endDate,
        pickupLocation: quotation.pickupLocation,
        dropoffLocation: quotation.dropoffLocation,
        totalPassengers: quotation.passengerCount,
        totalAmount: quotation.totalAmount || 0,
        status: "PENDING",
        notes: `Booking created from quotation ${quotation.quotationId}. ${quotation.specialRequests || ""}`,
        // Include trip details from quotation
        estimatedDistance: quotation.estimatedDistance,
        estimatedDuration: quotation.estimatedDuration,
      },
    });
  });

  const route = `${quotation.pickupLocation} → ${
    quotation.dropoffLocation || quotation.pickupLocation
  }`;
  dispatchNotification(
    bookingRequestedToOwner(quotation.vehicle.ownerId, {
      bookingId: booking.id,
      route,
    }),
  );
  dispatchNotification(
    bookingPlacedToCustomer(customerId, { bookingId: booking.id }),
  );

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

  dispatchNotification(
    driverAssignedToCustomer(updatedBooking.customer.id, {
      bookingId: updatedBooking.id,
    }),
  );

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
