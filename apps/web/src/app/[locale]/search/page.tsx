"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  FaFilter,
  FaStar,
  FaUsers,
  FaSnowflake,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { VEHICLE_AMENITIES, SRI_LANKAN_DISTRICTS } from "@/constants";
import { vehicleService, ApiError } from "@/lib/api";

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

const VEHICLE_TYPES = [
  { value: "ORDINARY", label: "Ordinary" },
  { value: "SEMI_LUXURY", label: "Semi-Luxury" },
  { value: "LUXURY_AC", label: "Luxury AC" },
];

const AC_TYPES = [
  { value: "FULL_AC", label: "Full AC" },
  { value: "AC", label: "AC" },
  { value: "NON_AC", label: "Non-AC" },
];

export default function SearchPage() {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]); // Store unfiltered list
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    vehicleType: "",
    minCapacity: "",
    maxCapacity: "",
    acType: "",
    district: "",
    amenities: [] as string[],
  });

  // Fetch vehicles on mount
  useEffect(() => {
    fetchVehicles();
  }, []);

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
        setError("Failed to fetch vehicles");
      }
      console.error("Error fetching vehicles:", err);
    } finally {
      setIsLoading(false);
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

    // Filter by district/location
    if (filters.district) {
      filtered = filtered.filter((v) =>
        v.location?.toLowerCase().includes(filters.district.toLowerCase()),
      );
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
    setFilters({
      vehicleType: "",
      minCapacity: "",
      maxCapacity: "",
      acType: "",
      district: "",
      amenities: [],
    });
  };

  return (
    <MainLayout>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-4 lg:gap-8">
            {/* Mobile Filter Toggle */}
            <div className="mb-6 lg:hidden">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="w-full"
              >
                <FaFilter className="mr-2 h-4 w-4" />
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
                  {/* Vehicle Type */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("filters.vehicleType")}
                    </label>
                    <select
                      value={filters.vehicleType}
                      onChange={(e) =>
                        setFilters({ ...filters, vehicleType: e.target.value })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">All Types</option>
                      {VEHICLE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Capacity */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("filters.capacity")}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
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
                        placeholder="Max"
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
                      {AC_TYPES.map((type) => (
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
                            "flex-1 px-3 py-2 text-sm rounded-md border transition-colors",
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
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("filters.district")}
                    </label>
                    <select
                      value={filters.district}
                      onChange={(e) =>
                        setFilters({ ...filters, district: e.target.value })
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">All Districts</option>
                      {SRI_LANKAN_DISTRICTS.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amenities */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("filters.amenities")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {VEHICLE_AMENITIES.slice(0, 6).map((amenity) => (
                        <button
                          key={amenity.id}
                          onClick={() => toggleAmenity(amenity.id)}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-full border transition-colors",
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
                <select className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="">{t("sort.label")}</option>
                  <option value="price_asc">{t("sort.priceAsc")}</option>
                  <option value="price_desc">{t("sort.priceDesc")}</option>
                  <option value="rating">{t("sort.rating")}</option>
                  <option value="newest">{t("sort.newest")}</option>
                </select>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-0 overflow-hidden">
                      <div className="flex flex-col sm:flex-row">
                        <div className="sm:w-64 h-48 bg-muted animate-pulse" />
                        <div className="flex-1 p-6 space-y-3">
                          <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                          <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                          <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
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
                  <Button onClick={fetchVehicles}>Retry</Button>
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
                            <FaMapMarkerAlt className="h-12 w-12 text-muted-foreground/30" />
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
                                  <FaUsers className="mr-1.5 h-4 w-4" />
                                  {bus.seats} Seats
                                </div>
                                {bus.acType && (
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    <FaSnowflake className="mr-1.5 h-4 w-4" />
                                    {bus.acType.replace(/_/g, " ")}
                                  </div>
                                )}
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <FaMapMarkerAlt className="mr-1.5 h-4 w-4" />
                                  {bus.location}
                                </div>
                              </div>

                              {/* Amenities */}
                              {bus.amenities && bus.amenities.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                  {bus.amenities.slice(0, 4).map((amenity) => {
                                    const amenityInfo = VEHICLE_AMENITIES.find(
                                      (a) => a.id === amenity,
                                    );
                                    return amenityInfo ? (
                                      <span
                                        key={amenity}
                                        className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground"
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
                                Rs. {bus.pricePerDay.toLocaleString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                per day
                              </p>
                              {bus.pricePerKm && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Rs. {bus.pricePerKm}/km
                                </p>
                              )}
                              <Link href={`/${locale}/vehicles/${bus.id}`}>
                                <Button className="mt-4" size="sm">
                                  View Details
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
                <Card className="text-center py-12">
                  <FaMapMarkerAlt className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {t("noResults")}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {t("adjustFilters")}
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
