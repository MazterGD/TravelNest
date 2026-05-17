import type { Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  changeAdminPassword,
  getAdminActivity,
  getAdminPermissions,
  getAdminProfile,
  updateAdminProfile,
} from "./profile.service.js";

export const getProfile = async (req: Request, res: Response) => {
  const profile = await getAdminProfile(req.user!.id);
  return ResponseHelper.success(res, profile, "Admin profile fetched successfully");
};

export const patchProfile = async (req: Request, res: Response) => {
  const updated = await updateAdminProfile(req.user!.id, req.body);
  return ResponseHelper.success(res, updated, "Admin profile updated successfully");
};

export const patchPassword = async (req: Request, res: Response) => {
  const result = await changeAdminPassword(req.user!.id, req.body);
  return ResponseHelper.success(res, result, "Password updated successfully");
};

export const getProfileActivity = async (req: Request, res: Response) => {
  const data = await getAdminActivity(
    req.user!.id,
    req.query.page ? Number(req.query.page) : undefined,
    req.query.limit ? Number(req.query.limit) : undefined,
    req.query.action ? String(req.query.action) : undefined,
    req.query.status ? (String(req.query.status) as "success" | "failure") : undefined,
  );

  return ResponseHelper.success(res, data, "Admin activity fetched successfully");
};

export const getProfilePermissions = async (req: Request, res: Response) => {
  const permissions = await getAdminPermissions(req.user!.id);
  return ResponseHelper.success(
    res,
    permissions,
    "Admin permissions fetched successfully",
  );
};
