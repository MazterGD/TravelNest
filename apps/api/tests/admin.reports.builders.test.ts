/**
 * Admin report exports: every report type builds in every format, and a
 * scheduled report can be updated and exported against its saved settings.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = `reports-build-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;

const REPORT_TYPES = [
  "USERS",
  "BOOKINGS",
  "FINANCIAL",
  "OPERATIONS",
  "AUDIT",
  "DISPUTES",
  "VERIFICATIONS",
  "SYSTEM",
] as const;

const MIME = {
  CSV: /text\/csv/,
  PDF: /application\/pdf/,
  EXCEL: /spreadsheetml/,
} as const;

const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

describe("Admin report exports", () => {
  const ids = { admin: "", customer: "", owner: "", vehicle: "", booking: "" };
  let token = "";

  const exportReport = (body: Record<string, unknown>) =>
    request(app)
      .post(`${API_BASE}/admin/reports/export`)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(binary)
      .send(body);

  const cleanup = async () => {
    const users = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.scheduledReportRun.deleteMany({ where: { report: { createdBy: { in: users } } } });
    await prisma.scheduledReport.deleteMany({ where: { createdBy: { in: users } } });
    await prisma.auditLog.deleteMany({ where: { adminId: { in: users } } });
    await prisma.dispute.deleteMany({ where: { raisedBy: { in: users } } });
    await prisma.payment.deleteMany({ where: { userId: { in: users } } });
    await prisma.booking.deleteMany({ where: { customerId: { in: users } } });
    await prisma.ownerDocument.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  };

  beforeAll(async () => {
    await cleanup();
    const make = (key: string, role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER", extra = {}) =>
      prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: key,
          lastName: "Tester",
          role,
          status: "ACTIVE",
          ...extra,
        },
      });
    ids.admin = (await make("admin", "ADMIN", { adminRole: "SUPER_ADMIN" })).id;
    ids.customer = (await make("customer", "CUSTOMER")).id;
    ids.owner = (await make("owner", "VEHICLE_OWNER", { status: "PENDING_VERIFICATION" })).id;
    token = jwt.sign({ id: ids.admin, email: `${PREFIX}.admin@example.com`, role: "ADMIN" }, config.jwt.secret, {
      expiresIn: "1h",
    });

    ids.vehicle = (
      await prisma.vehicle.create({
        data: {
          ownerId: ids.owner,
          name: `${PREFIX} bus`,
          type: "ORDINARY",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: "RBZ-5566",
          seats: 40,
          fuelType: "DIESEL",
          transmission: "MANUAL",
          pricePerDay: 15000,
          location: "Colombo",
          images: [],
          amenities: [],
          isActive: false,
          isAvailable: true,
        },
      })
    ).id;
    ids.booking = (
      await prisma.booking.create({
        data: {
          customerId: ids.customer,
          vehicleId: ids.vehicle,
          startDate: new Date(Date.now() - 3 * DAY),
          endDate: new Date(Date.now() - 2 * DAY),
          pickupLocation: "Colombo",
          totalAmount: 25000,
          status: "COMPLETED",
          payment: {
            create: { userId: ids.customer, amount: 25000, status: "COMPLETED", method: "CARD" },
          },
        },
      })
    ).id;
    await prisma.dispute.create({
      data: {
        disputeCode: `DSP-${PREFIX}`,
        bookingId: ids.booking,
        raisedBy: ids.customer,
        raisedAgainst: ids.owner,
        type: "OTHER",
        subject: "Late pickup",
        description: "The bus arrived two hours late.",
        evidenceUrls: [],
        status: "OPEN",
      },
    });
    await prisma.ownerDocument.create({
      data: {
        ownerId: ids.owner,
        type: "NIC",
        url: `storage://private/owner-documents/${PREFIX}/nic.pdf`,
        fileName: "nic.pdf",
        fileSize: 10,
        mimeType: "application/pdf",
      },
    });
    await prisma.auditLog.create({
      data: {
        adminId: ids.admin,
        action: "UPDATE",
        entityType: "USER",
        entityId: ids.customer,
        changes: { note: "Seeded audit entry" },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  for (const reportType of REPORT_TYPES) {
    for (const format of ["CSV", "PDF", "EXCEL"] as const) {
      it(`builds the ${reportType} report as ${format}`, async () => {
        const res = await exportReport({
          reportType,
          format,
          configuration: {
            startDate: new Date(Date.now() - 30 * DAY).toISOString(),
            endDate: new Date(Date.now() + DAY).toISOString(),
          },
        });

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(MIME[format]);
        expect(res.headers["content-disposition"]).toMatch(/attachment; filename=/);
        expect((res.body as Buffer).length).toBeGreaterThan(0);
      });
    }
  }

  it("updates a scheduled report and exports it with its saved settings", async () => {
    const created = await request(app)
      .post(`${API_BASE}/admin/reports`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `${PREFIX} weekly`, reportType: "USERS", format: "CSV", frequency: "WEEKLY" });
    expect(created.status).toBe(201);
    const reportId = created.body.data.report?.id ?? created.body.data.id;

    const updated = await request(app)
      .patch(`${API_BASE}/admin/reports/${reportId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `${PREFIX} monthly`,
        frequency: "MONTHLY",
        format: "PDF",
        recipients: ["finance@example.com"],
        configuration: { role: "CUSTOMER" },
      });
    expect(updated.status).toBe(200);
    const row = await prisma.scheduledReport.findUnique({ where: { id: reportId } });
    expect(row).toMatchObject({ name: `${PREFIX} monthly`, frequency: "MONTHLY", format: "PDF" });
    expect(row?.nextRunAt).not.toBeNull();

    const paused = await request(app)
      .patch(`${API_BASE}/admin/reports/${reportId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false, frequency: "ON_DEMAND" });
    expect(paused.status).toBe(200);
    expect((await prisma.scheduledReport.findUnique({ where: { id: reportId } }))?.nextRunAt).toBeNull();

    const exported = await exportReport({ reportId });
    expect(exported.status).toBe(200);
    expect(exported.headers["content-type"]).toMatch(MIME.PDF);
    expect(await prisma.scheduledReportRun.count({ where: { reportId, triggerSource: "EXPORT" } })).toBe(1);

    const empty = await request(app)
      .patch(`${API_BASE}/admin/reports/${reportId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const missing = await request(app)
      .patch(`${API_BASE}/admin/reports/missing-report`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope" });
    expect(empty.status).toBe(422);
    expect(missing.status).toBe(404);
  });
});
