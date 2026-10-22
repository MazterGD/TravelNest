import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import type { CreateDriverInput, UpdateDriverInput } from "./driver.schemas.js";

/**
 * List all drivers for an owner, each decorated with assignment counts.
 */
export const listDrivers = async (ownerId: string) => {
  const drivers = await prisma.driver.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bookings: true } },
    },
  });

  // Fetch active (ongoing/confirmed/pending) booking count per driver for analytics.
  const driverIds = drivers.map((d) => d.id);
  const activeBookingCounts = await prisma.booking.groupBy({
    by: ["driverId"],
    where: {
      driverId: { in: driverIds },
      status: { in: ["PENDING", "CONFIRMED", "ONGOING"] },
    },
    _count: { _all: true },
  });
  const activeMap = new Map(
    activeBookingCounts.map((r) => [r.driverId!, r._count._all]),
  );

  return drivers.map((d) => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    photoUrl: d.photoUrl,
    status: d.status,
    totalTrips: d._count.bookings,
    activeTrips: activeMap.get(d.id) ?? 0,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));
};

/**
 * Get a single driver (must belong to ownerId).
 */
export const getDriver = async (driverId: string, ownerId: string) => {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: {
      bookings: {
        orderBy: { startDate: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          pickupLocation: true,
          dropoffLocation: true,
          vehicle: { select: { name: true, licensePlate: true } },
        },
      },
    },
  });

  if (!driver) throw ApiError.notFound("Driver not found");
  if (driver.ownerId !== ownerId) throw ApiError.forbidden("Not your driver");

  return driver;
};

/**
 * Create a new driver in the owner's roster.
 */
export const createDriver = async (
  ownerId: string,
  data: CreateDriverInput,
) => {
  return prisma.driver.create({
    data: {
      ownerId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      photoUrl: data.photoUrl ?? null,
      status: data.status ?? "ACTIVE",
    },
  });
};

/**
 * Update driver details (only owner may update their own drivers).
 */
export const updateDriver = async (
  driverId: string,
  ownerId: string,
  data: UpdateDriverInput,
) => {
  const existing = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!existing) throw ApiError.notFound("Driver not found");
  if (existing.ownerId !== ownerId) throw ApiError.forbidden("Not your driver");

  return prisma.driver.update({
    where: { id: driverId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.phone !== undefined && { phone: data.phone.trim() }),
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });
};

/**
 * Delete a driver — only allowed when they have no active bookings.
 */
export const deleteDriver = async (driverId: string, ownerId: string) => {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw ApiError.notFound("Driver not found");
  if (driver.ownerId !== ownerId) throw ApiError.forbidden("Not your driver");

  const activeBooking = await prisma.booking.findFirst({
    where: {
      driverId,
      status: { in: ["PENDING", "CONFIRMED", "ONGOING"] },
    },
  });
  if (activeBooking) {
    throw ApiError.badRequest(
      "Cannot delete a driver who has active bookings. Mark them inactive instead.",
    );
  }

  // Null out driverId on past bookings before deleting so no FK violation.
  await prisma.booking.updateMany({
    where: { driverId },
    data: { driverId: null },
  });

  await prisma.driver.delete({ where: { id: driverId } });
};

/**
 * Assign a driver from the roster to a booking.
 * Enforces:
 *   1. Driver belongs to owner
 *   2. Driver is ACTIVE
 *   3. Driver has no conflicting booking in the same date range
 */
export const assignDriverToBooking = async (
  bookingId: string,
  ownerId: string,
  driverId: string,
) => {
  const [booking, driver] = await Promise.all([
    prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: { select: { ownerId: true } } },
    }),
    prisma.driver.findUnique({ where: { id: driverId } }),
  ]);

  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.vehicle.ownerId !== ownerId)
    throw ApiError.forbidden("Not authorized to manage this booking");

  if (!driver) throw ApiError.notFound("Driver not found");
  if (driver.ownerId !== ownerId)
    throw ApiError.forbidden("Driver does not belong to you");

  if (driver.status !== "ACTIVE")
    throw ApiError.badRequest("Cannot assign an inactive driver");

  // Check for date-range conflicts with other bookings already assigned to this driver.
  const conflict = await prisma.booking.findFirst({
    where: {
      id: { not: bookingId },
      driverId,
      status: { in: ["PENDING", "CONFIRMED", "ONGOING"] },
      startDate: { lte: booking.endDate },
      endDate: { gte: booking.startDate },
    },
  });

  if (conflict) {
    throw ApiError.conflict(
      `${driver.name} is already assigned to another booking on overlapping dates (${conflict.startDate.toLocaleDateString()} – ${conflict.endDate.toLocaleDateString()}).`,
    );
  }

  // Update booking — also denormalize name/phone for quick joins.
  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      driverId,
      driverName: driver.name,
      driverPhone: driver.phone,
      // license lives on the booking as free text; not part of the Driver model.
    },
    include: {
      driver: { select: { id: true, name: true, phone: true, photoUrl: true } },
    },
  });
};

/**
 * Remove driver assignment from a booking.
 */
export const unassignDriverFromBooking = async (
  bookingId: string,
  ownerId: string,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: { select: { ownerId: true } } },
  });

  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.vehicle.ownerId !== ownerId)
    throw ApiError.forbidden("Not authorized");

  return prisma.booking.update({
    where: { id: bookingId },
    data: { driverId: null, driverName: null, driverPhone: null },
  });
};

/**
 * Return drivers available (no conflicting active booking) for the given date range.
 */
export const getAvailableDrivers = async (
  ownerId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string,
) => {
  const allDrivers = await prisma.driver.findMany({
    where: { ownerId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  // Drivers with a conflicting booking in the date range.
  const conflictWhere: any = {
    driverId: { in: allDrivers.map((d) => d.id) },
    status: { in: ["PENDING", "CONFIRMED", "ONGOING"] },
    startDate: { lte: endDate },
    endDate: { gte: startDate },
  };
  if (excludeBookingId) {
    conflictWhere.id = { not: excludeBookingId };
  }

  const conflicting = await prisma.booking.findMany({
    where: conflictWhere,
    select: { driverId: true },
  });
  const busyIds = new Set(conflicting.map((b) => b.driverId));

  return allDrivers
    .filter((d) => !busyIds.has(d.id))
    .map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      photoUrl: d.photoUrl,
      status: d.status,
    }));
};
