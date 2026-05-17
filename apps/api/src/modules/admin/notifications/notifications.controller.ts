import type { NextFunction, Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  createPlatformNotification,
  getPlatformNotificationAnalytics,
  listPlatformNotifications,
  resendPlatformNotification,
} from "./notifications.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getPlatformNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const notifications = await listPlatformNotifications(
      {
        search: req.query.search as string | undefined,
        status: req.query.status as
          | "DRAFT"
          | "SCHEDULED"
          | "SENT"
          | "FAILED"
          | "CANCELLED"
          | undefined,
        channel: req.query.channel as "IN_APP" | "EMAIL" | "SMS" | undefined,
        targetRole: req.query.targetRole as
          | "CUSTOMER"
          | "VEHICLE_OWNER"
          | "ADMIN"
          | undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      notifications,
      "Platform notifications fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postCreatePlatformNotification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const created = await createPlatformNotification(adminId, req.body);

    return ResponseHelper.success(
      res,
      created,
      "Platform notification created successfully",
      201,
    );
  } catch (error) {
    return next(error);
  }
};

export const getPlatformNotificationMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const analytics = await getPlatformNotificationAnalytics(
      normalizeParam(req.params.notificationId),
    );

    return ResponseHelper.success(
      res,
      analytics,
      "Platform notification analytics fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const patchResendPlatformNotification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const resent = await resendPlatformNotification(
      adminId,
      normalizeParam(req.params.notificationId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      resent,
      "Platform notification resent successfully",
    );
  } catch (error) {
    return next(error);
  }
};
