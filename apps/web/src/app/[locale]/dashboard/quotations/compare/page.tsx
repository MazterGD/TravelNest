import { use } from "react";
import ComparisonPageContent from "./ComparisonPageContent";

export default function QuotationComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  return <ComparisonPageContent locale={locale} />;
}
