"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  CreditCard,
  Bus,
  Clock,
  Phone,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CTAButton } from "@/components/ui";

interface FAQProps {
  contactHref: string;
  helpCenterHref: string;
}

export function FAQ({ contactHref, helpCenterHref }: FAQProps) {
  const t = useTranslations("landing.faq");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      icon: Shield,
      question: t("items.verification.question"),
      answer: t("items.verification.answer"),
    },
    {
      icon: CreditCard,
      question: t("items.payment.question"),
      answer: t("items.payment.answer"),
    },
    {
      icon: Bus,
      question: t("items.breakdown.question"),
      answer: t("items.breakdown.answer"),
    },
    {
      icon: Clock,
      question: t("items.cancellation.question"),
      answer: t("items.cancellation.answer"),
    },
    {
      icon: Phone,
      question: t("items.contact.question"),
      answer: t("items.contact.answer"),
    },
    {
      icon: CheckCircle,
      question: t("items.safety.question"),
      answer: t("items.safety.answer"),
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-[720px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-[28px] font-bold leading-[36px] tracking-[-0.01em] text-foreground sm:text-[36px] sm:leading-[44px]">
            {t("title")}
          </h2>
          <p className="text-[16px] leading-[24px] text-muted-foreground sm:text-[18px] sm:leading-[28px]">
            {t("subtitle")}
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const Icon = faq.icon;
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="overflow-hidden rounded-[20px] border border-border bg-muted"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center gap-4 rounded-[20px] px-6 py-5 text-left transition-colors hover:bg-[#F1F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  aria-expanded={isOpen}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-white">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[16px] font-semibold text-foreground">
                      {faq.question}
                    </h3>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-text-tertiary transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96" : "max-h-0"}`}
                >
                  <div className="px-6 pb-5 pl-[80px]">
                    <p className="text-[14px] leading-[20px] text-muted-foreground sm:text-[16px] sm:leading-[24px]">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-[20px] border border-border bg-muted p-8 text-center">
          <h3 className="mb-2 text-[20px] font-semibold text-foreground">
            {t("cta.title")}
          </h3>
          <p className="mb-6 text-[16px] text-muted-foreground">
            {t("cta.subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <CTAButton href={contactHref}>{t("cta.contactButton")}</CTAButton>
            <Link
              href={helpCenterHref}
              className="inline-flex min-h-11 items-center rounded-xl border border-border bg-white px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t("cta.helpCenterButton")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
