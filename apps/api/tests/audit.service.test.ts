import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "./setup";
import {
  createAuditLog,
  getAuditLogById,
  getAuditLogs,
} from "../src/modules/admin/audit/audit.service";

const cleanupAuditServiceData = async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["phase1.audit.service@example.com", "phase1.audit.service.2@example.com"],
      },
    },
  });
};

describe("Audit service", () => {
  beforeEach(async () => {
    await cleanupAuditServiceData();
  });

  afterEach(async () => {
    await cleanupAuditServiceData();
  });

  it("creates and retrieves an audit log", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "phase1.audit.service@example.com",
        password: "password-hash",
        firstName: "Audit",
        lastName: "Admin",
        role: "ADMIN",
        adminRole: "SUPER_ADMIN",
      },
    });

    const log = await createAuditLog({
      adminId: admin.id,
      action: "user.suspended",
      entityType: "User",
      entityId: "user_123",
      changes: {
        status: { before: "ACTIVE", after: "SUSPENDED" },
      },
    });

    const fetched = await getAuditLogById(log.id);

    expect(fetched.id).toBe(log.id);
    expect(fetched.action).toBe("user.suspended");
    expect(fetched.entityType).toBe("User");
  });

  it("filters and paginates audit logs", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "phase1.audit.service.2@example.com",
        password: "password-hash",
        firstName: "Audit",
        lastName: "Moderator",
        role: "ADMIN",
        adminRole: "MODERATOR",
      },
    });

    await createAuditLog({
      adminId: admin.id,
      action: "vehicle.updated",
      entityType: "Vehicle",
      entityId: "vehicle_1",
    });

    await createAuditLog({
      adminId: admin.id,
      action: "booking.cancelled",
      entityType: "Booking",
      entityId: "booking_1",
      status: "failure",
      errorMessage: "Refund provider timeout",
    });

    const result = await getAuditLogs({
      page: 1,
      limit: 10,
      adminId: admin.id,
      status: "failure",
    });

    expect(result.logs.length).toBe(1);
    expect(result.logs[0]?.action).toBe("booking.cancelled");
    expect(result.pagination.total).toBe(1);
  });
});
