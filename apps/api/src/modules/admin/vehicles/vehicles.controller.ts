import { Request, Response } from "express";
import * as vehiclesService from "./vehicles.service.js";
import { ResponseHelper } from "../../../utils/response.js";

export const getVehicles = async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = Math.min(100, req.query.limit ? Number(req.query.limit) : 10);
  const search = req.query.search ? String(req.query.search).trim() || undefined : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
  const isActive =
    req.query.isActive !== undefined
      ? req.query.isActive === "true"
      : undefined;

  const result = await vehiclesService.getAllAdminVehicles({
    page,
    limit,
    search,
    type,
    isActive,
    ownerId,
  });

  return ResponseHelper.success(res, result);
};
