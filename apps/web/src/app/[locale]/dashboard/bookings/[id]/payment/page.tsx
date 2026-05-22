import { use } from "react";
import PaymentPageContent from "./PaymentPageContent";

export default function PaymentPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = use(params);
  return <PaymentPageContent bookingId={id} locale={locale} />;
}
