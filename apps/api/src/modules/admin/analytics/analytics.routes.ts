import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  exportAnalyticsController,
  getBookingsAnalyticsController,
  getFinancialAnalyticsController,
  getGeographicAnalyticsController,
  getOperationalAnalyticsController,
  getUsersAnalyticsController,
} from "./analytics.controller.js";
import { analyticsQuerySchema, exportAnalyticsSchema } from "./analytics.schemas.js";

const router = Router();

router.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

router.get(
  "/users",
  validate(analyticsQuerySchema),
  requireAdminPermission("admin.analytics.read"),
  asyncHandler(getUsersAnalyticsController),
);

router.get(
  "/bookings",
  validate(analyticsQuerySchema),
  requireAdminPermission("admin.analytics.read"),
  asyncHandler(getBookingsAnalyticsController),
);

router.get(
  "/financial",
  validate(analyticsQuerySchema),
  requireAdminPermission("admin.analytics.read"),
  asyncHandler(getFinancialAnalyticsController),
);

router.get(
  "/operational",
  validate(analyticsQuerySchema),
  requireAdminPermission("admin.analytics.read"),
  asyncHandler(getOperationalAnalyticsController),
);

router.get(
  "/geographic",
  validate(analyticsQuerySchema),
  requireAdminPermission("admin.analytics.read"),
  asyncHandler(getGeographicAnalyticsController),
);

router.get(
  "/export",
  validate(exportAnalyticsSchema),
  requireAdminPermission("admin.analytics.export"),
  asyncHandler(exportAnalyticsController),
);

export default router;
