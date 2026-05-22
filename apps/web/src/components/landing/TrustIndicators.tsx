import { useTranslations } from "next-intl";
import type { LandingStat } from "@/lib/api/services";

interface TrustIndicatorsProps {
  stats: LandingStat[];
}

export function TrustIndicators({ stats }: TrustIndicatorsProps) {
  const t = useTranslations("landing.trustIndicators");

  const localizedByDbKey: Record<string, { label: string; sublabel: string }> =
    {
      verified_buses: {
        label: t("stats.verifiedBuses.label"),
        sublabel: t("stats.verifiedBuses.sublabel"),
      },
      active_routes: {
        label: t("stats.activeRoutes.label"),
        sublabel: t("stats.activeRoutes.sublabel"),
      },
      happy_customers: {
        label: t("stats.happyTravelers.label"),
        sublabel: t("stats.happyTravelers.sublabel"),
      },
      trips_completed: {
        label: t("stats.tripsCompleted.label"),
        sublabel: t("stats.tripsCompleted.sublabel"),
      },
    };

  const localizedByLabel: Record<string, { label: string; sublabel: string }> =
    {
      "verified buses": localizedByDbKey.verified_buses,
      "active routes": localizedByDbKey.active_routes,
      "happy travelers": localizedByDbKey.happy_customers,
      "happy customers": localizedByDbKey.happy_customers,
      "trips completed": localizedByDbKey.trips_completed,
      "successful trips": localizedByDbKey.trips_completed,
    };

  const normalizedStats = stats.map((stat) => {
    const dbKey = stat.key?.toLowerCase();
    const labelKey = stat.label.trim().toLowerCase();
    const localized =
      (dbKey && localizedByDbKey[dbKey]) || localizedByLabel[labelKey];

    return {
      number: stat.value,
      label: localized?.label || stat.label,
      sublabel: localized?.sublabel || stat.sublabel || "",
    };
  });

  return (
    <section className="border-b border-border bg-white py-16">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-[14px] font-medium uppercase tracking-wide text-text-tertiary">
            {t("headline")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {normalizedStats.map((stat, index) => {
            return (
              <div key={index} className="text-center">
                <div className="mb-1 text-[32px] font-bold tracking-[-0.02em] text-foreground sm:text-[40px]">
                  {stat.number}
                </div>

                <div className="mb-1 text-[16px] font-semibold text-foreground">
                  {stat.label}
                </div>

                <div className="text-[14px] text-text-tertiary">
                  {stat.sublabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
