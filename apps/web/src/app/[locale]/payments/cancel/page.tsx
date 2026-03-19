"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button, Card, CardContent } from "@/components/ui";
import { FaTimesCircle } from "react-icons/fa";
import { useTranslations } from "next-intl";

export default function PaymentCancelPage() {
  const t = useTranslations("payment.cancel");
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") || "";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-6 py-10">
      <Card className="w-full">
        <CardContent className="space-y-4 p-8 text-center">
          <FaTimesCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="text-2xl font-semibold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-600">{t("message")}</p>
          {bookingId && (
            <Link href={`/${locale}/dashboard/bookings/${bookingId}/payment`}>
              <Button>{t("actions.returnToPayment")}</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
