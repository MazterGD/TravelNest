import { prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { buildCsv, parsePagination } from "../types.js";
import type {
  BookingStatusUpdateInput,
  CancelWithRefundInput,
} from "./bookings.schemas.js";

type BookingFilters = {
  search?: string;
  status?: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  paymentStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
  startDateFrom?: Date;
  startDateTo?: Date;
};

const buildBookingWhere = (filters: BookingFilters) => {
  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDateFrom || filters.startDateTo) {
    where.startDate = {
      ...(filters.startDateFrom ? { gte: filters.startDateFrom } : {}),
      ...(filters.startDateTo ? { lte: filters.startDateTo } : {}),
    };
  }

  if (filters.paymentStatus) {
    where.payment = {
      is: {
        status: filters.paymentStatus,
      },
    };
  }

  if (filters.search) {
    where.OR = [
      { id: { contains: filters.search, mode: "insensitive" } },
      { pickupLocation: { contains: filters.search, mode: "insensitive" } },
      { dropoffLocation: { contains: filters.search, mode: "insensitive" } },
      {
        customer: {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      },
      {
        vehicle: {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { licensePlate: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      },
      // Allows searching by vehicle owner name/email (e.g. from the admin users page)
      {
        vehicle: {
          owner: {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  return where;
};

export const getBookings = async (
  filters: BookingFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildBookingWhere(filters);

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.limit,
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
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            refundAmount: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    bookings,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getBookingDetails = async (bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
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
      tripPackage: {
        select: {
          id: true,
          title: true,
          startLocation: true,
          endLocation: true,
        },
      },
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          currency: true,
          bankReceiptUrl: true,
          bankReceiptAt: true,
          refundAmount: true,
          refundReason: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          ownerResponse: true,
          createdAt: true,
        },
      },
      itinerary: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  return booking;
};

export const updateBookingStatus = async (
  adminId: string,
  bookingId: string,
  payload: BookingStatusUpdateInput,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: payload.status,
      cancelReason:
        payload.status === "CANCELLED"
          ? payload.reason ?? "Cancelled by admin"
          : null,
    },
    select: {
      id: true,
      status: true,
      cancelReason: true,
      updatedAt: true,
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "BOOKING",
    bookingId,
    {
      previousStatus: booking.status,
      newStatus: payload.status,
      reason: payload.reason,
    },
    `Booking status changed from ${booking.status} to ${payload.status}`,
  );

  return updated;
};

export const cancelBookingWithRefund = async (
  adminId: string,
  bookingId: string,
  payload: CancelWithRefundInput,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          refundAmount: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.status === "CANCELLED") {
    throw new ApiError(400, "Booking is already cancelled");
  }

  const paidAmount = booking.payment?.amount ?? 0;
  const refundAmount = payload.refundAmount ?? paidAmount;

  if (paidAmount > 0 && refundAmount > paidAmount) {
    throw new ApiError(400, "Refund amount cannot exceed paid amount");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelReason: payload.refundReason,
      },
      select: {
        id: true,
        status: true,
        cancelReason: true,
        updatedAt: true,
      },
    });

    let updatedPayment: {
      id: string;
      status: string;
      refundAmount: number | null;
      refundReason: string | null;
      updatedAt: Date;
    } | null = null;

    if (booking.payment) {
      updatedPayment = await tx.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: "REFUNDED",
          refundAmount,
          refundReason: payload.refundReason,
        },
        select: {
          id: true,
          status: true,
          refundAmount: true,
          refundReason: true,
          updatedAt: true,
        },
      });
    }

    return {
      booking: updatedBooking,
      payment: updatedPayment,
    };
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "BOOKING_REFUND",
    bookingId,
    {
      previousStatus: booking.status,
      newStatus: "CANCELLED",
      refundAmount,
      refundReason: payload.refundReason,
      previousPaymentStatus: booking.payment?.status,
      newPaymentStatus: booking.payment ? "REFUNDED" : undefined,
    },
    `Booking cancelled with refund processing${booking.payment ? "" : " (no payment record)"}`,
  );

  return result;
};

export const exportBookingsCsv = async (filters: BookingFilters) => {
  const where = buildBookingWhere(filters);

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
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
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          refundAmount: true,
        },
      },
    },
  });

  const rows = bookings.map((booking) => [
    booking.id,
    booking.customer.id,
    `${booking.customer.firstName} ${booking.customer.lastName}`,
    booking.customer.email,
    booking.vehicle.id,
    booking.vehicle.name,
    booking.vehicle.licensePlate,
    booking.startDate.toISOString(),
    booking.endDate.toISOString(),
    booking.pickupLocation,
    booking.dropoffLocation ?? "",
    booking.totalAmount,
    booking.status,
    booking.payment?.id ?? "",
    booking.payment?.amount ?? "",
    booking.payment?.status ?? "",
    booking.payment?.method ?? "",
    booking.payment?.refundAmount ?? "",
    booking.createdAt.toISOString(),
    booking.updatedAt.toISOString(),
  ]);

  return buildCsv(
    [
      "bookingId",
      "customerId",
      "customerName",
      "customerEmail",
      "vehicleId",
      "vehicleName",
      "vehicleLicensePlate",
      "startDate",
      "endDate",
      "pickupLocation",
      "dropoffLocation",
      "totalAmount",
      "bookingStatus",
      "paymentId",
      "paidAmount",
      "paymentStatus",
      "paymentMethod",
      "refundAmount",
      "createdAt",
      "updatedAt",
    ],
    rows,
  );
};
