"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Eye,
  Shield,
  Handshake,
  Lightbulb,
  Target,
  Sparkles,
  Bus,
  UsersRound,
  MapPinned,
  Mail,
  HelpCircle,
  FileText,
  Receipt,
  ChevronRight,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card } from "@/components/ui";
import { landingContentService, ApiError } from "@/lib/api";

interface AboutStatItem {
  label: string;
  value: string;
  icon?: string;
}

const statIconMap: Record<string, typeof Sparkles> = {
  users: UsersRound,
  user: UsersRound,
  buses: Bus,
  bus: Bus,
  routes: MapPinned,
  route: MapPinned,
  default: Sparkles,
};

export default function AboutPage() {
  const t = useTranslations("about");
  const tNav = useTranslations("navigation");
  const tFooter = useTranslations("footer");
  const locale = useLocale();
  const [aboutStats, setAboutStats] = useState<AboutStatItem[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  useEffect(() => {
    const fetchAboutStats = async () => {
      try {
        const response = await landingContentService.getAboutStats();

        if (response.stats?.length) {
          setAboutStats(response.stats);
          return;
        }

        const configResponse = await landingContentService.getPublicConfig();
        setAboutStats(configResponse.aboutStats || []);
      } catch (error) {
        if (error instanceof ApiError) {
          console.error("Failed to fetch about stats:", error.message);
        } else {
          console.error("Failed to fetch about stats:", error);
        }
      } finally {
        setIsStatsLoading(false);
      }
    };

    fetchAboutStats();
  }, []);

  const getLocalizedStatLabel = (label: string) => {
    const normalizedLabel = label.trim().toLowerCase();

    const statLabelMap: Record<string, string> = {
      "verified buses": t("statistics.items.verifiedBuses", {
        defaultValue: "Verified Buses",
      }),
      "happy customers": t("statistics.items.happyCustomers", {
        defaultValue: "Happy Customers",
      }),
      "districts covered": t("statistics.items.districtsCovered", {
        defaultValue: "Districts Covered",
      }),
      "average rating": t("statistics.items.averageRating", {
        defaultValue: "Average Rating",
      }),
    };

    return statLabelMap[normalizedLabel] ?? label;
  };

  const values = [
    {
      icon: Eye,
      title: t("values.transparency.title"),
      description: t("values.transparency.description"),
    },
    {
      icon: Shield,
      title: t("values.safety.title"),
      description: t("values.safety.description"),
    },
    {
      icon: Handshake,
      title: t("values.reliability.title"),
      description: t("values.reliability.description"),
    },
    {
      icon: Lightbulb,
      title: t("values.innovation.title"),
      description: t("values.innovation.description"),
    },
  ];

  const uspItems = [
    {
      icon: Shield,
      title: t("usp.items.verified.title", {
        defaultValue: "Verified Owners",
      }),
      description: t("usp.items.verified.description", {
        defaultValue:
          "Every owner and fleet goes through documentation and safety checks before listing.",
      }),
    },
    {
      icon: Handshake,
      title: t("usp.items.pricing.title", {
        defaultValue: "Transparent Quotations",
      }),
      description: t("usp.items.pricing.description", {
        defaultValue:
          "Customers compare clear, itemized quotations with no hidden platform fees.",
      }),
    },
    {
      icon: MapPinned,
      title: t("usp.items.coverage.title", {
        defaultValue: "Island-Wide Coverage",
      }),
      description: t("usp.items.coverage.description", {
        defaultValue:
          "From city commutes to long-distance tours, TravelNest supports journeys across Sri Lanka.",
      }),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title={t("hero.title")} subtitle={t("hero.subtitle")} />

      {/* Story */}
      <section className="bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="p-8 md:p-10">
            <h2 className="mb-4 text-3xl font-bold text-foreground">
              {t("story.title", { defaultValue: "Our Story" })}
            </h2>
            <p className="mb-4 text-muted-foreground leading-relaxed max-w-[720px]">
              {t("story.paragraph1", {
                defaultValue:
                  "TravelNest was founded to solve a common challenge in group travel: finding trustworthy buses with fair pricing and dependable service.",
              })}
            </p>
            <p className="text-muted-foreground leading-relaxed max-w-[720px]">
              {t("story.paragraph2", {
                defaultValue:
                  "What started as a small idea has grown into a platform that connects travelers and verified owners through transparent workflows, faster quotations, and safer journeys.",
              })}
            </p>
          </Card>
        </div>
      </section>

      {/* Statistics */}
      <section className="bg-muted py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
            {t("statistics.title", { defaultValue: "Our Impact" })}
          </h2>

          {isStatsLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-[20px] border border-border bg-card"
                />
              ))}
            </div>
          ) : aboutStats.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {aboutStats.map((stat, index) => {
                const iconKey = (stat.icon || "").toLowerCase();
                const Icon = statIconMap[iconKey] || statIconMap.default;

                return (
                  <Card
                    key={`${stat.label}-${index}`}
                    className="p-6 text-center"
                  >
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getLocalizedStatLabel(stat.label)}
                    </p>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center text-muted-foreground">
              {t("statistics.empty", {
                defaultValue: "Statistics will be available soon.",
              })}
            </Card>
          )}
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="text-center p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-muted mx-auto mb-6">
                <Target className="h-8 w-8 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {t("mission.title")}
              </h2>
              <p className="text-muted-foreground leading-relaxed max-w-[720px] mx-auto">
                {t("mission.description")}
              </p>
            </Card>

            <Card className="text-center p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-muted mx-auto mb-6">
                <Eye className="h-8 w-8 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {t("vision.title")}
              </h2>
              <p className="text-muted-foreground leading-relaxed max-w-[720px] mx-auto">
                {t("vision.description")}
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            {t("values.title")}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div key={index} className="text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card border border-border mx-auto mb-4">
                    <Icon className="h-7 w-7 text-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {value.title}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-[720px] mx-auto">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why TravelNest */}
      <section className="bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
            {t("usp.title", { defaultValue: "Why Choose TravelNest" })}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {uspItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card key={index} className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            {t("team.title")}
          </h2>
          <p className="text-muted-foreground max-w-[720px] mx-auto">
            {t("team.description")}
          </p>
        </div>
      </section>

      {/* Help & information — mobile only (desktop surfaces these in the footer) */}
      <section className="bg-background pb-16 md:hidden">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {tFooter("support")}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-[20px] border border-border">
            {[
              { label: tNav("contact"), href: `/${locale}/contact`, Icon: Mail },
              { label: tFooter("faq"), href: `/${locale}/faq`, Icon: HelpCircle },
              {
                label: tFooter("privacyPolicy"),
                href: `/${locale}/privacy`,
                Icon: Shield,
              },
              {
                label: tFooter("termsOfService"),
                href: `/${locale}/terms`,
                Icon: FileText,
              },
              {
                label: tFooter("refundPolicy"),
                href: `/${locale}/refund-policy`,
                Icon: Receipt,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[44px] items-center justify-between gap-3 bg-background px-4 py-3.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="flex items-center gap-3">
                  <item.Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
