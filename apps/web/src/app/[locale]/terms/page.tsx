import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card } from "@/components/ui";
import { PolicyContent } from "@/components/features/content/PolicyContent";

export default function TermsOfServicePage() {
  const t = useTranslations("legal.terms");

  const sections = [
    {
      key: "acceptance",
      title: t("sections.acceptance.title"),
      content: t("sections.acceptance.content"),
    },
    {
      key: "services",
      title: t("sections.services.title"),
      content: t("sections.services.content"),
    },
    {
      key: "accounts",
      title: t("sections.accounts.title"),
      content: t("sections.accounts.content"),
    },
    {
      key: "booking",
      title: t("sections.booking.title"),
      content: t("sections.booking.content"),
    },
    {
      key: "conduct",
      title: t("sections.conduct.title"),
      content: t("sections.conduct.content"),
    },
    {
      key: "liability",
      title: t("sections.liability.title"),
      content: t("sections.liability.content"),
    },
    {
      key: "changes",
      title: t("sections.changes.title"),
      content: t("sections.changes.content"),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title={t("title")} />

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Card className="p-8">
            <p className="text-sm text-muted-foreground mb-8">
              {t("lastUpdated")}: {t("lastUpdatedDate")}
            </p>

            <PolicyContent
              slug="terms-and-conditions"
              fallback={
                <div className="space-y-8">
                  {sections.map((section, index) => (
                    <div key={section.key}>
                      <h2 className="text-xl font-semibold text-foreground mb-3">
                        {index + 1}. {section.title}
                      </h2>
                      <p className="text-muted-foreground leading-relaxed">
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              }
            />
          </Card>
        </div>
      </section>
    </MainLayout>
  );
}
