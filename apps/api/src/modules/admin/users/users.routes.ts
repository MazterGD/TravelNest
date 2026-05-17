import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  deleteUserById,
  getUserAuditTrail,
  getUserById,
  getUsersCsv,
  listUsers,
  patchUserStatus,
  postResetPassword,
} from "./users.controller.js";
import {
  exportUsersSchema,
  listUsersSchema,
  resetUserPasswordSchema,
  updateUserStatusSchema,
  userActivitySchema,
  userIdParamsSchema,
} from "./users.schemas.js";

const router = Router();

router.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

router.get(
  "/",
  validate(listUsersSchema),
  requireAdminPermission("admin.users.read"),
  asyncHandler(listUsers),
);

router.get(
  "/export",
  validate(exportUsersSchema),
  requireAdminPermission("admin.users.export"),
  asyncHandler(getUsersCsv),
);

router.get(
  "/:userId",
  validate(userIdParamsSchema),
  requireAdminPermission("admin.users.read"),
  asyncHandler(getUserById),
);

router.get(
  "/:userId/activity",
  validate(userActivitySchema),
  requireAdminPermission("admin.users.read"),
  asyncHandler(getUserAuditTrail),
);

router.patch(
  "/:userId/status",
  validate(updateUserStatusSchema),
  requireAdminPermission("admin.users.update_status"),
  asyncHandler(patchUserStatus),
);

router.patch(
  "/:userId/password",
  validate(resetUserPasswordSchema),
  requireAdminPermission("admin.users.reset_password"),
  asyncHandler(postResetPassword),
);

router.delete(
  "/:userId",
  validate(userIdParamsSchema),
  requireAdminPermission("admin.users.delete"),
  asyncHandler(deleteUserById),
);

export default router;
