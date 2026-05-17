"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Filter, Star, Users, Snowflake, MapPin } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  PageHeader,
  Button,
  Card,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { vehicleService, landingContentService, ApiError } from "@/lib/api";
import { localizePlaceName } from "@/lib/i18n/placeName";

interface Vehicle {
  id: string;
  name: string;
  type: string;
  brand: string;
  model: string;
  seats: number;
  acType: string;
  pricePerDay: number;
  pricePerKm?: number;
  location: string;
  amenities: string[];
  images: string[];
  owner: {
    firstName: string;
    lastName: string;
  };
}

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

export default function SearchPage() {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const tLocations = useTranslations("locations");
  const tLandingSearch = useTranslations("landing.searchSection.form");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]); // Store unfiltered list
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
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
  const [filters, setFilters] = useState<SearchFilters>(createDefaultFilters);

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

  // Fetch vehicles on mount
  useEffect(() => {
    fetchVehicles();
    fetchPublicOptions();
  }, []);

  // Prefill filters from URL query params (landing search and popular routes)
  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const normalizeCount = (value: string | null) => {
      if (!value) {
        return "";
      }

      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) || parsed <= 0 ? "" : String(parsed);
    };

    const normalizeAmenities = (value: string | null) => {
      if (!value) {
        return [];
      }

      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    };

    const routeFrom = params.get("from")?.trim() ?? "";
    const routeTo = params.get("to")?.trim() ?? "";

    const nextFilters: SearchFilters = {
      ...createDefaultFilters(),
      vehicleType: params.get("vehicleType")?.trim() ?? "",
      minCapacity: normalizeCount(params.get("minCapacity")),
      maxCapacity: normalizeCount(params.get("maxCapacity")),
      acType: params.get("acType")?.trim() ?? "",
      district: params.get("district")?.trim() ?? "",
      amenities: normalizeAmenities(params.get("amenities")),
      routeFrom,
      routeTo,
      travelDate: params.get("date")?.trim() ?? "",
      tripPassengers: normalizeCount(params.get("passengers")),
    };

    setFilters(nextFilters);
  }, [searchParamsKey]);

  // Apply filters whenever they change
  useEffect(() => {
    applyFilters();
  }, [filters, allVehicles]);

  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await vehicleService.getAll();
      const data = response as any;
      const vehiclesList = data.data?.vehicles || data.vehicles || [];
      setAllVehicles(vehiclesList);
      setVehicles(vehiclesList);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("errors.fetchVehicles"));
      }
      console.error("Error fetching vehicles:", err);
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
    } catch (error) {
      console.error("Failed to fetch public filter options:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...allVehicles];

    // Filter by vehicle type
    if (filters.vehicleType) {
      filtered = filtered.filter((v) => v.type === filters.vehicleType);
    }

    // Filter by minimum capacity
    if (filters.minCapacity) {
      const minSeats = parseInt(filters.minCapacity, 10);
      filtered = filtered.filter((v) => v.seats >= minSeats);
    }

    // Filter by maximum capacity
    if (filters.maxCapacity) {
      const maxSeats = parseInt(filters.maxCapacity, 10);
      filtered = filtered.filter((v) => v.seats <= maxSeats);
    }

    // Filter by AC type
    if (filters.acType) {
      filtered = filtered.filter((v) => {
        const vehicleAcType = v.acType?.toUpperCase().replace(/[- ]/g, "_");
        return vehicleAcType === filters.acType;
      });
    }

    // Filter by route details from landing search/popular routes
    if (filters.routeFrom || filters.routeTo) {
      const routeFrom = filters.routeFrom.toLowerCase();
      const routeTo = filters.routeTo.toLowerCase();

      filtered = filtered.filter((v) => {
        const location = v.location?.toLowerCase() || "";

        if (routeFrom && routeTo) {
          return location.includes(routeFrom) || location.includes(routeTo);
        }

        return routeFrom
          ? location.includes(routeFrom)
          : location.includes(routeTo);
      });
    }

    // Filter by district/location
    if (filters.district) {
      filtered = filtered.filter((v) =>
        v.location?.toLowerCase().includes(filters.district.toLowerCase()),
      );
    }

    // Filter by requested passenger count from landing search
    if (filters.tripPassengers) {
      const requestedPassengers = Number.parseInt(filters.tripPassengers, 10);
      if (!Number.isNaN(requestedPassengers) && requestedPassengers > 0) {
        filtered = filtered.filter((v) => v.seats >= requestedPassengers);
      }
    }

    // Filter by amenities
    if (filters.amenities.length > 0) {
      filtered = filtered.filter((v) =>
        filters.amenities.every((amenity) => v.amenities?.includes(amenity)),
      );
    }

    setVehicles(filtered);
  };

  const toggleAmenity = (amenityId: string) => {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter((a) => a !== amenityId)
        : [...prev.amenities, amenityId],
    }));
  };

  const clearFilters = () => {
    setFilters(createDefaultFilters());
  };

  return (
    <MainLayout>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-4 lg:gap-6">
            {/* Mobile Filter Toggle */}
            <div className="mb-6 lg:hidden">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="w-full"
              >
                <Filter className="mr-2 h-4 w-4" />
                {t("filters.title")}
              </Button>
            </div>

            {/* Filters Sidebar */}
            <aside
              className={cn(
                "lg:col-span-1",
                showFilters ? "block" : "hidden lg:block",
              )}
            >
              <Card className="sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    {t("filters.title")}
                  </h3>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary hover:underline"
                  >
                    {t("filters.clearAll")}
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Route Details */}
                  <div>
                    <Input
                      label={tLandingSearch("fromLabel")}
                      value={filters.routeFrom}
                      placeholder={tLandingSearch("fromPlaceholder")}
                      onChange={(event) =>
                        setFilters({
                          ...filters,
                          routeFrom: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Input
                      label={tLandingSearch("toLabel")}
                      value={filters.routeTo}
                      placeholder={tLandingSearch("toPlaceholder")}
                      onChange={(event) =>
                        setFilters({ ...filters, routeTo: event.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Input
                      label={tLandingSearch("dateLabel")}
                      type="date"
                      value={filters.travelDate}
                      onChange={(event) =>
                        setFilters({
                          ...filters,
                          travelDate: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Input
                      label={tLandingSearch("passengersLabel")}
                      type="number"
                      min={1}
                      placeholder={tLandingSearch("passengersPlaceholder")}
                      value={filters.tripPassengers}
                      onChange={(event) =>
                        setFilters({
                          ...filters,
                          tripPassengers: event.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Vehicle Type */}
                  <div>
                    <Select
                      label={t("filters.vehicleType")}
                      value={filters.vehicleType}
                      onChange={(value) =>
                        setFilters({ ...filters, vehicleType: value })
                      }
                      options={[
                        { value: "", label: t("filters.allTypes") },
                        ...publicOptions.vehicleTypes.map((type) => ({
                          value: type.value,
                          label: type.label,
                        })),
                      ]}
                    />
                  </div>

                  {/* Capacity */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("filters.capacity")}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={t("filters.min")}
                        value={filters.minCapacity}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            minCapacity: e.target.value,
                          })
                        }
                        className="w-1/2"
                      />
                      <Input
                        type="number"
                        placeholder={t("filters.max")}
                        value={filters.maxCapacity}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            maxCapacity: e.target.value,
                          })
                        }
                        className="w-1/2"
                      />
                    </div>
                  </div>

                  {/* AC Type */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("filters.acType")}
                    </label>
                    <div className="flex gap-2">
                      {publicOptions.acTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() =>
                            setFilters({
                              ...filters,
                              acType:
                                filters.acType === type.value ? "" : type.value,
                            })
                          }
                          className={cn(
                            "flex-1 px-3 py-2 text-sm rounded-xl border transition-colors",
                            filters.acType === type.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-muted-foreground",
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* District */}
                  <div>
                    <Select
                      label={t("filters.district")}
                      value={filters.district}
                      onChange={(value) =>
                        setFilters({ ...filters, district: value })
                      }
                      options={[
                        { value: "", label: t("filters.allDistricts") },
                        ...publicOptions.districts.map((district) => ({
                          value: district,
                          label: localizePlace(district),
                        })),
                      ]}
                    />
                  </div>

                  {/* Amenities */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("filters.amenities")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {publicOptions.amenities.slice(0, 6).map((amenity) => (
                        <button
                          key={amenity.id}
                          onClick={() => toggleAmenity(amenity.id)}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                            filters.amenities.includes(amenity.id)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-muted-foreground",
                          )}
                        >
                          {amenity.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </aside>

            {/* Results */}
            <div className="lg:col-span-3">
              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {vehicles.length}
                  </span>{" "}
                  {t("results")}
                </p>
                <div className="w-48">
                  <Select
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

              {/* Loading State */}
              {isLoading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-0 overflow-hidden">
                      <div className="flex flex-col sm:flex-row">
                        <Skeleton
                          className="sm:w-64 h-48 rounded-none"
                          variant="rectangular"
                        />
                        <div className="flex-1 p-6 space-y-4">
                          <Skeleton className="h-6 w-3/4 rounded-lg" />
                          <Skeleton className="h-4 w-1/2 rounded-lg" />
                          <Skeleton className="h-4 w-2/3 rounded-lg" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <Card className="text-center py-12">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button onClick={fetchVehicles}>{tCommon("retry")}</Button>
                </Card>
              )}

              {/* Bus Cards */}
              {!isLoading && !error && vehicles.length > 0 && (
                <div className="space-y-4">
                  {vehicles.map((bus) => (
                    <Card key={bus.id} hover className="p-0 overflow-hidden">
                      <div className="flex flex-col sm:flex-row">
                        {/* Image */}
                        <div className="sm:w-64 h-48 sm:h-auto bg-muted flex items-center justify-center overflow-hidden">
                          {bus.images && bus.images.length > 0 ? (
                            <img
                              src={bus.images[0]}
                              alt={bus.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <MapPin className="h-12 w-12 text-muted-foreground/30" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">
                                {bus.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {`${bus.owner.firstName} ${bus.owner.lastName}`}
                              </p>

                              {/* Features */}
                              <div className="flex flex-wrap gap-3 mt-3">
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Users className="mr-1.5 h-4 w-4" />
                                  {t("seatsCount", { count: bus.seats })}
                                </div>
                                {bus.acType && (
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    <Snowflake className="mr-1.5 h-4 w-4" />
                                    {localizeAcTypeLabel(
                                      bus.acType,
                                      bus.acType.replace(/_/g, " "),
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <MapPin className="mr-1.5 h-4 w-4" />
                                  {localizePlace(bus.location)}
                                </div>
                              </div>

                              {/* Amenities */}
                              {bus.amenities && bus.amenities.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                  {bus.amenities.slice(0, 4).map((amenity) => {
                                    const amenityInfo =
                                      publicOptions.amenities.find(
                                        (a) => a.id === amenity,
                                      );
                                    return amenityInfo ? (
                                      <span
                                        key={amenity}
                                        className="px-2 py-1 text-xs rounded-lg bg-muted text-muted-foreground"
                                      >
                                        {amenityInfo.label}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Price & Action */}
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">
                                {new Intl.NumberFormat(locale, {
                                  style: "currency",
                                  currency: "LKR",
                                  minimumFractionDigits: 0,
                                }).format(bus.pricePerDay)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {tCommon("perDay")}
                              </p>
                              {bus.pricePerKm && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Intl.NumberFormat(locale, {
                                    style: "currency",
                                    currency: "LKR",
                                    minimumFractionDigits: 0,
                                  }).format(bus.pricePerKm)}{" "}
                                  {tCommon("perKm")}
                                </p>
                              )}
                              <Link href={`/${locale}/vehicles/${bus.id}`}>
                                <Button className="mt-4" size="sm">
                                  {t("viewDetails")}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && vehicles.length === 0 && (
                <Card className="text-center py-16 px-4 flex flex-col items-center justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[20px] bg-muted mb-6">
                    <MapPin className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-foreground mb-2">
                    {t("noResults")}
                  </h3>
                  <p className="mt-2 text-muted-foreground mb-6 max-w-md">
                    {t("adjustFilters")}
                  </p>
                  <Button onClick={clearFilters}>
                    {t("filters.clearAll")}
                  </Button>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
