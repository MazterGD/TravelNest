import Link from "next/link";
import {
  Users,
  Star,
  MapPin,
  Wifi,
  Snowflake,
  Music,
  ChevronRight,
} from "lucide-react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { ImageWithFallback } from "@/components/landing/ImageWithFallback";
import { CTAButton } from "@/components/ui";
import type { LandingFeaturedVehicle } from "@/lib/api/services";
import { localizePlaceName } from "@/lib/i18n/placeName";

interface FeaturedVehiclesProps {
  searchHref: string;
  vehicles: LandingFeaturedVehicle[];
}

export function FeaturedVehicles({
  searchHref,
  vehicles,
}: FeaturedVehiclesProps) {
  const t = useTranslations("landing.featuredVehicles");
  const tCommon = useTranslations("common");
  const tLocations = useTranslations("locations");
  const messages = useMessages() as {
    landing?: {
      featuredVehicles?: {
        items?: Array<{
          name?: string;
          location?: string;
        }>;
      };
    };
  };
  const locale = useLocale();

  const localizedVehicleItems = Array.isArray(
    messages?.landing?.featuredVehicles?.items,
  )
    ? messages.landing.featuredVehicles.items
    : [];

  const getLocalizedPlace = (placeName: string) =>
    localizePlaceName(placeName, (key) => tLocations(key));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);

  const getAmenityIcon = (amenity: string) => {
    switch (amenity) {
      case "AC":
        return <Snowflake className="h-4 w-4" />;
      case "WiFi":
        return <Wifi className="h-4 w-4" />;
      case "Music":
        return <Music className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getAmenityLabel = (amenity: string) => {
    switch (amenity) {
      case "AC":
        return t("amenities.ac");
      case "WiFi":
        return t("amenities.wifi");
      case "Music":
        return t("amenities.music");
      default:
        return amenity;
    }
  };

  return (
    <section className="bg-muted py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-[28px] font-bold leading-[36px] tracking-[-0.01em] text-foreground sm:text-[36px] sm:leading-[44px]">
            {t("title")}
          </h2>
          <p className="mx-auto max-w-lg text-[16px] leading-[24px] text-muted-foreground sm:text-[18px] sm:leading-[28px]">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle, index) => {
            const localizedVehicle = localizedVehicleItems[index];
            const displayName = localizedVehicle?.name || vehicle.name;
            const displayLocation =
              localizedVehicle?.location || getLocalizedPlace(vehicle.location);

            return (
              <Link
                key={vehicle.id}
                href={`/${locale}/vehicles/${vehicle.id}`}
                className="group cursor-pointer overflow-hidden rounded-[20px] border border-border bg-white transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative aspect-video overflow-hidden">
                  <ImageWithFallback
                    src={
                      vehicle.imageUrl ||
                      "https://images.unsplash.com/photo-1538391912490-304338a7f94c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                    }
                    alt={displayName}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-[13px] font-semibold text-foreground">
                      {vehicle.rating}
                    </span>
                    <span className="text-[13px] text-text-tertiary">
                      ({vehicle.reviewsCount})
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="mb-3 text-[18px] font-semibold text-foreground">
                    {displayName}
                  </h3>

                  <div className="mb-4 space-y-2">
                    <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                      <Users className="h-4 w-4 text-text-tertiary" />
                      <span>
                        {vehicle.seats} {tCommon("passengers")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                      <MapPin className="h-4 w-4 text-text-tertiary" />
                      <span>{displayLocation}</span>
                    </div>
                  </div>

                  <div className="mb-5 flex flex-wrap gap-2">
                    {vehicle.amenities.map((amenity) => (
                      <div
                        key={amenity}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground"
                      >
                        {getAmenityIcon(amenity)}
                        <span>{getAmenityLabel(amenity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <span className="text-[20px] font-bold text-foreground">
                      {formatCurrency(vehicle.pricePerDay)} {tCommon("perDay")}
                    </span>
                    <CTAButton size="sm" className="px-3">
                      {t("viewDetails")}
                    </CTAButton>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <CTAButton
            href={searchHref}
            rightIcon={<ChevronRight className="h-4 w-4" />}
            variant="secondary"
          >
            {t("viewAllBuses")}
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
