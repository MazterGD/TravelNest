"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, LoadingSpinner } from "@/components/ui";
import { paymentService, ApiError } from "@/lib/api";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";

interface PaymentInfo {
  id: string;
  bookingId: string;
  status: string;
}

export default function PaymentReturnPage() {
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
        setError("Payment reference not found");
        setIsLoading(false);
        return;
      }

      try {
        const response = await paymentService.getPaymentById(orderId);
        setPayment(response.payment);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to verify payment";
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
            <FaCheckCircle className="mx-auto h-12 w-12 text-green-500" />
          ) : (
            <FaExclamationTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          )}
          <h1 className="text-2xl font-semibold text-gray-900">
            {isSuccess ? "Payment successful" : "Payment pending"}
          </h1>
          <p className="text-sm text-gray-600">
            {error ||
              (isSuccess
                ? "Your payment is confirmed."
                : "We are still confirming your payment status.")}
          </p>
          {payment?.bookingId && (
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href={`/${locale}/dashboard/bookings/${payment.bookingId}`}>
                <Button>View booking</Button>
              </Link>
              <Link
                href={`/${locale}/dashboard/bookings/${payment.bookingId}/payment`}
              >
                <Button variant="outline">Payment details</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
