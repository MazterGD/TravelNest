import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { validate } from "../../middleware/validate.js";
import * as landingController from "./landing.controller.js";
import { routeEstimateSchema, submitContactSchema } from "./landing.schemas.js";

const router = Router();

router.get("/", asyncHandler(landingController.getLandingData));
router.get("/config", asyncHandler(landingController.getPublicConfig));
router.get("/about-stats", asyncHandler(landingController.getAboutStats));
router.post(
  "/contact",
  validate(submitContactSchema),
  asyncHandler(landingController.submitContactMessage),
);
router.post(
  "/route-estimate",
  validate(routeEstimateSchema),
  asyncHandler(landingController.getRouteEstimate),
);

export default router;
