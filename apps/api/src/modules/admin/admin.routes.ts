import { Router } from "express";
import { authenticate, isAdmin } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { validate } from "../../middleware/validate.js";
import * as adminController from "./admin.controller.js";
import { requireAdminPermission, requireAdminRole } from "./admin.middleware.js";
import auditRoutes from "./audit/audit.routes.js";
import dashboardRoutes from "./dashboard/dashboard.routes.js";
import usersRoutes from "./users/users.routes.js";
import bookingsRoutes from "./bookings/bookings.routes.js";
import analyticsRoutes from "./analytics/analytics.routes.js";
import verificationsRoutes from "./verifications/verifications.routes.js";
import reviewsRoutes from "./reviews/reviews.routes.js";
import disputesRoutes from "./disputes/disputes.routes.js";
import financialRoutes from "./financial/financial.routes.js";
import settlementsRoutes from "./financial/settlements.routes.js";
import commissionsRoutes from "./financial/commissions.routes.js";
import settingsRoutes from "./settings/settings.routes.js";
import contentRoutes from "./content/content.routes.js";
import faqsRoutes from "./faqs/faqs.routes.js";
import testimonialsRoutes from "./testimonials/testimonials.routes.js";
import amenitiesRoutes from "./amenities/amenities.routes.js";
import notificationsRoutes from "./notifications/notifications.routes.js";
import { adminReportsRouter } from "./reports/reports.routes.js";
import profileRoutes from "./profile/profile.routes.js";
import vehiclesRoutes from "./vehicles/vehicles.routes.js";
import { postCreateAdmin } from "./users/users.controller.js";
import { createAdminSchema } from "./users/users.schemas.js";

const router = Router();

router.use(authenticate, isAdmin);

router.get("/health", asyncHandler(adminController.health));
router.post(
	"/admins",
	requireAdminRole("SUPER_ADMIN"),
	validate(createAdminSchema),
	requireAdminPermission("admin.users.create_admin"),
	asyncHandler(postCreateAdmin),
);
router.use("/audit-logs", auditRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/users", usersRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/verifications", verificationsRoutes);
router.use("/reviews", reviewsRoutes);
router.use("/disputes", disputesRoutes);
router.use("/financial", financialRoutes);
router.use("/settlements", settlementsRoutes);
router.use("/commissions", commissionsRoutes);
router.use("/settings", settingsRoutes);
router.use("/content", contentRoutes);
router.use("/faqs", faqsRoutes);
router.use("/testimonials", testimonialsRoutes);
router.use("/amenities", amenitiesRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/reports", adminReportsRouter);
router.use("/profile", profileRoutes);
router.use("/vehicles", vehiclesRoutes);

export default router;
