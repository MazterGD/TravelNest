import { getTranslations } from "next-intl/server";
import { TripDetailPageContent } from "./TripDetailPageContent";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trip" });

  return {
    title: t("detailPageTitle"),
    description: t("detailPageDescription"),
  };
}

export default async function TripDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  return <TripDetailPageContent locale={locale} tripId={id} />;
}
