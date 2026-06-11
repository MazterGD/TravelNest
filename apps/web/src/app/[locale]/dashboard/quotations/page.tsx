import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ locale: string }>;
}

// The old Quotations list page has been replaced by the Trip-grouped Trips
// list. Per-quotation detail (/dashboard/quotations/[id]) still exists and is
// linked from the trip detail view; only the flat list is redirected.
export default async function QuotationsPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/trips`);
}
