import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  deleteCommissionRuleById,
  listCommissionRules,
  patchCommissionRule,
  postCreateCommissionRule,
} from "./financial.controller.js";
import {
  commissionRuleIdParamsSchema,
  createCommissionRuleSchema,
  listCommissionRulesSchema,
  updateCommissionRuleSchema,
} from "./financial.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN", "FINANCE_ADMIN"));

router.get(
  "/",
  validate(listCommissionRulesSchema),
  requireAdminPermission("admin.financial.read"),
  asyncHandler(listCommissionRules),
);

router.post(
  "/",
  validate(createCommissionRuleSchema),
  requireAdminPermission("admin.financial.manage_commissions"),
  asyncHandler(postCreateCommissionRule),
);

router.patch(
  "/:ruleId",
  validate(updateCommissionRuleSchema),
  requireAdminPermission("admin.financial.manage_commissions"),
  asyncHandler(patchCommissionRule),
);

router.delete(
  "/:ruleId",
  validate(commissionRuleIdParamsSchema),
  requireAdminPermission("admin.financial.manage_commissions"),
  asyncHandler(deleteCommissionRuleById),
);

export default router;
