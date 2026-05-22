import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card } from "@/components/ui";

export default function PrivacyPolicyPage() {
  const t = useTranslations("legal.privacy");

  const sections = [
    {
      key: "intro",
      title: t("sections.intro.title"),
      content: t("sections.intro.content"),
    },
    {
      key: "collection",
      title: t("sections.collection.title"),
      content: t("sections.collection.content"),
    },
    {
      key: "use",
      title: t("sections.use.title"),
      content: t("sections.use.content"),
    },
    {
      key: "sharing",
      title: t("sections.sharing.title"),
      content: t("sections.sharing.content"),
    },
    {
      key: "security",
      title: t("sections.security.title"),
      content: t("sections.security.content"),
    },
    {
      key: "rights",
      title: t("sections.rights.title"),
      content: t("sections.rights.content"),
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
