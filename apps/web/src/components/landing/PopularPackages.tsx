"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Calendar, Users, ChevronRight } from "lucide-react";
import type { LandingPopularPackage } from "@/lib/api/services";
import { ImageWithFallback } from "./ImageWithFallback";
import { CTAButton } from "@/components/ui";
import { localizePlaceName } from "@/lib/i18n/placeName";

interface PopularPackagesProps {
  packagesHref: string;
  packages: LandingPopularPackage[];
}

export function PopularPackages({ packagesHref, packages }: PopularPackagesProps) {
  const t = useTranslations("landing.popularPackages");
  const tLocations = useTranslations("locations");
  const locale = useLocale();

  const getLocalizedPlace = (placeName: string) =>
    localizePlaceName(placeName, (key) => tLocations(key));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);

  if (packages.length === 0) return null;

  return (
    <section className="bg-muted py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-[28px] font-bold leading-[36px] tracking-[-0.01em] text-foreground sm:text-[36px] sm:leading-[44px]">
            {t("title")}
          </h2>
          <p className="mx-auto max-w-xl text-[16px] leading-[24px] text-muted-foreground sm:text-[18px] sm:leading-[28px]">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const localizedStart = getLocalizedPlace(pkg.startLocation);
            const localizedEnd = getLocalizedPlace(pkg.endLocation);
            const localizedTitle = t("generatedTitle", {
              from: localizedStart,
              to: localizedEnd,
              days: pkg.durationDays,
            });

            return (
              <Link
                key={pkg.id}
                href={`${packagesHref}/${pkg.id}`}
                className="group cursor-pointer overflow-hidden rounded-[20px] border border-border bg-white transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative aspect-video overflow-hidden bg-primary/10">
                  <ImageWithFallback
                    src={`https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2070&auto=format&fit=crop`}
                    alt={localizedTitle}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="p-6">
                  <h3 className="mb-3 line-clamp-1 text-[18px] font-semibold text-foreground">
                    {localizedTitle}
                  </h3>

                  <div className="mb-5 space-y-2">
                    <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                      <MapPin className="h-4 w-4 text-text-tertiary" />
                      <span className="line-clamp-1">
                        {localizedStart} → {localizedEnd}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                      <Calendar className="h-4 w-4 text-text-tertiary" />
                      <span>
                        {pkg.durationDays} {t("days")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                      <Users className="h-4 w-4 text-text-tertiary" />
                      <span>
                        {pkg.minPassengers}-{pkg.maxPassengers}{" "}
                        {t("capacityLabel")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <div>
                      <div className="mb-1 text-[12px] text-text-tertiary">
                        {t("priceLabel")}
                      </div>
                      <div className="text-[20px] font-bold text-foreground">
                        {formatCurrency(pkg.price)}
                        <span className="ml-1 text-[12px] font-medium text-text-tertiary">
                          {t("perPerson")}
                        </span>
                      </div>
                    </div>
                    <CTAButton size="sm" className="px-3">
                      {t("viewDetails")}
                    </CTAButton>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <CTAButton
            href={packagesHref}
            rightIcon={<ChevronRight className="h-4 w-4" />}
            variant="secondary"
          >
            {t("viewAllPackages")}
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
