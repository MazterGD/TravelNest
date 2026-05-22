import { TrendingUp, Clock, Shield, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { CTAButton } from "@/components/ui";

interface OwnerCTAProps {
  ownerRegisterHref: string;
}

export function OwnerCTA({ ownerRegisterHref }: OwnerCTAProps) {
  const t = useTranslations("landing.ownerCta");
  const benefits = [
    { icon: TrendingUp, text: t("benefits.0") },
    { icon: Clock, text: t("benefits.1") },
    { icon: Shield, text: t("benefits.2") },
  ];

  return (
    <section className="bg-foreground py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <h2 className="mb-5 text-[28px] font-bold leading-[36px] tracking-[-0.01em] text-white sm:text-[36px] sm:leading-[44px]">
              {t("title")}
            </h2>
            <p className="mb-10 max-w-lg text-[16px] leading-[24px] text-text-tertiary sm:text-[18px] sm:leading-[28px]">
              {t("subtitle")}
            </p>

            <div className="mb-10 space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                    <benefit.icon className="h-5 w-5 text-white/70" />
                  </div>
                  <span className="text-[16px] text-border">
                    {benefit.text}
                  </span>
                </div>
              ))}
            </div>

            <CTAButton
              href={ownerRegisterHref}
              size="lg"
              ringOffsetClassName="focus-visible:ring-offset-foreground"
              rightIcon={<ArrowRight className="h-5 w-5" />}
            >
              {t("primaryButton")}
            </CTAButton>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/5 p-10 text-white lg:p-12">
            <h3 className="mb-10 text-[20px] font-semibold leading-[28px] sm:text-[24px] sm:leading-[32px]">
              {t("card.title")}
            </h3>

            <div className="space-y-8">
              <div className="border-b border-white/20 pb-6">
                <div className="mb-1 text-[40px] font-bold leading-tight sm:text-[48px]">
                  {t("card.stats.0.value")}
                </div>
                <div className="text-[16px] text-text-tertiary">
                  {t("card.stats.0.label")}
                </div>
              </div>
              <div className="border-b border-white/20 pb-6">
                <div className="mb-1 text-[40px] font-bold leading-tight sm:text-[48px]">
                  {t("card.stats.1.value")}
                </div>
                <div className="text-[16px] text-text-tertiary">
                  {t("card.stats.1.label")}
                </div>
              </div>
              <div className="border-b border-white/20 pb-6">
                <div className="mb-1 text-[40px] font-bold leading-tight sm:text-[48px]">
                  {t("card.stats.2.value")}
                </div>
                <div className="text-[16px] text-text-tertiary">
                  {t("card.stats.2.label")}
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-8">
              <p className="text-[16px] leading-relaxed text-text-tertiary">
                {t("card.note")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
