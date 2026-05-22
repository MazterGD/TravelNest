import { type NextFunction, type Request, type Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  approveOwnerVerification,
  approveVehicleVerification,
  getOwnerVerificationDetails,
  getVehicleVerificationDetails,
  getVerificationHistory,
  listOwnerVerifications,
  listVehicleVerifications,
  rejectOwnerVerification,
  rejectVehicleVerification,
  requestOwnerResubmission,
} from "./verifications.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getOwnerVerificationQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await listOwnerVerifications(
      {
        search: req.query.search as string | undefined,
        status: req.query.status as
          | "ACTIVE"
          | "INACTIVE"
          | "SUSPENDED"
          | "PENDING_VERIFICATION"
          | undefined,
        documentStatus: req.query.documentStatus as
          | "PENDING"
          | "VERIFIED"
          | "REJECTED"
          | undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      data,
      "Owner verification queue fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const getOwnerVerificationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const owner = await getOwnerVerificationDetails(
      normalizeParam(req.params.ownerId),
    );

    return ResponseHelper.success(
      res,
      owner,
      "Owner verification details fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postApproveOwnerVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const owner = await approveOwnerVerification(
      adminId,
      normalizeParam(req.params.ownerId),
      req.body.note,
    );

    return ResponseHelper.success(
      res,
      owner,
      "Owner verification approved successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postRejectOwnerVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const owner = await rejectOwnerVerification(
      adminId,
      normalizeParam(req.params.ownerId),
      req.body.reason,
    );

    return ResponseHelper.success(
      res,
      owner,
      "Owner verification rejected successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postRequestOwnerResubmission = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const owner = await requestOwnerResubmission(
      adminId,
      normalizeParam(req.params.ownerId),
      req.body.reason,
    );

    return ResponseHelper.success(
      res,
      owner,
      "Owner resubmission requested successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const getVehicleVerificationQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await listVehicleVerifications(
      {
        search: req.query.search as string | undefined,
        documentStatus: req.query.documentStatus as
          | "PENDING"
          | "VERIFIED"
          | "REJECTED"
          | undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      data,
      "Vehicle verification queue fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const getVehicleVerificationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vehicle = await getVehicleVerificationDetails(
      normalizeParam(req.params.vehicleId),
    );

    return ResponseHelper.success(
      res,
      vehicle,
      "Vehicle verification details fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postApproveVehicleVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const vehicle = await approveVehicleVerification(
      adminId,
      normalizeParam(req.params.vehicleId),
      req.body.note,
    );

    return ResponseHelper.success(
      res,
      vehicle,
      "Vehicle verification approved successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postRejectVehicleVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const vehicle = await rejectVehicleVerification(
      adminId,
      normalizeParam(req.params.vehicleId),
      req.body.reason,
    );

    return ResponseHelper.success(
      res,
      vehicle,
      "Vehicle verification rejected successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const getVerificationHistoryByEntityId = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const history = await getVerificationHistory(
      normalizeParam(req.params.entityId),
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      history,
      "Verification history fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};
