"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Filter,
  MapPin,
  Clock3,
  Users,
  Bus,
  Search,
  ArrowRight,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Card, Input, Select, Button } from "@/components/ui";
import {
  tripPackageService,
  landingContentService,
  ApiError,
  type TripPackageSearchParams,
} from "@/lib/api";
import type { TripPackage } from "@/types";
import { ImageWithFallback } from "@/components/landing/ImageWithFallback";
import { localizePlaceName } from "@/lib/i18n/placeName";

interface PackageFilters {
  search: string;
  startLocation: string;
  endLocation: string;
  durationDays: string;
  minPrice: string;
  maxPrice: string;
  vehicleType: string;
}

const initialFilters: PackageFilters = {
  search: "",
  startLocation: "",
  endLocation: "",
  durationDays: "",
  minPrice: "",
  maxPrice: "",
  vehicleType: "",
};

export default function PackagesPage() {
  const t = useTranslations("packages");
  const tLocations = useTranslations("locations");
  const locale = useLocale();

  const getLocalizedPlace = (placeName: string) =>
    localizePlaceName(placeName, (key) => tLocations(key));

  const [packages, setPackages] = useState<TripPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PackageFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "LKR",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        const options = response.options?.quotationVehicleTypes?.length
          ? response.options.quotationVehicleTypes
          : response.options?.vehicleTypes || [];

        setVehicleTypeOptions(options);
      } catch (err) {
        console.error("Failed to fetch package filter options:", err);
      }
    };

    fetchFilterOptions();
  }, []);

  useEffect(() => {
    const fetchPackages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const query: TripPackageSearchParams = {
          isActive: true,
          limit: 24,
          sortBy: "newest",
          sortOrder: "desc",
        };

        if (debouncedSearch) {
          query.search = debouncedSearch;
        }
        if (filters.startLocation.trim()) {
          query.startLocation = filters.startLocation.trim();
        }
        if (filters.endLocation.trim()) {
          query.endLocation = filters.endLocation.trim();
        }
        if (filters.durationDays) {
          query.durationDays = Number(filters.durationDays);
        }
        if (filters.minPrice) {
          query.minPrice = Number(filters.minPrice);
        }
        if (filters.maxPrice) {
          query.maxPrice = Number(filters.maxPrice);
        }
        if (filters.vehicleType) {
          query.vehicleType = filters.vehicleType;
        }

        const response = await tripPackageService.getAll(query);
        setPackages(response.packages || []);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(
            t("errors.fetchPackages", {
              defaultValue: "Failed to load trip packages",
            }),
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackages();
  }, [
    debouncedSearch,
    filters.startLocation,
    filters.endLocation,
    filters.durationDays,
    filters.minPrice,
    filters.maxPrice,
    filters.vehicleType,
    t,
  ]);

  const clearFilters = () => {
    setFilters(initialFilters);
    setDebouncedSearch("");
  };

  return (
    <MainLayout>
      <PageHeader
        title={t("title", { defaultValue: "Trip Packages" })}
        subtitle={t("subtitle", {
          defaultValue: "Compare fixed trip packages from verified owners.",
        })}
      />

      <section className="bg-background py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="mb-8 p-6">
            <div className="mb-4 grid gap-4 lg:grid-cols-[2fr_auto]">
              <Input
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                placeholder={t("searchPlaceholder", {
                  defaultValue: "Search routes or package name",
                })}
              />
              <Button variant="outline" onClick={clearFilters}>
                <Filter className="mr-2 h-4 w-4" />
                {t("filters.clear", { defaultValue: "Clear" })}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Input
                label={t("filters.startLocation", {
                  defaultValue: "Start Location",
                })}
                value={filters.startLocation}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    startLocation: e.target.value,
                  }))
                }
              />

              <Input
                label={t("filters.endLocation", {
                  defaultValue: "End Location",
                })}
                value={filters.endLocation}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    endLocation: e.target.value,
                  }))
                }
              />

              <Input
                label={t("filters.durationDays", {
                  defaultValue: "Duration (days)",
                })}
                type="number"
                min={1}
                value={filters.durationDays}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    durationDays: e.target.value,
                  }))
                }
              />

              <Select
                label={t("filters.vehicleType", {
                  defaultValue: "Vehicle Type",
                })}
                value={filters.vehicleType}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, vehicleType: value }))
                }
                options={[
                  {
                    value: "",
                    label: t("filters.allVehicleTypes", {
                      defaultValue: "All Vehicle Types",
                    }),
                  },
                  ...vehicleTypeOptions,
                ]}
              />

              <Input
                label={t("filters.minPrice", {
                  defaultValue: "Min Price (LKR)",
                })}
                type="number"
                min={0}
                value={filters.minPrice}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, minPrice: e.target.value }))
                }
              />

              <Input
                label={t("filters.maxPrice", {
                  defaultValue: "Max Price (LKR)",
                })}
                type="number"
                min={0}
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, maxPrice: e.target.value }))
                }
              />
            </div>
          </Card>

          {error && (
            <Card className="mb-6 border-error-border bg-error-bg p-4 text-sm text-error-foreground">
              {error}
            </Card>
          )}

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-80 animate-pulse rounded-[20px] border border-border bg-muted"
                />
              ))}
            </div>
          ) : packages.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => {
                const imageUrl = pkg.vehicle?.images?.[0];
                const vehicleName =
                  pkg.vehicle?.name ||
                  t("vehicleFallback", { defaultValue: "Vehicle" });
                const localizedStart = getLocalizedPlace(pkg.startLocation);
                const localizedEnd = getLocalizedPlace(pkg.endLocation);

                return (
                  <Card key={pkg.id} className="overflow-hidden p-0" hover>
                    <div className="relative h-48 w-full bg-muted">
                      {imageUrl ? (
                        <ImageWithFallback
                          src={imageUrl}
                          alt={pkg.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Bus className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 p-5">
                      <div>
                        <h3 className="line-clamp-2 text-lg font-semibold text-foreground">
                          {pkg.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {vehicleName}
                        </p>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {localizedStart} → {localizedEnd}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          <span>
                            {t("durationDays", {
                              count: pkg.durationDays,
                              defaultValue: `${pkg.durationDays} day(s)`,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>
                            {pkg.minPassengers}-{pkg.maxPassengers}{" "}
                            {t("passengers", { defaultValue: "passengers" })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border pt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("priceLabel", { defaultValue: "Package Price" })}
                          </p>
                          <p className="text-xl font-bold text-foreground">
                            {currencyFormatter.format(pkg.price)}
                          </p>
                        </div>

                        <Link href={`/${locale}/packages/${pkg.id}`}>
                          <Button size="sm">
                            {t("viewDetails", { defaultValue: "View Details" })}
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-base font-medium text-foreground">
                {t("empty", {
                  defaultValue: "No packages match your filters.",
                })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("emptyHint", {
                  defaultValue:
                    "Try adjusting your search or filters to find more options.",
                })}
              </p>
              <div className="mt-5">
                <Button variant="outline" onClick={clearFilters}>
                  {t("filters.clear", { defaultValue: "Clear" })}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
