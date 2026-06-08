"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Bus,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Snowflake,
  Star,
  Users,
  X,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button, Input, Select, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  vehicleService,
  landingContentService,
  ApiError,
  type VehicleSearchParams,
} from "@/lib/api";
import { localizePlaceName } from "@/lib/i18n/placeName";
import type { Vehicle } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

type SortOption = "" | "price_asc" | "price_desc" | "rating" | "newest";

interface SearchFilters {
  vehicleType: string;
  minCapacity: string;
  maxCapacity: string;
  acType: string;
  district: string;
  amenities: string[];
  routeFrom: string;
  routeTo: string;
  travelDate: string;
  tripPassengers: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PublicOptions {
  vehicleTypes: Array<{ value: string; label: string }>;
  acTypes: Array<{ value: string; label: string }>;
  amenities: Array<{ id: string; label: string }>;
  districts: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createDefaultFilters = (): SearchFilters => ({
  vehicleType: "",
  minCapacity: "",
  maxCapacity: "",
  acType: "",
  district: "",
  amenities: [],
  routeFrom: "",
  routeTo: "",
  travelDate: "",
  tripPassengers: "",
});

const readFiltersFromParams = (params: URLSearchParams): SearchFilters => {
  const normalizeCount = (raw: string | null): string => {
    if (!raw) return "";
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) || n <= 0 ? "" : String(n);
  };

  return {
    vehicleType: params.get("vehicleType")?.trim() ?? "",
    minCapacity: normalizeCount(params.get("minCapacity")),
    maxCapacity: normalizeCount(params.get("maxCapacity")),
    acType: params.get("acType")?.trim() ?? "",
    district: params.get("district")?.trim() ?? "",
    amenities:
      params
        .get("amenities")
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
    routeFrom: params.get("from")?.trim() ?? "",
    routeTo: params.get("to")?.trim() ?? "",
    travelDate: params.get("date")?.trim() ?? "",
    tripPassengers: normalizeCount(params.get("passengers")),
  };
};

const buildSearchParams = (
  filters: SearchFilters,
  sort: SortOption,
  page: number,
): VehicleSearchParams => {
  const minSeatsCap = filters.minCapacity ? parseInt(filters.minCapacity) : 0;
  const minSeatsPax = filters.tripPassengers
    ? parseInt(filters.tripPassengers)
    : 0;
  const minSeats = Math.max(minSeatsCap, minSeatsPax) || undefined;

  const sortMap: Record<
    SortOption,
    {
      sortBy?: VehicleSearchParams["sortBy"];
      sortOrder?: VehicleSearchParams["sortOrder"];
    }
  > = {
    "": {},
    price_asc: { sortBy: "price", sortOrder: "asc" },
    price_desc: { sortBy: "price", sortOrder: "desc" },
    rating: { sortBy: "rating", sortOrder: "desc" },
    newest: { sortBy: "newest", sortOrder: "desc" },
  };

  const locationQuery = filters.routeFrom || filters.routeTo || undefined;

  return {
    ...(filters.vehicleType ? { type: filters.vehicleType } : {}),
    ...(filters.district ? { district: filters.district } : {}),
    ...(filters.acType ? { acType: filters.acType } : {}),
    ...(locationQuery ? { location: locationQuery } : {}),
    ...(minSeats ? { minSeats } : {}),
    ...(filters.maxCapacity
      ? { maxSeats: parseInt(filters.maxCapacity) }
      : {}),
    ...(filters.amenities.length
      ? { amenities: filters.amenities.join(",") }
      : {}),
    ...(filters.travelDate ? { startDate: filters.travelDate } : {}),
    ...sortMap[sort],
    page,
    limit: 12,
  };
};

const getVehicleImageUrl = (vehicle: Vehicle): string | null => {
  const photos = vehicle.photos as Array<{
    url: string;
    isPrimary?: boolean;
  }> | undefined;
  const primary = photos?.find((p) => p.isPrimary);
  return primary?.url ?? photos?.[0]?.url ?? vehicle.images?.[0] ?? null;
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function SearchPage() {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const tLocations = useTranslations("locations");
  const tLandingSearch = useTranslations("landing.searchSection.form");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const searchParamsStr = searchParams.toString();

  // Initialise filters eagerly from URL params so the first fetch uses them
  const [filters, setFilters] = useState<SearchFilters>(() =>
    readFiltersFromParams(new URLSearchParams(searchParamsStr)),
  );
  const [sort, setSort] = useState<SortOption>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [publicOptions, setPublicOptions] = useState<PublicOptions>({
    vehicleTypes: [],
    acTypes: [],
    amenities: [],
    districts: [],
  });

  // ── Localisation helpers ──────────────────────────────────────────────────

  const normalizeEnum = (v: string) => v.toUpperCase().replace(/[- ]/g, "_");

  const localizeVehicleType = (value: string, fallback: string) => {
    switch (normalizeEnum(value)) {
      case "ORDINARY":
        return t("filters.vehicleTypes.ordinary");
      case "SEMI_LUXURY":
        return t("filters.vehicleTypes.semiLuxury");
      case "LUXURY_AC":
        return t("filters.vehicleTypes.luxuryAc");
      default:
        return fallback;
    }
  };

  const localizeAcType = (value: string, fallback: string) => {
    switch (normalizeEnum(value)) {
      case "FULL_AC":
        return t("filters.acTypes.fullAc");
      case "AC":
        return t("filters.acTypes.ac");
      case "NON_AC":
        return t("filters.acTypes.nonAc");
      default:
        return fallback;
    }
  };

  const localizeAmenity = (id: string, fallback: string) => {
    const map: Record<string, string> = {
      wifi: t("filters.amenityOptions.wifi"),
      ac: t("filters.amenityOptions.ac"),
      music: t("filters.amenityOptions.music"),
      usb: t("filters.amenityOptions.usb"),
      tv: t("filters.amenityOptions.tv"),
      reclining: t("filters.amenityOptions.reclining"),
      reading: t("filters.amenityOptions.reading"),
      gps: t("filters.amenityOptions.gps"),
    };
    return map[id.toLowerCase()] ?? fallback;
  };

  const localizePlace = (name: string) =>
    localizePlaceName(name, (key) => tLocations(key));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);

  // ── URL-param sync (only when navigated to from an external link) ──────────

  const prevSearchParamsStr = useRef(searchParamsStr);
  useEffect(() => {
    if (prevSearchParamsStr.current === searchParamsStr) return;
    prevSearchParamsStr.current = searchParamsStr;
    setFilters(readFiltersFromParams(new URLSearchParams(searchParamsStr)));
    setCurrentPage(1);
  }, [searchParamsStr]);

  // ── Fetch filter options once ─────────────────────────────────────────────

  useEffect(() => {
    landingContentService
      .getPublicConfig()
      .then((response) => {
        setPublicOptions({
          vehicleTypes: response.options.vehicleTypes.map((type) => ({
            value: type.value,
            label: localizeVehicleType(type.value, type.label),
          })),
          acTypes: response.options.acTypes.map((type) => ({
            value: type.value,
            label: localizeAcType(type.value, type.label),
          })),
          amenities: response.options.amenities.map((amenity) => ({
            id: amenity.id,
            label: localizeAmenity(amenity.id, amenity.label),
          })),
          districts: response.options.districts,
        });
      })
      .catch(() => {
        // Filter options are non-critical — silently degrade
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced server-side fetch ───────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = buildSearchParams(filters, sort, currentPage);
        const response = await vehicleService.getAll(params);
        if (!cancelled) {
          setVehicles(response.vehicles ?? []);
          if (response.pagination) setPagination(response.pagination);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : t("errors.fetchVehicles"),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const timer = setTimeout(doFetch, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, currentPage]);

  // ── Filter helpers ────────────────────────────────────────────────────────

  const toggleAmenity = (id: string) => {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(id)
        ? prev.amenities.filter((a) => a !== id)
        : [...prev.amenities, id],
    }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters(createDefaultFilters());
    setSort("");
    setCurrentPage(1);
  };

  const activeFilterCount =
    [
      filters.vehicleType,
      filters.acType,
      filters.district,
      filters.routeFrom,
      filters.routeTo,
      filters.travelDate,
      filters.tripPassengers,
      filters.minCapacity,
      filters.maxCapacity,
    ].filter(Boolean).length + filters.amenities.length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      {/* Page header */}
      <section className="bg-muted border-b border-border py-8">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
      </section>

      <section className="py-8">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-4 lg:gap-6">
            {/* ── Mobile filter toggle ─────────────────────────────────── */}
            <div className="mb-4 lg:hidden">
              <Button
                variant="outline"
                onClick={() => setShowFilters((v) => !v)}
                className="w-full gap-2"
                aria-expanded={showFilters}
                aria-controls="filter-sidebar"
              >
                <Filter className="h-4 w-4" />
                {t("filters.title")}
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>

            {/* ── Filter sidebar ───────────────────────────────────────── */}
            <aside
              id="filter-sidebar"
              className={cn(
                "lg:col-span-1",
                showFilters ? "block" : "hidden lg:block",
              )}
            >
              <div className="sticky top-24 rounded-[20px] border border-border bg-card p-5 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">
                    {t("filters.title")}
                  </h2>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3 w-3" />
                      {t("filters.clearAll")}
                    </button>
                  )}
                </div>

                {/* Route + trip inputs */}
                <div className="space-y-3">
                  <Input
                    label={tLandingSearch("fromLabel")}
                    value={filters.routeFrom}
                    placeholder={tLandingSearch("fromPlaceholder")}
                    onChange={(e) =>
                      setFilters({ ...filters, routeFrom: e.target.value })
                    }
                  />
                  <Input
                    label={tLandingSearch("toLabel")}
                    value={filters.routeTo}
                    placeholder={tLandingSearch("toPlaceholder")}
                    onChange={(e) =>
                      setFilters({ ...filters, routeTo: e.target.value })
                    }
                  />
                  <Input
                    label={tLandingSearch("dateLabel")}
                    type="date"
                    value={filters.travelDate}
                    onChange={(e) => {
                      setFilters({ ...filters, travelDate: e.target.value });
                      setCurrentPage(1);
                    }}
                  />
                  <Input
                    label={tLandingSearch("passengersLabel")}
                    type="number"
                    min={1}
                    placeholder={tLandingSearch("passengersPlaceholder")}
                    value={filters.tripPassengers}
                    onChange={(e) => {
                      setFilters({
                        ...filters,
                        tripPassengers: e.target.value,
                      });
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div className="h-px w-full bg-border" />

                {/* Vehicle type */}
                <Select
                  label={t("filters.vehicleType")}
                  value={filters.vehicleType}
                  onChange={(value) => {
                    setFilters({ ...filters, vehicleType: value });
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: "", label: t("filters.allTypes") },
                    ...publicOptions.vehicleTypes,
                  ]}
                />

                {/* Capacity range */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("filters.capacity")}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={t("filters.min")}
                      value={filters.minCapacity}
                      onChange={(e) => {
                        setFilters({
                          ...filters,
                          minCapacity: e.target.value,
                        });
                        setCurrentPage(1);
                      }}
                      className="w-1/2"
                    />
                    <Input
                      type="number"
                      placeholder={t("filters.max")}
                      value={filters.maxCapacity}
                      onChange={(e) => {
                        setFilters({
                          ...filters,
                          maxCapacity: e.target.value,
                        });
                        setCurrentPage(1);
                      }}
                      className="w-1/2"
                    />
                  </div>
                </div>

                {/* AC type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("filters.acType")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {publicOptions.acTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => {
                          setFilters({
                            ...filters,
                            acType:
                              filters.acType === type.value ? "" : type.value,
                          });
                          setCurrentPage(1);
                        }}
                        className={cn(
                          "flex-1 min-h-[44px] rounded-xl border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          filters.acType === type.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary",
                        )}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* District */}
                <Select
                  label={t("filters.district")}
                  value={filters.district}
                  onChange={(value) => {
                    setFilters({ ...filters, district: value });
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: "", label: t("filters.allDistricts") },
                    ...publicOptions.districts.map((d) => ({
                      value: d,
                      label: localizePlace(d),
                    })),
                  ]}
                />

                {/* Amenities */}
                {publicOptions.amenities.length > 0 && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("filters.amenities")}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {publicOptions.amenities.map((amenity) => (
                        <button
                          key={amenity.id}
                          onClick={() => toggleAmenity(amenity.id)}
                          className={cn(
                            "min-h-[36px] rounded-lg border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            filters.amenities.includes(amenity.id)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary",
                          )}
                        >
                          {amenity.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* ── Results ──────────────────────────────────────────────── */}
            <div className="lg:col-span-3">
              {/* Results header */}
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {pagination.total}
                  </span>{" "}
                  {t("results")}
                </p>
                <div className="w-44">
                  <Select
                    value={sort}
                    onChange={(value) => {
                      setSort(value as SortOption);
                      setCurrentPage(1);
                    }}
                    options={[
                      { value: "", label: t("sort.label") },
                      { value: "price_asc", label: t("sort.priceAsc") },
                      { value: "price_desc", label: t("sort.priceDesc") },
                      { value: "rating", label: t("sort.rating") },
                      { value: "newest", label: t("sort.newest") },
                    ]}
                  />
                </div>
              </div>

              {/* Loading skeletons */}
              {isLoading && (
                <div className="space-y-4" aria-busy="true" aria-label={tCommon("loading")}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex overflow-hidden rounded-[20px] border border-border bg-card"
                    >
                      <Skeleton
                        variant="rectangular"
                        className="h-44 w-full sm:h-auto sm:w-56 rounded-none"
                      />
                      <div className="flex-1 space-y-3 p-5">
                        <Skeleton className="h-5 w-3/4 rounded-lg" />
                        <Skeleton className="h-4 w-1/2 rounded-lg" />
                        <Skeleton className="h-4 w-2/3 rounded-lg" />
                        <div className="flex gap-2 pt-1">
                          <Skeleton className="h-6 w-16 rounded-lg" />
                          <Skeleton className="h-6 w-16 rounded-lg" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error state */}
              {error && !isLoading && (
                <div className="rounded-[20px] border border-error bg-error/10 p-8 text-center">
                  <p className="text-error-foreground mb-4">{error}</p>
                  <Button
                    onClick={() => setFilters({ ...filters })}
                    variant="outline"
                  >
                    {tCommon("retry")}
                  </Button>
                </div>
              )}

              {/* Vehicle cards */}
              {!isLoading && !error && vehicles.length > 0 && (
                <>
                  <div className="space-y-4">
                    {vehicles.map((bus) => {
                      const imageUrl = getVehicleImageUrl(bus);
                      const ownerName = bus.owner
                        ? `${bus.owner.firstName ?? ""} ${bus.owner.lastName ?? ""}`.trim()
                        : "";

                      return (
                        <article
                          key={bus.id}
                          className="group overflow-hidden rounded-[20px] border border-border bg-card transition-shadow hover:shadow-lg"
                        >
                          <div className="flex flex-col sm:flex-row">
                            {/* Image */}
                            <div className="relative h-48 w-full flex-shrink-0 overflow-hidden bg-muted sm:h-auto sm:w-56 md:w-64">
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={bus.name}
                                  fill
                                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                                  sizes="(max-width: 640px) 100vw, 256px"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Bus className="h-12 w-12 text-muted-foreground/30" />
                                </div>
                              )}
                              {/* Vehicle type chip */}
                              <div className="absolute left-3 top-3">
                                <span className="rounded-lg bg-card/90 px-2 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                                  {localizeVehicleType(bus.type, bus.type)}
                                </span>
                              </div>
                            </div>

                            {/* Card content */}
                            <div className="flex min-w-0 flex-1 flex-col justify-between p-5">
                              {/* Name + rating */}
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h3 className="truncate text-base font-semibold text-foreground">
                                    {bus.name}
                                  </h3>
                                  {ownerName && (
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                      {ownerName}
                                    </p>
                                  )}
                                </div>
                                {bus.averageRating && bus.averageRating > 0 ? (
                                  <div className="mt-0.5 flex flex-shrink-0 items-center gap-1">
                                    <Star className="h-4 w-4 fill-primary text-primary" />
                                    <span className="text-sm font-semibold text-foreground">
                                      {bus.averageRating.toFixed(1)}
                                    </span>
                                    {bus.reviewCount ? (
                                      <span className="text-xs text-muted-foreground">
                                        ({bus.reviewCount})
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>

                              {/* Key features */}
                              <div className="mb-3 flex flex-wrap gap-3">
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Users className="h-4 w-4" />
                                  {t("seatsCount", { count: bus.seats })}
                                </span>
                                {bus.acType && (
                                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Snowflake className="h-4 w-4" />
                                    {localizeAcType(
                                      bus.acType,
                                      bus.acType.replace(/_/g, " "),
                                    )}
                                  </span>
                                )}
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <MapPin className="h-4 w-4" />
                                  {localizePlace(bus.location)}
                                </span>
                              </div>

                              {/* Amenity chips */}
                              {bus.amenities && bus.amenities.length > 0 && (
                                <div className="mb-4 flex flex-wrap gap-1.5">
                                  {bus.amenities.slice(0, 4).map((id) => {
                                    const info = publicOptions.amenities.find(
                                      (a) => a.id === id,
                                    );
                                    return info ? (
                                      <span
                                        key={id}
                                        className="rounded-lg border border-border px-2 py-0.5 text-xs text-muted-foreground"
                                      >
                                        {info.label}
                                      </span>
                                    ) : null;
                                  })}
                                  {bus.amenities.length > 4 && (
                                    <span className="rounded-lg border border-border px-2 py-0.5 text-xs text-muted-foreground/60">
                                      +{bus.amenities.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Price + CTA */}
                              <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-3">
                                <div>
                                  <p className="text-xl font-bold text-primary">
                                    {formatCurrency(bus.pricePerDay)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {tCommon("perDay")}
                                  </p>
                                </div>
                                <Link
                                  href={`/${locale}/vehicles/${bus.id}`}
                                  className="flex-shrink-0"
                                >
                                  <Button size="sm">{t("viewDetails")}</Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <nav
                      aria-label="Search results pages"
                      className="mt-8 flex items-center justify-center gap-2"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        aria-label={tCommon("previous")}
                        className="gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {tCommon("previous")}
                      </Button>

                      <span className="px-4 text-sm text-muted-foreground">
                        {currentPage} / {pagination.totalPages}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(pagination.totalPages, p + 1),
                          )
                        }
                        disabled={currentPage === pagination.totalPages}
                        aria-label={tCommon("next")}
                        className="gap-1"
                      >
                        {tCommon("next")}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </nav>
                  )}
                </>
              )}

              {/* Empty state */}
              {!isLoading && !error && vehicles.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-[20px] border border-border bg-card py-16 px-4 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Bus className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    {t("noResults")}
                  </h3>
                  <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                    {t("adjustFilters")}
                  </p>
                  <Button onClick={clearFilters} variant="outline">
                    {t("filters.clearAll")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
