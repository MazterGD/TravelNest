import { QuotationDetailPageContent } from "./QuotationDetailPageContent";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function QuotationDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  return <QuotationDetailPageContent locale={locale} requestId={id} />;
}
