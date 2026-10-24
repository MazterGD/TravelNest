/**
 * Admins suspend or reactivate vehicles only with the verification
 * permissions; a suspension reason reaches the owner and the audit log.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1/vehicles";
const PREFIX = `veh-admin-status-${Date.now()}`;

describe("Admin vehicle status", () => {
  const ids = { owner: "", superAdmin: "", support: "", vehicle: "" };
  const tokens = { owner: "", superAdmin: "", support: "" };

  const setStatus = (who: keyof typeof tokens, body: object) =>
    request(app)
      .patch(`${API_BASE}/${ids.vehicle}/status`)
      .set("Authorization", `Bearer ${tokens[who]}`)
      .send(body);

  const cleanup = async () => {
    const users = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.auditLog.deleteMany({ where: { adminId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.adminPermission.deleteMany({ where: { adminId: { in: users } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  };

  beforeAll(async () => {
    await cleanup();
    const make = async (key: keyof typeof tokens, role: "VEHICLE_OWNER" | "ADMIN", adminRole?: "SUPER_ADMIN" | "SUPPORT_ADMIN") => {
      const user = await prisma.user.create({
        data: { email: `${PREFIX}.${key}@example.com`, password: "x", firstName: key, lastName: "T", role, adminRole, status: "ACTIVE", isVerified: true },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign({ id: user.id, email: user.email, role }, config.jwt.secret, { expiresIn: "1h" });
    };
    await make("owner", "VEHICLE_OWNER");
    await make("superAdmin", "ADMIN", "SUPER_ADMIN");
    await make("support", "ADMIN", "SUPPORT_ADMIN");
    ids.vehicle = (
      await prisma.vehicle.create({
        data: {
          ownerId: ids.owner,
          name: `${PREFIX} bus`,
          type: "ORDINARY",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: "VAZ-6611",
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
  });

  afterAll(async () => {
    await cleanup();
  });

  it("refuses admins without the verification permission", async () => {
    expect((await setStatus("support", { isActive: false, reason: "No" })).status).toBe(403);
    expect((await setStatus("support", { isActive: true })).status).toBe(403);
    expect((await prisma.vehicle.findUnique({ where: { id: ids.vehicle } }))?.isActive).toBe(true);
  });

  it("suspends with a reason the owner is told and the audit log keeps", async () => {
    const res = await setStatus("superAdmin", { isActive: false, reason: "Expired insurance" });

    expect(res.status).toBe(200);
    expect((await prisma.vehicle.findUnique({ where: { id: ids.vehicle } }))?.isActive).toBe(false);
    const notice = await prisma.notification.findFirst({ where: { userId: ids.owner, type: "vehicle_suspended" } });
    expect(notice?.message).toContain("Expired insurance");
    const audit = await prisma.auditLog.findFirst({
      where: { adminId: ids.superAdmin, entityId: ids.vehicle, action: "SUSPEND" },
    });
    expect(audit?.changes).toMatchObject({ reason: "Expired insurance", isActive: false });
  });

  it("lets a permitted admin reactivate, and an owner still only deactivate", async () => {
    await prisma.adminPermission.create({
      data: { adminId: ids.support, permission: "admin.verifications.approve", grantedBy: ids.superAdmin },
    });

    expect((await setStatus("support", { isActive: true })).status).toBe(200);
    expect(
      await prisma.auditLog.count({ where: { adminId: ids.support, entityId: ids.vehicle, action: "ACTIVATE" } }),
    ).toBe(1);
    expect((await setStatus("owner", { isActive: true })).status).toBe(403);
    expect((await setStatus("owner", { isActive: false })).status).toBe(200);
  });

  it("caps the reason length", async () => {
    expect((await setStatus("superAdmin", { isActive: false, reason: "x".repeat(501) })).status).toBe(422);
  });
});
