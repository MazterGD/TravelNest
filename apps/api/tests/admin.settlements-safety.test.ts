/**
 * Settlement payouts (ADM-4): transitions move forward only and concurrent
 * processing requests cannot both pay out.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "admin.settlement.safety";

describe("Settlement processing safety", () => {
  let ownerId = "";
  let token = "";
  let seq = 0;

  const cleanup = async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.settlement.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    const owner = await prisma.user.create({
      data: {
        email: `${PREFIX}.owner@example.com`,
        password: "hashed",
        firstName: "Settle",
        lastName: "Owner",
        role: "VEHICLE_OWNER",
        status: "ACTIVE",
      },
    });
    ownerId = owner.id;
    const admin = await prisma.user.create({
      data: {
        email: `${PREFIX}.finance@example.com`,
        password: "hashed",
        firstName: "Settle",
        lastName: "Finance",
        role: "ADMIN",
        adminRole: "FINANCE_ADMIN",
        status: "ACTIVE",
      },
    });
    await prisma.adminPermission.create({
      data: {
        adminId: admin.id,
        permission: "admin.financial.process_settlement",
        grantedBy: admin.id,
      },
    });
    token = jwt.sign(
      { id: admin.id, email: admin.email, role: "ADMIN" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  });

  afterAll(cleanup);

  const createSettlement = (
    status: "PENDING" | "COMPLETED" | "CANCELLED",
  ) =>
    prisma.settlement.create({
      data: {
        settlementCode: `STL-SAFE-${Date.now()}-${seq++}`,
        ownerId,
        period: "2026-10",
        totalBookings: 1,
        grossAmount: 10000,
        commissionAmount: 1000,
        netAmount: 9000,
        status,
      },
    });

  const processAs = (settlementId: string, status?: string) =>
    request(app)
      .post(`${API_BASE}/admin/settlements/${settlementId}/process`)
      .set("Authorization", `Bearer ${token}`)
      .send(status ? { status } : {});

  it("pays out a pending settlement once when two requests race", async () => {
    const settlement = await createSettlement("PENDING");

    const responses = await Promise.all([
      processAs(settlement.id),
      processAs(settlement.id),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
    const notifications = await prisma.notification.count({
      where: {
        userId: ownerId,
        type: "settlement_update",
        data: { path: ["settlementId"], equals: settlement.id },
      },
    });
    expect(notifications).toBe(1);
  });

  it("does not reopen a completed settlement", async () => {
    const settlement = await createSettlement("COMPLETED");

    for (const status of ["CANCELLED", "FAILED"]) {
      const response = await processAs(settlement.id, status);
      expect(response.status).toBe(400);
    }

    const after = await prisma.settlement.findUnique({
      where: { id: settlement.id },
    });
    expect(after?.status).toBe("COMPLETED");
  });

  it("does not pay out a cancelled settlement", async () => {
    const settlement = await createSettlement("CANCELLED");

    const response = await processAs(settlement.id, "COMPLETED");

    expect(response.status).toBe(400);
  });
});
