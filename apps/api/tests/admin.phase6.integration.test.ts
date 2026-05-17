import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import app from "../src/app";
import { config } from "../src/config/index";
import "./setup";
import { prisma } from "@travenest/database";

const API_BASE = "/api/v1";

const createdEmails: string[] = [];

const uniqueTag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const trackEmail = (email: string) => {
  createdEmails.push(email);
  return email;
};

const makeEmail = (label: string) =>
  trackEmail(`phase6.integration.${label}.${uniqueTag()}@example.com`);

const makeToken = (
  id: string,
  email: string,
  role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER",
) => jwt.sign({ id, email, role }, config.jwt.secret, { expiresIn: "1h" });

const createAdmin = async (options?: {
  adminRole?: "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN";
  permissions?: string[];
  password?: string;
}) => {
  const rawPassword = options?.password ?? "Password123!";
  const hashedPassword = await bcrypt.hash(rawPassword, 12);

  const admin = await prisma.user.create({
    data: {
      email: makeEmail("admin"),
      password: hashedPassword,
      firstName: "Phase6",
      lastName: "Admin",
      phone: "+94771234567",
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
    rawPassword,
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

describe("Admin Phase 6 - audit, reports, and profile", () => {
  it("lists and exports audit logs", async () => {
    const { admin, token } = await createAdmin({
      permissions: ["audit.read", "audit.export"],
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "TEST_ACTION",
        entityType: "TEST_ENTITY",
        entityId: `entity-${uniqueTag()}`,
        status: "success",
      },
    });

    const listResponse = await request(app)
      .get(`${API_BASE}/admin/audit-logs?action=TEST_ACTION`)
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data.logs.length).toBeGreaterThan(0);

    const exportResponse = await request(app)
      .get(`${API_BASE}/admin/audit-logs/export?action=TEST_ACTION`)
      .set("Authorization", `Bearer ${token}`);

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(String(exportResponse.text)).toContain("TEST_ACTION");
  });

  it("manages scheduled reports and export workflow", async () => {
    const { token } = await createAdmin({
      permissions: [
        "admin.reports.read",
        "admin.reports.create",
        "admin.reports.update",
        "admin.reports.run",
        "admin.reports.export",
        "admin.reports.archive",
      ],
    });

    const createResponse = await request(app)
      .post(`${API_BASE}/admin/reports`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Operations Pulse ${uniqueTag()}`,
        description: "Daily operations report",
        reportType: "OPERATIONS",
        format: "CSV",
        frequency: "DAILY",
        configuration: { includePending: true },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);

    const reportId = createResponse.body.data.id as string;

    const listResponse = await request(app)
      .get(`${API_BASE}/admin/reports?reportType=OPERATIONS`)
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(
      listResponse.body.data.items.some((item: { id: string }) => item.id === reportId),
    ).toBe(true);

    const runResponse = await request(app)
      .post(`${API_BASE}/admin/reports/${reportId}/run`)
      .set("Authorization", `Bearer ${token}`)
      .send({ format: "CSV" });

    expect(runResponse.status).toBe(200);
    expect(runResponse.body.success).toBe(true);
    expect(runResponse.body.data.run.status).toBe("SUCCESS");

    const csvExportResponse = await request(app)
      .post(`${API_BASE}/admin/reports/export`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reportId, format: "CSV" });

    expect(csvExportResponse.status).toBe(200);
    expect(csvExportResponse.headers["content-type"]).toContain("text/csv");
    expect(String(csvExportResponse.text)).toContain("metric");

    const pdfExportResponse = await request(app)
      .post(`${API_BASE}/admin/reports/export`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reportId, format: "PDF" });

    expect(pdfExportResponse.status).toBe(200);
    expect(pdfExportResponse.headers["content-type"]).toContain("application/pdf");
    expect(pdfExportResponse.headers["content-disposition"]).toContain(".pdf");
    const pdfContent = Buffer.isBuffer(pdfExportResponse.body)
      ? pdfExportResponse.body
      : Buffer.from(String(pdfExportResponse.text ?? ""), "binary");
    expect(pdfContent.length).toBeGreaterThan(200);

    const excelExportResponse = await request(app)
      .post(`${API_BASE}/admin/reports/export`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reportId, format: "EXCEL" });

    expect(excelExportResponse.status).toBe(200);
    expect(excelExportResponse.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(excelExportResponse.headers["content-disposition"]).toContain(".xlsx");
    const excelContent = Buffer.isBuffer(excelExportResponse.body)
      ? excelExportResponse.body
      : Buffer.from(String(excelExportResponse.text ?? ""), "binary");
    expect(excelContent.length).toBeGreaterThan(200);

    const archiveResponse = await request(app)
      .delete(`${API_BASE}/admin/reports/${reportId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.success).toBe(true);
    expect(archiveResponse.body.data.deleted).toBe(true);
  });

  it("supports admin profile details, updates, password change, activity, and permissions", async () => {
    const { admin, token, rawPassword } = await createAdmin({
      permissions: ["admin.profile.read", "admin.profile.update"],
      password: "CurrentPass123!",
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "PROFILE_VIEW",
        entityType: "ADMIN_PROFILE",
        entityId: admin.id,
        status: "success",
      },
    });

    const profileResponse = await request(app)
      .get(`${API_BASE}/admin/profile`)
      .set("Authorization", `Bearer ${token}`);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.success).toBe(true);
    expect(profileResponse.body.data.email).toBe(admin.email);

    const updateResponse = await request(app)
      .patch(`${API_BASE}/admin/profile/personal`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "Updated",
        phone: "+94770000000",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.firstName).toBe("Updated");

    const activityResponse = await request(app)
      .get(`${API_BASE}/admin/profile/activity?action=PROFILE_VIEW`)
      .set("Authorization", `Bearer ${token}`);

    expect(activityResponse.status).toBe(200);
    expect(activityResponse.body.success).toBe(true);
    expect(activityResponse.body.data.items.length).toBeGreaterThan(0);

    const permissionsResponse = await request(app)
      .get(`${API_BASE}/admin/profile/permissions`)
      .set("Authorization", `Bearer ${token}`);

    expect(permissionsResponse.status).toBe(200);
    expect(permissionsResponse.body.success).toBe(true);
    expect(permissionsResponse.body.data.effectivePermissions).toContain(
      "admin.profile.read",
    );

    const passwordResponse = await request(app)
      .patch(`${API_BASE}/admin/profile/password`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: rawPassword,
        newPassword: "NewPass123!",
        confirmPassword: "NewPass123!",
      });

    expect(passwordResponse.status).toBe(200);
    expect(passwordResponse.body.success).toBe(true);
    expect(passwordResponse.body.data.message).toBe("Password changed successfully");
  });
});
