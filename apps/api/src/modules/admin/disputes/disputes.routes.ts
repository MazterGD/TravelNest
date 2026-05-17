import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  getDisputeById,
  getDisputesQueue,
  postAssignDispute,
  postDisputeMessage,
  postResolveDispute,
  postUpdateDisputePriority,
  postUpdateDisputeStatus,
} from "./disputes.controller.js";
import {
  addDisputeMessageSchema,
  assignDisputeSchema,
  disputeIdParamsSchema,
  listDisputesSchema,
  resolveDisputeSchema,
  updateDisputePrioritySchema,
  updateDisputeStatusSchema,
} from "./disputes.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN"));

router.get(
  "/",
  validate(listDisputesSchema),
  requireAdminPermission("admin.disputes.read"),
  asyncHandler(getDisputesQueue),
);

router.get(
  "/:disputeId",
  validate(disputeIdParamsSchema),
  requireAdminPermission("admin.disputes.read"),
  asyncHandler(getDisputeById),
);

router.post(
  "/:disputeId/assign",
  validate(assignDisputeSchema),
  requireAdminPermission("admin.disputes.assign"),
  asyncHandler(postAssignDispute),
);

router.post(
  "/:disputeId/priority",
  validate(updateDisputePrioritySchema),
  requireAdminPermission("admin.disputes.update_priority"),
  asyncHandler(postUpdateDisputePriority),
);

router.post(
  "/:disputeId/status",
  validate(updateDisputeStatusSchema),
  requireAdminPermission("admin.disputes.update_status"),
  asyncHandler(postUpdateDisputeStatus),
);

router.post(
  "/:disputeId/message",
  validate(addDisputeMessageSchema),
  requireAdminPermission("admin.disputes.message"),
  asyncHandler(postDisputeMessage),
);

router.post(
  "/:disputeId/resolve",
  validate(resolveDisputeSchema),
  requireAdminPermission("admin.disputes.resolve"),
  asyncHandler(postResolveDispute),
);

export default router;
