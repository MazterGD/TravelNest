/**
 * Security regression tests: files are stored only after the caller is
 * allowed to attach them (OBJ-6, PAY-14).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";

const uploadBuffer = vi.fn();
const uploadPrivateBuffer = vi.fn();

vi.mock("../src/utils/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/storage")>();
  return {
    ...actual,
    uploadBuffer: (...args: unknown[]) => uploadBuffer(...args),
    uploadPrivateBuffer: (...args: unknown[]) => uploadPrivateBuffer(...args),
  };
});

const { default: app } = await import("../src/app");
const { config } = await import("../src/config/index");

const API_BASE = "/api/v1";
const PREFIX = "sec.uploadorder";
const DAY = 24 * 60 * 60 * 1000;

describe("Upload authorization happens before storage", () => {
  let vehicleId = "";
  let paymentOnCancelled = "";
  let paymentOnPending = "";
  const tokens = { owner: "", otherOwner: "", customer: "", otherCustomer: "" };

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: "UPL-ORD-1" } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  beforeAll(async () => {
    await cleanup();
    const roles = {
      owner: "VEHICLE_OWNER",
      otherOwner: "VEHICLE_OWNER",
      customer: "CUSTOMER",
      otherCustomer: "CUSTOMER",
    } as const;
    const ids: Record<string, string> = {};
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: "Upload",
          lastName: key,
          role: roles[key],
          status: "ACTIVE",
        },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: roles[key] },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: ids.owner,
        name: "Upload Order Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "UPL-ORD-1",
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

    const bookingWithPayment = async (status: "PENDING" | "CANCELLED") => {
      const booking = await prisma.booking.create({
        data: {
          customerId: ids.customer,
          vehicleId,
          startDate: new Date(Date.now() + 20 * DAY),
          endDate: new Date(Date.now() + 21 * DAY),
          pickupLocation: "Colombo",
          totalAmount: 20000,
          status,
          payment: {
            create: {
              userId: ids.customer,
              amount: 20000,
              currency: "LKR",
              status: "PENDING",
              method: "BANK_TRANSFER",
            },
          },
        },
        include: { payment: true },
      });
      return booking.payment!.id;
    };
    paymentOnCancelled = await bookingWithPayment("CANCELLED");
    paymentOnPending = await bookingWithPayment("PENDING");
  });

  beforeEach(() => {
    uploadBuffer.mockReset();
    uploadPrivateBuffer.mockReset();
  });

  afterAll(cleanup);

  const pdf = Buffer.from("%PDF-1.4 test");

  it("does not store photos sent to another owner's vehicle", async () => {
    const response = await request(app)
      .post(`${API_BASE}/vehicles/${vehicleId}/photos`)
      .set("Authorization", `Bearer ${tokens.otherOwner}`)
      .attach("photos", Buffer.from("img"), {
        filename: "bus.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(403);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  it("does not store documents sent to another owner's vehicle", async () => {
    const response = await request(app)
      .post(`${API_BASE}/vehicles/${vehicleId}/documents`)
      .set("Authorization", `Bearer ${tokens.otherOwner}`)
      .attach("license", pdf, { filename: "l.pdf", contentType: "application/pdf" })
      .attach("insurance", pdf, { filename: "i.pdf", contentType: "application/pdf" })
      .attach("registrationCertificate", pdf, {
        filename: "r.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(403);
    expect(uploadPrivateBuffer).not.toHaveBeenCalled();
  });

  const uploadReceipt = (paymentId: string, token: string) =>
    request(app)
      .post(`${API_BASE}/payments/${paymentId}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .attach("receipt", pdf, {
        filename: "receipt.pdf",
        contentType: "application/pdf",
      });

  it("does not store a receipt for someone else's payment", async () => {
    const response = await uploadReceipt(paymentOnPending, tokens.otherCustomer);

    expect(response.status).toBe(403);
    expect(uploadPrivateBuffer).not.toHaveBeenCalled();
  });

  it("does not accept a receipt for a cancelled booking", async () => {
    const response = await uploadReceipt(paymentOnCancelled, tokens.customer);

    expect(response.status).toBe(400);
    expect(uploadPrivateBuffer).not.toHaveBeenCalled();
    const payment = await prisma.payment.findUnique({
      where: { id: paymentOnCancelled },
    });
    expect(payment?.status).toBe("PENDING");
  });

  it("stores a receipt for the customer's own pending booking", async () => {
    uploadPrivateBuffer.mockResolvedValue({
      path: "receipts/x.pdf",
      url: "storage://private/receipts/x.pdf",
    });

    const response = await uploadReceipt(paymentOnPending, tokens.customer);

    expect(response.status).toBe(200);
    expect(uploadPrivateBuffer).toHaveBeenCalledOnce();
  });
});
