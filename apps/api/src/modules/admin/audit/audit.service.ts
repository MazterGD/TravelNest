import prisma, { type Prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { ResponseHelper } from "../../../utils/response.js";
import { buildCsv } from "../types.js";

export interface CreateAuditLogInput {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failure";
  errorMessage?: string;
}

export interface GetAuditLogsFilters {
  page: number;
  limit: number;
  adminId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  status?: "success" | "failure";
  dateFrom?: Date;
  dateTo?: Date;
}

type AuditFilterInput = Omit<GetAuditLogsFilters, "page" | "limit">;

const buildAuditWhere = (filters: AuditFilterInput): Prisma.AuditLogWhereInput => ({
  ...(filters.adminId && { adminId: filters.adminId }),
  ...(filters.action && { action: filters.action }),
  ...(filters.entityType && { entityType: filters.entityType }),
  ...(filters.entityId && { entityId: filters.entityId }),
  ...(filters.status && { status: filters.status }),
  ...((filters.dateFrom || filters.dateTo) && {
    createdAt: {
      ...(filters.dateFrom && { gte: filters.dateFrom }),
      ...(filters.dateTo && { lte: filters.dateTo }),
    },
  }),
});

export const createAuditLog = async (data: CreateAuditLogInput) => {
  return prisma.auditLog.create({
    data: {
      adminId: data.adminId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      changes: data.changes,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: data.status ?? "success",
      errorMessage: data.errorMessage,
    },
  });
};

export const recordAuditLog = async (
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: Record<string, unknown>,
  message?: string,
  status: "success" | "failure" = "success",
  errorMessage?: string,
) => {
  const mergedChanges: Prisma.InputJsonValue | undefined = {
    ...(changes ?? {}),
    ...(message ? { message } : {}),
  } as Prisma.InputJsonValue;

  return createAuditLog({
    adminId,
    action,
    entityType,
    entityId,
    changes: mergedChanges,
    status,
    errorMessage,
  });
};

export const getAuditLogs = async (filters: GetAuditLogsFilters) => {
  const {
    page,
    limit,
    adminId,
    action,
    entityType,
    entityId,
    status,
    dateFrom,
    dateTo,
  } = filters;
  const skip = (page - 1) * limit;

  const where = buildAuditWhere({
    adminId,
    action,
    entityType,
    entityId,
    status,
    dateFrom,
    dateTo,
  });

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        admin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            adminRole: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: ResponseHelper.calculatePagination(page, limit, total),
  };
};

export const getAuditLogById = async (logId: string) => {
  const log = await prisma.auditLog.findUnique({
    where: { id: logId },
    include: {
      admin: {
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

  if (!log) {
    throw ApiError.notFound("Audit log");
  }

  return log;
};

export const getAuditLogsByUser = async (
  adminId: string,
  page: number,
  limit: number,
) => {
  return getAuditLogs({ page, limit, adminId });
};

export const getAuditLogsByEntity = async (
  entityType: string,
  entityId: string,
  page: number,
  limit: number,
) => {
  return getAuditLogs({ page, limit, entityType, entityId });
};

export const exportAuditLogsCsv = async (filters: AuditFilterInput) => {
  const where = buildAuditWhere(filters);

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      admin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const headers = [
    "logId",
    "createdAt",
    "adminId",
    "adminName",
    "adminEmail",
    "adminRole",
    "action",
    "entityType",
    "entityId",
    "status",
    "ipAddress",
    "userAgent",
    "errorMessage",
    "changes",
  ];

  const rows = logs.map((log) => [
    log.id,
    log.createdAt.toISOString(),
    log.adminId,
    `${log.admin.firstName} ${log.admin.lastName}`.trim(),
    log.admin.email,
    log.admin.adminRole,
    log.action,
    log.entityType,
    log.entityId,
    log.status,
    log.ipAddress ?? "",
    log.userAgent ?? "",
    log.errorMessage ?? "",
    log.changes ? JSON.stringify(log.changes) : "",
  ]);

  return buildCsv(headers, rows);
};
