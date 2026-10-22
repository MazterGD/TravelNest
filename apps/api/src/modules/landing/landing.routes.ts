import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../config/index.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { validate } from "../../middleware/validate.js";
import * as landingController from "./landing.controller.js";
import { routeEstimateSchema, submitContactSchema } from "./landing.schemas.js";

const router = Router();

// Anonymous endpoints: the contact form notifies admins and the route
// estimate calls OSRM, so both are throttled per client IP.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "You've sent several messages already. Please wait a while before sending another.",
  },
  skip: () => config.env !== "production",
});

const routeEstimateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many route estimates. Please try again in a few minutes.",
  },
  skip: () => config.env !== "production",
});

router.get("/", asyncHandler(landingController.getLandingData));
router.get("/config", asyncHandler(landingController.getPublicConfig));
router.get("/about-stats", asyncHandler(landingController.getAboutStats));
router.post(
  "/contact",
  contactLimiter,
  validate(submitContactSchema),
  asyncHandler(landingController.submitContactMessage),
);
router.post(
  "/route-estimate",
  routeEstimateLimiter,
  validate(routeEstimateSchema),
  asyncHandler(landingController.getRouteEstimate),
);

export default router;
