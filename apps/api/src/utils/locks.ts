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
