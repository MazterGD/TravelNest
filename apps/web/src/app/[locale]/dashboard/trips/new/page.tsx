import { getTranslations } from "next-intl/server";
import { NewTripPageContent } from "./NewTripPageContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trip" });

  return {
    title: t("newPageTitle"),
    description: t("newPageDescription"),
  };
}

export default async function NewTripPage({ params }: PageProps) {
  const { locale } = await params;
  return <NewTripPageContent locale={locale} />;
}
