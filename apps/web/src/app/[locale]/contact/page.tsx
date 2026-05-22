"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  MapPin,
  Mail,
  Phone,
  Clock,
  ChevronDown,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card, Input, TextArea, Button } from "@/components/ui";
import {
  landingContentService,
  ApiError,
  type LandingPublicConfigResponse,
} from "@/lib/api";

export default function ContactPage() {
  const t = useTranslations("contact");
  const tLandingFaq = useTranslations("landing.faq");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [publicConfig, setPublicConfig] =
    useState<LandingPublicConfigResponse | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    const fetchContactConfig = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        setPublicConfig(response);
      } catch (error) {
        if (error instanceof ApiError) {
          console.error("Failed to fetch contact config:", error.message);
          return;
        }
        console.error("Failed to fetch contact config:", error);
      }
    };

    fetchContactConfig();
  }, []);

  const contactConfig = publicConfig?.contactInfo;
  const mapEmbedUrl = publicConfig?.googleMapsEmbed?.embedUrl;
  const fallbackFaqs = [
    {
      id: "fallback-verification",
      question: tLandingFaq("items.verification.question"),
      answer: tLandingFaq("items.verification.answer"),
    },
    {
      id: "fallback-payment",
      question: tLandingFaq("items.payment.question"),
      answer: tLandingFaq("items.payment.answer"),
    },
    {
      id: "fallback-breakdown",
      question: tLandingFaq("items.breakdown.question"),
      answer: tLandingFaq("items.breakdown.answer"),
    },
    {
      id: "fallback-cancellation",
      question: tLandingFaq("items.cancellation.question"),
      answer: tLandingFaq("items.cancellation.answer"),
    },
    {
      id: "fallback-contact",
      question: tLandingFaq("items.contact.question"),
      answer: tLandingFaq("items.contact.answer"),
    },
    {
      id: "fallback-safety",
      question: tLandingFaq("items.safety.question"),
      answer: tLandingFaq("items.safety.answer"),
    },
  ];
  const faqs = publicConfig?.faqs?.length ? publicConfig.faqs : fallbackFaqs;

  const socialLinks = [
    {
      key: "facebook",
      icon: Facebook,
      label: "Facebook",
      href: publicConfig?.socialMediaLinks?.facebook,
    },
    {
      key: "twitter",
      icon: Twitter,
      label: "Twitter",
      href: publicConfig?.socialMediaLinks?.twitter,
    },
    {
      key: "instagram",
      icon: Instagram,
      label: "Instagram",
      href: publicConfig?.socialMediaLinks?.instagram,
    },
    {
      key: "linkedin",
      icon: Linkedin,
      label: "LinkedIn",
      href: publicConfig?.socialMediaLinks?.linkedin,
    },
  ].filter((link) => Boolean(link.href));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("idle");

    try {
      await landingContentService.submitContactForm({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        subject: formData.subject,
        message: formData.message,
      });

      setStatus("success");
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (error) {
      setStatus("error");
      if (error instanceof ApiError) {
        console.error("Contact submit failed:", error.message);
      } else {
        console.error("Contact submit failed:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: t("info.address.title"),
      value: contactConfig?.address || t("info.address.value"),
    },
    {
      icon: Mail,
      title: t("info.email.title"),
      value: contactConfig?.email || t("info.email.value"),
      href: contactConfig?.email ? `mailto:${contactConfig.email}` : undefined,
    },
    {
      icon: Phone,
      title: t("info.phone.title"),
      value: contactConfig?.phone || t("info.phone.value"),
      href: contactConfig?.phone ? `tel:${contactConfig.phone}` : undefined,
    },
    {
      icon: Clock,
      title: t("info.hours.title"),
      value: contactConfig?.hours || t("info.hours.value"),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title={t("hero.title")} subtitle={t("hero.subtitle")} />

      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                {t("form.submit")}
              </h2>

              {status === "success" && (
                <div
                  className="mb-6 p-4 rounded-xl font-medium text-sm flex items-center justify-between"
                  style={{
                    backgroundColor: "var(--color-success-bg)",
                    color: "var(--color-success-text)",
                    borderColor: "var(--color-success-border)",
                    borderWidth: "1px",
                  }}
                >
                  {t("form.success")}
                </div>
              )}

              {status === "error" && (
                <div
                  className="mb-6 p-4 rounded-xl font-medium text-sm flex items-center justify-between"
                  style={{
                    backgroundColor: "var(--color-error-bg)",
                    color: "var(--color-error-text)",
                    borderColor: "var(--color-error-border)",
                    borderWidth: "1px",
                  }}
                >
                  {t("form.error")}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label={t("form.name")}
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label={t("form.email")}
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                  <Input
                    label={t("form.phone")}
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>

                <Input
                  label={t("form.subject")}
                  type="text"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  required
                />

                <TextArea
                  label={t("form.message")}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  required
                />

                <Button type="submit" size="lg" isLoading={isLoading}>
                  {t("form.submit")}
                </Button>
              </form>
            </Card>

            {/* Contact Information */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">
                {t("info.title")}
              </h2>

              <div className="space-y-6">
                {contactInfo.map((item, index) => {
                  const Icon = item.icon;
                  const isInteractive = !!item.href;

                  const content = (
                    <div className="flex items-start space-x-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center flex-shrink-0 rounded-xl ${
                          isInteractive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-foreground border border-border"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3
                          className={`font-semibold transition-colors ${isInteractive ? "text-foreground group-hover:text-primary" : "text-foreground"}`}
                        >
                          {item.title}
                        </h3>
                        <p className="text-muted-foreground mt-1">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  );

                  return item.href ? (
                    <a
                      key={index}
                      href={item.href}
                      className="group block active:scale-95 transition-transform origin-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      style={{
                        transitionTimingFunction: "var(--spring-bouncy)",
                        transitionDuration: "200ms",
                      }}
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={index}>{content}</div>
                  );
                })}
              </div>

              {socialLinks.length > 0 && (
                <Card className="mt-8 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">
                    {t("social.title", { defaultValue: "Follow TravelNest" })}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {socialLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <a
                          key={link.key}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </a>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Card className="mt-8 overflow-hidden p-0">
                <div className="border-b border-border px-6 py-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {t("map.title", { defaultValue: "Find Us on the Map" })}
                  </h3>
                </div>

                {mapEmbedUrl ? (
                  <iframe
                    title={t("map.title", {
                      defaultValue: "Find Us on the Map",
                    })}
                    src={mapEmbedUrl}
                    className="h-72 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center bg-muted text-center text-muted-foreground">
                    <div>
                      <MapPin className="mx-auto mb-2 h-8 w-8" />
                      <p>{t("mapPlaceholder")}</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              {t("faq.title", { defaultValue: "Frequently Asked Questions" })}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("faq.subtitle", {
                defaultValue:
                  "Quick answers to common questions about bookings, payments, and support.",
              })}
            </p>
          </div>

          {faqs.length > 0 ? (
            <div className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <Card
                    key={faq.id}
                    className="overflow-hidden border-border bg-background p-0"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="font-semibold text-foreground">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center text-muted-foreground">
              {t("faq.empty", {
                defaultValue: "No FAQs are available right now.",
              })}
            </Card>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
