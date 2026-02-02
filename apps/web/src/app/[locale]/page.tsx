import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  FaCheckCircle,
  FaSearch,
  FaFileInvoice,
  FaCreditCard,
  FaBus,
  FaShieldAlt,
  FaMoneyBillWave,
  FaGlobe,
} from "react-icons/fa";
import { MainLayout } from "@/components/layout/MainLayout";

export default function Home() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const features = [
    {
      icon: FaMoneyBillWave,
      title: t("features.transparentPricing.title"),
      description: t("features.transparentPricing.description"),
    },
    {
      icon: FaShieldAlt,
      title: t("features.verifiedOwners.title"),
      description: t("features.verifiedOwners.description"),
    },
    {
      icon: FaCheckCircle,
      title: t("features.easyBooking.title"),
      description: t("features.easyBooking.description"),
    },
    {
      icon: FaGlobe,
      title: t("features.multilingualSupport.title"),
      description: t("features.multilingualSupport.description"),
    },
  ];

  const customerSteps = [
    {
      icon: FaSearch,
      title: t("howItWorks.customer.step1"),
      description: t("howItWorks.customer.step1Desc"),
    },
    {
      icon: FaFileInvoice,
      title: t("howItWorks.customer.step2"),
      description: t("howItWorks.customer.step2Desc"),
    },
    {
      icon: FaCreditCard,
      title: t("howItWorks.customer.step3"),
      description: t("howItWorks.customer.step3Desc"),
    },
    {
      icon: FaBus,
      title: t("howItWorks.customer.step4"),
      description: t("howItWorks.customer.step4Desc"),
    },
  ];

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-muted via-background to-accent/20 py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
              {t("hero.subtitle")}
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href={`/${locale}/search`}
                className="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm hover:bg-secondary transition-colors"
              >
                {t("hero.searchButton")}
              </Link>
              <Link
                href={`/${locale}/how-it-works`}
                className="text-base font-semibold leading-7 text-foreground hover:text-accent transition-colors"
              >
                {tCommon("learnMore")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("features.title")}
            </h2>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="relative flex flex-col items-center text-center p-6 bg-card rounded-lg border border-border hover:shadow-lg transition-shadow"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-card-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("howItWorks.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t("howItWorks.customer.title")}
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {customerSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                    {index + 1}
                  </div>
                  <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/30">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            {t("cta.customer.title")}
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/90">
            {t("cta.customer.description")}
          </p>
          <div className="mt-10">
            <Link
              href={`/${locale}/search`}
              className="inline-flex items-center justify-center rounded-md bg-accent px-8 py-4 text-base font-semibold text-primary shadow-sm hover:bg-accent/90 transition-colors"
            >
              {t("cta.customer.button")}
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
