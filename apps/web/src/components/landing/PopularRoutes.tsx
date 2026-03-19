import Link from "next/link";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ImageWithFallback } from "@/components/landing/ImageWithFallback";
import { CTAButton } from "@/components/ui";

interface PopularRoutesProps {
  searchHref: string;
}

export function PopularRoutes({ searchHref }: PopularRoutesProps) {
  const t = useTranslations("landing.popularRoutes");
  const locale = useLocale();
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);

  const routes = [
    {
      from: "Colombo",
      to: "Kandy",
      durationHours: 3,
      avgPrice: 18000,
      bookings: 1200,
      popular: true,
      image:
        "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?q=80&w=2070",
    },
    {
      from: "Colombo",
      to: "Galle",
      durationHours: 2.5,
      avgPrice: 15000,
      bookings: 980,
      image:
        "https://images.unsplash.com/photo-1588417495960-eb4c560c4a7a?q=80&w=2070",
    },
    {
      from: "Kandy",
      to: "Ella",
      durationHours: 4,
      avgPrice: 22000,
      bookings: 850,
      image:
        "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=2071",
    },
    {
      from: "Colombo",
      to: "Anuradhapura",
      durationHours: 4.5,
      avgPrice: 25000,
      bookings: 720,
      image:
        "https://images.unsplash.com/photo-1588402237163-0a6d2f6a5ef7?q=80&w=2073",
    },
    {
      from: "Negombo",
      to: "Sigiriya",
      durationHours: 3.5,
      avgPrice: 20000,
      bookings: 650,
      image:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070",
    },
  ];

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

        <div className="grid auto-rows-[220px] grid-cols-1 gap-6 md:grid-cols-4">
          <Link
            href={searchHref}
            className="group relative cursor-pointer overflow-hidden rounded-[20px] md:col-span-2 md:row-span-2"
          >
            <div className="absolute inset-0">
              <ImageWithFallback
                src={routes[0].image}
                alt={`${routes[0].from} to ${routes[0].to}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
            </div>
            <div className="relative flex h-full flex-col justify-end p-8">
              {routes[0].popular && (
                <div className="absolute right-6 top-6 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">
                  {t("mostPopular")}
                </div>
              )}
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="h-6 w-6 text-white" />
                <div className="flex items-center gap-2 text-white">
                  <span className="text-2xl font-bold">{routes[0].from}</span>
                  <ChevronRight className="h-5 w-5 text-white/60" />
                  <span className="text-2xl font-bold">{routes[0].to}</span>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-white/90">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {t("durationHours", { hours: routes[0].durationHours })}
                  </span>
                </div>
                <div className="text-sm text-white/60">
                  {t("bookingsCount", { count: routes[0].bookings })}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="mb-0.5 text-[12px] text-white/50">
                    {t("startingFrom")}
                  </div>
                  <div className="text-[20px] font-bold text-white">
                    {formatCurrency(routes[0].avgPrice)}
                  </div>
                </div>
                <CTAButton size="sm">{t("viewBuses")}</CTAButton>
              </div>
            </div>
          </Link>

          {routes.slice(1).map((route, index) => (
            <Link
              key={index}
              href={searchHref}
              className="group relative cursor-pointer overflow-hidden rounded-[20px]"
            >
              <div className="absolute inset-0">
                <ImageWithFallback
                  src={route.image}
                  alt={`${route.from} to ${route.to}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              </div>
              <div className="relative flex h-full flex-col justify-end p-6">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex items-center gap-2 text-white">
                    <span className="text-[16px] font-bold">{route.from}</span>
                    <ChevronRight className="h-4 w-4 text-white/50" />
                    <span className="text-[16px] font-bold">{route.to}</span>
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
