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
  trackEmail(`phase2.integration.${label}.${uniqueTag()}@example.com`);

const makeToken = (
  id: string,
  email: string,
  role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER",
  tokenVersion?: number,
) =>
  jwt.sign(
    {
      id,
      email,
      role,
      ...(tokenVersion !== undefined ? { tokenVersion } : {}),
    },
    config.jwt.secret,
    { expiresIn: "1h" },
  );

const createAdmin = async (options?: {
  adminRole?: "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN";
  permissions?: string[];
}) => {
  const admin = await prisma.user.create({
    data: {
      email: makeEmail("admin"),
      password: "password-hash",
      firstName: "Phase2",
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

const createCustomer = async (label: string, district = "Colombo") => {
  return prisma.user.create({
    data: {
      email: makeEmail(label),
      password: "password-hash",
      firstName: "Phase2",
      lastName: "Customer",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      district,
    },
  });
};

const createOwner = async (
  label: string,
  status: "ACTIVE" | "PENDING_VERIFICATION" = "ACTIVE",
) => {
  return prisma.user.create({
    data: {
      email: makeEmail(label),
      password: "password-hash",
      firstName: "Phase2",
      lastName: "Owner",
      role: "VEHICLE_OWNER",
      status,
      isVerified: status === "ACTIVE",
      district: "Kandy",
    },
  });
};

const createBookingFixture = async () => {
  const owner = await createOwner("owner");
  const customer = await createCustomer("customer", "Galle");

  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: owner.id,
      name: `Phase2 Coach ${uniqueTag()}`,
      type: "ORDINARY",
      brand: "Ashok Leyland",
      model: "Viking",
      year: 2022,
      licensePlate: `PH2-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      seats: 45,
      fuelType: "DIESEL",
      transmission: "MANUAL",
      amenities: ["AC", "WiFi"],
      images: [],
      pricePerDay: 25000,
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
      totalPassengers: 20,
      totalAmount: 45000,
      status: "PENDING",
    },
  });

  const payment = await prisma.payment.create({
    data: {
      userId: customer.id,
      bookingId: booking.id,
      amount: 45000,
      status: "COMPLETED",
      method: "BANK_TRANSFER",
    },
  });

  return {
    owner,
    customer,
    vehicle,
    booking,
    payment,
  };
};

const seedAnalyticsData = async (adminId: string) => {
  const bookingFixture = await createBookingFixture();
  const pendingOwner = await createOwner("pending-owner", "PENDING_VERIFICATION");

  await prisma.ownerDocument.create({
    data: {
      ownerId: pendingOwner.id,
      type: "NIC",
      url: "https://example.com/documents/nic.pdf",
      fileName: "nic.pdf",
      fileSize: 12345,
      mimeType: "application/pdf",
      status: "PENDING",
    },
  });

  await prisma.vehicleDocument.create({
    data: {
      vehicleId: bookingFixture.vehicle.id,
      type: "INSURANCE",
      url: "https://example.com/documents/insurance.pdf",
      fileName: "insurance.pdf",
      fileSize: 23456,
      mimeType: "application/pdf",
      status: "PENDING",
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId,
      action: "admin.analytics.seed",
      entityType: "ANALYTICS",
      entityId: bookingFixture.booking.id,
    },
  });

  return {
    ...bookingFixture,
    pendingOwner,
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

describe("Admin Phase 2 - users endpoints", () => {
  it("lists users for admins with admin.users.read permission", async () => {
    const { token } = await createAdmin({ permissions: ["admin.users.read"] });

    const managedUser = await prisma.user.create({
      data: {
        email: makeEmail("managed-user"),
        password: "password-hash",
        firstName: "Managed",
        lastName: "User",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });

    const response = await request(app)
      .get(`${API_BASE}/admin/users?search=Managed`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.users.some((user: { id: string }) => user.id === managedUser.id)).toBe(true);
  });

  it("blocks users listing when permission is missing", async () => {
    const { token } = await createAdmin();

    const response = await request(app)
      .get(`${API_BASE}/admin/users`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("updates user status and writes an audit log", async () => {
    const { admin, token } = await createAdmin({
      permissions: ["admin.users.update_status"],
    });

    const targetUser = await createCustomer("status-target");

    const response = await request(app)
      .patch(`${API_BASE}/admin/users/${targetUser.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "SUSPENDED",
        reason: "Suspended by integration test",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("SUSPENDED");

    const updatedUser = await prisma.user.findUnique({
      where: { id: targetUser.id },
      select: { status: true },
    });
    expect(updatedUser?.status).toBe("SUSPENDED");

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        adminId: admin.id,
        entityType: "USER",
        entityId: targetUser.id,
      },
    });

    expect(auditLog).not.toBeNull();
  });

  it("creates admin accounts from super admin endpoint", async () => {
    const { token } = await createAdmin({ adminRole: "SUPER_ADMIN" });

    const response = await request(app)
      .post(`${API_BASE}/admin/admins`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "New",
        lastName: "Moderator",
        email: makeEmail("new-admin"),
        password: "NewAdminPass123!",
        adminRole: "MODERATOR",
        permissions: ["admin.users.read", "admin.bookings.read"],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe("ADMIN");
    expect(response.body.data.adminRole).toBe("MODERATOR");

    const permissionCount = await prisma.adminPermission.count({
      where: { adminId: response.body.data.id },
    });
    expect(permissionCount).toBe(2);
  });

  it("exports users as CSV when authorized", async () => {
    const { token } = await createAdmin({ permissions: ["admin.users.export"] });

    const exportedUser = await createCustomer("csv-user");

    const response = await request(app)
      .get(`${API_BASE}/admin/users/export?search=${encodeURIComponent(exportedUser.email)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain('"id","firstName","lastName","email"');
    expect(response.text).toContain(exportedUser.email);
  });

  it("validates update status payload", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.users.update_status"],
    });
    const targetUser = await createCustomer("invalid-status-target");

    const response = await request(app)
      .patch(`${API_BASE}/admin/users/${targetUser.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "NOT_A_REAL_STATUS",
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("invalidates existing user sessions after admin password reset", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.users.reset_password"],
    });

    const targetUser = await createCustomer("password-reset-target");
    const oldUserToken = makeToken(
      targetUser.id,
      targetUser.email,
      "CUSTOMER",
      targetUser.tokenVersion,
    );

    const resetResponse = await request(app)
      .patch(`${API_BASE}/admin/users/${targetUser.id}/password`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        newPassword: "ResetPass123!",
      });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.success).toBe(true);

    const oldTokenResponse = await request(app)
      .get(`${API_BASE}/notifications/unread-count`)
      .set("Authorization", `Bearer ${oldUserToken}`);

    expect(oldTokenResponse.status).toBe(401);
    expect(oldTokenResponse.body.success).toBe(false);
    expect(oldTokenResponse.body.error.code).toBe("TOKEN_INVALIDATED");
  });
});

describe("Admin Phase 2 - bookings endpoints", () => {
  it("lists and retrieves booking details with read permission", async () => {
    const { token } = await createAdmin({ permissions: ["admin.bookings.read"] });
    const fixture = await createBookingFixture();

    const listResponse = await request(app)
      .get(`${API_BASE}/admin/bookings?search=${fixture.booking.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(
      listResponse.body.data.bookings.some(
        (booking: { id: string }) => booking.id === fixture.booking.id,
      ),
    ).toBe(true);

    const detailsResponse = await request(app)
      .get(`${API_BASE}/admin/bookings/${fixture.booking.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(detailsResponse.status).toBe(200);
    expect(detailsResponse.body.success).toBe(true);
    expect(detailsResponse.body.data.id).toBe(fixture.booking.id);
  });

  it("updates booking status through admin endpoint", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.bookings.update_status"],
    });
    const fixture = await createBookingFixture();

    const response = await request(app)
      .patch(`${API_BASE}/admin/bookings/${fixture.booking.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "CONFIRMED",
        reason: "Confirmed by admin",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("CONFIRMED");

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: fixture.booking.id },
      select: { status: true },
    });
    expect(updatedBooking?.status).toBe("CONFIRMED");
  });

  it("cancels booking with refund and updates payment record", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.bookings.cancel_refund"],
    });
    const fixture = await createBookingFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/bookings/${fixture.booking.id}/cancel-with-refund`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        refundReason: "Duplicate booking",
        refundAmount: 20000,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.booking.status).toBe("CANCELLED");
    expect(response.body.data.payment.status).toBe("REFUNDED");
    expect(response.body.data.payment.refundAmount).toBe(20000);

    const payment = await prisma.payment.findUnique({
      where: { id: fixture.payment.id },
      select: {
        status: true,
        refundAmount: true,
      },
    });

    expect(payment?.status).toBe("REFUNDED");
    expect(payment?.refundAmount).toBe(20000);
  });

  it("exports bookings as CSV when authorized", async () => {
    const { token } = await createAdmin({ permissions: ["admin.bookings.export"] });
    const fixture = await createBookingFixture();

    const response = await request(app)
      .get(`${API_BASE}/admin/bookings/export?search=${fixture.booking.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain('"bookingId","customerId","customerName"');
    expect(response.text).toContain(fixture.booking.id);
  });

  it("blocks booking routes when permission is missing", async () => {
    const { token } = await createAdmin();

    const response = await request(app)
      .get(`${API_BASE}/admin/bookings`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("validates cancel-with-refund payload", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.bookings.cancel_refund"],
    });
    const fixture = await createBookingFixture();

    const response = await request(app)
      .post(`${API_BASE}/admin/bookings/${fixture.booking.id}/cancel-with-refund`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        refundReason: "",
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });
});

describe("Admin Phase 2 - analytics endpoints", () => {
  const rangeQuery = "startDate=2020-01-01&endDate=2030-12-31";

  it("returns users, bookings, financial, operational, and geographic analytics", async () => {
    const { admin, token } = await createAdmin({
      permissions: ["admin.analytics.read"],
    });
    await seedAnalyticsData(admin.id);

    const usersResponse = await request(app)
      .get(`${API_BASE}/admin/analytics/users?${rangeQuery}`)
      .set("Authorization", `Bearer ${token}`);

    expect(usersResponse.status).toBe(200);
    expect(usersResponse.body.success).toBe(true);
    expect(usersResponse.body.data).toHaveProperty("totalUsers");
    expect(Array.isArray(usersResponse.body.data.growthSeries)).toBe(true);

    const bookingsResponse = await request(app)
      .get(`${API_BASE}/admin/analytics/bookings?${rangeQuery}`)
      .set("Authorization", `Bearer ${token}`);

    expect(bookingsResponse.status).toBe(200);
    expect(bookingsResponse.body.success).toBe(true);
    expect(bookingsResponse.body.data).toHaveProperty("totalBookingsInRange");

    const financialResponse = await request(app)
      .get(`${API_BASE}/admin/analytics/financial?${rangeQuery}`)
      .set("Authorization", `Bearer ${token}`);

    expect(financialResponse.status).toBe(200);
    expect(financialResponse.body.success).toBe(true);
    expect(financialResponse.body.data).toHaveProperty("completedRevenue");

    const operationalResponse = await request(app)
      .get(`${API_BASE}/admin/analytics/operational?${rangeQuery}`)
      .set("Authorization", `Bearer ${token}`);

    expect(operationalResponse.status).toBe(200);
    expect(operationalResponse.body.success).toBe(true);
    expect(operationalResponse.body.data.pendingVerificationItems).toBeGreaterThan(0);

    const geographicResponse = await request(app)
      .get(`${API_BASE}/admin/analytics/geographic?${rangeQuery}`)
      .set("Authorization", `Bearer ${token}`);

    expect(geographicResponse.status).toBe(200);
    expect(geographicResponse.body.success).toBe(true);
    expect(Array.isArray(geographicResponse.body.data.bookingsByPickupCity)).toBe(true);
  });

  it("exports analytics report as CSV when authorized", async () => {
    const { admin, token } = await createAdmin({
      permissions: ["admin.analytics.export"],
    });
    await seedAnalyticsData(admin.id);

    const response = await request(app)
      .get(`${API_BASE}/admin/analytics/export?${rangeQuery}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain('"section","metric","value"');
  });

  it("validates analytics date range", async () => {
    const { token } = await createAdmin({
      permissions: ["admin.analytics.read"],
    });

    const response = await request(app)
      .get(`${API_BASE}/admin/analytics/users?startDate=2030-01-01&endDate=2020-01-01`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("blocks analytics endpoints when read permission is missing", async () => {
    const { token } = await createAdmin();

    const response = await request(app)
      .get(`${API_BASE}/admin/analytics/users`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
