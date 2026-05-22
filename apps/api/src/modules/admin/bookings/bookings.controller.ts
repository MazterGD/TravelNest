import { type NextFunction, type Request, type Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import { sendCsvResponse } from "../types.js";
import {
  cancelBookingWithRefund,
  exportBookingsCsv,
  getBookingDetails,
  getBookings,
  updateBookingStatus,
} from "./bookings.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const listBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getBookings(
      {
        search: req.query.search as string | undefined,
        status: req.query.status as
          | "PENDING"
          | "CONFIRMED"
          | "ONGOING"
          | "COMPLETED"
          | "CANCELLED"
          | undefined,
        paymentStatus: req.query.paymentStatus as
          | "PENDING"
          | "PROCESSING"
          | "COMPLETED"
          | "FAILED"
          | "REFUNDED"
          | undefined,
        startDateFrom: req.query.startDateFrom
          ? new Date(String(req.query.startDateFrom))
          : undefined,
        startDateTo: req.query.startDateTo
          ? new Date(String(req.query.startDateTo))
          : undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(res, data, "Bookings fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const getBookingById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const booking = await getBookingDetails(normalizeParam(req.params.bookingId));
    return ResponseHelper.success(res, booking, "Booking fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const patchBookingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const updated = await updateBookingStatus(
      adminId,
      normalizeParam(req.params.bookingId),
      req.body,
    );

    return ResponseHelper.success(res, updated, "Booking status updated successfully");
  } catch (error) {
    return next(error);
  }
};

export const postCancelWithRefund = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const result = await cancelBookingWithRefund(
      adminId,
      normalizeParam(req.params.bookingId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      result,
      "Booking cancelled and refund processed successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const getBookingsCsv = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const csv = await exportBookingsCsv({
      search: req.query.search as string | undefined,
      status: req.query.status as
        | "PENDING"
        | "CONFIRMED"
        | "ONGOING"
        | "COMPLETED"
        | "CANCELLED"
        | undefined,
      paymentStatus: req.query.paymentStatus as
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "REFUNDED"
        | undefined,
      startDateFrom: req.query.startDateFrom
        ? new Date(String(req.query.startDateFrom))
        : undefined,
      startDateTo: req.query.startDateTo
        ? new Date(String(req.query.startDateTo))
        : undefined,
    });

    return sendCsvResponse(res, "admin-bookings-export.csv", csv);
  } catch (error) {
    return next(error);
  }
};
