import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  listModerationQueueSchema,
  resolveReviewReportSchema,
  reviewIdParamsSchema,
  updateReviewStatusSchema,
} from "./reviews.schemas.js";
import {
  getModerationQueue,
  getModerationReviewById,
  postResolveReviewReport,
  postReviewModerationStatus,
} from "./reviews.controller.js";

const router = Router();

router.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN"),
);

router.get(
  "/moderation",
  validate(listModerationQueueSchema),
  requireAdminPermission("admin.reviews.read"),
  asyncHandler(getModerationQueue),
);

router.get(
  "/:reviewId",
  validate(reviewIdParamsSchema),
  requireAdminPermission("admin.reviews.read"),
  asyncHandler(getModerationReviewById),
);

router.post(
  "/:reviewId/status",
  validate(updateReviewStatusSchema),
  requireAdminPermission("admin.reviews.update_status"),
  asyncHandler(postReviewModerationStatus),
);

router.post(
  "/:reviewId/report/resolve",
  validate(resolveReviewReportSchema),
  requireAdminPermission("admin.reviews.resolve_report"),
  asyncHandler(postResolveReviewReport),
);

export default router;
