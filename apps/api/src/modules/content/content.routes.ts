import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as contentController from "./content.controller.js";

const router = Router();

// Public, read-only published content (Terms, Privacy, Refund, FAQ, …).
router.get("/:slug", asyncHandler(contentController.getContentPage));

export default router;
