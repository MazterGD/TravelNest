import type { Request, Response } from "express";
import { ResponseHelper } from "../../utils/response.js";
import { landingService } from "./landing.service.js";

export const getLandingData = async (_req: Request, res: Response) => {
  const data = await landingService.getLandingData();
  return ResponseHelper.success(res, data);
};

export const getPublicConfig = async (_req: Request, res: Response) => {
  const config = await landingService.getPublicConfig();
  return ResponseHelper.success(res, config);
};

export const getAboutStats = async (_req: Request, res: Response) => {
  const stats = await landingService.getAboutStats();
  return ResponseHelper.success(res, { stats });
};

export const submitContactMessage = async (req: Request, res: Response) => {
  const result = await landingService.submitContactMessage(req.body);
  return ResponseHelper.success(
    res,
    result,
    "Contact message submitted successfully",
  );
};

export const getRouteEstimate = async (req: Request, res: Response) => {
  const estimate = await landingService.getRouteEstimate(req.body);
  return ResponseHelper.success(res, estimate);
};
