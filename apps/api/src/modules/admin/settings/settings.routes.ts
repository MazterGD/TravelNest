import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  getPlatformSettingsConfig,
  patchPlatformSettingsConfig,
} from "./settings.controller.js";
import {
  getPlatformSettingsSchema,
  updatePlatformSettingsSchema,
} from "./settings.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN"));

router.get(
  "/platform",
  validate(getPlatformSettingsSchema),
  requireAdminPermission("admin.settings.read"),
  asyncHandler(getPlatformSettingsConfig),
);

router.patch(
  "/platform",
  validate(updatePlatformSettingsSchema),
  requireAdminPermission("admin.settings.update"),
  asyncHandler(patchPlatformSettingsConfig),
);

export default router;
