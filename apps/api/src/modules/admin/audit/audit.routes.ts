import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import * as auditController from "./audit.controller.js";

const router = Router();

router.use(
	requireAdminRole("SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN"),
);

router.get(
	"/",
	requireAdminPermission("audit.read"),
	asyncHandler(auditController.getAuditLogs),
);
router.get(
	"/user/:userId",
	requireAdminPermission("audit.read"),
	asyncHandler(auditController.getAuditLogsByUser),
);
router.get(
	"/entity/:entityType/:entityId",
	requireAdminPermission("audit.read"),
	asyncHandler(auditController.getAuditLogsByEntity),
);
router.get(
	"/export",
	requireAdminPermission("audit.export"),
	asyncHandler(auditController.exportAuditLogs),
);
router.get(
	"/:logId",
	requireAdminPermission("audit.read"),
	asyncHandler(auditController.getAuditLogById),
);

export default router;
