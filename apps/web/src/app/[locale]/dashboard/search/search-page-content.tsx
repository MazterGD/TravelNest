"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  PageHeader,
  Button,
  Card,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import { ApiError, landingContentService, vehicleService } from "@/lib/api";
import { localizePlaceName } from "@/lib/i18n/placeName";
import { cn } from "@/lib/utils/cn";
import { Bus, Filter, MapPin, Snowflake, Star, Users } from "lucide-react";
import type { Vehicle } from "@/types";

interface SearchPageContentProps {
  locale: string;
}

interface SearchFilters {
  query: string;
  from: string;
  to: string;
  travelDate: string;
  passengers: string;
  vehicleType: string;
  minCapacity: string;
  maxCapacity: string;
  acType: string;
  district: string;
  amenities: string[];
}

const createDefaultFilters = (): SearchFilters => ({
  query: "",
  from: "",
  to: "",
  travelDate: "",
  passengers: "",
  vehicleType: "",
  minCapacity: "",
  maxCapacity: "",
  acType: "",
  district: "",
  amenities: [],
});

type SortOption = "" | "price_asc" | "price_desc" | "rating" | "newest";

export function SearchPageContent({ locale }: SearchPageContentProps) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const tLocations = useTranslations("locations");
  const activeLocale = useLocale() || locale;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("");

  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(createDefaultFilters);

  const [publicOptions, setPublicOptions] = useState<{
    vehicleTypes: Array<{ value: string; label: string }>;
    acTypes: Array<{ value: string; label: string }>;
    amenities: Array<{ id: string; label: string }>;
    districts: string[];
  }>({
    vehicleTypes: [],
    acTypes: [],
    amenities: [],
    districts: [],
  });

  const normalizeEnumValue = (value: string) =>
    value.toUpperCase().replace(/[- ]/g, "_");

  const localizeVehicleTypeLabel = (value: string, fallbackLabel: string) => {
    switch (normalizeEnumValue(value)) {
      case "ORDINARY":
        return t("filters.vehicleTypes.ordinary");
      case "SEMI_LUXURY":
        return t("filters.vehicleTypes.semiLuxury");
      case "LUXURY_AC":
        return t("filters.vehicleTypes.luxuryAc");
      default:
        return fallbackLabel;
    }
  };

  const localizeAcTypeLabel = (value: string, fallbackLabel: string) => {
    switch (normalizeEnumValue(value)) {
      case "FULL_AC":
        return t("filters.acTypes.fullAc");
      case "AC":
        return t("filters.acTypes.ac");
      case "NON_AC":
        return t("filters.acTypes.nonAc");
      default:
        return fallbackLabel;
    }
  };

  const localizeAmenityLabel = (id: string, fallbackLabel: string) => {
    switch (id.toLowerCase()) {
      case "wifi":
        return t("filters.amenityOptions.wifi");
      case "ac":
        return t("filters.amenityOptions.ac");
      case "music":
        return t("filters.amenityOptions.music");
      case "usb":
        return t("filters.amenityOptions.usb");
      case "tv":
        return t("filters.amenityOptions.tv");
      case "reclining":
        return t("filters.amenityOptions.reclining");
      case "reading":
        return t("filters.amenityOptions.reading");
      case "gps":
        return t("filters.amenityOptions.gps");
      default:
        return fallbackLabel;
    }
  };

  const localizePlace = (placeName: string) =>
    localizePlaceName(placeName, (key) => tLocations(key));

  const fetchVehicles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await vehicleService.getAll();
      const data = response as {
        data?: { vehicles?: Vehicle[] };
        vehicles?: Vehicle[];
      };
      const vehicles = data.data?.vehicles || data.vehicles || [];
      setAllVehicles(vehicles.filter((vehicle) => vehicle.isActive));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t("errors.fetchVehicles"));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPublicOptions = async () => {
    try {
      const response = await landingContentService.getPublicConfig();
      setPublicOptions({
        vehicleTypes: response.options.vehicleTypes.map((type) => ({
          ...type,
          label: localizeVehicleTypeLabel(type.value, type.label),
        })),
        acTypes: response.options.acTypes.map((type) => ({
          ...type,
          label: localizeAcTypeLabel(type.value, type.label),
        })),
        amenities: response.options.amenities.map((amenity) => ({
          ...amenity,
          label: localizeAmenityLabel(amenity.id, amenity.label),
        })),
        districts: response.options.districts,
      });
    } catch {
      // Keep filters usable with empty options when config fetch fails.
    }
  };

  useEffect(() => {
    void fetchVehicles();
    void fetchPublicOptions();
  }, []);

  const filteredVehicles = useMemo(() => {
    let list = [...allVehicles];

    if (filters.query) {
      const query = filters.query.toLowerCase();
      list = list.filter((vehicle) =>
        [
          vehicle.name,
          vehicle.location,
          vehicle.brand,
          vehicle.model,
          vehicle.owner?.firstName,
          vehicle.owner?.lastName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    if (filters.vehicleType) {
      list = list.filter((vehicle) => vehicle.type === filters.vehicleType);
    }

    if (filters.minCapacity) {
      const minSeats = Number(filters.minCapacity);
      list = list.filter((vehicle) => vehicle.seats >= minSeats);
    }

    if (filters.maxCapacity) {
      const maxSeats = Number(filters.maxCapacity);
      list = list.filter((vehicle) => vehicle.seats <= maxSeats);
    }

    if (filters.acType) {
      list = list.filter(
        (vehicle) =>
          normalizeEnumValue(vehicle.acType || "") === filters.acType,
      );
    }

    if (filters.district) {
      const district = filters.district.toLowerCase();
      list = list.filter((vehicle) =>
        (vehicle.location || "").toLowerCase().includes(district),
      );
    }

    if (filters.passengers) {
      const requestedPassengers = Number(filters.passengers);
      if (!Number.isNaN(requestedPassengers) && requestedPassengers > 0) {
        list = list.filter((vehicle) => vehicle.seats >= requestedPassengers);
      }
    }

    if (filters.from || filters.to) {
      const from = filters.from.toLowerCase();
      const to = filters.to.toLowerCase();
      list = list.filter((vehicle) => {
        const location = (vehicle.location || "").toLowerCase();
        if (from && to) {
          return location.includes(from) || location.includes(to);
        }
        return from ? location.includes(from) : location.includes(to);
      });
    }

    if (filters.amenities.length > 0) {
      list = list.filter((vehicle) => {
        const amenitySet = new Set(
          (vehicle.amenities || []).map((a) => a.toLowerCase()),
        );
        return filters.amenities.every((amenity) =>
          amenitySet.has(amenity.toLowerCase()),
        );
      });
    }

    if (sortBy === "price_asc") {
      list.sort((a, b) => a.pricePerDay - b.pricePerDay);
    }

    if (sortBy === "price_desc") {
      list.sort((a, b) => b.pricePerDay - a.pricePerDay);
    }

    if (sortBy === "rating") {
      list.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    }

    if (sortBy === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return list;
  }, [allVehicles, filters, sortBy]);

  const toggleAmenity = (amenityId: string) => {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter((amenity) => amenity !== amenityId)
        : [...prev.amenities, amenityId],
    }));
  };

  const clearFilters = () => {
    setFilters(createDefaultFilters());
    setSortBy("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 lg:px-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <Input
              placeholder={tCommon("search")}
              value={filters.query}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, query: event.target.value }))
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {t("filters.title")}
            </Button>
            <Button variant="ghost" onClick={clearFilters}>
              {t("filters.clearAll")}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label={tCommon("from")}
              value={filters.from}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, from: event.target.value }))
              }
            />

            <Input
              label={tCommon("to")}
              value={filters.to}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, to: event.target.value }))
              }
            />

            <Input
              label={tCommon("date")}
              type="date"
              value={filters.travelDate}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  travelDate: event.target.value,
                }))
              }
            />

            <Input
              label={tCommon("passengers")}
              type="number"
              min={1}
              value={filters.passengers}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  passengers: event.target.value,
                }))
              }
            />

            <Select
              label={t("filters.vehicleType")}
              value={filters.vehicleType}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, vehicleType: value }))
              }
              options={[
                { value: "", label: t("filters.allTypes") },
                ...publicOptions.vehicleTypes,
              ]}
            />

            <Select
              label={t("filters.district")}
              value={filters.district}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, district: value }))
              }
              options={[
                { value: "", label: t("filters.allDistricts") },
                ...publicOptions.districts.map((district) => ({
                  value: district,
                  label: localizePlace(district),
                })),
              ]}
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("filters.capacity")}
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder={t("filters.min")}
                  value={filters.minCapacity}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      minCapacity: event.target.value,
                    }))
                  }
                  className="w-1/2"
                />
                <Input
                  type="number"
                  min={1}
                  placeholder={t("filters.max")}
                  value={filters.maxCapacity}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      maxCapacity: event.target.value,
                    }))
                  }
                  className="w-1/2"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("filters.acType")}
              </label>
              <div className="flex flex-wrap gap-2">
                {publicOptions.acTypes.map((acType) => (
                  <button
                    key={acType.value}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        acType:
                          prev.acType === acType.value ? "" : acType.value,
                      }))
                    }
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm transition-colors",
                      filters.acType === acType.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {acType.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("filters.amenities")}
              </label>
              <div className="flex flex-wrap gap-2">
                {publicOptions.amenities.map((amenity) => (
                  <button
                    key={amenity.id}
                    type="button"
                    onClick={() => toggleAmenity(amenity.id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                      filters.amenities.includes(amenity.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {amenity.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">
            {filteredVehicles.length}
          </span>{" "}
          {t("results")}
        </p>
        <div className="w-52">
          <Select
            value={sortBy}
            onChange={(value) => setSortBy(value as SortOption)}
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

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Card key={item} className="overflow-hidden p-0">
              <Skeleton className="aspect-video w-full" variant="rectangular" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4 rounded-lg" />
                <Skeleton className="h-4 w-1/2 rounded-lg" />
                <Skeleton className="h-4 w-2/3 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {error && !isLoading && (
        <Card className="p-8 text-center">
          <p className="mb-4 text-sm text-destructive">{error}</p>
          <Button onClick={fetchVehicles}>{tCommon("retry")}</Button>
        </Card>
      )}

      {!isLoading && !error && filteredVehicles.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const image = vehicle.images?.[0];
            const ownerName = vehicle.owner
              ? `${vehicle.owner.firstName || ""} ${vehicle.owner.lastName || ""}`.trim()
              : "";
            return (
              <Card
                key={vehicle.id}
                hover
                className="flex h-full flex-col overflow-hidden p-0"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {image ? (
                    <Image
                      src={image}
                      alt={vehicle.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Bus className="h-10 w-10" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {vehicle.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {ownerName || tCommon("owner")}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {t("seatsCount", { count: vehicle.seats })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Snowflake className="h-4 w-4" />
                        {localizeAcTypeLabel(
                          vehicle.acType,
                          vehicle.acType.replace(/_/g, " "),
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {localizePlace(vehicle.location)}
                      </div>
                      {vehicle.averageRating ? (
                        <div className="flex items-center gap-1.5">
                          <Star className="h-4 w-4" />
                          {vehicle.averageRating.toFixed(1)}
                        </div>
                      ) : null}
                    </div>

                    {vehicle.amenities && vehicle.amenities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {vehicle.amenities.slice(0, 4).map((amenity) => {
                          const translated = publicOptions.amenities.find(
                            (option) =>
                              option.id.toLowerCase() === amenity.toLowerCase(),
                          );
                          return (
                            <span
                              key={amenity}
                              className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground"
                            >
                              {translated?.label || amenity}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {tCommon("from")}
                      </p>
                      <p className="text-xl font-semibold text-primary">
                        {new Intl.NumberFormat(activeLocale, {
                          style: "currency",
                          currency: "LKR",
                          maximumFractionDigits: 0,
                        }).format(vehicle.pricePerDay)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tCommon("perDay")}
                      </p>
                    </div>

                    <Link href={`/${locale}/dashboard/vehicles/${vehicle.id}`}>
                      <Button size="sm">{t("viewDetails")}</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && !error && filteredVehicles.length === 0 && (
        <Card className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-muted">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {t("noResults")}
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {t("adjustFilters")}
          </p>
          <Button className="mt-6" onClick={clearFilters}>
            {t("filters.clearAll")}
          </Button>
        </Card>
      )}
    </div>
  );
}
