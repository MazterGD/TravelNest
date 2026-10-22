import type prisma from "@travenest/database";

type RawQueryClient = Pick<typeof prisma, "$queryRaw">;

/**
 * Serialise booking creation for one vehicle until the surrounding transaction
 * ends, so two concurrent requests cannot both pass the date-overlap check
 * (ADR-004). Selecting a constant avoids deserialising the void return value.
 */
export const lockVehicleForBooking = async (
  tx: RawQueryClient,
  vehicleId: string,
): Promise<void> => {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${vehicleId}))`;
};

/**
 * Serialise changes to one owner's settlements until the surrounding
 * transaction ends, so a booking is never accrued into a settlement that is
 * being paid out at the same moment.
 */
export const lockOwnerSettlements = async (
  tx: RawQueryClient,
  ownerId: string,
): Promise<void> => {
  const key = `settlement:${ownerId}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
};
