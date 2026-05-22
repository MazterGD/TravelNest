import { Router } from "express";
import commissionsRoutes from "./commissions.routes.js";
import settlementsRoutes from "./settlements.routes.js";

const router = Router();

router.use("/settlements", settlementsRoutes);
router.use("/commissions", commissionsRoutes);

export default router;
