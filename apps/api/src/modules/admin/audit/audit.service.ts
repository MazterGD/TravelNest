import prisma, { type Prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { ResponseHelper } from "../../../utils/response.js";
import { buildCsv } from "../types.js";

export interface CreateAuditLogInput {
  adminId?: string;
  actorId?: string;
  actorRole?: string;
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
  actorId?: string;
  actorRole?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  status?: "success" | "failure";
  dateFrom?: Date;
  dateTo?: Date;
}

type AuditFilterInput = Omit<GetAuditLogsFilters, "page" | "limit">;

// Both admin and actor are surfaced; for non-admin (customer/owner) entries the
// admin relation is null and the actor relation carries the acting user.
const auditActorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  adminRole: true,
} as const;

const auditLogInclude = {
  admin: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      adminRole: true,
    },
  },
  actor: { select: auditActorSelect },
} as const;

const buildAuditWhere = (filters: AuditFilterInput): Prisma.AuditLogWhereInput => ({
  ...(filters.adminId && { adminId: filters.adminId }),
  ...(filters.actorId && { actorId: filters.actorId }),
  ...(filters.actorRole && { actorRole: filters.actorRole }),
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
  // Always populate actorId so every entry is attributable, even legacy
  // admin-only call sites that only pass adminId.
  const actorId = data.actorId ?? data.adminId;
  const actorRole = data.actorRole ?? (data.adminId ? "ADMIN" : undefined);

  return prisma.auditLog.create({
    data: {
      adminId: data.adminId,
      actorId,
      actorRole,
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

/**
 * Record an action performed by ANY authenticated user (customer/owner/admin).
 * Used by the app-wide audit middleware. Never store request bodies here — they
 * may contain PII or secrets; only metadata belongs in the audit trail.
 */
export const recordUserAction = async (input: {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failure";
}) => {
  return createAuditLog({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    changes: input.changes as Prisma.InputJsonValue | undefined,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    status: input.status,
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
    actorId,
    actorRole,
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
    actorId,
    actorRole,
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
      include: auditLogInclude,
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
    include: auditLogInclude,
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
    include: auditLogInclude,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const headers = [
    "logId",
    "createdAt",
    "actorId",
    "actorName",
    "actorRole",
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
    log.actorId ?? "",
    log.actor ? `${log.actor.firstName} ${log.actor.lastName}`.trim() : "",
    log.actorRole ?? "",
    log.adminId ?? "",
    log.admin ? `${log.admin.firstName} ${log.admin.lastName}`.trim() : "",
    log.admin?.email ?? "",
    log.admin?.adminRole ?? "",
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
