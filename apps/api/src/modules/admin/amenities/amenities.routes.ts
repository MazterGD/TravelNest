import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import { validate } from "../../../middleware/validate.js";
import { requireAdminPermission, requireAdminRole } from "../admin.middleware.js";
import {
  deleteAmenityById,
  getAmenitiesCollection,
  patchAmenityById,
  postCreateAmenity,
} from "./amenities.controller.js";
import {
  amenityIdParamsSchema,
  createAmenitySchema,
  listAmenitiesSchema,
  updateAmenitySchema,
} from "./amenities.schemas.js";

const router = Router();

router.use(requireAdminRole("SUPER_ADMIN", "MODERATOR"));

router.get(
  "/",
  validate(listAmenitiesSchema),
  requireAdminPermission("admin.amenities.read"),
  asyncHandler(getAmenitiesCollection),
);

router.post(
  "/",
  validate(createAmenitySchema),
  requireAdminPermission("admin.amenities.manage"),
  asyncHandler(postCreateAmenity),
);

router.patch(
  "/:amenityId",
  validate(updateAmenitySchema),
  requireAdminPermission("admin.amenities.manage"),
  asyncHandler(patchAmenityById),
);

router.delete(
  "/:amenityId",
  validate(amenityIdParamsSchema),
  requireAdminPermission("admin.amenities.manage"),
  asyncHandler(deleteAmenityById),
);

export default router;
