import { SearchPageContent } from "./search-page-content";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function SearchPage({ params }: PageProps) {
  const { locale } = await params;
  return <SearchPageContent locale={locale} />;
}
