import type { NextFunction, Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import { createFaq, deleteFaq, listFaqs, updateFaq } from "./faqs.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getFaqCollection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const faqs = await listFaqs(
      {
        search: req.query.search as string | undefined,
        category: req.query.category as string | undefined,
        isPublished:
          req.query.isPublished !== undefined
            ? String(req.query.isPublished) === "true"
            : undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(res, faqs, "FAQs fetched successfully");
  } catch (error) {
    return next(error);
  }
};

export const postCreateFaq = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const created = await createFaq(adminId, req.body);

    return ResponseHelper.success(res, created, "FAQ created successfully", 201);
  } catch (error) {
    return next(error);
  }
};

export const patchFaqById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const updated = await updateFaq(
      adminId,
      normalizeParam(req.params.faqId),
      req.body,
    );

    return ResponseHelper.success(res, updated, "FAQ updated successfully");
  } catch (error) {
    return next(error);
  }
};

export const deleteFaqById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const result = await deleteFaq(adminId, normalizeParam(req.params.faqId));

    return ResponseHelper.success(res, result, "FAQ deleted successfully");
  } catch (error) {
    return next(error);
  }
};
