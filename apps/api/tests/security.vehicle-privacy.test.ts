/**
 * Security regression tests: public vehicle detail must not expose the
 * owner's verification documents or email (OBJ-1).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const EMAILS = {
  owner: "sec.vehicle.owner@example.com",
  customer: "sec.vehicle.customer@example.com",
  admin: "sec.vehicle.admin@example.com",
};

const tokenFor = (user: { id: string; email: string; role: string }) =>
  jwt.sign(user, config.jwt.secret, { expiresIn: "1h" });

describe("Public vehicle detail privacy", () => {
  let vehicleId = "";
  const tokens: Record<keyof typeof EMAILS, string> = {
    owner: "",
    customer: "",
    admin: "",
  };

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: "SEC-OBJ-1" } });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(EMAILS) } },
    });
  };

  beforeAll(async () => {
    await cleanup();

    const roles = {
      owner: "VEHICLE_OWNER",
      customer: "CUSTOMER",
      admin: "ADMIN",
    } as const;

    const users: Record<string, { id: string }> = {};
    for (const key of Object.keys(EMAILS) as (keyof typeof EMAILS)[]) {
      const user = await prisma.user.create({
        data: {
          email: EMAILS[key],
          password: "hashed",
          firstName: "Sec",
          lastName: key,
          role: roles[key],
          status: "ACTIVE",
          isVerified: true,
        },
      });
      users[key] = user;
      tokens[key] = tokenFor({
        id: user.id,
        email: user.email,
        role: roles[key],
      });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: users.owner.id,
        name: "Privacy Test Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "SEC-OBJ-1",
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
        isActive: true,
        documents: {
          create: {
            type: "INSURANCE",
            url: "https://example.com/private/insurance.pdf",
            fileName: "insurance.pdf",
            fileSize: 1024,
            mimeType: "application/pdf",
          },
        },
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(cleanup);

  const fetchVehicle = (token?: string) => {
    const req = request(app).get(`${API_BASE}/vehicles/${vehicleId}`);
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  };

  it("hides documents and owner email from anonymous visitors", async () => {
    const response = await fetchVehicle();

    expect(response.status).toBe(200);
    const vehicle = response.body.data.vehicle;
    expect(vehicle.documents).toBeUndefined();
    expect(vehicle.owner.email).toBeUndefined();
    expect(vehicle.owner.firstName).toBe("Sec");
  });

  it("hides documents and owner email from other customers", async () => {
    const response = await fetchVehicle(tokens.customer);

    expect(response.status).toBe(200);
    expect(response.body.data.vehicle.documents).toBeUndefined();
    expect(response.body.data.vehicle.owner.email).toBeUndefined();
  });

  it("returns documents to the vehicle owner", async () => {
    const response = await fetchVehicle(tokens.owner);

    expect(response.status).toBe(200);
    expect(response.body.data.vehicle.documents).toHaveLength(1);
    expect(response.body.data.vehicle.owner.email).toBe(EMAILS.owner);
  });

  it("returns documents to admins", async () => {
    const response = await fetchVehicle(tokens.admin);

    expect(response.status).toBe(200);
    expect(response.body.data.vehicle.documents).toHaveLength(1);
  });
});
