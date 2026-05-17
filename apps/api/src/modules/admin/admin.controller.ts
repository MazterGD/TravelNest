import type { Request, Response } from "express";
import { ResponseHelper } from "../../utils/response.js";

export const health = async (req: Request, res: Response) => {
  return ResponseHelper.success(
    res,
    {
      status: "ready",
      adminId: req.user!.id,
      timestamp: new Date().toISOString(),
    },
    "Admin foundation module is ready",
  );
};
