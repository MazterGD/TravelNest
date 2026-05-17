"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MapPin, Clock, Users, Car, Calendar, Star, Info } from "lucide-react";
import { Button } from "@/components/ui";
import { tripPackageService } from "@/lib/api";
import type { TripPackage } from "@/types";
import { localizePlaceName } from "@/lib/i18n/placeName";

export default function PackageDetailPage() {
  const params = useParams();
  const locale = params.locale as string;
  const packageId = params.id as string;
  const activeLocale = useLocale();
  const t = useTranslations("packages");
  const tLocations = useTranslations("locations");

  const getLocalizedPlace = (placeName: string) =>
    localizePlaceName(placeName, (key) => tLocations(key));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(activeLocale, {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);

  const [tripPackage, setTripPackage] = useState<TripPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPackage = async () => {
      setIsLoading(true);
      try {
        const response = await tripPackageService.getById(packageId);
        setTripPackage(response.tripPackage);
      } catch (err) {
        console.error(err);
        setError(t("errors.fetchPackages"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackage();
  }, [packageId, t]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" className="text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error || !tripPackage) {
    return (
      <MainLayout>
        <div className="flex flex-col justify-center items-center min-h-[60vh] px-4 text-center">
          <Info className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t("detail.notFoundTitle")}
          </h2>
          <p className="text-gray-500 mb-6">
            {error || t("detail.notFoundMessage")}
          </p>
          <Link href={`/${locale}/search`}>
            <Button>{t("detail.exploreOtherPackages")}</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const localizedStart = getLocalizedPlace(tripPackage.startLocation);
  const localizedEnd = getLocalizedPlace(tripPackage.endLocation);

  return (
    <MainLayout>
      {/* Hero Section */}
      <div className="relative w-full h-[50vh] md:h-[60vh] bg-gray-900 overflow-hidden">
        {tripPackage.vehicle?.images?.[0] ? (
          <img
            src={tripPackage.vehicle.images[0]}
            alt={tripPackage.title}
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/80 to-blue-900 opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 max-w-7xl mx-auto text-white">
          <span className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-wider text-white uppercase bg-primary rounded-full">
            {t("detail.featuredBadge")}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 drop-shadow-md">
            {tripPackage.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 md:gap-8 text-sm md:text-base text-gray-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <span>
                {localizedStart} → {localizedEnd}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>
                {t("durationDays", { count: tripPackage.durationDays })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>
                {tripPackage.minPassengers} - {tripPackage.maxPassengers}{" "}
                {t("passengers")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Overview */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t("detail.overview")}
              </h2>
              <p className="text-gray-600 leading-relaxed text-lg">
                {tripPackage.description || t("detail.overviewFallback")}
              </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50/50 p-8 rounded-3xl border border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {t("detail.route")}
                </h3>
                <p className="text-gray-600">
                  {localizedStart} → {localizedEnd}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {t("detail.passengerRange")}
                </h3>
                <p className="text-gray-600">
                  {tripPackage.minPassengers} - {tripPackage.maxPassengers}{" "}
                  {t("passengers")}
                </p>
              </div>
            </section>

            {/* Operator Info */}
            <section className="flex items-center gap-6 p-6 rounded-2xl border border-gray-200">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                <Car className="w-8 h-8 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  {t("detail.operatedBy")}
                </p>
                <h3 className="text-xl font-bold text-gray-900">
                  {tripPackage.owner?.firstName} {tripPackage.owner?.lastName}
                </h3>
                <div className="flex items-center gap-1 mt-1 text-yellow-600 font-medium text-sm">
                  <Star className="w-4 h-4 fill-current" />
                  <span>
                    {tripPackage.owner?.isVerified
                      ? t("detail.verifiedOwner")
                      : t("detail.owner")}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-3xl shadow-xl border border-gray-100 p-8 overflow-hidden transform transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />

              <div className="mb-6">
                <p className="text-gray-500 font-medium mb-1">
                  {t("detail.startingFrom")}
                </p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-black text-gray-900 tracking-tight">
                    {formatCurrency(tripPackage.price)}
                  </h3>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {t("detail.priceNote")}
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100/50">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium">
                      {t("detail.duration")}
                    </p>
                    <p className="font-semibold">
                      {t("durationDays", { count: tripPackage.durationDays })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100/50">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium">
                      {t("detail.groupSize")}
                    </p>
                    <p className="font-semibold">
                      {tripPackage.minPassengers} - {tripPackage.maxPassengers}{" "}
                      {t("passengers")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href={`/${locale}/search?package=${tripPackage.id}`}
                  className="block w-full"
                >
                  <Button className="w-full py-6 text-lg rounded-2xl shadow-lg shadow-primary/30 font-bold group">
                    {t("detail.bookThisPackage")}
                  </Button>
                </Link>
                <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1"></span>
                  {t("detail.freeCancellation")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
