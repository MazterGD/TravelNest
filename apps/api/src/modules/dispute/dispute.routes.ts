import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import {
  createDisputeSchema,
  disputeIdParamsSchema,
  listMyDisputesSchema,
  replyDisputeSchema,
} from "./dispute.schemas.js";
import * as disputeController from "./dispute.controller.js";

const router = Router();

// Disputes are between a customer and a vehicle owner; admins use the
// dedicated /admin/disputes module.
router.use(authenticate, authorize("customer", "owner"));

router.post(
  "/",
  csrfProtection,
  validate(createDisputeSchema),
  asyncHandler(disputeController.createDispute),
);

router.get(
  "/",
  validate(listMyDisputesSchema),
  asyncHandler(disputeController.listMyDisputes),
);

router.get(
  "/:disputeId",
  validate(disputeIdParamsSchema),
  asyncHandler(disputeController.getDispute),
);

router.post(
  "/:disputeId/messages",
  csrfProtection,
  validate(replyDisputeSchema),
  asyncHandler(disputeController.replyToDispute),
);

export default router;
