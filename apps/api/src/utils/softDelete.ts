import prisma from "@travenest/database";
import { ApiError } from "../middleware/errorHandler.js";

// Soft delete (ADR-006): removed rows keep their data and history; reads hide
// them through the database client extension.

const ACTIVE_BOOKING = ["PENDING", "CONFIRMED", "ONGOING"] as const;
const OPEN_DISPUTE = ["OPEN", "INVESTIGATING", "ESCALATED"] as const;
const OPEN_QUOTATION = ["PENDING", "SENT", "VIEWED"] as const;
const UNPAID_SETTLEMENT = ["PENDING", "PROCESSING"] as const;

export const removalStamp = () => ({ isRemoved: true, removedAt: new Date() });

/**
 * Frees a unique value (email, licence plate) held by a removed row so it can
 * be registered again; the original stays readable before the marker.
 */
export const withRemovedSuffix = (value: string, id: string) =>
  `${value}#removed-${id}`;

/** The original value of a unique field freed by withRemovedSuffix. */
export const stripRemovedSuffix = (value: string) =>
  value.replace(/#removed-[^#]*$/, "");

const assertNothingPending = (pending: Record<string, number>) => {
  const labels: Record<string, string> = {
    bookings: "active bookings",
    disputes: "open disputes",
    payouts: "unpaid payouts",
    quotations: "open quotations",
  };
  const blocking = Object.entries(pending)
    .filter(([, count]) => count > 0)
    .map(([key]) => labels[key]);

  if (blocking.length > 0) {
    throw ApiError.badRequest(
      `This can't be removed yet because it still has ${blocking.join(", ")}. Please complete or cancel them first.`,
    );
  }
};

export const assertUserRemovable = async (userId: string) => {
  const [bookings, disputes, payouts, quotations] = await Promise.all([
    prisma.booking.count({
      where: {
        status: { in: [...ACTIVE_BOOKING] },
        OR: [{ customerId: userId }, { vehicle: { ownerId: userId } }],
      },
    }),
    prisma.dispute.count({
      where: {
        status: { in: [...OPEN_DISPUTE] },
        OR: [{ raisedBy: userId }, { raisedAgainst: userId }],
      },
    }),
    prisma.settlement.count({
      where: { ownerId: userId, status: { in: [...UNPAID_SETTLEMENT] } },
    }),
    prisma.quotation.count({
      where: {
        status: { in: [...OPEN_QUOTATION] },
        OR: [{ customerId: userId }, { vehicle: { ownerId: userId } }],
      },
    }),
  ]);

  assertNothingPending({ bookings, disputes, payouts, quotations });
};

export const assertVehicleRemovable = async (vehicleId: string) => {
  const [bookings, disputes, quotations] = await Promise.all([
    prisma.booking.count({
      where: { vehicleId, status: { in: [...ACTIVE_BOOKING] } },
    }),
    prisma.dispute.count({
      where: { status: { in: [...OPEN_DISPUTE] }, booking: { vehicleId } },
    }),
    prisma.quotation.count({
      where: { vehicleId, status: { in: [...OPEN_QUOTATION] } },
    }),
  ]);

  assertNothingPending({ bookings, disputes, quotations });
};

/**
 * Soft-remove an account (self-service or by an admin). Owners' vehicles,
 * packages and drivers are removed with it so their listings disappear; the
 * email is freed for a new registration and all sessions are revoked.
 */
export const removeUserAccount = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    throw ApiError.notFound("User");
  }

  await prisma.$transaction(async (tx) => {
    const vehicles = await tx.vehicle.findMany({
      where: { ownerId: userId },
      select: { id: true, licensePlate: true },
    });
    for (const vehicle of vehicles) {
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          ...removalStamp(),
          licensePlate: withRemovedSuffix(vehicle.licensePlate, vehicle.id),
        },
      });
    }

    await tx.tripPackage.updateMany({
      where: { ownerId: userId, isRemoved: false },
      data: removalStamp(),
    });
    await tx.driver.updateMany({
      where: { ownerId: userId, isRemoved: false },
      data: removalStamp(),
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        ...removalStamp(),
        email: withRemovedSuffix(user.email, userId),
        tokenVersion: { increment: 1 },
      },
    });
  });

  return user;
};
