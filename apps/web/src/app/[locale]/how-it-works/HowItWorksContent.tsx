"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { 
  Search, 
  FileText, 
  Scale, 
  CheckCircle, 
  CreditCard, 
  Bus, 
  UserPlus, 
  Shield, 
  Mail, 
  TrendingUp, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Card, CTAButton } from "@/components/ui";

interface HowItWorksContentProps {
  locale: string;
  images: {
    customer: (string | null)[];
    owner: (string | null)[];
  };
}

export default function HowItWorksContent({ locale, images }: HowItWorksContentProps) {
  const t = useTranslations("howItWorks");
  const tCommon = useTranslations("common");
  
  const [activeTab, setActiveTab] = useState<"customer" | "owner">("customer");

  const customerSteps = [
    {
      icon: Search,
      imageUrl: images.customer[0],
      title: t("customer.steps.search.title", { defaultValue: "Search & Browse" }),
      description: t("customer.steps.search.description", { defaultValue: "Enter your route, date, and passenger count to discover available buses." }),
    },
    {
      icon: FileText,
      imageUrl: images.customer[1],
      title: t("customer.steps.request.title", { defaultValue: "Request Quotations" }),
      description: t("customer.steps.request.description", { defaultValue: "Send a quote request with your trip requirements to multiple owners." }),
    },
    {
      icon: Scale,
      imageUrl: images.customer[2],
      title: t("customer.steps.compare.title", { defaultValue: "Compare Options" }),
      description: t("customer.steps.compare.description", { defaultValue: "Review pricing, bus details, owner ratings, and included services." }),
    },
    {
      icon: CheckCircle,
      imageUrl: images.customer[3],
      title: t("customer.steps.book.title", { defaultValue: "Book Confidently" }),
      description: t("customer.steps.book.description", { defaultValue: "Choose the best quote and confirm your booking instantly." }),
    },
    {
      icon: CreditCard,
      imageUrl: images.customer[4],
      title: t("customer.steps.pay.title", { defaultValue: "Pay Securely" }),
      description: t("customer.steps.pay.description", { defaultValue: "Complete payment through a secure checkout and receive confirmation." }),
    },
    {
      icon: Bus,
      imageUrl: images.customer[5],
      title: t("customer.steps.travel.title", { defaultValue: "Travel with Peace of Mind" }),
      description: t("customer.steps.travel.description", { defaultValue: "Track your booking and enjoy your journey with verified operators." }),
    },
  ];

  const ownerSteps = [
    {
      icon: UserPlus,
      imageUrl: images.owner[0],
      title: t("owner.steps.register.title", { defaultValue: "Register Your Account" }),
      description: t("owner.steps.register.description", { defaultValue: "Create your owner profile and submit your business information." }),
    },
    {
      icon: Shield,
      imageUrl: images.owner[1],
      title: t("owner.steps.verify.title", { defaultValue: "Complete Verification" }),
      description: t("owner.steps.verify.description", { defaultValue: "Upload required documents to get verified for customer trust." }),
    },
    {
      icon: Bus,
      imageUrl: images.owner[2],
      title: t("owner.steps.list.title", { defaultValue: "List Your Fleet" }),
      description: t("owner.steps.list.description", { defaultValue: "Add your buses, amenities, pricing, and availability details." }),
    },
    {
      icon: Mail,
      imageUrl: images.owner[3],
      title: t("owner.steps.receiveRequests.title", { defaultValue: "Receive Requests" }),
      description: t("owner.steps.receiveRequests.description", { defaultValue: "Get incoming quotation requests that match your fleet and routes." }),
    },
    {
      icon: FileText,
      imageUrl: images.owner[4],
      title: t("owner.steps.sendQuotes.title", { defaultValue: "Send Competitive Quotes" }),
      description: t("owner.steps.sendQuotes.description", { defaultValue: "Respond quickly with detailed quotations to convert more bookings." }),
    },
    {
      icon: TrendingUp,
      imageUrl: images.owner[5],
      title: t("owner.steps.manage.title", { defaultValue: "Manage & Grow" }),
      description: t("owner.steps.manage.description", { defaultValue: "Track bookings, improve service quality, and grow repeat business." }),
    },
  ];

  const activeSteps = activeTab === "customer" ? customerSteps : ownerSteps;

  const springSmooth = {
    type: "spring" as const,
    stiffness: 300,
    damping: 30
  };

  return (
    <div className="w-full">
      {/* Dynamic Tab Switcher */}
      <div className="flex justify-center mb-16">
        <div className="inline-flex p-1.5 bg-bg-surface border border-border rounded-xl">
          <button
            onClick={() => setActiveTab("customer")}
            className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
              activeTab === "customer"
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t("customer.title", { defaultValue: "For Customers" })}
          </button>
          <button
            onClick={() => setActiveTab("owner")}
            className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
              activeTab === "owner"
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t("owner.title", { defaultValue: "For Bus Owners" })}
          </button>
        </div>
      </div>

      {/* Bento Grid Step Presentation */}
      <motion.div
        layout
        transition={springSmooth}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8"
      >
        {activeSteps.map((step, index) => {
          const StepIcon = step.icon;
          return (
            <motion.div
              key={`${activeTab}-step-${index}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSmooth, delay: index * 0.08 }}
              className="h-full"
            >
              <Card className="rounded-[20px] border border-border bg-bg-surface hover:bg-white hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full group p-4">
                {/* Image / Fallback Header with Concentric Radius Principle */}
                <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-bg-surface mb-5 border border-border">
                  {step.imageUrl ? (
                    <Image
                      src={step.imageUrl}
                      alt={step.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      priority={index < 3}
                    />
                  ) : (
                    // Creative Fallback Design System Gradient & Icon
                    <div className="absolute inset-0 bg-gradient-to-tr from-action-primary/5 via-action-primary/10 to-transparent flex items-center justify-center">
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-white border border-border shadow-sm group-hover:rotate-6 transition-transform duration-300">
                        <StepIcon className="h-8 w-8 text-action-primary" />
                        <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-action-primary text-[10px] font-bold text-white shadow-sm">
                          {index + 1}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Overlay Badge when Image Exists */}
                  {step.imageUrl && (
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md border border-border px-3 py-1 rounded-full text-xs font-semibold text-text-primary flex items-center gap-1.5 shadow-sm">
                      <StepIcon className="h-3.5 w-3.5 text-action-primary" />
                      <span>{tCommon("step", { defaultValue: "Step" })} {index + 1}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 px-2 pb-2">
                  <div className="flex items-center gap-3 mb-2.5">
                    {!step.imageUrl && (
                      <span className="text-text-tertiary text-xs font-semibold uppercase tracking-wider">
                        {tCommon("step", { defaultValue: "Step" })} {index + 1}
                      </span>
                    )}
                  </div>
                  <h3 className="text-heading-md text-text-primary font-bold tracking-tight mb-2 group-hover:text-action-primary transition-colors duration-200">
                    {step.title}
                  </h3>
                  <p className="text-body text-text-secondary leading-relaxed flex-1">
                    {step.description}
                  </p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* CTA Layer */}
      <motion.div
        layout
        transition={springSmooth}
        className="text-center mt-20"
      >
        {activeTab === "customer" ? (
          <div className="inline-flex flex-col items-center gap-4">
            <CTAButton
              href={`/${locale}/search`}
              size="lg"
              variant="primary"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              {tCommon("getStarted", { defaultValue: "Find Your Bus Now" })}
            </CTAButton>
            <p className="text-caption text-text-tertiary flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-action-primary" />
              <span>Book instantly with verified transport partners in Sri Lanka</span>
            </p>
          </div>
        ) : (
          <div className="inline-flex flex-col items-center gap-4">
            <CTAButton
              href={`/${locale}/register`}
              size="lg"
              variant="secondary"
              rightIcon={<ArrowRight className="w-5 h-5 text-action-primary" />}
            >
              {t("ownerCta", { defaultValue: "Register as Owner" })}
            </CTAButton>
            <p className="text-caption text-text-tertiary">
              Join hundreds of successful bus operators growing their businesses daily.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
