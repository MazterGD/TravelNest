import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";

const makeToken = (id: string, email: string, role: "ADMIN" | "CUSTOMER") => {
  return jwt.sign({ id, email, role }, config.jwt.secret, { expiresIn: "1h" });
};

const cleanupAdminTestData = async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "phase1.superadmin@example.com",
          "phase1.moderator@example.com",
          "phase1.customer@example.com",
        ],
      },
    },
  });
};

describe("Admin middleware", () => {
  beforeEach(async () => {
    await cleanupAdminTestData();
  });

  afterEach(async () => {
    await cleanupAdminTestData();
  });

  it("blocks admin route without token", async () => {
    const response = await request(app).get(`${API_BASE}/admin/health`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("blocks non-admin user from admin route", async () => {
    const customer = await prisma.user.create({
      data: {
        email: "phase1.customer@example.com",
        password: "password-hash",
        firstName: "Phase1",
        lastName: "Customer",
        role: "CUSTOMER",
      },
    });

    const token = makeToken(customer.id, customer.email, "CUSTOMER");

    const response = await request(app)
      .get(`${API_BASE}/admin/health`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("allows super admin to read audit logs without explicit permission", async () => {
    const superAdmin = await prisma.user.create({
      data: {
        email: "phase1.superadmin@example.com",
        password: "password-hash",
        firstName: "Phase1",
        lastName: "SuperAdmin",
        role: "ADMIN",
        adminRole: "SUPER_ADMIN",
      },
    });

    const token = makeToken(superAdmin.id, superAdmin.email, "ADMIN");

    await prisma.auditLog.create({
      data: {
        adminId: superAdmin.id,
        action: "admin.seed",
        entityType: "System",
        entityId: "seed-1",
      },
    });

    const response = await request(app)
      .get(`${API_BASE}/admin/audit-logs`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.logs)).toBe(true);
  });

  it("blocks moderator without audit.read permission", async () => {
    const moderator = await prisma.user.create({
      data: {
        email: "phase1.moderator@example.com",
        password: "password-hash",
        firstName: "Phase1",
        lastName: "Moderator",
        role: "ADMIN",
        adminRole: "MODERATOR",
      },
    });

    const token = makeToken(moderator.id, moderator.email, "ADMIN");

    const response = await request(app)
      .get(`${API_BASE}/admin/audit-logs`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("allows moderator with audit.read permission", async () => {
    const moderator = await prisma.user.create({
      data: {
        email: "phase1.moderator@example.com",
        password: "password-hash",
        firstName: "Phase1",
        lastName: "Moderator",
        role: "ADMIN",
        adminRole: "MODERATOR",
      },
    });

    await prisma.adminPermission.create({
      data: {
        adminId: moderator.id,
        permission: "audit.read",
        grantedBy: moderator.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: moderator.id,
        action: "admin.seed",
        entityType: "System",
        entityId: "seed-2",
      },
    });

    const token = makeToken(moderator.id, moderator.email, "ADMIN");

    const response = await request(app)
      .get(`${API_BASE}/admin/audit-logs`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
