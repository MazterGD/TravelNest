import { type NextFunction, type Request, type Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import { sendCsvResponse } from "../types.js";
import {
  exportAnalyticsCsv,
  getBookingsAnalytics,
  getFinancialAnalytics,
  getGeographicAnalytics,
  getOperationalAnalytics,
  getUsersAnalytics,
} from "./analytics.service.js";

const parseDateRangeQuery = (req: Request) => ({
  startDate: req.query.startDate ? new Date(String(req.query.startDate)) : undefined,
  endDate: req.query.endDate ? new Date(String(req.query.endDate)) : undefined,
});

export const getUsersAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getUsersAnalytics(parseDateRangeQuery(req));
    return ResponseHelper.success(res, data, "User analytics fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const getBookingsAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getBookingsAnalytics(parseDateRangeQuery(req));
    return ResponseHelper.success(res, data, "Booking analytics fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const getFinancialAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getFinancialAnalytics(parseDateRangeQuery(req));
    return ResponseHelper.success(res, data, "Financial analytics fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const getOperationalAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getOperationalAnalytics(parseDateRangeQuery(req));
    return ResponseHelper.success(res, data, "Operational analytics fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const getGeographicAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getGeographicAnalytics(parseDateRangeQuery(req));
    return ResponseHelper.success(res, data, "Geographic analytics fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const exportAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const csv = await exportAnalyticsCsv(parseDateRangeQuery(req));
    return sendCsvResponse(res, "admin-analytics-export.csv", csv);
  } catch (error) {
    return next(error);
  }
};
