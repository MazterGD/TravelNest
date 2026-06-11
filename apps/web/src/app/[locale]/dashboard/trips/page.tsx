import { getTranslations } from "next-intl/server";
import { TripsPageContent } from "./TripsPageContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trip" });

  return {
    title: t("listPageTitle"),
    description: t("listPageDescription"),
  };
}

export default async function TripsPage({ params }: PageProps) {
  const { locale } = await params;
  return <TripsPageContent locale={locale} />;
}
