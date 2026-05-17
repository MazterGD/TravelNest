import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  getProfile,
  getProfileActivity,
  getProfilePermissions,
  patchPassword,
  patchProfile,
} from "./profile.controller.js";
import {
  changeAdminPasswordSchema,
  getAdminActivitySchema,
  getAdminPermissionsSchema,
  getAdminProfileSchema,
  updateAdminProfileSchema,
} from "./profile.schemas.js";

const router = Router();

router.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

router.get(
  "/",
  validate(getAdminProfileSchema),
  requireAdminPermission("admin.profile.read"),
  asyncHandler(getProfile),
);

router.patch(
  "/personal",
  validate(updateAdminProfileSchema),
  requireAdminPermission("admin.profile.update"),
  asyncHandler(patchProfile),
);

router.patch(
  "/password",
  validate(changeAdminPasswordSchema),
  requireAdminPermission("admin.profile.update"),
  asyncHandler(patchPassword),
);

router.get(
  "/activity",
  validate(getAdminActivitySchema),
  requireAdminPermission("admin.profile.read"),
  asyncHandler(getProfileActivity),
);

router.get(
  "/permissions",
  validate(getAdminPermissionsSchema),
  requireAdminPermission("admin.profile.read"),
  asyncHandler(getProfilePermissions),
);

export default router;
