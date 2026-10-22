import prisma from "@travenest/database";

const RUN_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
const INITIAL_DELAY_MS = 90 * 1000; // first sweep ~90s after boot
const DEFAULT_AUTO_CANCEL_HOURS = 24;

/**
 * Read the configurable "auto-cancel unpaid reserve" window (hours) from the
 * platform settings, falling back to 24h.
 */
const getAutoCancelHours = async (): Promise<number> => {
  const settings = await prisma.platformSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { bookingSettings: true },
  });
  const bs = settings?.bookingSettings as
    | Record<string, unknown>
    | null
    | undefined;
  const raw = bs?.autoCancelUnpaidHours;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 1
    ? raw
    : DEFAULT_AUTO_CANCEL_HOURS;
};

/**
 * Release PENDING reserves that were never paid within the configured window so
 * the held vehicle dates free up for other customers. Bank-transfer receipts
 * awaiting review (PROCESSING) and cash reserves are left alone. Released:
 * no payment, a still-PENDING non-cash payment, a FAILED payment, or a card
 * checkout abandoned in PROCESSING since before the cutoff (a late PayHere
 * success is then recorded as owed back by the webhook).
 */
export const releaseExpiredReserves = async (): Promise<void> => {
  const hours = await getAutoCancelHours();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const stale = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      OR: [
        { payment: { is: null } },
        { payment: { is: { status: "PENDING", method: { not: "CASH" } } } },
        { payment: { is: { status: "FAILED" } } },
        {
          payment: {
            is: {
              status: "PROCESSING",
              method: "CARD",
              updatedAt: { lt: cutoff },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      quotation: { select: { tripId: true } },
    },
  });

  for (const booking of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        // Conditional: a payment or cancellation may have landed since the read.
        const released = await tx.booking.updateMany({
          where: { id: booking.id, status: "PENDING" },
          data: {
            status: "CANCELLED",
            cancelReason: "Payment not completed within the allowed time",
          },
        });
        if (released.count !== 1) return;

        // Return the parent trip to AWAITING_QUOTES so the customer can request
        // fresh quotations (the sibling quotes were auto-rejected on accept).
        const tripId = booking.quotation?.tripId;
        if (tripId) {
          await tx.trip.updateMany({
            where: { id: tripId, status: "CONFIRMED" },
            data: { status: "AWAITING_QUOTES" },
          });
        }
      });
    } catch (err) {
      console.error(
        `[job:booking-lifecycle] failed to release reserve ${booking.id}`,
        err,
      );
    }
  }

  if (stale.length > 0) {
    console.info(
      `[job:booking-lifecycle] released ${stale.length} unpaid reserve(s)`,
    );
  }
};

/**
 * Expire stale quotations and trips whose time has passed, instead of relying on
 * lazy expiry when a record happens to be opened.
 */
const expireStaleQuotationsAndTrips = async (): Promise<void> => {
  const now = new Date();

  const expiredQuotes = await prisma.quotation.updateMany({
    where: { validUntil: { lt: now }, status: { in: ["SENT", "VIEWED"] } },
    data: { status: "EXPIRED" },
  });

  const expiredTrips = await prisma.trip.updateMany({
    where: {
      endDate: { lt: now },
      status: { in: ["PLANNING", "AWAITING_QUOTES"] },
    },
    data: { status: "EXPIRED" },
  });

  if (expiredQuotes.count > 0 || expiredTrips.count > 0) {
    console.info(
      `[job:booking-lifecycle] expired ${expiredQuotes.count} quotation(s), ${expiredTrips.count} trip(s)`,
    );
  }
};

const runSweep = async (): Promise<void> => {
  await releaseExpiredReserves().catch((err) =>
    console.error("[job:booking-lifecycle] reserve sweep failed", err),
  );
  await expireStaleQuotationsAndTrips().catch((err) =>
    console.error("[job:booking-lifecycle] expiry sweep failed", err),
  );
};

/**
 * Schedule the booking-lifecycle sweeps (unpaid-reserve release + trip/quote
 * expiry). Plain interval — no external scheduler dependency, matching the
 * existing notification-retention job. Timers are unref'd so they never hold the
 * process open during shutdown.
 */
export const startBookingLifecycleJobs = (): void => {
  setTimeout(() => void runSweep(), INITIAL_DELAY_MS).unref?.();
  setInterval(() => void runSweep(), RUN_INTERVAL_MS).unref?.();
};
