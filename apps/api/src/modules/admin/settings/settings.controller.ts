import type { NextFunction, Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "./settings.service.js";

export const getPlatformSettingsConfig = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settings = await getPlatformSettings();

    return ResponseHelper.success(
      res,
      settings,
      "Platform settings fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const patchPlatformSettingsConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const updated = await updatePlatformSettings(adminId, req.body);

    return ResponseHelper.success(
      res,
      updated,
      "Platform settings updated successfully",
    );
  } catch (error) {
    return next(error);
  }
};
