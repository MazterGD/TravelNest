import type { Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import * as dashboardService from "./dashboard.service.js";

export const getOverview = async (_req: Request, res: Response) => {
  const data = await dashboardService.getDashboardOverview();
  return ResponseHelper.success(res, data);
};

export const getRevenueChart = async (req: Request, res: Response) => {
  const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));
  const data = await dashboardService.getRevenueChart(months);
  return ResponseHelper.success(res, data);
};

export const getUserGrowthChart = async (req: Request, res: Response) => {
  const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));
  const data = await dashboardService.getUserGrowthChart(months);
  return ResponseHelper.success(res, data);
};

export const getBookingTrendsChart = async (req: Request, res: Response) => {
  const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));
  const data = await dashboardService.getBookingTrendsChart(months);
  return ResponseHelper.success(res, data);
};

export const getActivityFeed = async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const data = await dashboardService.getActivityFeed(limit);
  return ResponseHelper.success(res, data);
};

export const getPendingActions = async (_req: Request, res: Response) => {
  const data = await dashboardService.getPendingActions();
  return ResponseHelper.success(res, data);
};
