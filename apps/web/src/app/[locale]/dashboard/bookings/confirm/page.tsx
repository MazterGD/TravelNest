import { use } from "react";
import BookingConfirmPageContent from "./BookingConfirmPageContent";

export default function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  return <BookingConfirmPageContent locale={locale} />;
}
