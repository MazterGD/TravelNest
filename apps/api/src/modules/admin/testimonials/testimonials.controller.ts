import type { NextFunction, Request, Response } from "express";
import { ResponseHelper } from "../../../utils/response.js";
import {
  approveTestimonial,
  deleteTestimonial,
  listTestimonials,
  updateTestimonial,
} from "./testimonials.service.js";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export const getTestimonialCollection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const testimonials = await listTestimonials(
      {
        includeInactive:
          req.query.includeInactive !== undefined
            ? String(req.query.includeInactive) === "true"
            : undefined,
        search: req.query.search as string | undefined,
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );

    return ResponseHelper.success(
      res,
      testimonials,
      "Testimonials fetched successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const postApproveTestimonial = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const approved = await approveTestimonial(
      adminId,
      normalizeParam(req.params.testimonialId),
      req.body.note,
    );

    return ResponseHelper.success(
      res,
      approved,
      "Testimonial approved successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const patchTestimonialById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const updated = await updateTestimonial(
      adminId,
      normalizeParam(req.params.testimonialId),
      req.body,
    );

    return ResponseHelper.success(
      res,
      updated,
      "Testimonial updated successfully",
    );
  } catch (error) {
    return next(error);
  }
};

export const deleteTestimonialById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?.id as string;
    const deleted = await deleteTestimonial(
      adminId,
      normalizeParam(req.params.testimonialId),
    );

    return ResponseHelper.success(
      res,
      deleted,
      "Testimonial deleted successfully",
    );
  } catch (error) {
    return next(error);
  }
};
