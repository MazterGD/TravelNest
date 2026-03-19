import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  FaSearch,
  FaFileAlt,
  FaBalanceScale,
  FaCheckCircle,
  FaUserPlus,
  FaBus,
  FaEnvelope,
  FaChartLine,
} from "react-icons/fa";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card, Button } from "@/components/ui";

export default function HowItWorksPage() {
  const t = useTranslations("howItWorks");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const customerSteps = [
    {
      icon: FaSearch,
      title: t("customer.steps.search.title"),
      description: t("customer.steps.search.description"),
    },
    {
      icon: FaFileAlt,
      title: t("customer.steps.request.title"),
      description: t("customer.steps.request.description"),
    },
    {
      icon: FaBalanceScale,
      title: t("customer.steps.compare.title"),
      description: t("customer.steps.compare.description"),
    },
    {
      icon: FaCheckCircle,
      title: t("customer.steps.book.title"),
      description: t("customer.steps.book.description"),
    },
  ];

  const ownerSteps = [
    {
      icon: FaUserPlus,
      title: t("owner.steps.register.title"),
      description: t("owner.steps.register.description"),
    },
    {
      icon: FaBus,
      title: t("owner.steps.list.title"),
      description: t("owner.steps.list.description"),
    },
    {
      icon: FaEnvelope,
      title: t("owner.steps.respond.title"),
      description: t("owner.steps.respond.description"),
    },
    {
      icon: FaChartLine,
      title: t("owner.steps.earn.title"),
      description: t("owner.steps.earn.description"),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title={t("hero.title")} subtitle={t("hero.subtitle")} />

      {/* Customer Section */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">
              {t("customer.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("customer.description")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {customerSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative">
                  {/* Connector Line */}
                  {index < customerSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-1/2 w-full h-0.5 bg-border" />
                  )}

                  <Card className="relative text-center p-6 bg-card">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold mx-auto mb-4">
                      {index + 1}
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/30 mx-auto mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </Card>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link href={`/${locale}/search`}>
              <Button size="lg">{tCommon("getStarted")}</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Owner Section */}
      <section className="py-16 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">
              {t("owner.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("owner.description")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {ownerSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative">
                  {/* Connector Line */}
                  {index < ownerSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-1/2 w-full h-0.5 bg-border" />
                  )}

                  <Card className="relative text-center p-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xl font-bold mx-auto mb-4">
                      {index + 1}
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/30 mx-auto mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </Card>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link href={`/${locale}/register`}>
              <Button size="lg" variant="secondary">
                {t("ownerCta")}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
