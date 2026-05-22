import { Search, FileText, CheckCircle, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { CTAButton } from "@/components/ui";

interface HowItWorksProps {
  searchHref: string;
}

export function HowItWorks({ searchHref }: HowItWorksProps) {
  const t = useTranslations("landing.howItWorks");
  const steps = [
    {
      number: "01",
      title: t("steps.search.title"),
      description: t("steps.search.description"),
      icon: Search,
    },
    {
      number: "02",
      title: t("steps.quotes.title"),
      description: t("steps.quotes.description"),
      icon: FileText,
    },
    {
      number: "03",
      title: t("steps.book.title"),
      description: t("steps.book.description"),
      icon: CheckCircle,
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-3 text-[28px] font-bold leading-[36px] tracking-[-0.01em] text-foreground sm:text-[36px] sm:leading-[44px]">
            {t("title")}
          </h2>
          <p className="mx-auto max-w-lg text-[16px] leading-[24px] text-muted-foreground sm:text-[18px] sm:leading-[28px]">
            {t("subtitle")}
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-[16%] right-[16%] top-[52px] hidden h-px bg-border md:block"></div>

          <div className="relative grid gap-12 md:grid-cols-3 lg:gap-16">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative">
                  <div className="text-center">
                    <div className="mb-6 flex justify-center">
                      <div className="relative z-10 flex h-[104px] w-[104px] items-center justify-center rounded-full border border-border bg-muted">
                        <Icon
                          className="h-8 w-8 text-foreground"
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>

                    <div className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-text-tertiary">
                      {t("stepLabel", { number: step.number })}
                    </div>

                    <h3 className="mb-3 text-[20px] font-semibold leading-[28px] text-foreground sm:text-[24px] sm:leading-[32px]">
                      {step.title}
                    </h3>

                    <p className="mx-auto max-w-xs text-[14px] leading-[20px] text-muted-foreground sm:text-[16px] sm:leading-[24px]">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-16 text-center">
          <CTAButton
            href={searchHref}
            size="lg"
            rightIcon={<ArrowRight className="h-5 w-5" />}
          >
            {t("cta.button")}
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
