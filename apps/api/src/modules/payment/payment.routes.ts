import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import type { Request, Response } from "express";

const router = Router();

// Create payment intent (PayHere)
router.post(
  "/create-intent",
  authenticate,
  csrfProtection,
  asyncHandler(async (req: Request, res: Response) => {
    const { bookingId, amount } = req.body;

    // TODO: Implement with PayHere
    res.json({
      success: true,
      data: {
        clientSecret: "mock_client_secret",
        paymentIntentId: "mock_pi_id",
      },
    });
  }),
);

// Confirm payment
router.post(
  "/confirm",
  authenticate,
  csrfProtection,
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentIntentId, bookingId } = req.body;

    // TODO: Implement with PayHere
    res.json({
      success: true,
      message: "Payment confirmed",
    });
  }),
);

// Get payment by ID
router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // TODO: Implement with database
    res.json({
      success: true,
      data: { payment: { id } },
    });
  }),
);

// Get my payments
router.get(
  "/my-payments",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;

    // TODO: Implement with database
    res.json({
      success: true,
      data: {
        payments: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          totalPages: 0,
        },
      },
    });
  }),
);

// PayHere webhook
router.post(
  "/webhook",
  asyncHandler(async (req: Request, res: Response) => {
    // TODO: Implement PayHere webhook handling
    res.json({ received: true });
  }),
);

// Refund payment
router.post(
  "/:id/refund",
  authenticate,
  csrfProtection,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { amount, reason } = req.body;

    // TODO: Implement with PayHere
    res.json({
      success: true,
      message: `Refund initiated for payment ${id}`,
    });
  }),
);

export default router;
