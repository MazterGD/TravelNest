"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Search, MapPin, Calendar, Users, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { ImageWithFallback } from "@/components/landing/ImageWithFallback";
import { CTAButton } from "@/components/ui";

interface SearchSectionProps {
  searchHref: string;
  howItWorksHref: string;
}

export function SearchSection({
  searchHref,
  howItWorksHref,
}: SearchSectionProps) {
  const router = useRouter();
  const t = useTranslations("landing.searchSection");
  const tTrust = useTranslations("landing.trustIndicators.stats");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [passengers, setPassengers] = useState("");

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();
    const normalizedFrom = from.trim();
    const normalizedTo = to.trim();
    const normalizedDate = travelDate.trim();
    const parsedPassengers = Number.parseInt(passengers, 10);

    if (normalizedFrom) {
      params.set("from", normalizedFrom);
    }

    if (normalizedTo) {
      params.set("to", normalizedTo);
    }

    if (normalizedDate) {
      params.set("date", normalizedDate);
    }

    if (!Number.isNaN(parsedPassengers) && parsedPassengers > 0) {
      params.set("passengers", String(parsedPassengers));
    }

    const queryString = params.toString();
    router.push(queryString ? `${searchHref}?${queryString}` : searchHref);
  };

  const valueProps = [
    t("bullets.verifiedOwners"),
    t("bullets.transparentPricing"),
    t("bullets.instantQuotes"),
  ];

  const trustHighlights = [
    `${tTrust("verifiedBuses.label")} · ${tTrust("verifiedBuses.sublabel")}`,
    `${tTrust("successfulTrips.label")} · ${tTrust("successfulTrips.sublabel")}`,
    `${tTrust("travelersTrustUs.label")} · ${tTrust("travelersTrustUs.sublabel")}`,
  ];

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1715525873402-a1f939144ce3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxTcmklMjBMYW5rYSUyMHNjZW5pYyUyMGxhbmRzY2FwZSUyMHJvYWR8ZW58MXx8fHwxNzczMzE1MTc5fDA&ixlib=rb-4.1.0&q=80&w=1080"
          alt={t("imageAlt")}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70"></div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 py-32 sm:px-6 lg:px-8">
        <div className="max-w-[720px]">
          <p className="mb-4 text-[14px] font-medium uppercase tracking-wide text-white/70">
            {valueProps.join(" · ")}
          </p>

          <h1 className="mb-6 text-[36px] font-bold leading-[44px] tracking-[-0.02em] text-white sm:text-[48px] sm:leading-[56px]">
            {t("titleLine1")}
            <br />
            {t("titleLine2")}
          </h1>

          <p className="mb-12 max-w-[540px] text-[16px] leading-[24px] text-white/80 sm:text-[18px] sm:leading-[28px]">
            {t("subtitle")}
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="max-w-[960px] rounded-[20px] bg-white p-2 shadow-2xl"
        >
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <div className="border-b border-border px-4 py-3 transition-colors hover:bg-muted lg:border-b-0 lg:border-r">
              <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t("form.fromLabel")}
              </label>
              <div className="flex items-center gap-2">
                <MapPin className="h-[18px] w-[18px] flex-shrink-0 text-text-tertiary" />
                <input
                  type="text"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  placeholder={t("form.fromPlaceholder")}
                  className="w-full bg-transparent text-[16px] text-foreground placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
            </div>

            <div className="border-b border-border px-4 py-3 transition-colors hover:bg-muted lg:border-b-0 lg:border-r">
              <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t("form.toLabel")}
              </label>
              <div className="flex items-center gap-2">
                <MapPin className="h-[18px] w-[18px] flex-shrink-0 text-text-tertiary" />
                <input
                  type="text"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder={t("form.toPlaceholder")}
                  className="w-full bg-transparent text-[16px] text-foreground placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
            </div>

            <div className="border-b border-border px-4 py-3 transition-colors hover:bg-muted sm:border-r lg:border-b-0">
              <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t("form.dateLabel")}
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="h-[18px] w-[18px] flex-shrink-0 text-text-tertiary" />
                <input
                  type="date"
                  value={travelDate}
                  onChange={(event) => setTravelDate(event.target.value)}
                  className="w-full bg-transparent text-[16px] text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div className="border-b border-border px-4 py-3 transition-colors hover:bg-muted lg:border-b-0 lg:border-r">
              <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t("form.passengersLabel")}
              </label>
              <div className="flex items-center gap-2">
                <Users className="h-[18px] w-[18px] flex-shrink-0 text-text-tertiary" />
                <input
                  type="number"
                  value={passengers}
                  onChange={(event) => setPassengers(event.target.value)}
                  placeholder={t("form.passengersPlaceholder")}
                  min="1"
                  className="w-full bg-transparent text-[16px] text-foreground placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 sm:col-span-2 lg:col-span-1 flex items-center justify-center">
              <CTAButton
                type="submit"
                size="lg"
                fullWidth
                leftIcon={<Search className="h-5 w-5" />}
              >
                {t("form.searchButton")}
              </CTAButton>
            </div>
          </div>
        </form>

        <div className="mt-8 flex flex-wrap items-center gap-6">
          {trustHighlights.map((stat) => (
            <span key={stat} className="text-[14px] font-medium text-white/60">
              {stat}
            </span>
          ))}
        </div>

        <div className="mt-6 lg:hidden">
          <Link
            href={howItWorksHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            {t("scrollPrompt")}
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <ChevronDown className="h-6 w-6 text-white/40" />
      </div>
    </section>
  );
}
