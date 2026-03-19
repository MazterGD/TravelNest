import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  PageHeader,
  Card,
  Accordion,
  AccordionItem,
  Button,
} from "@/components/ui";

export default function FAQPage() {
  const t = useTranslations("faq");
  const locale = useLocale();

  const faqItems = [
    {
      key: "whatIs",
      question: t("questions.whatIs.question"),
      answer: t("questions.whatIs.answer"),
    },
    {
      key: "howToBook",
      question: t("questions.howToBook.question"),
      answer: t("questions.howToBook.answer"),
    },
    {
      key: "payment",
      question: t("questions.payment.question"),
      answer: t("questions.payment.answer"),
    },
    {
      key: "cancellation",
      question: t("questions.cancellation.question"),
      answer: t("questions.cancellation.answer"),
    },
    {
      key: "verification",
      question: t("questions.verification.question"),
      answer: t("questions.verification.answer"),
    },
    {
      key: "becomeOwner",
      question: t("questions.becomeOwner.question"),
      answer: t("questions.becomeOwner.answer"),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Card className="p-8">
            <Accordion>
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={item.key}
                  title={item.question}
                  defaultOpen={index === 0}
                >
                  <p className="text-sm leading-relaxed">{item.answer}</p>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>

          {/* Contact CTA */}
          <Card className="mt-8 text-center p-8 bg-muted border-0">
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t("stillHaveQuestions")}
            </h3>
            <p className="text-muted-foreground mb-6">{t("contactUs")}</p>
            <Link href={`/${locale}/contact`}>
              <Button>{t("contactUs")}</Button>
            </Link>
          </Card>
        </div>
      </section>
    </MainLayout>
  );
}
