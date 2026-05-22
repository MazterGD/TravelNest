import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  deleteFaqById,
  getFaqCollection,
  patchFaqById,
  postCreateFaq,
} from "./faqs.controller.js";
import {
  createFaqSchema,
  faqIdParamsSchema,
  listFaqsSchema,
  updateFaqSchema,
} from "./faqs.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN", "MODERATOR"));

router.get(
  "/",
  validate(listFaqsSchema),
  requireAdminPermission("admin.content.read"),
  asyncHandler(getFaqCollection),
);

router.post(
  "/",
  validate(createFaqSchema),
  requireAdminPermission("admin.content.update"),
  asyncHandler(postCreateFaq),
);

router.patch(
  "/:faqId",
  validate(updateFaqSchema),
  requireAdminPermission("admin.content.update"),
  asyncHandler(patchFaqById),
);

router.delete(
  "/:faqId",
  validate(faqIdParamsSchema),
  requireAdminPermission("admin.content.update"),
  asyncHandler(deleteFaqById),
);

export default router;
