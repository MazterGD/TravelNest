import {
  prisma,
  type AdminReportFormat,
  type AdminReportFrequency,
  type AdminReportType,
  type Prisma,
} from "@travenest/database";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { buildCsv, parsePagination } from "../types.js";
import type {
  CreateScheduledReportInput,
  ExportAdminReportInput,
  ListScheduledReportsFilters,
  ReportFormat,
  ReportType,
  RunScheduledReportInput,
  UpdateScheduledReportInput,
} from "./reports.schemas.js";

const MAX_REPORT_ROWS = 5000;

type ReportData = {
  title: string;
  headers: string[];
  rows: unknown[][];
};

const USER_ROLES = new Set(["CUSTOMER", "VEHICLE_OWNER", "ADMIN"]);
const USER_STATUSES = new Set([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
]);
const BOOKING_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
const PAYMENT_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
]);
const DISPUTE_STATUSES = new Set([
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
  "CLOSED",
  "ESCALATED",
]);
const DISPUTE_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const DOCUMENT_STATUSES = new Set(["PENDING", "VERIFIED", "REJECTED"]);

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const parseOptionalDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const getDateRangeFilter = (
  configuration: Record<string, unknown>,
): Prisma.DateTimeFilter | undefined => {
  const startDate = parseOptionalDate(configuration.startDate);
  const endDate = parseOptionalDate(configuration.endDate);

  if (!startDate && !endDate) {
    return undefined;
  }

  return {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
};

const getStringConfig = (
  configuration: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = configuration[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
};

const getMimeType = (format: AdminReportFormat) => {
  if (format === "EXCEL") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  if (format === "PDF") {
    return "application/pdf";
  }

  return "text/csv; charset=utf-8";
};

const getFileExtension = (format: AdminReportFormat) => {
  if (format === "EXCEL") {
    return "xlsx";
  }

  if (format === "PDF") {
    return "pdf";
  }

  return "csv";
};

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "admin-report";
};

const toReportFormat = (format?: ReportFormat): AdminReportFormat =>
  ((format ?? "CSV") as AdminReportFormat);

const toReportType = (reportType: ReportType): AdminReportType =>
  reportType as AdminReportType;

const computeNextRunAt = (
  frequency: AdminReportFrequency,
  baseDate = new Date(),
): Date | null => {
  if (frequency === "ON_DEMAND") {
    return null;
  }

  const next = new Date(baseDate);

  if (frequency === "DAILY") {
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (frequency === "WEEKLY") {
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (frequency === "MONTHLY") {
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  return null;
};

const normalizeCellValue = (value: unknown) =>
  String(value ?? "")
    .replace(/\r?\n/g, " ")
    .trim();

const buildPdfContent = (reportName: string, data: ReportData) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({
      margin: 36,
      size: "A4",
      autoFirstPage: true,
    });

    document.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    document.on("error", (error) => {
      reject(error);
    });

    document.fontSize(16).text("TravelNest Admin Report");
    document.moveDown(0.3);
    document.fontSize(10).text(`Report: ${reportName}`);
    document.text(`Generated At: ${new Date().toISOString()}`);
    document.moveDown(0.7);

    document.fontSize(9).text(data.headers.join(" | "), {
      width: 520,
    });
    document.moveDown(0.4);

    data.rows.forEach((row) => {
      document.text(
        row.map((value) => normalizeCellValue(value)).join(" | "),
        {
          width: 520,
        },
      );
    });

    document.end();
  });

const buildExcelContent = async (data: ReportData): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TravelNest";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Report", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = data.headers.map((header) => ({
    header,
    key: header,
    width: Math.min(48, Math.max(16, header.length + 4)),
  }));

  data.rows.forEach((row) => {
    worksheet.addRow(row.map((value) => normalizeCellValue(value)));
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };

  const rawBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(rawBuffer)
    ? rawBuffer
    : Buffer.from(rawBuffer as ArrayBuffer);
};

const buildUsersReport = async (
  configuration: Record<string, unknown>,
): Promise<ReportData> => {
  const where: Prisma.UserWhereInput = {};
  const createdAt = getDateRangeFilter(configuration);
  const role = getStringConfig(configuration, "role");
  const status = getStringConfig(configuration, "status");

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (role && USER_ROLES.has(role)) {
    where.role = role as "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN";
  }

  if (status && USER_STATUSES.has(status)) {
    where.status = status as "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_REPORT_ROWS,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      adminRole: true,
      status: true,
      isVerified: true,
      district: true,
      createdAt: true,
    },
  });

  return {
    title: "Users Report",
    headers: [
      "userId",
      "name",
      "email",
      "role",
      "adminRole",
      "status",
      "isVerified",
      "district",
      "createdAt",
    ],
    rows: users.map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`.trim(),
      user.email,
      user.role,
      user.adminRole ?? "",
      user.status,
      user.isVerified ? "YES" : "NO",
      user.district ?? "",
      user.createdAt.toISOString(),
    ]),
  };
};

const buildBookingsReport = async (
  configuration: Record<string, unknown>,
): Promise<ReportData> => {
  const where: Prisma.BookingWhereInput = {};
  const createdAt = getDateRangeFilter(configuration);
  const status = getStringConfig(configuration, "status");

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (status && BOOKING_STATUSES.has(status)) {
    where.status = status as
      | "PENDING"
      | "CONFIRMED"
      | "ONGOING"
      | "COMPLETED"
      | "CANCELLED";
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_REPORT_ROWS,
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          name: true,
          licensePlate: true,
        },
      },
      payment: {
        select: {
          status: true,
          method: true,
        },
      },
    },
  });

  return {
    title: "Bookings Report",
    headers: [
      "bookingId",
      "createdAt",
      "status",
      "totalAmount",
      "startDate",
      "endDate",
      "customer",
      "customerEmail",
      "vehicle",
      "paymentStatus",
      "paymentMethod",
    ],
    rows: bookings.map((booking) => [
      booking.id,
      booking.createdAt.toISOString(),
      booking.status,
      booking.totalAmount,
      booking.startDate.toISOString(),
      booking.endDate.toISOString(),
      `${booking.customer.firstName} ${booking.customer.lastName}`.trim(),
      booking.customer.email,
      `${booking.vehicle.name} (${booking.vehicle.licensePlate})`,
      booking.payment?.status ?? "NO_PAYMENT",
      booking.payment?.method ?? "",
    ]),
  };
};

const buildFinancialReport = async (
  configuration: Record<string, unknown>,
): Promise<ReportData> => {
  const where: Prisma.PaymentWhereInput = {};
  const createdAt = getDateRangeFilter(configuration);
  const status = getStringConfig(configuration, "status");

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (status && PAYMENT_STATUSES.has(status)) {
    where.status = status as
      | "PENDING"
      | "PROCESSING"
      | "COMPLETED"
      | "FAILED"
      | "REFUNDED";
  }

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_REPORT_ROWS,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      booking: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  return {
    title: "Financial Report",
    headers: [
      "paymentId",
      "createdAt",
      "bookingId",
      "bookingStatus",
      "user",
      "userEmail",
      "amount",
      "currency",
      "status",
      "method",
      "refundAmount",
    ],
    rows: payments.map((payment) => [
      payment.id,
      payment.createdAt.toISOString(),
      payment.booking.id,
      payment.booking.status,
      `${payment.user.firstName} ${payment.user.lastName}`.trim(),
      payment.user.email,
      payment.amount,
      payment.currency,
      payment.status,
      payment.method ?? "",
      payment.refundAmount ?? "",
    ]),
  };
};

const buildAuditReport = async (
  configuration: Record<string, unknown>,
): Promise<ReportData> => {
  const where: Prisma.AuditLogWhereInput = {};
  const createdAt = getDateRangeFilter(configuration);
  const action = getStringConfig(configuration, "action");
  const entityType = getStringConfig(configuration, "entityType");
  const status = getStringConfig(configuration, "status");

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (action) {
    where.action = action;
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (status === "success" || status === "failure") {
    where.status = status;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      admin: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_REPORT_ROWS,
  });

  return {
    title: "Audit Report",
    headers: [
      "logId",
      "createdAt",
      "admin",
      "adminEmail",
      "adminRole",
      "action",
      "entityType",
      "entityId",
      "status",
      "errorMessage",
    ],
    rows: logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      `${log.admin.firstName} ${log.admin.lastName}`.trim(),
      log.admin.email,
      log.admin.adminRole,
      log.action,
      log.entityType,
      log.entityId,
      log.status,
      log.errorMessage ?? "",
    ]),
  };
};

const buildDisputesReport = async (
  configuration: Record<string, unknown>,
): Promise<ReportData> => {
  const where: Prisma.DisputeWhereInput = {};
  const createdAt = getDateRangeFilter(configuration);
  const status = getStringConfig(configuration, "status");
  const priority = getStringConfig(configuration, "priority");

  if (createdAt) {
    where.createdAt = createdAt;
  }

  if (status && DISPUTE_STATUSES.has(status)) {
    where.status = status as
      | "OPEN"
      | "INVESTIGATING"
      | "RESOLVED"
      | "CLOSED"
      | "ESCALATED";
  }

  if (priority && DISPUTE_PRIORITIES.has(priority)) {
    where.priority = priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }

  const disputes = await prisma.dispute.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_REPORT_ROWS,
    include: {
      assignedAdmin: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return {
    title: "Disputes Report",
    headers: [
      "disputeId",
      "disputeCode",
      "createdAt",
      "type",
      "priority",
      "status",
      "subject",
      "assignedAdmin",
      "assignedAdminEmail",
    ],
    rows: disputes.map((dispute) => [
      dispute.id,
      dispute.disputeCode,
      dispute.createdAt.toISOString(),
      dispute.type,
      dispute.priority,
      dispute.status,
      dispute.subject,
      dispute.assignedAdmin
        ? `${dispute.assignedAdmin.firstName} ${dispute.assignedAdmin.lastName}`
        : "",
      dispute.assignedAdmin?.email ?? "",
    ]),
  };
};

const buildVerificationsReport = async (
  configuration: Record<string, unknown>,
): Promise<ReportData> => {
  const status = getStringConfig(configuration, "status");

  const ownerDocuments = await prisma.ownerDocument.findMany({
    where:
      status && DOCUMENT_STATUSES.has(status)
        ? { status: status as "PENDING" | "VERIFIED" | "REJECTED" }
        : undefined,
    include: {
      owner: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_REPORT_ROWS,
  });

  const vehicleDocuments = await prisma.vehicleDocument.findMany({
    where:
      status && DOCUMENT_STATUSES.has(status)
        ? { status: status as "PENDING" | "VERIFIED" | "REJECTED" }
        : undefined,
    include: {
      vehicle: {
        select: {
          name: true,
          licensePlate: true,
          owner: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_REPORT_ROWS,
  });

  const rows: unknown[][] = [
    ...ownerDocuments.map((document) => [
      "OWNER_DOCUMENT",
      document.id,
      document.type,
      document.status,
      document.createdAt.toISOString(),
      `${document.owner.firstName} ${document.owner.lastName}`.trim(),
      document.owner.email,
      "",
    ]),
    ...vehicleDocuments.map((document) => [
      "VEHICLE_DOCUMENT",
      document.id,
      document.type,
      document.status,
      document.createdAt.toISOString(),
      `${document.vehicle.owner.firstName} ${document.vehicle.owner.lastName}`.trim(),
      document.vehicle.owner.email,
      `${document.vehicle.name} (${document.vehicle.licensePlate})`,
    ]),
  ];

  return {
    title: "Verifications Report",
    headers: [
      "itemType",
      "itemId",
      "documentType",
      "status",
      "createdAt",
      "owner",
      "ownerEmail",
      "vehicle",
    ],
    rows,
  };
};

const buildOperationsReport = async (): Promise<ReportData> => {
  const [
    pendingOwnerVerifications,
    pendingOwnerDocuments,
    pendingVehicleDocuments,
    openDisputes,
    pendingSettlements,
    unreadNotifications,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: "VEHICLE_OWNER",
        status: "PENDING_VERIFICATION",
      },
    }),
    prisma.ownerDocument.count({ where: { status: "PENDING" } }),
    prisma.vehicleDocument.count({ where: { status: "PENDING" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "INVESTIGATING", "ESCALATED"] } } }),
    prisma.settlement.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.notification.count({ where: { isRead: false } }),
  ]);

  return {
    title: "Operations Report",
    headers: ["metric", "value"],
    rows: [
      ["Pending owner verifications", pendingOwnerVerifications],
      ["Pending owner documents", pendingOwnerDocuments],
      ["Pending vehicle documents", pendingVehicleDocuments],
      ["Open disputes", openDisputes],
      ["Pending settlements", pendingSettlements],
      ["Unread notifications", unreadNotifications],
    ],
  };
};

const buildSystemReport = async (): Promise<ReportData> => {
  const [
    totalUsers,
    totalAdmins,
    totalVehicles,
    totalBookings,
    totalPayments,
    totalReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.vehicle.count(),
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.scheduledReport.count(),
  ]);

  return {
    title: "System Summary Report",
    headers: ["metric", "value"],
    rows: [
      ["Total users", totalUsers],
      ["Total admins", totalAdmins],
      ["Total vehicles", totalVehicles],
      ["Total bookings", totalBookings],
      ["Total payments", totalPayments],
      ["Configured scheduled reports", totalReports],
    ],
  };
};

const buildReportData = async (
  reportType: AdminReportType,
  configuration: Record<string, unknown>,
): Promise<ReportData> => {
  if (reportType === "USERS") {
    return buildUsersReport(configuration);
  }

  if (reportType === "BOOKINGS") {
    return buildBookingsReport(configuration);
  }

  if (reportType === "FINANCIAL") {
    return buildFinancialReport(configuration);
  }

  if (reportType === "OPERATIONS") {
    return buildOperationsReport();
  }

  if (reportType === "AUDIT") {
    return buildAuditReport(configuration);
  }

  if (reportType === "DISPUTES") {
    return buildDisputesReport(configuration);
  }

  if (reportType === "VERIFICATIONS") {
    return buildVerificationsReport(configuration);
  }

  return buildSystemReport();
};

const generateReportPayload = async (options: {
  reportType: AdminReportType;
  format: AdminReportFormat;
  configuration: Record<string, unknown>;
  reportName: string;
}) => {
  const data = await buildReportData(options.reportType, options.configuration);
  const extension = getFileExtension(options.format);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${slugify(options.reportName)}-${timestamp}.${extension}`;
  let content: Buffer | string;

  if (options.format === "PDF") {
    content = await buildPdfContent(options.reportName, data);
  } else if (options.format === "EXCEL") {
    content = await buildExcelContent(data);
  } else {
    content = buildCsv(data.headers, data.rows);
  }

  return {
    filename,
    mimeType: getMimeType(options.format),
    content,
    rowCount: data.rows.length,
    headers: data.headers,
    sampleRows: data.rows.slice(0, 5),
    title: data.title,
  };
};

const buildScheduledReportsWhere = (
  filters: ListScheduledReportsFilters,
): Prisma.ScheduledReportWhereInput => {
  const where: Prisma.ScheduledReportWhereInput = {};

  if (filters.reportType) {
    where.reportType = toReportType(filters.reportType);
  }

  if (filters.format) {
    where.format = toReportFormat(filters.format);
  }

  if (filters.frequency) {
    where.frequency = filters.frequency as AdminReportFrequency;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
};

export const listScheduledReports = async (
  filters: ListScheduledReportsFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildScheduledReportsWhere(filters);

  const [items, total] = await Promise.all([
    prisma.scheduledReport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: paging.skip,
      take: paging.limit,
      include: {
        createdByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            adminRole: true,
          },
        },
        updatedByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            adminRole: true,
          },
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            runs: true,
          },
        },
      },
    }),
    prisma.scheduledReport.count({ where }),
  ]);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const createScheduledReport = async (
  adminId: string,
  payload: CreateScheduledReportInput,
) => {
  const frequency = (payload.frequency ?? "ON_DEMAND") as AdminReportFrequency;

  const created = await prisma.scheduledReport.create({
    data: {
      name: payload.name,
      description: payload.description,
      reportType: toReportType(payload.reportType),
      format: toReportFormat(payload.format),
      frequency,
      cronExpression: payload.cronExpression,
      timezone: payload.timezone ?? "Asia/Colombo",
      configuration: payload.configuration
        ? toJsonValue(payload.configuration)
        : undefined,
      recipients: payload.recipients ?? [],
      isActive: payload.isActive ?? true,
      nextRunAt:
        payload.nextRunAt ??
        ((payload.isActive ?? true)
          ? computeNextRunAt(frequency, new Date())
          : null),
      createdBy: adminId,
      updatedBy: adminId,
    },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });

  await recordAuditLog(
    adminId,
    "CREATE",
    "SCHEDULED_REPORT",
    created.id,
    {
      name: created.name,
      reportType: created.reportType,
      format: created.format,
      frequency: created.frequency,
      isActive: created.isActive,
    },
    "Scheduled report created",
  );

  return created;
};

export const updateScheduledReport = async (
  adminId: string,
  reportId: string,
  payload: UpdateScheduledReportInput,
) => {
  const existing = await prisma.scheduledReport.findUnique({
    where: { id: reportId },
  });

  if (!existing) {
    throw new ApiError(404, "Scheduled report not found");
  }

  const resolvedFrequency = (payload.frequency ?? existing.frequency) as AdminReportFrequency;
  const resolvedIsActive = payload.isActive ?? existing.isActive;

  const nextRunAt =
    payload.nextRunAt !== undefined
      ? payload.nextRunAt
      : payload.frequency !== undefined || payload.isActive !== undefined
        ? resolvedIsActive
          ? computeNextRunAt(resolvedFrequency, new Date())
          : null
        : existing.nextRunAt;

  const updated = await prisma.scheduledReport.update({
    where: { id: reportId },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.reportType !== undefined
        ? { reportType: toReportType(payload.reportType) }
        : {}),
      ...(payload.format !== undefined ? { format: toReportFormat(payload.format) } : {}),
      ...(payload.frequency !== undefined
        ? { frequency: payload.frequency as AdminReportFrequency }
        : {}),
      ...(payload.cronExpression !== undefined
        ? { cronExpression: payload.cronExpression }
        : {}),
      ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
      ...(payload.configuration !== undefined
        ? { configuration: toJsonValue(payload.configuration) }
        : {}),
      ...(payload.recipients !== undefined ? { recipients: payload.recipients } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      ...(nextRunAt !== undefined ? { nextRunAt } : {}),
      updatedBy: adminId,
    },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
      updatedByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "SCHEDULED_REPORT",
    updated.id,
    {
      updatedFields: Object.keys(payload),
      previousFrequency: existing.frequency,
      newFrequency: updated.frequency,
      previousIsActive: existing.isActive,
      newIsActive: updated.isActive,
    },
    "Scheduled report updated",
  );

  return updated;
};

export const archiveScheduledReport = async (adminId: string, reportId: string) => {
  const existing = await prisma.scheduledReport.findUnique({
    where: { id: reportId },
  });

  if (!existing) {
    throw new ApiError(404, "Scheduled report not found");
  }

  const archived = await prisma.scheduledReport.update({
    where: { id: reportId },
    data: {
      isActive: false,
      nextRunAt: null,
      updatedBy: adminId,
    },
  });

  await recordAuditLog(
    adminId,
    "ARCHIVE",
    "SCHEDULED_REPORT",
    archived.id,
    {
      previousIsActive: existing.isActive,
      newIsActive: archived.isActive,
    },
    "Scheduled report archived",
  );

  return {
    id: archived.id,
    deleted: true,
  };
};

export const runScheduledReport = async (
  adminId: string,
  reportId: string,
  payload: RunScheduledReportInput,
) => {
  const report = await prisma.scheduledReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new ApiError(404, "Scheduled report not found");
  }

  const run = await prisma.scheduledReportRun.create({
    data: {
      reportId: report.id,
      triggeredBy: adminId,
      triggerSource: "MANUAL",
      status: "RUNNING",
      format: toReportFormat(payload.format ?? (report.format as ReportFormat)),
    },
  });

  try {
    const generated = await generateReportPayload({
      reportType: report.reportType,
      format: toReportFormat(payload.format ?? (report.format as ReportFormat)),
      configuration: toRecord(report.configuration),
      reportName: report.name,
    });

    const completedRun = await prisma.scheduledReportRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        fileName: generated.filename,
        rowCount: generated.rowCount,
        completedAt: new Date(),
      },
    });

    const updatedReport = await prisma.scheduledReport.update({
      where: { id: report.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt:
          report.isActive && report.frequency !== "ON_DEMAND"
            ? computeNextRunAt(report.frequency, new Date())
            : null,
        updatedBy: adminId,
      },
    });

    await recordAuditLog(
      adminId,
      "RUN",
      "SCHEDULED_REPORT",
      report.id,
      {
        runId: completedRun.id,
        rowCount: completedRun.rowCount,
        format: completedRun.format,
      },
      "Scheduled report executed",
    );

    return {
      report: updatedReport,
      run: completedRun,
      preview: {
        headers: generated.headers,
        rows: generated.sampleRows,
      },
    };
  } catch (error) {
    await prisma.scheduledReportRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Unexpected report generation error",
      },
    });

    await recordAuditLog(
      adminId,
      "RUN",
      "SCHEDULED_REPORT",
      report.id,
      {
        runId: run.id,
      },
      "Scheduled report execution failed",
      "failure",
      error instanceof Error ? error.message : "Unexpected report generation error",
    );

    throw error;
  }
};

export const exportAdminReport = async (
  adminId: string,
  payload: ExportAdminReportInput,
) => {
  const scheduledReport = payload.reportId
    ? await prisma.scheduledReport.findUnique({
        where: { id: payload.reportId },
      })
    : null;

  if (payload.reportId && !scheduledReport) {
    throw new ApiError(404, "Scheduled report not found");
  }

  const reportType =
    scheduledReport?.reportType ??
    (payload.reportType ? toReportType(payload.reportType) : undefined);

  if (!reportType) {
    throw new ApiError(400, "reportType is required when reportId is not provided");
  }

  const format = toReportFormat(
    payload.format ?? ((scheduledReport?.format as ReportFormat | undefined) ?? "CSV"),
  );

  const mergedConfiguration = {
    ...toRecord(scheduledReport?.configuration),
    ...toRecord(payload.configuration),
  };

  const reportName =
    payload.name ??
    scheduledReport?.name ??
    `${reportType.toLowerCase()} report`;

  const generated = await generateReportPayload({
    reportType,
    format,
    configuration: mergedConfiguration,
    reportName,
  });

  if (scheduledReport) {
    await prisma.scheduledReportRun.create({
      data: {
        reportId: scheduledReport.id,
        triggeredBy: adminId,
        triggerSource: "EXPORT",
        status: "SUCCESS",
        format,
        fileName: generated.filename,
        rowCount: generated.rowCount,
        completedAt: new Date(),
      },
    });

    await prisma.scheduledReport.update({
      where: { id: scheduledReport.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt:
          scheduledReport.isActive && scheduledReport.frequency !== "ON_DEMAND"
            ? computeNextRunAt(scheduledReport.frequency, new Date())
            : null,
        updatedBy: adminId,
      },
    });
  }

  await recordAuditLog(
    adminId,
    "EXPORT",
    scheduledReport ? "SCHEDULED_REPORT" : "ADMIN_REPORT",
    scheduledReport?.id ?? generated.filename,
    {
      reportType,
      format,
      rowCount: generated.rowCount,
    },
    "Admin report exported",
  );

  return {
    filename: generated.filename,
    mimeType: generated.mimeType,
    content: generated.content,
    rowCount: generated.rowCount,
    reportType,
    format,
  };
};
