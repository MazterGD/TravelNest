import { use } from "react";
import BookingDetailsContent from "./BookingDetailsContent";

export default function BookingDetailsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = use(params);
  return <BookingDetailsContent bookingId={id} locale={locale} />;
}
