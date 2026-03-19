import { useTranslations } from "next-intl";

export function TrustIndicators() {
  const t = useTranslations("landing.trustIndicators");
  const stats = [
    {
      number: "500+",
      label: t("stats.verifiedBuses.label"),
      sublabel: t("stats.verifiedBuses.sublabel"),
    },
    {
      number: "10,000+",
      label: t("stats.successfulTrips.label"),
      sublabel: t("stats.successfulTrips.sublabel"),
    },
    {
      number: "5,000+",
      label: t("stats.travelersTrustUs.label"),
      sublabel: t("stats.travelersTrustUs.sublabel"),
    },
    {
      number: "4.9/5",
      label: "Average Rating",
      sublabel: "Based on real reviews",
    },
  ];

  return (
    <section className="border-b border-border bg-white py-16">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-[14px] font-medium uppercase tracking-wide text-text-tertiary">
            {t("headline")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, index) => {
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
