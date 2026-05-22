import { type NextFunction, type Request, type Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  addDisputeMessage,
  assignDispute,
  getDisputeDetails,
  listDisputes,
  resolveDispute,
  updateDisputePriority,
  updateDisputeStatus,
} from "./disputes.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getDisputesQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const disputes = await listDisputes(
      {
        search: req.query.search as string | undefined,
        status: req.query.status as
          | "OPEN"
          | "INVESTIGATING"
          | "RESOLVED"
          | "CLOSED"
          | "ESCALATED"
          | undefined,
        priority: req.query.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined,
        type: req.query.type as
          | "BOOKING_QUALITY_ISSUE"
          | "CANCELLATION_DISPUTE"
          | "PAYMENT_ISSUE"
          | "VEHICLE_CONDITION"
          | "BEHAVIOR_COMPLAINT"
          | "SERVICE_NOT_PROVIDED"
          | "OTHER"
          | undefined,
        assignedTo: req.query.assignedTo as string | undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(res, disputes, "Disputes fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const getDisputeById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const dispute = await getDisputeDetails(normalizeParam(req.params.disputeId));
    return ResponseHelper.success(res, dispute, "Dispute fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const postAssignDispute = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const dispute = await assignDispute(
      adminId,
      normalizeParam(req.params.disputeId),
      req.body,
    );

    return ResponseHelper.success(res, dispute, "Dispute assigned successfully");
  } catch (error) {
    return next(error);
  }
};

export const postUpdateDisputePriority = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const dispute = await updateDisputePriority(
      adminId,
      normalizeParam(req.params.disputeId),
      req.body.priority,
      req.body.note,
    );

    return ResponseHelper.success(
      res,
      dispute,
      "Dispute priority updated successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postUpdateDisputeStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const dispute = await updateDisputeStatus(
      adminId,
      normalizeParam(req.params.disputeId),
      req.body.status,
      req.body.note,
    );

    return ResponseHelper.success(
      res,
      dispute,
      "Dispute status updated successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postDisputeMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const message = await addDisputeMessage(
      adminId,
      normalizeParam(req.params.disputeId),
      req.body,
    );

    return ResponseHelper.success(res, message, "Dispute message added successfully");
  } catch (error) {
    return next(error);
  }
};

export const postResolveDispute = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const dispute = await resolveDispute(
      adminId,
      normalizeParam(req.params.disputeId),
      req.body,
    );

    return ResponseHelper.success(res, dispute, "Dispute resolved successfully");
  } catch (error) {
    return next(error);
  }
};
