import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import {
  requireAdminPermission,
  requireAdminRole,
} from "../admin.middleware.js";
import {
  createScheduledReportSchema,
  exportAdminReportSchema,
  listScheduledReportsSchema,
  reportIdParamsSchema,
  runScheduledReportSchema,
  updateScheduledReportSchema,
} from "./reports.schemas.js";
import {
  deleteScheduledReport,
  getScheduledReports,
  patchScheduledReport,
  postCreateScheduledReport,
  postExportAdminReport,
  postRunScheduledReport,
} from "./reports.controller.js";

export const adminReportsRouter = Router();

adminReportsRouter.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

adminReportsRouter.get(
  "/",
  validate(listScheduledReportsSchema),
  requireAdminPermission("admin.reports.read"),
  asyncHandler(getScheduledReports),
);

adminReportsRouter.post(
  "/",
  validate(createScheduledReportSchema),
  requireAdminPermission("admin.reports.create"),
  asyncHandler(postCreateScheduledReport),
);

adminReportsRouter.patch(
  "/:reportId",
  validate(updateScheduledReportSchema),
  requireAdminPermission("admin.reports.update"),
  asyncHandler(patchScheduledReport),
);

adminReportsRouter.delete(
  "/:reportId",
  validate(reportIdParamsSchema),
  requireAdminPermission("admin.reports.archive"),
  asyncHandler(deleteScheduledReport),
);

adminReportsRouter.post(
  "/:reportId/run",
  validate(runScheduledReportSchema),
  requireAdminPermission("admin.reports.run"),
  asyncHandler(postRunScheduledReport),
);

adminReportsRouter.post(
  "/export",
  validate(exportAdminReportSchema),
  requireAdminPermission("admin.reports.export"),
  asyncHandler(postExportAdminReport),
);
