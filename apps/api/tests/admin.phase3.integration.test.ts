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
  trackEmail(`phase3.integration.${label}.${uniqueTag()}@example.com`);

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
      firstName: "Phase3",
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
      firstName: "Phase3",
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
      firstName: "Phase3",
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
  const owner = await createOwner("owner");
  const customer = await createCustomer("customer");

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

  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: owner.id,
      name: `Phase3 Coach ${uniqueTag()}`,
      type: "LUXURY_AC",
      brand: "Ashok Leyland",
      model: "Viking",
      year: 2021,
      licensePlate: `PH3-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      seats: 45,
      fuelType: "DIESEL",
      transmission: "MANUAL",
      amenities: ["AC", "WiFi"],
      images: [],
      pricePerDay: 30000,
      location: "Colombo",
      isActive: false,
      isAvailable: true,
    },
  });

  await prisma.vehicleDocument.createMany({
    data: [
      {
        vehicleId: vehicle.id,
        type: "INSURANCE",
        url: "https://example.com/vehicle/insurance.pdf",
        fileName: "insurance.pdf",
        fileSize: 33333,
        mimeType: "application/pdf",
        status: "PENDING",
      },
      {
        vehicleId: vehicle.id,
        type: "REGISTRATION_CERTIFICATE",
        url: "https://example.com/vehicle/registration.pdf",
        fileName: "registration.pdf",
        fileSize: 44444,
        mimeType: "application/pdf",
        status: "PENDING",
      },
    ],
  });

  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      pickupLocation: "Colombo, Sri Lanka",
      dropoffLocation: "Kandy, Sri Lanka",
      totalPassengers: 20,
      totalAmount: 50000,
      status: "COMPLETED",
    },
  });

  const review = await prisma.review.create({
    data: {
      bookingId: booking.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
      rating: 1,
      comment: "Unsafe driving and very poor communication",
    },
  });

  return {
    owner,
    customer,
    vehicle,
    booking,
    review,
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

describe("Admin Phase 3 - verifications endpoints", () => {
  it("lists owner verification queue", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.verifications.read"],
    });
    const fixture = await createVerificationFixture();

    const response = await request(app)
      .get(`${API_BASE}/admin/verifications/owners?search=${fixture.owner.email}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items.some((item: { id: string }) => item.id === fixture.owner.id)).toBe(true);
  });

  it("approves owner verification and updates owner documents", async () => {
    const { admin, token } = await createAdmin({
      permissions: ["admin.verifications.approve"],
    });
    const fixture = await createVerificationFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/verifications/owners/${fixture.owner.id}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "All checks passed" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.isVerified).toBe(true);

    const ownerDocuments = await prisma.ownerDocument.findMany({
      where: { ownerId: fixture.owner.id },
      select: { status: true, verifiedBy: true },
    });

    expect(ownerDocuments.every((document) => document.status === "VERIFIED")).toBe(true);
    expect(ownerDocuments.every((document) => document.verifiedBy === admin.id)).toBe(true);
  });

  it("rejects vehicle verification and marks pending docs as rejected", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.verifications.reject"],
    });
    const fixture = await createVerificationFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/verifications/vehicles/${fixture.vehicle.id}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Insurance document has expired" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isActive).toBe(false);

    const vehicleDocuments = await prisma.vehicleDocument.findMany({
      where: { vehicleId: fixture.vehicle.id },
      select: { status: true, rejectionReason: true },
    });

    expect(vehicleDocuments.every((document) => document.status === "REJECTED")).toBe(true);
    expect(vehicleDocuments.some((document) => document.rejectionReason?.includes("expired"))).toBe(true);
  });

  it("returns verification history by entity", async () => {
    const { token } = await createAdmin({
      permissions: [
        "admin.verifications.approve",
        "admin.verifications.read",
      ],
    });
    const fixture = await createVerificationFixture();

    await request(app)
      .post(`${API_BASE}/admin/verifications/owners/${fixture.owner.id}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "Approved from integration test" });

    const response = await request(app)
      .get(`${API_BASE}/admin/verifications/history/${fixture.owner.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.logs.length).toBeGreaterThan(0);
    expect(response.body.data.logs[0].entityId).toBe(fixture.owner.id);
  });

  it("blocks verification queue access without permission", async () => {
    const { token } = await createAdmin();

    const response = await request(app)
      .get(`${API_BASE}/admin/verifications/owners`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});

describe("Admin Phase 3 - review moderation endpoints", () => {
  it("lists flagged reviews in moderation queue", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.reviews.read"],
    });
    const fixture = await createVerificationFixture();

    const response = await request(app)
      .get(`${API_BASE}/admin/reviews/moderation?search=${encodeURIComponent("Unsafe")}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.reviews.some((review: { id: string }) => review.id === fixture.review.id)).toBe(true);
  });

  it("updates review moderation status and records audit trail", async () => {
    const { admin, token } = await createAdmin({
      permissions: ["admin.reviews.update_status", "admin.reviews.read"],
    });
    const fixture = await createVerificationFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/reviews/${fixture.review.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "HIDDEN",
        reason: "Contains abusive language",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.moderationStatus).toBe("HIDDEN");

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        adminId: admin.id,
        entityType: "REVIEW_MODERATION",
        entityId: fixture.review.id,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditLog).not.toBeNull();
  });

  it("resolves a review report", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.reviews.resolve_report"],
    });
    const fixture = await createVerificationFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/reviews/${fixture.review.id}/report/resolve`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "RESOLVED",
        resolution: "Issue reviewed and no further action is required",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.reportStatus).toBe("RESOLVED");

    const reportAudit = await prisma.auditLog.findFirst({
      where: {
        entityType: "REVIEW_REPORT",
        entityId: fixture.review.id,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(reportAudit).not.toBeNull();
  });

  it("validates review moderation payload when reason is missing", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.reviews.update_status"],
    });
    const fixture = await createVerificationFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/reviews/${fixture.review.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "HIDDEN",
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("blocks moderation queue access without permission", async () => {
    const { token } = await createAdmin();

    const response = await request(app)
      .get(`${API_BASE}/admin/reviews/moderation`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
