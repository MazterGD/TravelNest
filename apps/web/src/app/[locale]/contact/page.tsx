"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FaMapMarkerAlt, FaEnvelope, FaPhone, FaClock } from "react-icons/fa";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card, Input, TextArea, Button } from "@/components/ui";

export default function ContactPage() {
  const t = useTranslations("contact");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("idle");

    // TODO: Implement actual form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setStatus("success");
    setIsLoading(false);
    setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
  };

  const contactInfo = [
    {
      icon: FaMapMarkerAlt,
      title: t("info.address.title"),
      value: t("info.address.value"),
    },
    {
      icon: FaEnvelope,
      title: t("info.email.title"),
      value: t("info.email.value"),
      href: "mailto:support@travelnest.lk",
    },
    {
      icon: FaPhone,
      title: t("info.phone.title"),
      value: t("info.phone.value"),
      href: "tel:+94112345678",
    },
    {
      icon: FaClock,
      title: t("info.hours.title"),
      value: t("info.hours.value"),
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
                <div className="mb-6 p-4 rounded-md bg-success/10 text-success border border-success/20">
                  {t("form.success")}
                </div>
              )}

              {status === "error" && (
                <div className="mb-6 p-4 rounded-md bg-error/10 text-error border border-error/20">
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
                  const content = (
                    <div className="flex items-start space-x-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
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
                      className="block hover:opacity-80 transition-opacity"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={index}>{content}</div>
                  );
                })}
              </div>

              {/* Map Placeholder */}
              <Card className="mt-8 h-64 flex items-center justify-center bg-muted">
                <div className="text-center text-muted-foreground">
                  <FaMapMarkerAlt className="h-8 w-8 mx-auto mb-2" />
                  <p>{t("mapPlaceholder")}</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
