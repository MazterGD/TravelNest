import type { Request, Response } from "express";
import { ResponseHelper } from "../../utils/response.js";
import { ApiError } from "../../middleware/errorHandler.js";
import * as paymentService from "./payment.service.js";

export const createPaymentIntent = async (req: Request, res: Response) => {
  const { bookingId, method, amount } = req.body as {
    bookingId: string;
    method: paymentService.PaymentMethod;
    amount?: number;
  };

  const userId = req.user!.id;

  const result = await paymentService.createPaymentIntent(
    userId,
    bookingId,
    method,
    amount,
  );

  return ResponseHelper.created(res, result, "Payment intent created");
};

export const confirmPayment = async (req: Request, res: Response) => {
  const { paymentId } = req.body as { paymentId: string };
  const userId = req.user!.id;

  const payment = await paymentService.confirmPayment(userId, paymentId);

  return ResponseHelper.success(res, { payment }, "Payment status retrieved");
};

export const getPaymentById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const paymentId = Array.isArray(id) ? id[0] : id;
  const userId = req.user!.id;

  const payment = await paymentService.getPaymentById(userId, paymentId);

  return ResponseHelper.success(res, { payment });
};

export const getMyPayments = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

  const result = await paymentService.getMyPayments(userId, page, limit);

  return ResponseHelper.success(res, result);
};

export const refundPayment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const paymentId = Array.isArray(id) ? id[0] : id;
  const { amount, reason } = req.body as {
    amount?: number;
    reason: string;
  };
  const userId = req.user!.id;

  const payment = await paymentService.refundPayment(
    userId,
    paymentId,
    amount,
    reason,
  );

  return ResponseHelper.success(res, { payment }, "Refund processed");
};

export const uploadReceipt = async (req: Request, res: Response) => {
  const { id } = req.params;
  const paymentId = Array.isArray(id) ? id[0] : id;
  const userId = req.user!.id;
  const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;

  if (!uploadedFile) {
    throw ApiError.badRequest("Receipt file is required");
  }

  const receipt = await paymentService.uploadBankReceipt(userId, paymentId, {
    url: `/uploads/receipts/${uploadedFile.filename}`,
    fileName: uploadedFile.originalname,
    fileSize: uploadedFile.size,
    mimeType: uploadedFile.mimetype,
  });

  return ResponseHelper.success(res, { payment: receipt }, "Receipt uploaded");
};

export const getBankDetails = async (_req: Request, res: Response) => {
  const details = paymentService.getBankDetails();
  return ResponseHelper.success(res, { bankDetails: details });
};

export const payhereWebhook = async (req: Request, res: Response) => {
  const payload = req.body as Record<string, string>;

  const payment = await paymentService.handlePayHereWebhook(payload);

  return ResponseHelper.success(res, { payment }, "Webhook received");
};
