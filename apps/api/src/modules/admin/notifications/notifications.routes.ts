import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  getPlatformNotificationMetrics,
  getPlatformNotifications,
  patchResendPlatformNotification,
  postCreatePlatformNotification,
} from "./notifications.controller.js";
import {
  createPlatformNotificationSchema,
  listPlatformNotificationsSchema,
  platformNotificationIdParamsSchema,
  resendPlatformNotificationSchema,
} from "./notifications.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN"));

router.get(
  "/",
  validate(listPlatformNotificationsSchema),
  requireAdminPermission("admin.notifications.read"),
  asyncHandler(getPlatformNotifications),
);

router.post(
  "/",
  validate(createPlatformNotificationSchema),
  requireAdminPermission("admin.notifications.send"),
  asyncHandler(postCreatePlatformNotification),
);

router.get(
  "/:notificationId/analytics",
  validate(platformNotificationIdParamsSchema),
  requireAdminPermission("admin.notifications.read"),
  asyncHandler(getPlatformNotificationMetrics),
);

router.patch(
  "/:notificationId/resend",
  validate(resendPlatformNotificationSchema),
  requireAdminPermission("admin.notifications.resend"),
  asyncHandler(patchResendPlatformNotification),
);

export default router;
