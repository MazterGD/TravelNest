/**
 * The scheduled booking-lifecycle sweep: releasing an unpaid reserve reopens
 * its trip for fresh quotes, and stale quotations and trips expire.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import db from "@travenest/database";
import { prisma } from "./setup";
import { startBookingLifecycleJobs } from "../src/jobs/bookingLifecycle";

const PREFIX = `life-sweep-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;

const captureSweeps = () => {
  const callbacks: Array<() => void> = [];
  const timer = { unref: () => timer };
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
    callbacks.push(fn);
    return timer;
  }) as unknown as typeof setTimeout);
  vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void) => {
    callbacks.push(fn);
    return timer;
  }) as unknown as typeof setInterval);
  startBookingLifecycleJobs();
  vi.mocked(globalThis.setTimeout).mockRestore();
  vi.mocked(globalThis.setInterval).mockRestore();
  return callbacks;
};

describe("booking lifecycle sweep", () => {
  const ids = { customer: "", vehicle: "", trip: "", staleTrip: "", booking: "", quote: "", staleQuote: "" };

  const cleanup = async () => {
    const users = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.booking.deleteMany({ where: { customerId: { in: users } } });
    await prisma.quotation.deleteMany({ where: { customerId: { in: users } } });
    await prisma.trip.deleteMany({ where: { customerId: { in: users } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  };

  beforeAll(async () => {
    await cleanup();
    const customer = await prisma.user.create({
      data: { email: `${PREFIX}.c@example.com`, password: "x", firstName: "C", lastName: "T", role: "CUSTOMER", status: "ACTIVE" },
    });
    const owner = await prisma.user.create({
      data: { email: `${PREFIX}.o@example.com`, password: "x", firstName: "O", lastName: "T", role: "VEHICLE_OWNER", status: "ACTIVE" },
    });
    ids.customer = customer.id;
    ids.vehicle = (
      await prisma.vehicle.create({
        data: {
          ownerId: owner.id,
          name: `${PREFIX} bus`,
          type: "ORDINARY",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: "LSZ-9911",
          seats: 30,
          fuelType: "DIESEL",
          transmission: "MANUAL",
          pricePerDay: 15000,
          location: "Colombo",
          images: [],
          amenities: [],
        },
      })
    ).id;
    const trip = (overrides: Record<string, unknown>) =>
      prisma.trip.create({
        data: {
          tripCode: `TRP-${PREFIX}-${Math.random().toString(36).slice(2, 8)}`,
          customerId: ids.customer,
          pickupLocation: "Colombo",
          startDate: new Date(Date.now() + 20 * DAY),
          endDate: new Date(Date.now() + 21 * DAY),
          passengerCount: 10,
          ...overrides,
        },
      });
    ids.trip = (await trip({ status: "CONFIRMED" })).id;
    ids.staleTrip = (
      await trip({
        status: "AWAITING_QUOTES",
        startDate: new Date(Date.now() - 3 * DAY),
        endDate: new Date(Date.now() - 2 * DAY),
      })
    ).id;
    const quote = (overrides: Record<string, unknown>) =>
      prisma.quotation.create({
        data: {
          quotationId: `QUO-${PREFIX}-${Math.random().toString(36).slice(2, 8)}`,
          customerId: ids.customer,
          vehicleId: ids.vehicle,
          startDate: new Date(Date.now() + 20 * DAY),
          endDate: new Date(Date.now() + 21 * DAY),
          pickupLocation: "Colombo",
          ...overrides,
        },
      });
    ids.quote = (await quote({ tripId: ids.trip, status: "ACCEPTED" })).id;
    ids.staleQuote = (await quote({ status: "SENT", validUntil: new Date(Date.now() - DAY) })).id;
    ids.booking = (
      await prisma.booking.create({
        data: {
          customerId: ids.customer,
          vehicleId: ids.vehicle,
          quotationId: ids.quote,
          startDate: new Date(Date.now() + 20 * DAY),
          endDate: new Date(Date.now() + 21 * DAY),
          pickupLocation: "Colombo",
          totalAmount: 20000,
          status: "PENDING",
          createdAt: new Date(Date.now() - 3 * DAY),
        },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("schedules a first sweep and a repeating one", () => {
    expect(captureSweeps()).toHaveLength(2);
  });

  it("releases the unpaid reserve, reopens its trip and expires stale quotes and trips", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const [firstSweep] = captureSweeps();

    firstSweep();

    await expect
      .poll(async () => (await prisma.trip.findUnique({ where: { id: ids.staleTrip } }))?.status)
      .toBe("EXPIRED");
    expect((await prisma.booking.findUnique({ where: { id: ids.booking } }))?.status).toBe("CANCELLED");
    expect((await prisma.trip.findUnique({ where: { id: ids.trip } }))?.status).toBe("AWAITING_QUOTES");
    expect((await prisma.quotation.findUnique({ where: { id: ids.staleQuote } }))?.status).toBe("EXPIRED");
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/released \d+ unpaid reserve/));
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/expired \d+ quotation/));
  });

  it("logs and survives a failing sweep", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db.platformSettings, "findFirst").mockRejectedValue(new Error("db down"));
    vi.spyOn(db.quotation, "updateMany").mockRejectedValue(new Error("db down"));
    const [firstSweep] = captureSweeps();

    firstSweep();

    await vi.waitFor(() => {
      expect(errors).toHaveBeenCalledWith("[job:booking-lifecycle] reserve sweep failed", expect.any(Error));
      expect(errors).toHaveBeenCalledWith("[job:booking-lifecycle] expiry sweep failed", expect.any(Error));
    });
  });
});
