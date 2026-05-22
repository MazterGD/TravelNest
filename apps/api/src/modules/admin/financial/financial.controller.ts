import { type NextFunction, type Request, type Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  createCommissionRule,
  deleteCommissionRule,
  getCommissionRules,
  getSettlementDetails,
  getSettlementHistory,
  getSettlements,
  processSettlement,
  updateCommissionRule,
} from "./financial.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

const toSettlementStatus = (
  value: unknown,
): "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined => {
  if (
    value === "PENDING" ||
    value === "PROCESSING" ||
    value === "COMPLETED" ||
    value === "FAILED" ||
    value === "CANCELLED"
  ) {
    return value;
  }

  return undefined;
};

export const listSettlementsQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settlements = await getSettlements(
      {
        search: req.query.search as string | undefined,
        status: toSettlementStatus(req.query.status),
        period: req.query.period as string | undefined,
        ownerId: req.query.ownerId as string | undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      settlements,
      "Settlements fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const listSettlementHistoryRecords = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settlements = await getSettlementHistory(
      {
        search: req.query.search as string | undefined,
        status: toSettlementStatus(req.query.status),
        period: req.query.period as string | undefined,
        ownerId: req.query.ownerId as string | undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      settlements,
      "Settlement history fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const getSettlementById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settlement = await getSettlementDetails(
      normalizeParam(req.params.settlementId),
    );

    return ResponseHelper.success(
      res,
      settlement,
      "Settlement details fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postProcessSettlement = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const settlement = await processSettlement(
      adminId,
      normalizeParam(req.params.settlementId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      settlement,
      "Settlement processed successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const listCommissionRules = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rules = await getCommissionRules(
      req.query.includeInactive
        ? String(req.query.includeInactive) === "true"
        : undefined,
    );

    return ResponseHelper.success(
      res,
      rules,
      "Commission rules fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postCreateCommissionRule = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const rule = await createCommissionRule(adminId, req.body);

    return ResponseHelper.success(
      res,
      rule,
      "Commission rule created successfully",
      201,
    );
  } catch (error) {
    return next(error);
  }
};

export const patchCommissionRule = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const rule = await updateCommissionRule(
      adminId,
      normalizeParam(req.params.ruleId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      rule,
      "Commission rule updated successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const deleteCommissionRuleById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const deleted = await deleteCommissionRule(
      adminId,
      normalizeParam(req.params.ruleId),
    );

    return ResponseHelper.success(
      res,
      deleted,
      "Commission rule archived successfully",
    );
  } catch (error) {
    return next(error);
  }
};
