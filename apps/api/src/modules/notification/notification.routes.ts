import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { validate } from "../../middleware/validate.js";
import { csrfProtection } from "../../middleware/csrf.js";
import * as notificationController from "./notification.controller.js";
import {
  getNotificationsSchema,
  markAsReadSchema,
  deleteNotificationSchema,
} from "./notification.schemas.js";

const router = Router();

// Get my notifications with pagination
router.get(
  "/",
  authenticate,
  validate(getNotificationsSchema),
  asyncHandler(notificationController.getNotifications),
);

// Get unread notification count
router.get(
  "/unread-count",
  authenticate,
  asyncHandler(notificationController.getUnreadCount),
);

// Mark a specific notification as read
router.patch(
  "/:id/read",
  authenticate,
  csrfProtection,
  validate(markAsReadSchema),
  asyncHandler(notificationController.markAsRead),
);

// Mark all notifications as read
router.patch(
  "/read-all",
  authenticate,
  csrfProtection,
  asyncHandler(notificationController.markAllAsRead),
);

// Delete a specific notification
router.delete(
  "/:id",
  authenticate,
  csrfProtection,
  validate(deleteNotificationSchema),
  asyncHandler(notificationController.deleteNotification),
);

// Delete all notifications
router.delete(
  "/",
  authenticate,
  csrfProtection,
  asyncHandler(notificationController.deleteAllNotifications),
);

export default router;
