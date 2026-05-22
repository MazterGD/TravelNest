import type { Request, Response } from "express";
import { ResponseHelper } from "../../utils/response.js";
import * as notificationService from "./notification.service.js";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "./notification.schemas.js";

/**
 * Get user's notifications with pagination
 */
export const getNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const unreadOnly = req.query.unreadOnly === "true";
  const rawCategory =
    typeof req.query.category === "string" ? req.query.category : undefined;
  const category =
    rawCategory &&
    (NOTIFICATION_CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as NotificationCategory)
      : undefined;

  const result = await notificationService.getUserNotifications(
    userId,
    page,
    limit,
    unreadOnly,
    category,
  );

  return ResponseHelper.success(res, result);
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const unreadCount = await notificationService.getUnreadCount(userId);

  return ResponseHelper.success(res, { unreadCount });
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const notificationId = Array.isArray(id) ? id[0] : id;

  const notification = await notificationService.markNotificationAsRead(
    userId,
    notificationId,
  );

  return ResponseHelper.success(
    res,
    { notification },
    "Notification marked as read",
  );
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const count = await notificationService.markAllAsRead(userId);

  return ResponseHelper.success(
    res,
    { count },
    `${count} notification(s) marked as read`,
  );
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const notificationId = Array.isArray(id) ? id[0] : id;

  const notification = await notificationService.deleteNotification(
    userId,
    notificationId,
  );

  return ResponseHelper.success(res, { notification }, "Notification deleted");
};

/**
 * Delete all notifications
 */
export const deleteAllNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const count = await notificationService.deleteAllNotifications(userId);

  return ResponseHelper.success(
    res,
    { count },
    `${count} notification(s) deleted`,
  );
};
