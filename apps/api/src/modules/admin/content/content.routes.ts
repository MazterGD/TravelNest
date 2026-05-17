import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  getContentPage,
  getContentPages,
  patchContentPage,
} from "./content.controller.js";
import {
  contentSlugParamsSchema,
  listContentPagesSchema,
  updateContentPageSchema,
} from "./content.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN", "MODERATOR"));

router.get(
  "/",
  validate(listContentPagesSchema),
  requireAdminPermission("admin.content.read"),
  asyncHandler(getContentPages),
);

router.get(
  "/:slug",
  validate(contentSlugParamsSchema),
  requireAdminPermission("admin.content.read"),
  asyncHandler(getContentPage),
);

router.patch(
  "/:slug",
  validate(updateContentPageSchema),
  requireAdminPermission("admin.content.update"),
  asyncHandler(patchContentPage),
);

export default router;
