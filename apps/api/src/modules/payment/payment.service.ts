import crypto from "crypto";
import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { deleteByUrl } from "../../utils/storage.js";
import { config } from "../../config/index.js";
import { dispatchNotification } from "../notification/notification.service.js";
import {
  paymentFailedToCustomer,
  paymentReceivedToCustomer,
} from "../notification/notification.events.js";

export type PaymentMethod = "CARD" | "BANK_TRANSFER" | "CASH";

interface PaymentIntentResult {
  payment: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    method: string | null;
  };
  payhere?: {
    actionUrl: string;
    payload: Record<string, string>;
  };
}

interface PayHereWebhookPayload {
  merchant_id?: string;
  order_id?: string;
  payment_id?: string;
  payhere_amount?: string;
  payhere_currency?: string;
  status_code?: string;
  md5sig?: string;
  method?: string;
  customer_token?: string;
}

const PAYHERE_ACTION_URLS = {
  sandbox: "https://sandbox.payhere.lk/pay/checkout",
  live: "https://www.payhere.lk/pay/checkout",
} as const;

const PAYHERE_API_URLS = {
  sandbox: "https://sandbox.payhere.lk/merchant/v1",
  live: "https://www.payhere.lk/merchant/v1",
} as const;

const getPayHereAccessToken = async (): Promise<string> => {
  if (!config.payhere.appId || !config.payhere.appSecret) {
    throw ApiError.internal("PayHere App credentials are not configured");
  }

  const baseUrl =
    config.payhere.mode === "live"
      ? PAYHERE_API_URLS.live
      : PAYHERE_API_URLS.sandbox;

  const authString = Buffer.from(
    `${config.payhere.appId}:${config.payhere.appSecret}`,
  ).toString("base64");

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw ApiError.internal(`Failed to get PayHere access token: ${errorBody}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
};

const formatAmount = (amount: number) => Number(amount).toFixed(2);

const buildPayHereHash = (
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  merchantSecret: string,
) => {
  const hashedSecret = crypto
    .createHash("md5")
    .update(merchantSecret)
    .digest("hex")
    .toUpperCase();

  return crypto
    .createHash("md5")
    .update(`${merchantId}${orderId}${amount}${currency}${hashedSecret}`)
    .digest("hex")
    .toUpperCase();
};

const buildRedirectUrl = (baseUrl: string, params: Record<string, string>) => {
  if (!baseUrl) return "";
  const url = new URL(baseUrl, config.appUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const mapPaymentStatus = (statusCode: number) => {
  if (statusCode === 2) return "COMPLETED";
  if (statusCode === 0) return "PROCESSING";
  if (statusCode === -3) return "REFUNDED";
  return "FAILED";
};

const toPaymentResponse = (payment: {
  id: string;
  bookingId: string;
  status: string;
  amount: number;
  currency: string;
  method: string | null;
  bankReceiptUrl?: string | null;
  bankReceiptName?: string | null;
  bankReceiptSize?: number | null;
  bankReceiptMime?: string | null;
  bankReceiptAt?: Date | null;
}) => ({
  id: payment.id,
  bookingId: payment.bookingId,
  status: payment.status.toLowerCase(),
  amount: payment.amount,
  currency: payment.currency,
  method: payment.method,
  receipt: payment.bankReceiptUrl
    ? {
        url: payment.bankReceiptUrl,
        name: payment.bankReceiptName,
        size: payment.bankReceiptSize,
        mime: payment.bankReceiptMime,
        uploadedAt: payment.bankReceiptAt,
      }
    : null,
});

export const createPaymentIntent = async (
  userId: string,
  bookingId: string,
  method: PaymentMethod,
  amount?: number,
): Promise<PaymentIntentResult> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          city: true,
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  if (booking.customerId !== userId) {
    throw ApiError.forbidden("Not authorized to pay for this booking");
  }

  if (["CANCELLED", "COMPLETED"].includes(booking.status)) {
    throw ApiError.badRequest("Cannot pay for a closed booking");
  }

  const totalAmount = booking.totalAmount;
  const normalizedAmount = amount ? Number(amount) : totalAmount;

  if (normalizedAmount <= 0 || normalizedAmount > totalAmount) {
    throw ApiError.badRequest("Invalid payment amount");
  }

  const existingPayment = await prisma.payment.findUnique({
    where: { bookingId },
  });

  if (existingPayment?.status === "COMPLETED") {
    throw ApiError.conflict("Payment already completed for this booking");
  }

  const paymentStatus = method === "CARD" ? "PROCESSING" : "PENDING";

  const payment = existingPayment
    ? await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          amount: normalizedAmount,
          status: paymentStatus,
          method,
        },
      })
    : await prisma.payment.create({
        data: {
          userId,
          bookingId,
          amount: normalizedAmount,
          currency: "LKR",
          status: paymentStatus,
          method,
        },
      });

  if (method !== "CARD") {
    return { payment: toPaymentResponse(payment) };
  }

  if (!config.payhere.merchantId || !config.payhere.merchantSecret) {
    throw ApiError.badRequest("Payment gateway is not configured");
  }

  const amountString = formatAmount(payment.amount);
  const hash = buildPayHereHash(
    config.payhere.merchantId,
    payment.id,
    amountString,
    payment.currency,
    config.payhere.merchantSecret,
  );

  const payload: Record<string, string> = {
    merchant_id: config.payhere.merchantId,
    return_url: buildRedirectUrl(config.payhere.returnUrl, {
      bookingId: booking.id,
    }),
    cancel_url: buildRedirectUrl(config.payhere.cancelUrl, {
      bookingId: booking.id,
    }),
    notify_url: config.payhere.notifyUrl,
    order_id: payment.id,
    items: `Booking ${booking.id.slice(0, 8).toUpperCase()}`,
    currency: payment.currency,
    amount: amountString,
    first_name: booking.customer.firstName,
    last_name: booking.customer.lastName,
    email: booking.customer.email,
    phone: booking.customer.phone || "",
    address: booking.customer.address || "",
    city: booking.customer.city || "",
    country: "Sri Lanka",
    hash,
  };

  const actionUrl =
    config.payhere.mode === "live"
      ? PAYHERE_ACTION_URLS.live
      : PAYHERE_ACTION_URLS.sandbox;

  return {
    payment: toPaymentResponse(payment),
    payhere: {
      actionUrl,
      payload,
    },
  };
};

export const confirmPayment = async (userId: string, paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.userId !== userId) {
    throw ApiError.forbidden("Not authorized to access this payment");
  }

  return toPaymentResponse(payment);
};

export const getPaymentById = async (userId: string, paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.userId !== userId) {
    throw ApiError.forbidden("Not authorized to view this payment");
  }

  return toPaymentResponse(payment);
};

export const getMyPayments = async (
  userId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { userId } }),
  ]);

  return {
    payments: payments.map(toPaymentResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const refundPayment = async (
  userId: string,
  paymentId: string,
  amount: number | undefined,
  reason: string,
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.userId !== userId) {
    throw ApiError.forbidden("Not authorized to refund this payment");
  }

  if (payment.status !== "COMPLETED") {
    throw ApiError.badRequest("Only completed payments can be refunded");
  }

  const refundAmount = amount ?? payment.amount;

  if (refundAmount <= 0 || refundAmount > payment.amount) {
    throw ApiError.badRequest("Invalid refund amount");
  }

  if (payment.method === "CARD" && payment.payherePaymentId) {
    const accessToken = await getPayHereAccessToken();
    const baseUrl =
      config.payhere.mode === "live"
        ? PAYHERE_API_URLS.live
        : PAYHERE_API_URLS.sandbox;

    const refundResponse = await fetch(`${baseUrl}/payment/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment_id: payment.payherePaymentId,
        description: reason,
        amount: refundAmount,
      }),
    });

    if (!refundResponse.ok) {
      const errorBody = await refundResponse.text();
      throw ApiError.internal(`PayHere refund failed: ${errorBody}`);
    }

    const refundData = (await refundResponse.json()) as { status: number; msg: string };
    
    // Status 1 means success in PayHere API
    if (refundData.status !== 1) {
      throw ApiError.internal(`PayHere refund rejected: ${refundData.msg}`);
    }
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "REFUNDED",
      refundAmount,
      refundReason: reason,
    },
  });

  return toPaymentResponse(updated);
};

export const uploadBankReceipt = async (
  userId: string,
  paymentId: string,
  file: {
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  },
) => {
  const prismaClient = prisma as any;
  const payment = await prismaClient.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.userId !== userId) {
    throw ApiError.forbidden("Not authorized to update this payment");
  }

  if (payment.status === "COMPLETED") {
    throw ApiError.badRequest("Cannot upload receipt for completed payments");
  }

  if (payment.bankReceiptUrl) {
    await deleteByUrl(payment.bankReceiptUrl);
  }

  const updated = await prismaClient.payment.update({
    where: { id: paymentId },
    data: {
      method: "BANK_TRANSFER",
      status: "PROCESSING",
      bankReceiptUrl: file.url,
      bankReceiptName: file.fileName,
      bankReceiptSize: file.fileSize,
      bankReceiptMime: file.mimeType,
      bankReceiptAt: new Date(),
    },
  });

  return toPaymentResponse(updated);
};

export const getBankDetails = () => {
  return config.bankDetails;
};

export const handlePayHereWebhook = async (payload: PayHereWebhookPayload) => {
  if (!payload.order_id) {
    throw ApiError.badRequest("Missing PayHere order ID");
  }

  if (!payload.status_code || !payload.md5sig) {
    throw ApiError.badRequest("Invalid PayHere payload");
  }

  const merchantId = payload.merchant_id || config.payhere.merchantId;
  const amount = payload.payhere_amount || "0.00";
  const currency = payload.payhere_currency || "LKR";

  const expectedHash = buildPayHereHash(
    merchantId,
    payload.order_id,
    amount,
    currency,
    config.payhere.merchantSecret,
  );

  if (expectedHash !== payload.md5sig) {
    throw ApiError.forbidden("Invalid PayHere signature");
  }

  const statusCode = Number(payload.status_code);
  const nextStatus = mapPaymentStatus(statusCode);

  const payment = await prisma.payment.findUnique({
    where: { id: payload.order_id },
  });

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.status === "COMPLETED" && nextStatus === "COMPLETED") {
    return toPaymentResponse(payment);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: nextStatus,
      payherePaymentId: payload.payment_id || payment.payherePaymentId,
      payhereCustomerId: payload.customer_token || payment.payhereCustomerId,
      method: payload.method || payment.method,
    },
  });

  if (nextStatus === "COMPLETED") {
    dispatchNotification(
      paymentReceivedToCustomer(payment.userId, {
        bookingId: payment.bookingId,
        paymentId: payment.id,
      }),
    );
  }

  if (nextStatus === "FAILED") {
    dispatchNotification(
      paymentFailedToCustomer(payment.userId, {
        bookingId: payment.bookingId,
        paymentId: payment.id,
      }),
    );
  }

  return toPaymentResponse(updated);
};
