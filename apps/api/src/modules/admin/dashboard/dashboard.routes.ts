import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import * as dashboardController from "./dashboard.controller.js";

const router = Router();

router.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

router.get(
  "/",
  requireAdminPermission("dashboard.view"),
  asyncHandler(dashboardController.getOverview),
);
router.get(
  "/charts/revenue",
  requireAdminPermission("dashboard.view"),
  asyncHandler(dashboardController.getRevenueChart),
);
router.get(
  "/charts/users",
  requireAdminPermission("dashboard.view"),
  asyncHandler(dashboardController.getUserGrowthChart),
);
router.get(
  "/charts/bookings",
  requireAdminPermission("dashboard.view"),
  asyncHandler(dashboardController.getBookingTrendsChart),
);
router.get(
  "/activity-feed",
  requireAdminPermission("dashboard.view"),
  asyncHandler(dashboardController.getActivityFeed),
);
router.get(
  "/pending-actions",
  requireAdminPermission("dashboard.view"),
  asyncHandler(dashboardController.getPendingActions),
);

export default router;
