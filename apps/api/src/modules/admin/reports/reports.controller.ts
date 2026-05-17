import type { NextFunction, Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  archiveScheduledReport,
  createScheduledReport,
  exportAdminReport,
  listScheduledReports,
  runScheduledReport,
  updateScheduledReport,
} from "./reports.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getScheduledReports = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const reports = await listScheduledReports(
      {
        search: req.query.search as string | undefined,
        reportType: req.query.reportType as
          | "USERS"
          | "BOOKINGS"
          | "FINANCIAL"
          | "OPERATIONS"
          | "AUDIT"
          | "DISPUTES"
          | "VERIFICATIONS"
          | "SYSTEM"
          | undefined,
        format: req.query.format as "CSV" | "PDF" | "EXCEL" | undefined,
        frequency: req.query.frequency as
          | "ON_DEMAND"
          | "DAILY"
          | "WEEKLY"
          | "MONTHLY"
          | undefined,
        isActive:
          req.query.isActive !== undefined
            ? String(req.query.isActive) === "true"
            : undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      reports,
      "Scheduled reports fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postCreateScheduledReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const report = await createScheduledReport(adminId, req.body);

    return ResponseHelper.success(
      res,
      report,
      "Scheduled report created successfully",
      201,
    );
  } catch (error) {
    return next(error);
  }
};

export const patchScheduledReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const report = await updateScheduledReport(
      adminId,
      normalizeParam(req.params.reportId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      report,
      "Scheduled report updated successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const deleteScheduledReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const deleted = await archiveScheduledReport(
      adminId,
      normalizeParam(req.params.reportId),
    );

    return ResponseHelper.success(
      res,
      deleted,
      "Scheduled report archived successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postRunScheduledReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const run = await runScheduledReport(
      adminId,
      normalizeParam(req.params.reportId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      run,
      "Scheduled report run completed successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postExportAdminReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const generated = await exportAdminReport(adminId, req.body);

    res.setHeader("Content-Type", generated.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${generated.filename}"`,
    );

    return res.status(200).send(generated.content);
  } catch (error) {
    return next(error);
  }
};
