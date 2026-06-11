import { Router } from "express";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import * as vehiclesController from "./vehicles.controller.js";

const router = Router();

router.get("/", asyncHandler(vehiclesController.getVehicles));

export default router;
