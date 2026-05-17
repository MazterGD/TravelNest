import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  deleteTestimonialById,
  getTestimonialCollection,
  patchTestimonialById,
  postApproveTestimonial,
} from "./testimonials.controller.js";
import {
  approveTestimonialSchema,
  listTestimonialsSchema,
  testimonialIdParamsSchema,
  updateTestimonialSchema,
} from "./testimonials.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN", "MODERATOR"));

router.get(
  "/",
  validate(listTestimonialsSchema),
  requireAdminPermission("admin.content.read"),
  asyncHandler(getTestimonialCollection),
);

router.post(
  "/:testimonialId/approve",
  validate(approveTestimonialSchema),
  requireAdminPermission("admin.content.update"),
  asyncHandler(postApproveTestimonial),
);

router.patch(
  "/:testimonialId",
  validate(updateTestimonialSchema),
  requireAdminPermission("admin.content.update"),
  asyncHandler(patchTestimonialById),
);

router.delete(
  "/:testimonialId",
  validate(testimonialIdParamsSchema),
  requireAdminPermission("admin.content.update"),
  asyncHandler(deleteTestimonialById),
);

export default router;
