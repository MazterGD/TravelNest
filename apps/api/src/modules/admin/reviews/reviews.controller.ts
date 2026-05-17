import { type NextFunction, type Request, type Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  getReviewModerationDetails,
  listReviewModerationQueue,
  resolveReviewReport,
  updateReviewModerationStatus,
} from "./reviews.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getModerationQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await listReviewModerationQueue(
      {
        search: req.query.search as string | undefined,
        status: req.query.status as "ACTIVE" | "HIDDEN" | "DELETED" | undefined,
        flaggedOnly: req.query.flaggedOnly
          ? String(req.query.flaggedOnly) === "true"
          : undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      data,
      "Review moderation queue fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const getModerationReviewById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const review = await getReviewModerationDetails(
      normalizeParam(req.params.reviewId),
    );

    return ResponseHelper.success(
      res,
      review,
      "Review moderation details fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postReviewModerationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const result = await updateReviewModerationStatus(
      adminId,
      normalizeParam(req.params.reviewId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      result,
      "Review moderation status updated successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postResolveReviewReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const result = await resolveReviewReport(
      adminId,
      normalizeParam(req.params.reviewId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      result,
      "Review report resolved successfully",
    );
  } catch (error) {
    return next(error);
  }
};
