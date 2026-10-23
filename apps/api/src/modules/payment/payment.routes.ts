import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import { ApiError, asyncHandler } from "../../middleware/errorHandler.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import * as paymentController from "./payment.controller.js";
import {
  confirmPaymentSchema,
  createPaymentIntentSchema,
  uploadReceiptSchema,
} from "./payment.schemas.js";
import { config } from "../../config/index.js";

const router = Router();

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(ApiError.badRequest("Unsupported receipt file type"));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// Create payment intent (PayHere or offline)
router.post(
  "/create-intent",
  authenticate,
  csrfProtection,
  validate(createPaymentIntentSchema),
  asyncHandler(paymentController.createPaymentIntent),
);

// Confirm payment status
router.post(
  "/confirm",
  authenticate,
  csrfProtection,
  validate(confirmPaymentSchema),
  asyncHandler(paymentController.confirmPayment),
);

// Get bank transfer details
router.get(
  "/bank-details",
  authenticate,
  asyncHandler(paymentController.getBankDetails),
);

// Get my payments
router.get(
  "/my-payments",
  authenticate,
  asyncHandler(paymentController.getMyPayments),
);

// Get payment by ID
router.get(
  "/:id",
  authenticate,
  asyncHandler(paymentController.getPaymentById),
);

// Upload bank transfer receipt
router.post(
  "/:id/receipt",
  authenticate,
  csrfProtection,
  validate(uploadReceiptSchema),
  receiptUpload.single("receipt"),
  asyncHandler(paymentController.uploadReceipt),
);

// PayHere webhook
router.post("/webhook", asyncHandler(paymentController.payhereWebhook));

export default router;
