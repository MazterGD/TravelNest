/**
 * Report exports respect the data domain's access rules (ADM-9).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "admin.reports.access";

describe("Report type access", () => {
  const tokens: Record<string, string> = {};

  const cleanup = async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  const createAdmin = async (
    key: string,
    adminRole: "SUPPORT_ADMIN" | "FINANCE_ADMIN",
    permissions: string[],
  ) => {
    const admin = await prisma.user.create({
      data: {
        email: `${PREFIX}.${key}@example.com`,
        password: "hashed",
        firstName: "Reports",
        lastName: key,
        role: "ADMIN",
        adminRole,
        status: "ACTIVE",
      },
    });
    await prisma.adminPermission.createMany({
      data: permissions.map((permission) => ({
        adminId: admin.id,
        permission,
        grantedBy: admin.id,
      })),
    });
    tokens[key] = jwt.sign(
      { id: admin.id, email: admin.email, role: "ADMIN" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  };

  beforeAll(async () => {
    await cleanup();
    await createAdmin("support", "SUPPORT_ADMIN", ["admin.reports.export"]);
    await createAdmin("finance", "FINANCE_ADMIN", [
      "admin.reports.export",
      "admin.financial.read",
    ]);
  });

  afterAll(cleanup);

  const exportAs = (key: string, reportType: string) =>
    request(app)
      .post(`${API_BASE}/admin/reports/export`)
      .set("Authorization", `Bearer ${tokens[key]}`)
      .send({ reportType, format: "CSV" });

  it("blocks support admins from financial and audit reports", async () => {
    expect((await exportAs("support", "FINANCIAL")).status).toBe(403);
    expect((await exportAs("support", "AUDIT")).status).toBe(403);
  });

  it("still lets support admins export other report types", async () => {
    expect((await exportAs("support", "BOOKINGS")).status).toBe(200);
  });

  it("lets finance admins export financial reports", async () => {
    expect((await exportAs("finance", "FINANCIAL")).status).toBe(200);
  });
});
