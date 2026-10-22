import prisma from "@travenest/database";

/**
 * Interactive-transaction client type for the project's *extended* Prisma client
 * (the base `Prisma.TransactionClient` does not match the extended `$transaction`
 * callback argument). Derived by omitting the top-level-only client methods.
 */
export type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Resolve the active platform commission rate as a fraction (0..1).
 * Priority: an active PERCENTAGE CommissionRule → platform payment settings →
 * 10% default. Kept dependency-free (prisma only) so both the booking and
 * payment modules can reuse it without an import cycle.
 */
export const getConfiguredCommissionRate = async (): Promise<number> => {
  const activePercentageRule = await prisma.commissionRule.findFirst({
    where: {
      isActive: true,
      type: "PERCENTAGE",
      percentage: { not: null },
    },
    orderBy: [{ createdAt: "desc" }],
    select: { percentage: true },
  });

  if (
    activePercentageRule &&
    activePercentageRule.percentage !== null &&
    activePercentageRule.percentage >= 0 &&
    activePercentageRule.percentage <= 100
  ) {
    return activePercentageRule.percentage / 100;
  }

  const settings = await prisma.platformSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { paymentSettings: true },
  });

  const paymentSettings = settings?.paymentSettings as
    | Record<string, unknown>
    | null
    | undefined;
  const configuredRate =
    typeof paymentSettings?.commissionRate === "number"
      ? paymentSettings.commissionRate
      : null;

  // A fraction; anything above 1 (e.g. 15 entered as a percent) would make
  // the owner's net negative, so it falls back to the default.
  if (configuredRate !== null && configuredRate >= 0 && configuredRate <= 1) {
    return configuredRate;
  }

  // Default platform commission is 10% when no rule or setting is configured.
  return 0.1;
};

const recomputeSettlementTotals = async (
  tx: TxClient,
  settlementId: string,
): Promise<void> => {
  const agg = await tx.settlementBooking.aggregate({
    where: { settlementId },
    _sum: { amount: true, commission: true, net: true },
    _count: { _all: true },
  });
  await tx.settlement.update({
    where: { id: settlementId },
    data: {
      totalBookings: agg._count._all,
      grossAmount: agg._sum.amount ?? 0,
      commissionAmount: agg._sum.commission ?? 0,
      netAmount: agg._sum.net ?? 0,
    },
  });
};

/**
 * Accrue a paid booking into its owner's open (PENDING) settlement for the
 * current period, creating that settlement batch on first accrual. Idempotent —
 * a booking is only ever added once (an existing SettlementBooking short-
 * circuits), so webhook retries are safe. Must run inside a transaction.
 */
export const accrueSettlementForBooking = async (
  tx: TxClient,
  bookingId: string,
): Promise<void> => {
  const existing = await tx.settlementBooking.findFirst({
    where: { bookingId },
    select: { id: true },
  });
  if (existing) return;

  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      totalAmount: true,
      vehicle: { select: { ownerId: true } },
    },
  });
  if (!booking) return;

  const ownerId = booking.vehicle.ownerId;
  const rate = await getConfiguredCommissionRate();
  const gross = booking.totalAmount;
  const commission = Math.round(gross * rate);
  const net = gross - commission;

  const period = new Date().toISOString().slice(0, 7); // YYYY-MM

  let settlement = await tx.settlement.findFirst({
    where: { ownerId, period, status: "PENDING" },
    select: { id: true },
  });

  if (!settlement) {
    const settlementCode = `STL-${period}-${ownerId
      .slice(-6)
      .toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    settlement = await tx.settlement.create({
      data: {
        settlementCode,
        ownerId,
        period,
        totalBookings: 0,
        grossAmount: 0,
        commissionAmount: 0,
        netAmount: 0,
        status: "PENDING",
      },
      select: { id: true },
    });
  }

  await tx.settlementBooking.create({
    data: {
      settlementId: settlement.id,
      bookingId,
      amount: gross,
      commission,
      net,
    },
  });

  await recomputeSettlementTotals(tx, settlement.id);
};

/**
 * Shrink a booking's settlement line to the amount the platform kept after a
 * partial refund (ADR-005): the owner is paid for the retained share. A
 * retained amount of 0 removes the line. Only PENDING settlements change.
 * Runs in a transaction.
 */
export const reduceSettlementForBooking = async (
  tx: TxClient,
  bookingId: string,
  retainedAmount: number,
): Promise<void> => {
  if (retainedAmount <= 0) {
    await removeSettlementForBooking(tx, bookingId);
    return;
  }

  const line = await tx.settlementBooking.findFirst({
    where: { bookingId },
    select: { id: true, settlementId: true, amount: true },
  });
  if (!line || retainedAmount >= line.amount) return;

  const settlement = await tx.settlement.findUnique({
    where: { id: line.settlementId },
    select: { id: true, status: true },
  });
  if (!settlement || settlement.status !== "PENDING") return;

  const rate = await getConfiguredCommissionRate();
  const commission = Math.round(retainedAmount * rate);
  await tx.settlementBooking.update({
    where: { id: line.id },
    data: {
      amount: retainedAmount,
      commission,
      net: retainedAmount - commission,
    },
  });
  await recomputeSettlementTotals(tx, settlement.id);
};

/**
 * Unwind a booking's settlement line item (e.g. when the booking is cancelled /
 * refunded). Only touches settlements that have not yet been paid out (PENDING),
 * so historical/processed payouts stay immutable. Idempotent. Runs in a
 * transaction.
 */
export const removeSettlementForBooking = async (
  tx: TxClient,
  bookingId: string,
): Promise<void> => {
  const line = await tx.settlementBooking.findFirst({
    where: { bookingId },
    select: { id: true, settlementId: true },
  });
  if (!line) return;

  const settlement = await tx.settlement.findUnique({
    where: { id: line.settlementId },
    select: { id: true, status: true },
  });
  if (!settlement || settlement.status !== "PENDING") return;

  await tx.settlementBooking.delete({ where: { id: line.id } });
  await recomputeSettlementTotals(tx, settlement.id);
};
