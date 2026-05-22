import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card } from "@/components/ui";

export default function RefundPolicyPage() {
  const t = useTranslations("legal.refund");

  const sections = [
    {
      key: "overview",
      title: t("sections.overview.title"),
      content: t("sections.overview.content"),
    },
    {
      key: "eligibility",
      title: t("sections.eligibility.title"),
      content: t("sections.eligibility.content"),
    },
    {
      key: "process",
      title: t("sections.process.title"),
      content: t("sections.process.content"),
    },
    {
      key: "exceptions",
      title: t("sections.exceptions.title"),
      content: t("sections.exceptions.content"),
    },
    {
      key: "disputes",
      title: t("sections.disputes.title"),
      content: t("sections.disputes.content"),
    },
    {
      key: "contact",
      title: t("sections.contact.title"),
      content: t("sections.contact.content"),
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
          </Card>
        </div>
      </section>
    </MainLayout>
  );
}
