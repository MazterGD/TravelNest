import type { Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import { ApiError } from "../../../middleware/errorHandler.js";
import { sendCsvResponse } from "../types.js";
import * as auditService from "./audit.service.js";

const parseDate = (value: unknown, fieldName: string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest(`Invalid date format for ${fieldName}`);
  }

  return parsed;
};

export const getAuditLogs = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const dateFrom = parseDate(req.query.dateFrom, "dateFrom");
  const dateTo = parseDate(req.query.dateTo, "dateTo");

  const result = await auditService.getAuditLogs({
    page,
    limit,
    adminId: req.query.adminId ? String(req.query.adminId) : undefined,
    action: req.query.action ? String(req.query.action) : undefined,
    entityType: req.query.entityType ? String(req.query.entityType) : undefined,
    entityId: req.query.entityId ? String(req.query.entityId) : undefined,
    status: req.query.status
      ? (String(req.query.status) as "success" | "failure")
      : undefined,
    dateFrom,
    dateTo,
  });

  return ResponseHelper.success(res, result);
};

export const getAuditLogById = async (req: Request, res: Response) => {
  const { logId } = req.params;
  const id = Array.isArray(logId) ? logId[0] : logId;

  const log = await auditService.getAuditLogById(id);
  return ResponseHelper.success(res, log);
};

export const getAuditLogsByUser = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const { userId } = req.params;
  const id = Array.isArray(userId) ? userId[0] : userId;
  const result = await auditService.getAuditLogsByUser(id, page, limit);
  return ResponseHelper.success(res, result);
};

export const getAuditLogsByEntity = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const { entityType, entityId } = req.params;
  const normalizedEntityType = Array.isArray(entityType)
    ? entityType[0]
    : entityType;
  const normalizedEntityId = Array.isArray(entityId) ? entityId[0] : entityId;
  const result = await auditService.getAuditLogsByEntity(
    normalizedEntityType,
    normalizedEntityId,
    page,
    limit,
  );
  return ResponseHelper.success(res, result);
};

export const exportAuditLogs = async (req: Request, res: Response) => {
  const dateFrom = parseDate(req.query.dateFrom, "dateFrom");
  const dateTo = parseDate(req.query.dateTo, "dateTo");

  const csv = await auditService.exportAuditLogsCsv({
    adminId: req.query.adminId ? String(req.query.adminId) : undefined,
    action: req.query.action ? String(req.query.action) : undefined,
    entityType: req.query.entityType ? String(req.query.entityType) : undefined,
    entityId: req.query.entityId ? String(req.query.entityId) : undefined,
    status: req.query.status
      ? (String(req.query.status) as "success" | "failure")
      : undefined,
    dateFrom,
    dateTo,
  });

  return sendCsvResponse(res, "admin-audit-logs", csv);
};
