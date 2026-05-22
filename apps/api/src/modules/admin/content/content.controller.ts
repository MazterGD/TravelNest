import type { NextFunction, Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  getContentPageBySlug,
  listContentPages,
  updateContentPageBySlug,
} from "./content.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getContentPages = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const pages = await listContentPages(
      {
        search: req.query.search as string | undefined,
        isPublished:
          req.query.isPublished !== undefined
            ? String(req.query.isPublished) === "true"
            : undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      pages,
      "Content pages fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const getContentPage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = await getContentPageBySlug(normalizeParam(req.params.slug));

    return ResponseHelper.success(
      res,
      page,
      "Content page fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const patchContentPage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const updated = await updateContentPageBySlug(
      adminId,
      normalizeParam(req.params.slug),
      req.body,
    );

    return ResponseHelper.success(
      res,
      updated,
      "Content page updated successfully",
    );
  } catch (error) {
    return next(error);
  }
};
