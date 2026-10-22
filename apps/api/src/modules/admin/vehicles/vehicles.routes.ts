import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import * as vehiclesController from "./vehicles.controller.js";
import { adminVehiclesQuerySchema } from "./vehicles.schemas.js";

const router = Router();

router.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

router.get(
  "/",
  validate(adminVehiclesQuerySchema),
  requireAdminPermission("admin.verifications.read"),
  asyncHandler(vehiclesController.getVehicles),
);

export default router;
