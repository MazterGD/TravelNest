import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  approveDocumentSchema,
  approveVerificationSchema,
  entityIdParamsSchema,
  listOwnerVerificationsSchema,
  listVehicleVerificationsSchema,
  ownerDocumentParamsSchema,
  ownerIdParamsSchema,
  rejectDocumentSchema,
  rejectVerificationSchema,
  requestResubmissionSchema,
  vehicleDocumentParamsSchema,
  vehicleIdParamsSchema,
} from "./verifications.schemas.js";
import {
  getOwnerVerificationById,
  getOwnerVerificationQueue,
  getVehicleVerificationById,
  getVehicleVerificationQueue,
  getVerificationHistoryByEntityId,
  postApproveOwnerDocument,
  postApproveOwnerVerification,
  postApproveVehicleDocument,
  postApproveVehicleVerification,
  postRejectOwnerDocument,
  postRejectOwnerVerification,
  postRejectVehicleDocument,
  postRejectVehicleVerification,
  postRequestOwnerResubmission,
} from "./verifications.controller.js";

const router = Router();

router.use(
  requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

router.get(
  "/owners",
  validate(listOwnerVerificationsSchema),
  requireAdminPermission("admin.verifications.read"),
  asyncHandler(getOwnerVerificationQueue),
);

router.get(
  "/owners/:ownerId",
  validate(ownerIdParamsSchema),
  requireAdminPermission("admin.verifications.read"),
  asyncHandler(getOwnerVerificationById),
);

router.post(
  "/owners/:ownerId/approve",
  validate(approveVerificationSchema),
  requireAdminPermission("admin.verifications.approve"),
  asyncHandler(postApproveOwnerVerification),
);

router.post(
  "/owners/:ownerId/reject",
  validate(rejectVerificationSchema),
  requireAdminPermission("admin.verifications.reject"),
  asyncHandler(postRejectOwnerVerification),
);

router.post(
  "/owners/:ownerId/request-resubmission",
  validate(requestResubmissionSchema),
  requireAdminPermission("admin.verifications.request_resubmission"),
  asyncHandler(postRequestOwnerResubmission),
);

router.get(
  "/vehicles",
  validate(listVehicleVerificationsSchema),
  requireAdminPermission("admin.verifications.read"),
  asyncHandler(getVehicleVerificationQueue),
);

router.get(
  "/vehicles/:vehicleId",
  validate(vehicleIdParamsSchema),
  requireAdminPermission("admin.verifications.read"),
  asyncHandler(getVehicleVerificationById),
);

router.post(
  "/vehicles/:vehicleId/approve",
  validate(approveVerificationSchema),
  requireAdminPermission("admin.verifications.approve"),
  asyncHandler(postApproveVehicleVerification),
);

router.post(
  "/vehicles/:vehicleId/reject",
  validate(rejectVerificationSchema),
  requireAdminPermission("admin.verifications.reject"),
  asyncHandler(postRejectVehicleVerification),
);

router.get(
  "/history/:entityId",
  validate(entityIdParamsSchema),
  requireAdminPermission("admin.verifications.read"),
  asyncHandler(getVerificationHistoryByEntityId),
);

router.post(
  "/vehicles/:vehicleId/documents/:documentId/approve",
  validate(approveDocumentSchema),
  requireAdminPermission("admin.verifications.approve"),
  asyncHandler(postApproveVehicleDocument),
);

router.post(
  "/vehicles/:vehicleId/documents/:documentId/reject",
  validate(rejectDocumentSchema),
  requireAdminPermission("admin.verifications.reject"),
  asyncHandler(postRejectVehicleDocument),
);

router.post(
  "/owners/:ownerId/documents/:documentId/approve",
  validate(approveDocumentSchema),
  requireAdminPermission("admin.verifications.approve"),
  asyncHandler(postApproveOwnerDocument),
);

router.post(
  "/owners/:ownerId/documents/:documentId/reject",
  validate(rejectDocumentSchema),
  requireAdminPermission("admin.verifications.reject"),
  asyncHandler(postRejectOwnerDocument),
);

export default router;
