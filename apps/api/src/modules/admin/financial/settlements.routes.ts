import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  getSettlementById,
  listSettlementHistoryRecords,
  listSettlementsQueue,
  postProcessSettlement,
} from "./financial.controller.js";
import {
  listSettlementsSchema,
  processSettlementSchema,
  settlementIdParamsSchema,
} from "./financial.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN", "FINANCE_ADMIN"));

router.get(
  "/",
  validate(listSettlementsSchema),
  requireAdminPermission("admin.financial.read"),
  asyncHandler(listSettlementsQueue),
);

router.get(
  "/history",
  validate(listSettlementsSchema),
  requireAdminPermission("admin.financial.read"),
  asyncHandler(listSettlementHistoryRecords),
);

router.get(
  "/:settlementId",
  validate(settlementIdParamsSchema),
  requireAdminPermission("admin.financial.read"),
  asyncHandler(getSettlementById),
);

router.post(
  "/:settlementId/process",
  validate(processSettlementSchema),
  requireAdminPermission("admin.financial.process_settlement"),
  asyncHandler(postProcessSettlement),
);

export default router;
