import { type NextFunction, type Request, type Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import { sendCsvResponse } from "../types.js";
import {
  createAdminUser,
  deleteUser,
  exportUsersCsv,
  getUserActivity,
  getUserDetails,
  getUsers,
  resetUserPassword,
  updateUserStatus,
} from "./users.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getUsers(
      {
        search: req.query.search as string | undefined,
        role: req.query.role as "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN" | undefined,
        status: req.query.status as
          | "ACTIVE"
          | "INACTIVE"
          | "SUSPENDED"
          | "PENDING_VERIFICATION"
          | undefined,
        adminRole: req.query.adminRole as
          | "SUPER_ADMIN"
          | "MODERATOR"
          | "FINANCE_ADMIN"
          | "SUPPORT_ADMIN"
          | undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(res, data, "Users fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await getUserDetails(normalizeParam(req.params.userId));
    return ResponseHelper.success(res, user, "User fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const getUserAuditTrail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getUserActivity(
      normalizeParam(req.params.userId),
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(res, data, "User activity fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const patchUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const updatedUser = await updateUserStatus(
      adminId,
      normalizeParam(req.params.userId),
      req.body,
    );

    return ResponseHelper.success(res, updatedUser, "User status updated successfully");
  } catch (error) {
    return next(error);
  }
};

export const postCreateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const created = await createAdminUser(adminId, req.body);

    return ResponseHelper.success(res, created, "Admin user created successfully", 201);
  } catch (error) {
    return next(error);
  }
};

export const postResetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    await resetUserPassword(
      adminId,
      normalizeParam(req.params.userId),
      req.body.newPassword,
    );

    return ResponseHelper.success(res, null, "User password reset successfully");
  } catch (error) {
    return next(error);
  }
};

export const deleteUserById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const deleted = await deleteUser(adminId, normalizeParam(req.params.userId));

    return ResponseHelper.success(res, deleted, "User deleted successfully");
  } catch (error) {
    return next(error);
  }
};

export const getUsersCsv = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const csv = await exportUsersCsv({
      search: req.query.search as string | undefined,
      role: req.query.role as "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN" | undefined,
      status: req.query.status as
        | "ACTIVE"
        | "INACTIVE"
        | "SUSPENDED"
        | "PENDING_VERIFICATION"
        | undefined,
      adminRole: req.query.adminRole as
        | "SUPER_ADMIN"
        | "MODERATOR"
        | "FINANCE_ADMIN"
        | "SUPPORT_ADMIN"
        | undefined,
    });

    return sendCsvResponse(res, "admin-users-export.csv", csv);
  } catch (error) {
    return next(error);
  }
};
