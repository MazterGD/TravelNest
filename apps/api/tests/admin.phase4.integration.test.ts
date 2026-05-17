import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { config } from "../src/config/index";
import "./setup";
import { prisma } from "@travenest/database";

type Phase4Prisma = typeof prisma & {
  dispute: any;
  disputeMessage: any;
  settlement: any;
  settlementBooking: any;
  commissionRule: any;
};

const prismaPhase4 = prisma as Phase4Prisma;

const API_BASE = "/api/v1";

const createdEmails: string[] = [];
const createdCommissionRuleIds: string[] = [];

const uniqueTag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const trackEmail = (email: string) => {
  createdEmails.push(email);
  return email;
};

const makeEmail = (label: string) =>
  trackEmail(`phase4.integration.${label}.${uniqueTag()}@example.com`);

const makeToken = (
  id: string,
  email: string,
  role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER",
) => jwt.sign({ id, email, role }, config.jwt.secret, { expiresIn: "1h" });

const createAdmin = async (options?: {
  adminRole?: "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN";
  permissions?: string[];
}) => {
  const admin = await prisma.user.create({
    data: {
      email: makeEmail("admin"),
      password: "password-hash",
      firstName: "Phase4",
      lastName: "Admin",
      role: "ADMIN",
      adminRole: options?.adminRole ?? "MODERATOR",
      status: "ACTIVE",
      isVerified: true,
    },
  });

  if (options?.permissions?.length) {
    await prisma.adminPermission.createMany({
      data: options.permissions.map((permission) => ({
        adminId: admin.id,
        permission,
        grantedBy: admin.id,
      })),
      skipDuplicates: true,
    });
  }

  return {
    admin,
    token: makeToken(admin.id, admin.email, "ADMIN"),
  };
};

const createCustomer = async (label: string) => {
  return prisma.user.create({
    data: {
      email: makeEmail(label),
      password: "password-hash",
      firstName: "Phase4",
      lastName: "Customer",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      district: "Colombo",
    },
  });
};

const createOwner = async (label: string) => {
  return prisma.user.create({
    data: {
      email: makeEmail(label),
      password: "password-hash",
      firstName: "Phase4",
      lastName: "Owner",
      role: "VEHICLE_OWNER",
      status: "ACTIVE",
      isVerified: true,
      district: "Gampaha",
      nicNumber: `91${Math.floor(Math.random() * 1000000)}V`,
    },
  });
};

const createBookingBaseFixture = async () => {
  const owner = await createOwner("owner");
  const customer = await createCustomer("customer");

  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: owner.id,
      name: `Phase4 Coach ${uniqueTag()}`,
      type: "LUXURY_AC",
      brand: "Ashok Leyland",
      model: "Viking",
      year: 2023,
      licensePlate: `PH4-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      seats: 45,
      fuelType: "DIESEL",
      transmission: "MANUAL",
      amenities: ["AC", "WiFi"],
      images: [],
      pricePerDay: 30000,
      location: "Colombo",
      isActive: true,
      isAvailable: true,
    },
  });

  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      pickupLocation: "Colombo, Sri Lanka",
      dropoffLocation: "Kandy, Sri Lanka",
      totalPassengers: 18,
      totalAmount: 65000,
      status: "COMPLETED",
    },
  });

  await prisma.payment.create({
    data: {
      userId: customer.id,
      bookingId: booking.id,
      amount: 65000,
      status: "COMPLETED",
      method: "BANK_TRANSFER",
    },
  });

  return {
    owner,
    customer,
    vehicle,
    booking,
  };
};

const createDisputeFixture = async () => {
  const base = await createBookingBaseFixture();

  const dispute = await prismaPhase4.dispute.create({
    data: {
      disputeCode: `DSP-${uniqueTag()}`,
      bookingId: base.booking.id,
      raisedBy: base.customer.id,
      raisedAgainst: base.owner.id,
      type: "SERVICE_NOT_PROVIDED",
      priority: "MEDIUM",
      status: "OPEN",
      subject: "Driver did not arrive on agreed pickup time",
      description: "The trip started three hours late and support was unresponsive.",
      evidenceUrls: ["https://example.com/evidence/phase4-dispute.png"],
    },
  });

  return {
    ...base,
    dispute,
  };
};

const createFinancialFixture = async () => {
  const base = await createBookingBaseFixture();

  const settlement = await prismaPhase4.settlement.create({
    data: {
      settlementCode: `SET-${uniqueTag()}`,
      ownerId: base.owner.id,
      period: "2026-03",
      totalBookings: 1,
      grossAmount: 65000,
      commissionAmount: 6500,
      netAmount: 58500,
      status: "PENDING",
      bankAccountName: "Phase4 Owner",
      bankAccountNumber: "1234567890",
      bankCode: "7010",
    },
  });

  await prismaPhase4.settlementBooking.create({
    data: {
      settlementId: settlement.id,
      bookingId: base.booking.id,
      amount: 65000,
      commission: 6500,
      net: 58500,
    },
  });

  return {
    ...base,
    settlement,
  };
};

afterEach(async () => {
  if (createdCommissionRuleIds.length > 0) {
    await prismaPhase4.commissionRule.deleteMany({
      where: {
        id: {
          in: Array.from(new Set(createdCommissionRuleIds)),
        },
      },
    });

    createdCommissionRuleIds.length = 0;
  }

  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: Array.from(new Set(createdEmails)),
        },
      },
    });

    createdEmails.length = 0;
  }
});

describe("Admin Phase 4 - disputes endpoints", () => {
  it("lists disputes queue for authorized admins", async () => {
    const { token } = await createAdmin({
      adminRole: "SUPPORT_ADMIN",
      permissions: ["admin.disputes.read"],
    });
    const fixture = await createDisputeFixture();

    const response = await request(app)
      .get(`${API_BASE}/admin/disputes?search=${fixture.dispute.disputeCode}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items.some((item: { id: string }) => item.id === fixture.dispute.id)).toBe(true);
  });

  it("assigns disputes to support admins and adds assignment note", async () => {
    const { admin, token } = await createAdmin({
      adminRole: "SUPPORT_ADMIN",
      permissions: ["admin.disputes.assign"],
    });
    const assignee = await createAdmin({
      adminRole: "SUPPORT_ADMIN",
    });
    const fixture = await createDisputeFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/disputes/${fixture.dispute.id}/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        assignedTo: assignee.admin.id,
        note: "Investigate with owner and customer call logs",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.assignedTo).toBe(assignee.admin.id);
    expect(response.body.data.status).toBe("INVESTIGATING");

    const updated = await prismaPhase4.dispute.findUnique({
      where: { id: fixture.dispute.id },
      select: { assignedTo: true, status: true },
    });

    expect(updated?.assignedTo).toBe(assignee.admin.id);
    expect(updated?.status).toBe("INVESTIGATING");

    const noteMessage = await prismaPhase4.disputeMessage.findFirst({
      where: {
        disputeId: fixture.dispute.id,
        senderId: admin.id,
        isInternalNote: true,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(noteMessage).not.toBeNull();
  });

  it("resolves disputes and records an audit log", async () => {
    const { admin, token } = await createAdmin({
      adminRole: "SUPPORT_ADMIN",
      permissions: ["admin.disputes.resolve"],
    });
    const fixture = await createDisputeFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/disputes/${fixture.dispute.id}/resolve`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resolution: "Refunded 20% due to delayed service start",
        resolutionType: "PARTIAL_REFUND",
        resolutionAmount: 13000,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("RESOLVED");

    const resolvedDispute = await prismaPhase4.dispute.findUnique({
      where: { id: fixture.dispute.id },
      select: {
        status: true,
        resolution: true,
        resolutionType: true,
        resolutionAmount: true,
        closedAt: true,
      },
    });

    expect(resolvedDispute?.status).toBe("RESOLVED");
    expect(resolvedDispute?.resolution).toContain("Refunded");
    expect(resolvedDispute?.resolutionType).toBe("PARTIAL_REFUND");
    expect(resolvedDispute?.resolutionAmount).toBe(13000);
    expect(resolvedDispute?.closedAt).not.toBeNull();

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        adminId: admin.id,
        action: "RESOLVE",
        entityType: "DISPUTE",
        entityId: fixture.dispute.id,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditLog).not.toBeNull();
  });

  it("blocks dispute queue access without required permission", async () => {
    const { token } = await createAdmin({
      adminRole: "SUPPORT_ADMIN",
    });

    const response = await request(app)
      .get(`${API_BASE}/admin/disputes`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});

describe("Admin Phase 4 - financial endpoints", () => {
  it("lists settlements for finance admins with read permission", async () => {
    const { token } = await createAdmin({
      adminRole: "FINANCE_ADMIN",
      permissions: ["admin.financial.read"],
    });
    const fixture = await createFinancialFixture();

    const [legacyResponse, aliasResponse] = await Promise.all([
      request(app)
        .get(
          `${API_BASE}/admin/financial/settlements?search=${fixture.settlement.settlementCode}`,
        )
        .set("Authorization", `Bearer ${token}`),
      request(app)
        .get(`${API_BASE}/admin/settlements?search=${fixture.settlement.settlementCode}`)
        .set("Authorization", `Bearer ${token}`),
    ]);

    expect(legacyResponse.status).toBe(200);
    expect(legacyResponse.body.success).toBe(true);
    expect(
      legacyResponse.body.data.items.some(
        (item: { id: string }) => item.id === fixture.settlement.id,
      ),
    ).toBe(true);

    expect(aliasResponse.status).toBe(200);
    expect(aliasResponse.body.success).toBe(true);
    expect(
      aliasResponse.body.data.items.some(
        (item: { id: string }) => item.id === fixture.settlement.id,
      ),
    ).toBe(true);
  });

  it("processes settlements and writes settlement audit events", async () => {
    const { admin, token } = await createAdmin({
      adminRole: "FINANCE_ADMIN",
      permissions: ["admin.financial.process_settlement"],
    });
    const fixture = await createFinancialFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/financial/settlements/${fixture.settlement.id}/process`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "COMPLETED",
        notes: "Transferred to owner bank account",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("COMPLETED");

    const processed = await prismaPhase4.settlement.findUnique({
      where: { id: fixture.settlement.id },
      select: { status: true, processedBy: true, processedAt: true, notes: true },
    });

    expect(processed?.status).toBe("COMPLETED");
    expect(processed?.processedBy).toBe(admin.id);
    expect(processed?.processedAt).not.toBeNull();
    expect(processed?.notes).toContain("Transferred");

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        adminId: admin.id,
        action: "PROCESS",
        entityType: "SETTLEMENT",
        entityId: fixture.settlement.id,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditLog).not.toBeNull();
  });

  it("creates, updates, and archives commission rules", async () => {
    const { token } = await createAdmin({
      adminRole: "FINANCE_ADMIN",
      permissions: ["admin.financial.manage_commissions"],
    });

    const createResponse = await request(app)
      .post(`${API_BASE}/admin/commissions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Phase4 Rule ${uniqueTag()}`,
        type: "PERCENTAGE",
        percentage: 9,
        minAmount: 0,
        maxAmount: 200000,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.type).toBe("PERCENTAGE");

    const ruleId = createResponse.body.data.id as string;
    createdCommissionRuleIds.push(ruleId);

    const updateResponse = await request(app)
      .patch(`${API_BASE}/admin/commissions/${ruleId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        percentage: 10,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.percentage).toBe(10);

    const archiveResponse = await request(app)
      .delete(`${API_BASE}/admin/commissions/${ruleId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.success).toBe(true);
    expect(archiveResponse.body.data.deleted).toBe(true);

    const archived = await prismaPhase4.commissionRule.findUnique({
      where: { id: ruleId },
      select: { isActive: true },
    });

    expect(archived?.isActive).toBe(false);
  });

  it("blocks settlement processing for unsupported admin roles", async () => {
    const { token } = await createAdmin({
      adminRole: "MODERATOR",
      permissions: ["admin.financial.process_settlement"],
    });
    const fixture = await createFinancialFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/financial/settlements/${fixture.settlement.id}/process`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "COMPLETED",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
