import Link from "next/link";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ImageWithFallback } from "@/components/landing/ImageWithFallback";
import { CTAButton } from "@/components/ui";
import type { LandingPopularRoute } from "@/lib/api/services";
import { localizePlaceName } from "@/lib/i18n/placeName";

interface PopularRoutesProps {
  searchHref: string;
  routes: LandingPopularRoute[];
}

export function PopularRoutes({ searchHref, routes }: PopularRoutesProps) {
  const t = useTranslations("landing.popularRoutes");
  const tLocations = useTranslations("locations");
  const locale = useLocale();
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);

  const primaryRoute = routes[0];
  const secondaryRoutes = routes.slice(1);

  const getLocalizedCity = (city: string) =>
    localizePlaceName(city, (key) => tLocations(key));

  const buildRouteHref = (fromCity: string, toCity: string) => {
    const params = new URLSearchParams();

    if (fromCity) {
      params.set("from", fromCity);
    }

    if (toCity) {
      params.set("to", toCity);
    }

    const queryString = params.toString();
    return queryString ? `${searchHref}?${queryString}` : searchHref;
  };

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-[28px] font-bold leading-[36px] tracking-[-0.01em] text-foreground sm:text-[36px] sm:leading-[44px]">
            {t("title")}
          </h2>
          <p className="mx-auto max-w-xl text-[16px] leading-[24px] text-muted-foreground sm:text-[18px] sm:leading-[28px]">
            {t("subtitle")}
          </p>
        </div>

        {primaryRoute ? (
          <div className="grid auto-rows-[220px] grid-cols-1 gap-6 md:grid-cols-4">
            <Link
              href={buildRouteHref(primaryRoute.fromCity, primaryRoute.toCity)}
              className="group relative cursor-pointer overflow-hidden rounded-[20px] md:col-span-2 md:row-span-2"
            >
              <div className="absolute inset-0">
                <ImageWithFallback
                  src={primaryRoute.imageUrl}
                  alt={`${getLocalizedCity(primaryRoute.fromCity)} to ${getLocalizedCity(primaryRoute.toCity)}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
              </div>
              <div className="relative flex h-full flex-col justify-end p-8">
                {primaryRoute.isPopular && (
                  <div className="absolute right-6 top-6 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">
                    {t("mostPopular")}
                  </div>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-white" />
                  <div className="flex items-center gap-2 text-white">
                    <span className="text-2xl font-bold">
                      {getLocalizedCity(primaryRoute.fromCity)}
                    </span>
                    <ChevronRight className="h-5 w-5 text-white/60" />
                    <span className="text-2xl font-bold">
                      {getLocalizedCity(primaryRoute.toCity)}
                    </span>
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-white/90">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {t("durationHours", {
                        hours: primaryRoute.durationHours,
                      })}
                    </span>
                  </div>
                  <div className="text-sm text-white/60">
                    {t("bookingsCount", { count: primaryRoute.bookingsCount })}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="mb-0.5 text-[12px] text-white/50">
                      {t("startingFrom")}
                    </div>
                    <div className="text-[20px] font-bold text-white">
                      {formatCurrency(primaryRoute.avgPrice)}
                    </div>
                  </div>
                  <CTAButton size="sm">{t("viewBuses")}</CTAButton>
                </div>
              </div>
            </Link>

            {secondaryRoutes.map((route) => (
              <Link
                key={route.id}
                href={buildRouteHref(route.fromCity, route.toCity)}
                className="group relative cursor-pointer overflow-hidden rounded-[20px]"
              >
                <div className="absolute inset-0">
                  <ImageWithFallback
                    src={route.imageUrl}
                    alt={`${getLocalizedCity(route.fromCity)} to ${getLocalizedCity(route.toCity)}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                </div>
                <div className="relative flex h-full flex-col justify-end p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex items-center gap-2 text-white">
                      <span className="text-[16px] font-bold">
                        {getLocalizedCity(route.fromCity)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/50" />
                      <span className="text-[16px] font-bold">
                        {getLocalizedCity(route.toCity)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] text-white/50">
                        {t("durationHours", { hours: route.durationHours })}
                      </div>
                      <div className="text-[16px] font-bold text-white">
                        {formatCurrency(route.avgPrice)}
                      </div>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-white group-hover:text-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] border border-border bg-muted p-8 text-center text-muted-foreground">
            {t("subtitle")}
          </div>
        )}

        <div className="mt-10 text-center">
          <CTAButton
            href={searchHref}
            rightIcon={<ChevronRight className="h-4 w-4" />}
            variant="secondary"
          >
            {t("viewAllRoutes")}
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
