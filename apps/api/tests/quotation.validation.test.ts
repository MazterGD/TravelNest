/**
 * Quotation input validation and vehicle suitability (PAY-12, PAY-13), and
 * admin access to quotation details (PAY-14).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "quote.validation";
const DAY = 24 * 60 * 60 * 1000;

describe("Quotation validation", () => {
  let customerId = "";
  let ownerId = "";
  let busId = "";
  let smallVanId = "";
  let inactiveId = "";
  const tokens = { customer: "", owner: "", admin: "" };
  let seq = 0;

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({
      where: { licensePlate: { startsWith: "QV-" } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  const makeUser = async (
    key: keyof typeof tokens,
    role: "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN",
  ) => {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}.${key}@example.com`,
        password: "hashed",
        firstName: "Quote",
        lastName: key,
        role,
        ...(role === "ADMIN" && { adminRole: "SUPER_ADMIN" as const }),
        status: "ACTIVE",
        isVerified: true,
      },
    });
    tokens[key] = jwt.sign(
      { id: user.id, email: user.email, role },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
    return user.id;
  };

  const makeVehicle = async (
    plate: string,
    type: "ORDINARY" | "SEMI_LUXURY" | "LUXURY_AC",
    seats: number,
    isActive: boolean,
  ) =>
    (
      await prisma.vehicle.create({
        data: {
          ownerId,
          name: plate,
          type,
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: plate,
          seats,
          fuelType: "DIESEL",
          transmission: "MANUAL",
          pricePerDay: 15000,
          location: "Colombo",
          images: [],
          amenities: [],
          isActive,
        },
      })
    ).id;

  beforeAll(async () => {
    await cleanup();
    customerId = await makeUser("customer", "CUSTOMER");
    ownerId = await makeUser("owner", "VEHICLE_OWNER");
    await makeUser("admin", "ADMIN");
    busId = await makeVehicle("QV-BUS", "SEMI_LUXURY", 40, true);
    smallVanId = await makeVehicle("QV-VAN", "SEMI_LUXURY", 10, true);
    inactiveId = await makeVehicle("QV-OFF", "SEMI_LUXURY", 40, false);
  });

  afterAll(async () => {
    await prisma.quotation.deleteMany({ where: { customerId } });
    await cleanup();
  });

  const pendingRequest = () =>
    prisma.quotation.create({
      data: {
        quotationId: `QUO-QV-${Date.now()}-${seq++}`,
        customerId,
        vehicleType: "SEMI_LUXURY",
        startDate: new Date(Date.now() + 20 * DAY),
        endDate: new Date(Date.now() + 21 * DAY),
        pickupLocation: "Colombo",
        dropoffLocation: "Kandy",
        passengerCount: 30,
        estimatedDistance: "120 km",
        status: "PENDING",
      },
    });

  const pricing = (vehicleId: string, overrides: object = {}) => ({
    vehicleId,
    startTime: "08:00",
    estimatedDistance: "120 km",
    estimatedDuration: "3 hours",
    driverCost: 5000,
    fuelCost: 4000,
    tollCharges: 1000,
    customItems: [],
    validityDays: 7,
    ...overrides,
  });

  const send = (quotationId: string, body: object) =>
    request(app)
      .patch(`${API_BASE}/quotations/${quotationId}/send`)
      .set("Authorization", `Bearer ${tokens.owner}`)
      .send(body);

  it.each([
    ["a negative cost", { driverCost: -50000 }],
    ["a cost sent as a string", { fuelCost: "4000" }],
    ["a negative custom item", { customItems: [{ description: "x", amount: -1 }] }],
    ["an unbounded validity", { validityDays: 365 }],
  ])("rejects %s", async (_label, override) => {
    const quote = await pendingRequest();

    const response = await send(quote.id, pricing(busId, override));

    expect(response.status).toBe(422);
    const after = await prisma.quotation.findUnique({ where: { id: quote.id } });
    expect(after?.status).toBe("PENDING");
  });

  it("rejects a vehicle with fewer seats than the group", async () => {
    const quote = await pendingRequest();

    const response = await send(quote.id, pricing(smallVanId));

    expect(response.status).toBe(400);
  });

  it("rejects a vehicle that is not approved", async () => {
    const quote = await pendingRequest();

    const response = await send(quote.id, pricing(inactiveId));

    expect(response.status).toBe(400);
  });

  it("rejects a vehicle of a different type than requested", async () => {
    const quote = await pendingRequest();
    await prisma.quotation.update({
      where: { id: quote.id },
      data: { vehicleType: "LUXURY_AC" },
    });

    const response = await send(quote.id, pricing(busId));

    expect(response.status).toBe(400);
  });

  it("sends a valid quotation", async () => {
    const quote = await pendingRequest();

    const response = await send(quote.id, pricing(busId));

    expect(response.status).toBe(200);
    expect(response.body.data.quotation.status).toBe("SENT");
  });

  it("only accepts ACCEPTED or REJECTED as a customer response", async () => {
    const quote = await pendingRequest();

    const response = await request(app)
      .patch(`${API_BASE}/quotations/${quote.id}/respond`)
      .set("Authorization", `Bearer ${tokens.customer}`)
      .send({ status: "PENDING" });

    expect(response.status).toBe(422);
  });

  it("lets an admin view quotation details", async () => {
    const quote = await pendingRequest();

    const response = await request(app)
      .get(`${API_BASE}/quotations/${quote.id}`)
      .set("Authorization", `Bearer ${tokens.admin}`);

    expect(response.status).toBe(200);
  });
});
