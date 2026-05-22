import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as routingController from "./routing.controller.js";
import { calculateRouteSchema } from "./routing.schemas.js";

const router = Router();

// POST /routing/calculate
// Accessible to authenticated customers (building quotation itineraries)
// and vehicle owners (reviewing/previewing routes for quotation responses).
// CSRF-protected because this is a mutating endpoint (writes to DB when
// quotationId is provided).
router.post(
  "/calculate",
  authenticate,
  csrfProtection,
  authorize("customer", "owner", "admin"),
  validate(calculateRouteSchema),
  asyncHandler(routingController.calculateRoute),
);

export default router;
