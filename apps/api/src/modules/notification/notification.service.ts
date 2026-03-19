import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";

/**
 * Notification response type
 */
export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Get user's notifications with pagination
 */
export const getUserNotifications = async (
  userId: string,
  page: number,
  limit: number,
  unreadOnly: boolean = false,
) => {
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({
      where: {
        userId,
        ...(unreadOnly && { isRead: false }),
      },
    }),
  ]);

  return {
    notifications: notifications as NotificationResponse[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get unread notification count for user
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return count;
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (
  userId: string,
  notificationId: string,
): Promise<NotificationResponse> => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found");
  }

  if (notification.userId !== userId) {
    throw ApiError.forbidden("Not authorized to access this notification");
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return updated as NotificationResponse;
};

/**
 * Mark all user's notifications as read
 */
export const markAllAsRead = async (userId: string): Promise<number> => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return result.count;
};

/**
 * Delete a single notification
 */
export const deleteNotification = async (
  userId: string,
  notificationId: string,
): Promise<NotificationResponse> => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found");
  }

  if (notification.userId !== userId) {
    throw ApiError.forbidden("Not authorized to delete this notification");
  }

  const deleted = await prisma.notification.delete({
    where: { id: notificationId },
  });

  return deleted as NotificationResponse;
};

/**
 * Delete all user's notifications
 */
export const deleteAllNotifications = async (
  userId: string,
): Promise<number> => {
  const result = await prisma.notification.deleteMany({
    where: { userId },
  });

  return result.count;
};

/**
 * Create a new notification for a user
 */
export const createNotification = async (
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<NotificationResponse> => {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: (data as any) || undefined,
    },
  });

  return notification as NotificationResponse;
};

/**
 * Create notifications for multiple users
 */
export const createBulkNotifications = async (
  userIds: string[],
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<number> => {
  if (userIds.length === 0) {
    return 0;
  }

  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      data: data as any,
    })) as any,
  });

  return result.count;
};

/**
 * Get notifications by type for a user
 */
export const getNotificationsByType = async (
  userId: string,
  type: string,
  limit: number = 10,
): Promise<NotificationResponse[]> => {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      type,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return notifications as NotificationResponse[];
};

/**
 * Clear old notifications (older than days)
 */
export const clearOldNotifications = async (
  userId: string,
  daysOld: number = 30,
): Promise<number> => {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const result = await prisma.notification.deleteMany({
    where: {
      userId,
      createdAt: { lt: cutoffDate },
      isRead: true, // Only delete read notifications
    },
  });

  return result.count;
};
