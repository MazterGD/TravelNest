import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";

// Mirror src/config: the local .env plus the repo root .env (which holds the
// PayHere sandbox credentials) so the signature matches the running server.
// Prisma is imported dynamically inside main() so this runs before the client loads.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });

/**
 * Local-demo helper: PayHere's servers cannot reach a localhost `notify_url`,
 * so the payment webhook never arrives during local development. This script
 * plays the role of PayHere by POSTing the notification to the local API with
 * a valid MD5 signature — the webhook's mandatory signature verification and
 * the full completion path (booking CONFIRMED, availability block, settlement
 * accrual, notifications) run exactly as they would in production.
 *
 * The customer must have initiated a payment first (Pay Now in the UI creates
 * the payment intent); this script then completes it.
 *
 * Usage:
 *   pnpm --filter @travenest/api payhere:simulate <bookingId | paymentId> [statusCode]
 *     statusCode: 2 = success (default), 0 = pending, -2 = failed
 */

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

const main = async () => {
  const id = process.argv[2];
  const statusCode = process.argv[3] || "2";
  if (!id) {
    console.error(
      "Usage: pnpm --filter @travenest/api payhere:simulate <bookingId | paymentId> [statusCode]",
    );
    process.exit(1);
  }

  const { default: prisma } = await import("@travenest/database");

  const payment =
    (await prisma.payment.findUnique({ where: { bookingId: id } })) ??
    (await prisma.payment.findUnique({ where: { id } }));

  if (!payment) {
    console.error(
      `No payment found for "${id}". Open the booking in the app and click Pay Now first (that creates the payment intent), then re-run this script.`,
    );
    process.exit(1);
  }

  console.log(
    `Payment ${payment.id} (booking ${payment.bookingId}): ${payment.status}, ${payment.currency} ${payment.amount}, method ${payment.method ?? "-"}`,
  );

  const merchantId = process.env.PAYHERE_MERCHANT_ID || "";
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || "";
  const amount = payment.amount.toFixed(2);
  const currency = payment.currency || "LKR";

  const body = new URLSearchParams({
    merchant_id: merchantId,
    order_id: payment.id,
    payhere_amount: amount,
    payhere_currency: currency,
    status_code: statusCode,
    md5sig: buildPayHereHash(
      merchantId,
      payment.id,
      amount,
      currency,
      merchantSecret,
    ),
  });

  const port = process.env.PORT || "5000";
  const apiVersion = process.env.API_VERSION || "v1";
  const url = `http://localhost:${port}/api/${apiVersion}/payments/webhook`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await response.text();

  if (!response.ok) {
    console.error(`Webhook rejected (${response.status}): ${text}`);
    process.exit(1);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: payment.bookingId },
    select: { status: true, payment: { select: { status: true } } },
  });
  console.log(
    `Webhook accepted. Payment is now ${booking?.payment?.status}, booking is ${booking?.status}.`,
  );

  await prisma.$disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
