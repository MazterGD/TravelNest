import type { Request, Response } from "express";
import { ResponseHelper } from "../../utils/response.js";
import * as disputeService from "./dispute.service.js";

/**
 * POST /api/v1/disputes
 */
export const createDispute = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const dispute = await disputeService.createDispute(userId, req.body);
  return ResponseHelper.created(res, { dispute }, "Dispute submitted successfully");
};

/**
 * GET /api/v1/disputes
 */
export const listMyDisputes = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await disputeService.listMyDisputes(userId, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: req.query.status as never,
    role: req.query.role as never,
  });
  return ResponseHelper.success(res, result);
};

/**
 * GET /api/v1/disputes/:disputeId
 */
export const getDispute = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const disputeId = req.params.disputeId as string;
  const dispute = await disputeService.getMyDisputeDetails(userId, disputeId);
  return ResponseHelper.success(res, { dispute });
};

/**
 * POST /api/v1/disputes/:disputeId/messages
 */
export const replyToDispute = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const disputeId = req.params.disputeId as string;
  const message = await disputeService.replyToDispute(
    userId,
    disputeId,
    req.body.message,
  );
  return ResponseHelper.created(res, { message }, "Reply posted");
};
