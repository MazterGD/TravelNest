import { getTranslations } from "next-intl/server";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui";
import HowItWorksContent from "./HowItWorksContent";
import { getHowItWorksImages } from "./actions";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });

  return {
    title: `${t("hero.title", { defaultValue: "How TravelNest Works" })} | TravelNest`,
    description: t("hero.subtitle", {
      defaultValue: "Simple steps to book your perfect bus or grow your transport business",
    }),
  };
}

export default async function HowItWorksPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  
  // Fetch presigned imagery from Supabase Storage with graceful fallback options
  const images = await getHowItWorksImages();

  return (
    <MainLayout>
      <div className="py-16 lg:py-24 bg-background">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-display text-text-primary tracking-tight font-extrabold mb-4">
              {t("hero.title", { defaultValue: "How TravelNest Works" })}
            </h1>
            <p className="text-body-lg text-text-secondary max-w-[720px] mx-auto leading-relaxed">
              {t("hero.subtitle", {
                defaultValue: "Simple steps to book your perfect bus or grow your transport business",
              })}
            </p>
          </div>

          {/* Interactive tabs and animated Bento Steps */}
          <HowItWorksContent locale={locale} images={images} />
        </div>
      </div>
    </MainLayout>
  );
}
