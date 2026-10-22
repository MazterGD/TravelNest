/**
 * Admin user management (ADM-5, ADM-6): only super admins manage admin
 * accounts, admins cannot change their own status, and accounts with
 * transaction history are suspended rather than deleted.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "admin.users.safety";
const DAY = 24 * 60 * 60 * 1000;
const USER_PERMISSIONS = [
  "admin.users.update_status",
  "admin.users.reset_password",
  "admin.users.delete",
];

type AdminRole = "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN";

describe("Admin user management safety", () => {
  const admins: Partial<Record<AdminRole, { id: string; token: string }>> = {};

  const cleanup = async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { licensePlate: "ADM-USR-1" } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  const createUser = (
    label: string,
    role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER",
    adminRole?: AdminRole,
  ) =>
    prisma.user.create({
      data: {
        email: `${PREFIX}.${label}@example.com`,
        password: "hashed",
        firstName: "Safety",
        lastName: label,
        role,
        adminRole,
        status: "ACTIVE",
      },
    });

  beforeAll(async () => {
    await cleanup();
    for (const adminRole of ["SUPER_ADMIN", "MODERATOR", "FINANCE_ADMIN"] as const) {
      const admin = await createUser(adminRole.toLowerCase(), "ADMIN", adminRole);
      await prisma.adminPermission.createMany({
        data: USER_PERMISSIONS.map((permission) => ({
          adminId: admin.id,
          permission,
          grantedBy: admin.id,
        })),
      });
      admins[adminRole] = {
        id: admin.id,
        token: jwt.sign(
          { id: admin.id, email: admin.email, role: "ADMIN" },
          config.jwt.secret,
          { expiresIn: "1h" },
        ),
      };
    }
  });

  afterAll(cleanup);

  const as = (role: AdminRole) => `Bearer ${admins[role]!.token}`;

  it("stops a moderator from taking over a finance admin", async () => {
    const target = admins.FINANCE_ADMIN!.id;

    const reset = await request(app)
      .patch(`${API_BASE}/admin/users/${target}/password`)
      .set("Authorization", as("MODERATOR"))
      .send({ newPassword: "NewPassword123!" });
    const suspend = await request(app)
      .patch(`${API_BASE}/admin/users/${target}/status`)
      .set("Authorization", as("MODERATOR"))
      .send({ status: "SUSPENDED" });
    const remove = await request(app)
      .delete(`${API_BASE}/admin/users/${target}`)
      .set("Authorization", as("MODERATOR"));

    expect([reset.status, suspend.status, remove.status]).toEqual([403, 403, 403]);
    const after = await prisma.user.findUnique({ where: { id: target } });
    expect(after?.status).toBe("ACTIVE");
    expect(after?.password).toBe("hashed");
  });

  it("lets a super admin reset another admin's password", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/admin/users/${admins.FINANCE_ADMIN!.id}/password`)
      .set("Authorization", as("SUPER_ADMIN"))
      .send({ newPassword: "NewPassword123!" });

    expect(response.status).toBe(200);
  });

  it("does not let an admin change their own status", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/admin/users/${admins.MODERATOR!.id}/status`)
      .set("Authorization", as("MODERATOR"))
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(400);
  });

  it("refuses to delete an owner with bookings and keeps the history", async () => {
    const owner = await createUser("owner", "VEHICLE_OWNER");
    const customer = await createUser("customer", "CUSTOMER");
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: owner.id,
        name: "History Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "ADM-USR-1",
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
      },
    });
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        startDate: new Date(Date.now() + 10 * DAY),
        endDate: new Date(Date.now() + 11 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 20000,
        status: "CONFIRMED",
      },
    });

    const response = await request(app)
      .delete(`${API_BASE}/admin/users/${owner.id}`)
      .set("Authorization", as("SUPER_ADMIN"));

    expect(response.status).toBe(409);
    expect(await prisma.booking.findUnique({ where: { id: booking.id } })).not.toBeNull();
  });

  it("deletes a customer without any history", async () => {
    const customer = await createUser("fresh", "CUSTOMER");

    const response = await request(app)
      .delete(`${API_BASE}/admin/users/${customer.id}`)
      .set("Authorization", as("MODERATOR"));

    expect(response.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: customer.id } })).toBeNull();
  });
});
