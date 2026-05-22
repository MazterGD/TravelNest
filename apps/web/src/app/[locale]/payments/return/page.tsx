"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, LoadingSpinner } from "@/components/ui";
import { paymentService, ApiError } from "@/lib/api";
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useTranslations } from "next-intl";

interface PaymentInfo {
  id: string;
  bookingId: string;
  status: string;
}

export default function PaymentReturnPage() {
  const t = useTranslations("payment.return");
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();
  const orderId =
    searchParams.get("order_id") || searchParams.get("payment_id");

  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPayment = async () => {
      if (!orderId) {
        setError(t("errors.missingReference"));
        setIsLoading(false);
        return;
      }

      try {
        const response = await paymentService.getPaymentById(orderId);
        setPayment(response.payment);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : t("errors.verifyFailed");
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadPayment();
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isSuccess = payment?.status === "completed";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-6 py-10">
      <Card className="w-full">
        <CardContent className="space-y-4 p-8 text-center">
          {isSuccess ? (
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          ) : (
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          )}
          <h1 className="text-2xl font-semibold text-gray-900">
            {isSuccess ? t("success.title") : t("pending.title")}
          </h1>
          <p className="text-sm text-gray-600">
            {error || (isSuccess ? t("success.message") : t("pending.message"))}
          </p>
          {payment?.bookingId && (
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href={`/${locale}/dashboard/bookings/${payment.bookingId}`}>
                <Button>{t("actions.viewBooking")}</Button>
              </Link>
              <Link
                href={`/${locale}/dashboard/bookings/${payment.bookingId}/payment`}
              >
                <Button variant="outline">{t("actions.paymentDetails")}</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
