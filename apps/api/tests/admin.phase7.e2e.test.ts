import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { config } from "../src/config/index";
import { prisma } from "./setup";

const API_BASE = "/api/v1";

const createdEmails: string[] = [];

const uniqueTag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const trackEmail = (email: string) => {
  createdEmails.push(email);
  return email;
};

const makeEmail = (label: string) =>
  trackEmail(`phase7.e2e.${label}.${uniqueTag()}@example.com`);

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
      firstName: "Phase7",
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
      firstName: "Phase7",
      lastName: "Customer",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      district: "Colombo",
    },
  });
};

const createOwner = async (
  label: string,
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" =
    "PENDING_VERIFICATION",
) => {
  return prisma.user.create({
    data: {
      email: makeEmail(label),
      password: "password-hash",
      firstName: "Phase7",
      lastName: "Owner",
      role: "VEHICLE_OWNER",
      status,
      isVerified: status === "ACTIVE",
      district: "Kandy",
      nicNumber: `90${Math.floor(Math.random() * 1000000)}V`,
    },
  });
};

const createVerificationFixture = async () => {
  const owner = await createOwner("owner-verification");

  await prisma.ownerDocument.createMany({
    data: [
      {
        ownerId: owner.id,
        type: "NIC",
        url: "https://example.com/owner/nic.pdf",
        fileName: "nic.pdf",
        fileSize: 12345,
        mimeType: "application/pdf",
        status: "PENDING",
      },
      {
        ownerId: owner.id,
        type: "PROFILE_PHOTO",
        url: "https://example.com/owner/profile.jpg",
        fileName: "profile.jpg",
        fileSize: 22345,
        mimeType: "image/jpeg",
        status: "PENDING",
      },
    ],
  });

  return { owner };
};

const createBookingBaseFixture = async () => {
  const owner = await createOwner("owner-booking", "ACTIVE");
  const customer = await createCustomer("customer-booking");

  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: owner.id,
      name: `Phase7 Coach ${uniqueTag()}`,
      type: "LUXURY_AC",
      brand: "Ashok Leyland",
      model: "Viking",
      year: 2023,
      licensePlate: `PH7-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
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

  const dispute = await prisma.dispute.create({
    data: {
      disputeCode: `DSP-${uniqueTag()}`,
      bookingId: base.booking.id,
      raisedBy: base.customer.id,
      raisedAgainst: base.owner.id,
      type: "SERVICE_NOT_PROVIDED",
      priority: "MEDIUM",
      status: "OPEN",
      subject: "Driver did not arrive on agreed pickup time",
      description: "The trip started late and support was unresponsive.",
      evidenceUrls: ["https://example.com/evidence/phase7-dispute.png"],
    },
  });

  return {
    ...base,
    dispute,
  };
};

const createSettlementFixture = async () => {
  const base = await createBookingBaseFixture();

  const settlement = await prisma.settlement.create({
    data: {
      settlementCode: `SET-${uniqueTag()}`,
      ownerId: base.owner.id,
      period: "2026-03",
      totalBookings: 1,
      grossAmount: 65000,
      commissionAmount: 6500,
      netAmount: 58500,
      status: "PENDING",
      bankAccountName: "Phase7 Owner",
      bankAccountNumber: "1234567890",
      bankCode: "7010",
    },
  });

  await prisma.settlementBooking.create({
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

describe("Admin Phase 7 - end-to-end workflows", () => {
  it("completes owner verification workflow from queue to approval history", async () => {
    const { admin, token } = await createAdmin({
      adminRole: "MODERATOR",
      permissions: ["admin.verifications.read", "admin.verifications.approve"],
    });
    const fixture = await createVerificationFixture();

    const queueResponse = await request(app)
      .get(`${API_BASE}/admin/verifications/owners?search=${fixture.owner.email}`)
      .set("Authorization", `Bearer ${token}`);

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body.success).toBe(true);
    expect(
      queueResponse.body.data.items.some(
        (item: { id: string }) => item.id === fixture.owner.id,
      ),
    ).toBe(true);

    const detailResponse = await request(app)
      .get(`${API_BASE}/admin/verifications/owners/${fixture.owner.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.success).toBe(true);
    expect(detailResponse.body.data.id).toBe(fixture.owner.id);

    const approveResponse = await request(app)
      .post(`${API_BASE}/admin/verifications/owners/${fixture.owner.id}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "All verification checks passed" });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.success).toBe(true);
    expect(approveResponse.body.data.status).toBe("ACTIVE");
    expect(approveResponse.body.data.isVerified).toBe(true);

    const ownerAfter = await prisma.user.findUnique({
      where: { id: fixture.owner.id },
      select: { status: true, isVerified: true },
    });

    expect(ownerAfter?.status).toBe("ACTIVE");
    expect(ownerAfter?.isVerified).toBe(true);

    const docsAfter = await prisma.ownerDocument.findMany({
      where: { ownerId: fixture.owner.id },
      select: { status: true, verifiedBy: true },
    });

    expect(docsAfter.every((doc) => doc.status === "VERIFIED")).toBe(true);
    expect(docsAfter.every((doc) => doc.verifiedBy === admin.id)).toBe(true);

    const historyResponse = await request(app)
      .get(`${API_BASE}/admin/verifications/history/${fixture.owner.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);
    expect(historyResponse.body.data.logs.length).toBeGreaterThan(0);
  });

  it("completes dispute resolution flow from assignment to final resolution", async () => {
    const { admin, token } = await createAdmin({
      adminRole: "SUPPORT_ADMIN",
      permissions: [
        "admin.disputes.read",
        "admin.disputes.assign",
        "admin.disputes.update_status",
        "admin.disputes.message",
        "admin.disputes.resolve",
      ],
    });

    const assignee = await createAdmin({
      adminRole: "SUPPORT_ADMIN",
    });

    const fixture = await createDisputeFixture();

    const queueResponse = await request(app)
      .get(`${API_BASE}/admin/disputes?search=${fixture.dispute.disputeCode}`)
      .set("Authorization", `Bearer ${token}`);

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body.success).toBe(true);

    const assignResponse = await request(app)
      .post(`${API_BASE}/admin/disputes/${fixture.dispute.id}/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        assignedTo: assignee.admin.id,
        note: "Assigned for urgent investigation",
      });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.success).toBe(true);
    expect(assignResponse.body.data.assignedTo).toBe(assignee.admin.id);

    const statusResponse = await request(app)
      .post(`${API_BASE}/admin/disputes/${fixture.dispute.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "INVESTIGATING",
        note: "Investigation in progress",
      });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.success).toBe(true);
    expect(statusResponse.body.data.status).toBe("INVESTIGATING");

    const messageResponse = await request(app)
      .post(`${API_BASE}/admin/disputes/${fixture.dispute.id}/message`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        message: "Public update shared with both parties",
        isInternalNote: false,
      });

    expect(messageResponse.status).toBe(200);
    expect(messageResponse.body.success).toBe(true);

    const resolveResponse = await request(app)
      .post(`${API_BASE}/admin/disputes/${fixture.dispute.id}/resolve`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resolution: "Refunded 20% due to delayed service start",
        resolutionType: "PARTIAL_REFUND",
        resolutionAmount: 13000,
      });

    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.success).toBe(true);
    expect(resolveResponse.body.data.status).toBe("RESOLVED");

    const disputeAfter = await prisma.dispute.findUnique({
      where: { id: fixture.dispute.id },
      select: {
        status: true,
        assignedTo: true,
        closedAt: true,
        resolutionType: true,
      },
    });

    expect(disputeAfter?.status).toBe("RESOLVED");
    expect(disputeAfter?.assignedTo).toBe(assignee.admin.id);
    expect(disputeAfter?.closedAt).not.toBeNull();
    expect(disputeAfter?.resolutionType).toBe("PARTIAL_REFUND");

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

  it("completes settlement processing flow from queue to history", async () => {
    const { admin, token } = await createAdmin({
      adminRole: "FINANCE_ADMIN",
      permissions: ["admin.financial.read", "admin.financial.process_settlement"],
    });

    const fixture = await createSettlementFixture();

    const queueResponse = await request(app)
      .get(`${API_BASE}/admin/financial/settlements?search=${fixture.settlement.settlementCode}`)
      .set("Authorization", `Bearer ${token}`);

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body.success).toBe(true);
    expect(
      queueResponse.body.data.items.some(
        (item: { id: string }) => item.id === fixture.settlement.id,
      ),
    ).toBe(true);

    const detailResponse = await request(app)
      .get(`${API_BASE}/admin/financial/settlements/${fixture.settlement.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.success).toBe(true);
    expect(detailResponse.body.data.id).toBe(fixture.settlement.id);

    const processResponse = await request(app)
      .post(`${API_BASE}/admin/financial/settlements/${fixture.settlement.id}/process`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "COMPLETED",
        notes: "Transferred to owner bank account",
      });

    expect(processResponse.status).toBe(200);
    expect(processResponse.body.success).toBe(true);
    expect(processResponse.body.data.status).toBe("COMPLETED");

    const settlementAfter = await prisma.settlement.findUnique({
      where: { id: fixture.settlement.id },
      select: {
        status: true,
        processedBy: true,
        processedAt: true,
      },
    });

    expect(settlementAfter?.status).toBe("COMPLETED");
    expect(settlementAfter?.processedBy).toBe(admin.id);
    expect(settlementAfter?.processedAt).not.toBeNull();

    const historyResponse = await request(app)
      .get(`${API_BASE}/admin/financial/settlements/history?search=${fixture.settlement.settlementCode}`)
      .set("Authorization", `Bearer ${token}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);
    expect(
      historyResponse.body.data.items.some(
        (item: { id: string; status: string }) =>
          item.id === fixture.settlement.id && item.status === "COMPLETED",
      ),
    ).toBe(true);

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
});
