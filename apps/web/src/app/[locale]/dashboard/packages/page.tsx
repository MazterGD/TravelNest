import { PackagesPageContent } from "./packages-page-content";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function PackagesPage({ params }: PageProps) {
  const { locale } = await params;
  return <PackagesPageContent locale={locale} />;
}
