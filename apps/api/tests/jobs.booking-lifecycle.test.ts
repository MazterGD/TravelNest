/**
 * Unpaid-reserve sweep (PAY-7): abandoned reserves are released, while cash
 * reserves and bank transfers awaiting review stay held (context.md).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./setup";
import { releaseExpiredReserves } from "../src/jobs/bookingLifecycle";

const PREFIX = "lifecycle.job";
const DAY = 24 * 60 * 60 * 1000;
const OLD = new Date(Date.now() - 3 * DAY);

describe("releaseExpiredReserves", () => {
  let customerId = "";
  let vehicleId = "";

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: "LIFE-JOB-1" } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  beforeAll(async () => {
    await cleanup();
    const customer = await prisma.user.create({
      data: {
        email: `${PREFIX}.customer@example.com`,
        password: "hashed",
        firstName: "Life",
        lastName: "Customer",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    customerId = customer.id;
    const owner = await prisma.user.create({
      data: {
        email: `${PREFIX}.owner@example.com`,
        password: "hashed",
        firstName: "Life",
        lastName: "Owner",
        role: "VEHICLE_OWNER",
        status: "ACTIVE",
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: owner.id,
        name: "Lifecycle Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "LIFE-JOB-1",
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(cleanup);

  const reserve = async (options: {
    createdAt?: Date;
    payment?: {
      method: "CARD" | "BANK_TRANSFER" | "CASH";
      status: "PENDING" | "PROCESSING" | "FAILED";
      updatedAt?: Date;
    };
  }) => {
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        startDate: new Date(Date.now() + 30 * DAY),
        endDate: new Date(Date.now() + 31 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 20000,
        status: "PENDING",
        createdAt: options.createdAt ?? OLD,
        ...(options.payment && {
          payment: {
            create: {
              userId: customerId,
              amount: 20000,
              currency: "LKR",
              method: options.payment.method,
              status: options.payment.status,
            },
          },
        }),
      },
      include: { payment: true },
    });
    if (options.payment?.updatedAt) {
      await prisma.$executeRaw`UPDATE payments SET "updatedAt" = ${options.payment.updatedAt} WHERE id = ${booking.payment!.id}`;
    }
    return booking.id;
  };

  const statusOf = async (bookingId: string) =>
    (await prisma.booking.findUnique({ where: { id: bookingId } }))?.status;

  it("releases abandoned reserves and keeps the documented exemptions", async () => {
    const noPayment = await reserve({});
    const abandonedCard = await reserve({
      payment: { method: "CARD", status: "PROCESSING", updatedAt: OLD },
    });
    const failed = await reserve({
      payment: { method: "CARD", status: "FAILED" },
    });
    const bankReceipt = await reserve({
      payment: { method: "BANK_TRANSFER", status: "PROCESSING" },
    });
    const cash = await reserve({
      payment: { method: "CASH", status: "PENDING" },
    });
    const activeCheckout = await reserve({
      payment: { method: "CARD", status: "PROCESSING" },
    });
    const fresh = await reserve({ createdAt: new Date() });

    await releaseExpiredReserves();

    expect(await statusOf(noPayment)).toBe("CANCELLED");
    expect(await statusOf(abandonedCard)).toBe("CANCELLED");
    expect(await statusOf(failed)).toBe("CANCELLED");
    expect(await statusOf(bankReceipt)).toBe("PENDING");
    expect(await statusOf(cash)).toBe("PENDING");
    expect(await statusOf(activeCheckout)).toBe("PENDING");
    expect(await statusOf(fresh)).toBe("PENDING");
  });
});
