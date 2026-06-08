"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Car,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  ShieldCheck,
  Snowflake,
  Star,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { Button, Card, CardContent, Badge, StarRating, Skeleton } from "@/components/ui";
import { vehicleService, reviewService, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils/cn";
import { VEHICLE_AMENITIES } from "@/constants";
import { localizePlaceName } from "@/lib/i18n/placeName";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  name: string;
  description?: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  color?: string;
  seats: number;
  fuelType?: string;
  transmission?: string;
  acType: string;
  condition?: string;
  amenities: string[];
  images: string[];
  photos?: Array<{ url: string; isPrimary?: boolean }>;
  pricePerDay: number;
  pricePerHour?: number;
  pricePerKm?: number;
  driverAllowance?: number;
  location: string;
  isAvailable: boolean;
  isActive: boolean;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    isVerified: boolean;
    businessName?: string | null;
    baseLocation?: string | null;
    businessProfile?: { businessName: string };
  };
}

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isRecommended: boolean | null;
  customerName: string;
  customerAvatar: string | null;
  ownerResponse: string | null;
  createdAt: string;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}

interface VehicleAvailability {
  month: string;
  blocked: Array<{
    id: string;
    startDate: string;
    endDate: string;
    reason?: string | null;
  }>;
  booked: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
}

interface SimilarVehicle {
  id: string;
  name: string;
  location: string;
  seats: number;
  pricePerDay: number;
  images?: string[];
  photos?: Array<{ url: string; isPrimary?: boolean }>;
  averageRating?: number;
}

export interface VehicleDetailsPageContentProps {
  locale: string;
  vehicleId: string;
  isDashboard?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getVehicleImageUrl = (v: {
  images?: string[];
  photos?: Array<{ url: string; isPrimary?: boolean }>;
}): string | null => {
  const primary = v.photos?.find((p) => p.isPrimary);
  return primary?.url ?? v.photos?.[0]?.url ?? v.images?.[0] ?? null;
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function VehicleDetailsPageContent({
  locale,
  vehicleId,
  isDashboard,
}: VehicleDetailsPageContentProps) {
  const t = useTranslations("vehicle");
  const tCommon = useTranslations("common");
  const tLocations = useTranslations("locations");
  const router = useRouter();

  // ── Localisation helpers ──────────────────────────────────────────────────

  const localizePlace = (name: string) =>
    localizePlaceName(name, (key) => tLocations(key));

  const normalizeEnum = (v: string) => v.toUpperCase().replace(/[- ]/g, "_");
  const humanizeEnum = (v: string) =>
    v
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const localizeVehicleType = (value: string) => {
    switch (normalizeEnum(value)) {
      case "ORDINARY":
        return t("valueLabels.vehicleType.ordinary");
      case "SEMI_LUXURY":
        return t("valueLabels.vehicleType.semiLuxury");
      case "LUXURY_AC":
        return t("valueLabels.vehicleType.luxuryAc");
      default:
        return humanizeEnum(value);
    }
  };

  const localizeAcType = (value: string) => {
    switch (normalizeEnum(value)) {
      case "FULL_AC":
        return t("valueLabels.acType.fullAc");
      case "AC":
        return t("valueLabels.acType.ac");
      case "NON_AC":
        return t("valueLabels.acType.nonAc");
      default:
        return humanizeEnum(value);
    }
  };

  const localizeCondition = (value: string) => {
    switch (normalizeEnum(value)) {
      case "EXCELLENT":
        return t("valueLabels.condition.excellent");
      case "GOOD":
        return t("valueLabels.condition.good");
      case "FAIR":
        return t("valueLabels.condition.fair");
      default:
        return humanizeEnum(value);
    }
  };

  const localizeAmenityLabel = (amenityId: string, fallback: string) => {
    const map: Record<string, string> = {
      wifi: t("amenityLabels.wifi"),
      usb_charging: t("amenityLabels.usbCharging"),
      ac: t("amenityLabels.ac"),
      reclining_seats: t("amenityLabels.recliningSeats"),
      entertainment: t("amenityLabels.entertainment"),
      gps: t("amenityLabels.gps"),
      first_aid: t("amenityLabels.firstAid"),
      reading_lights: t("amenityLabels.readingLights"),
      luggage_space: t("amenityLabels.luggageSpace"),
      water: t("amenityLabels.water"),
    };
    return map[amenityId] ?? fallback;
  };

  const formatDate = (date: string | Date, variant: "short" | "long") => {
    const d = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return t("specs.notAvailable");
    return d.toLocaleDateString(locale, {
      short: { year: "numeric", month: "short", day: "numeric" },
      long: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
    }[variant] as Intl.DateTimeFormatOptions);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);

  // ── State ─────────────────────────────────────────────────────────────────

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: {},
  });
  const [availability, setAvailability] =
    useState<VehicleAvailability | null>(null);
  const [similarVehicles, setSimilarVehicles] = useState<SimilarVehicle[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Vehicle is critical — fail fast if it errors
      const vehicleRes = await vehicleService.getById(vehicleId);
      const vehicleData = (vehicleRes as any);
      const v: Vehicle =
        vehicleData.data?.vehicle ?? vehicleData.vehicle ?? vehicleData;

      if (!v?.id) throw new Error(t("errors.invalidVehicleData"));
      setVehicle(v);

      // Non-critical data fetched in parallel; individual failures degrade gracefully
      const [reviewsResult, availabilityResult, similarResult] =
        await Promise.allSettled([
          reviewService.getByVehicle(vehicleId),
          vehicleService.getAvailability(vehicleId),
          vehicleService.getSimilarVehicles(vehicleId, 4),
        ]);

      if (reviewsResult.status === "fulfilled") {
        const rd = reviewsResult.value;
        setReviews(rd.reviews ?? []);
        if (rd.stats) {
          setReviewStats({
            averageRating: rd.stats.averageRating,
            totalReviews: rd.stats.totalReviews,
            ratingDistribution: rd.stats.ratingDistribution,
          });
        }
      }

      if (availabilityResult.status === "fulfilled") {
        setAvailability(availabilityResult.value as VehicleAvailability);
      }

      if (similarResult.status === "fulfilled") {
        setSimilarVehicles(
          (similarResult.value.vehicles ?? []) as SimilarVehicle[],
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("errors.fetchVehicle"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId]); // eslint-disable-line

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Lightbox keyboard navigation ─────────────────────────────────────────

  useEffect(() => {
    if (!showLightbox || !vehicle) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLightbox(false);
      if (e.key === "ArrowRight")
        setSelectedImage((i) => (i + 1) % vehicle.images.length);
      if (e.key === "ArrowLeft")
        setSelectedImage(
          (i) => (i - 1 + vehicle.images.length) % vehicle.images.length,
        );
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showLightbox, vehicle]);

  const handleRequestQuotation = () => {
    router.push(
      `/${locale}/dashboard/quotations/new?vehicleId=${vehicleId}`,
    );
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Gallery skeleton */}
        <div className="bg-foreground py-8">
          <div className="mx-auto max-w-[1280px] px-4">
            <Skeleton className="mb-4 h-5 w-32 rounded-lg bg-white/10" />
            <Skeleton
              variant="rectangular"
              className="h-80 w-full rounded-[20px] bg-white/10 md:h-[460px]"
            />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="mx-auto max-w-[1280px] px-4 py-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Skeleton className="h-48 w-full rounded-[20px]" />
              <Skeleton className="h-36 w-full rounded-[20px]" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full rounded-[20px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (error || !vehicle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="mb-4 text-error">{error ?? t("errors.notFound")}</p>
            <Button onClick={() => router.back()} variant="outline">
              {t("actions.goBack")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  // API returns photos as objects; images[] may be empty — merge both sources
  const fromPhotos = vehicle.photos?.map((p) => p.url) ?? [];
  const fromImages = vehicle.images ?? [];
  const images = [...new Set([...fromPhotos, ...fromImages])];

  const availabilityPeriods = availability
    ? [
        ...availability.booked.map((item) => ({
          id: item.id,
          startDate: item.startDate,
          endDate: item.endDate,
          type: "booked" as const,
          label: t("availability.status.booked"),
        })),
        ...availability.blocked.map((item) => ({
          id: item.id,
          startDate: item.startDate,
          endDate: item.endDate,
          type: "blocked" as const,
          label: item.reason
            ? t("availability.status.blockedWithReason", {
                reason: item.reason,
              })
            : t("availability.status.blocked"),
        })),
      ].sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
    : [];

  const ownerDisplayName =
    vehicle.owner.businessName ??
    vehicle.owner.businessProfile?.businessName ??
    `${vehicle.owner.firstName} ${vehicle.owner.lastName}`;

  const isActionable = vehicle.isAvailable && vehicle.isActive;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-0">
      {/* ── Image Gallery ─────────────────────────────────────────────── */}
      <section className="bg-foreground pb-6 pt-8">
        <div className="mx-auto max-w-[1280px] px-4">
          {/* Back link */}
          <Link
            href={`/${locale}${isDashboard ? "/dashboard/search" : "/search"}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("actions.backToSearch")}
          </Link>

          {/* Main image */}
          {images.length > 0 ? (
            <>
              <div
                className="relative aspect-video max-h-[500px] w-full overflow-hidden rounded-[20px] cursor-pointer"
                onClick={() => setShowLightbox(true)}
              >
                <Image
                  src={images[selectedImage]}
                  alt={`${vehicle.name} — photo ${selectedImage + 1}`}
                  fill
                  priority
                  className="object-cover transition-opacity hover:opacity-90"
                  sizes="(max-width: 1280px) 100vw, 1280px"
                />
                {/* Photo count badge */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
                    {selectedImage + 1} / {images.length}
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      aria-label={`View photo ${index + 1} of ${images.length}`}
                      aria-current={selectedImage === index ? "true" : undefined}
                      className={cn(
                        "relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                        selectedImage === index
                          ? "border-primary opacity-100"
                          : "border-transparent opacity-50 hover:opacity-80",
                      )}
                    >
                      <Image
                        src={img}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex aspect-video max-h-[400px] w-full items-center justify-center rounded-[20px] bg-white/5">
              <div className="flex flex-col items-center gap-3 text-white/40">
                <Car className="h-20 w-20" />
                <p className="text-sm">{t("empty.noImages")}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <section className="py-8">
        <div className="mx-auto max-w-[1280px] px-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ── Left column ───────────────────────────────────────── */}
            <div className="space-y-6 lg:col-span-2">
              {/* Vehicle overview */}
              <Card>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        {vehicle.name}
                      </h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {vehicle.brand} {vehicle.model}
                        {vehicle.year ? ` · ${vehicle.year}` : ""}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {localizePlace(vehicle.location)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {vehicle.isAvailable && vehicle.isActive && (
                        <Badge variant="success">{t("status.available")}</Badge>
                      )}
                      {vehicle.owner.isVerified && (
                        <Badge variant="success" className="text-xs">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          {t("status.verified")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Rating strip */}
                  {reviewStats.totalReviews > 0 && (
                    <div className="flex items-center gap-3 border-y border-border py-3">
                      <div className="flex items-center gap-1.5">
                        <Star className="h-5 w-5 fill-primary text-primary" />
                        <span className="text-lg font-bold text-foreground">
                          {reviewStats.averageRating.toFixed(1)}
                        </span>
                      </div>
                      <StarRating rating={reviewStats.averageRating} />
                      <span className="text-sm text-muted-foreground">
                        {t("reviewsCount", {
                          count: reviewStats.totalReviews,
                        })}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono text-sm text-muted-foreground">
                        {vehicle.licensePlate}
                      </span>
                    </div>
                  )}

                  {/* Key specs grid */}
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      {
                        icon: <Users className="h-5 w-5" />,
                        label: t("specs.capacity"),
                        value: t("specs.seatsCount", { count: vehicle.seats }),
                      },
                      {
                        icon: <Snowflake className="h-5 w-5" />,
                        label: t("specs.acType"),
                        value: vehicle.acType
                          ? localizeAcType(vehicle.acType)
                          : t("specs.notAvailable"),
                      },
                      {
                        icon: <Car className="h-5 w-5" />,
                        label: t("specs.type"),
                        value: localizeVehicleType(vehicle.type),
                      },
                      {
                        icon: <ShieldCheck className="h-5 w-5" />,
                        label: t("specs.condition"),
                        value: vehicle.condition
                          ? localizeCondition(vehicle.condition)
                          : t("valueLabels.condition.good"),
                      },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="mt-0.5 text-muted-foreground">
                          {icon}
                        </span>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {label}
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              {vehicle.description && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">
                      {t("sections.description")}
                    </h2>
                    <p className="max-w-prose leading-relaxed text-muted-foreground">
                      {vehicle.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Detailed specifications */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("sections.specifications")}
                  </h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      { label: t("specs.brand"), value: vehicle.brand },
                      { label: t("specs.model"), value: vehicle.model },
                      {
                        label: t("specs.year"),
                        value: vehicle.year?.toString(),
                      },
                      {
                        label: t("specs.color"),
                        value: vehicle.color
                          ? humanizeEnum(vehicle.color)
                          : undefined,
                      },
                      {
                        label: t("specs.fuelType"),
                        value: vehicle.fuelType
                          ? humanizeEnum(vehicle.fuelType)
                          : undefined,
                      },
                      {
                        label: t("specs.transmission"),
                        value: vehicle.transmission
                          ? humanizeEnum(vehicle.transmission)
                          : undefined,
                      },
                      {
                        label: t("specs.seatingCapacity"),
                        value: t("specs.passengersCount", {
                          count: vehicle.seats,
                        }),
                      },
                      {
                        label: t("specs.acType"),
                        value: vehicle.acType
                          ? localizeAcType(vehicle.acType)
                          : undefined,
                      },
                    ]
                      .filter(({ value }) => value)
                      .map(({ label, value }) => (
                        <div
                          key={label}
                          className="border-b border-border pb-2"
                        >
                          <dt className="text-xs text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="mt-0.5 text-sm font-medium text-foreground">
                            {value}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </CardContent>
              </Card>

              {/* Amenities */}
              {vehicle.amenities && vehicle.amenities.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">
                      {t("sections.amenities")}
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {vehicle.amenities.map((amenityId) => {
                        const amenity = VEHICLE_AMENITIES.find(
                          (a) => a.id === amenityId,
                        );
                        return amenity ? (
                          <div
                            key={amenityId}
                            className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2"
                          >
                            <CheckCircle className="h-4 w-4 flex-shrink-0 text-success" />
                            <span className="text-sm text-foreground">
                              {localizeAmenityLabel(amenityId, amenity.label)}
                            </span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reviews */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("reviewsTitle", { count: reviewStats.totalReviews })}
                  </h2>

                  {reviews.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                      {t("empty.noReviews")}
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {/* Rating summary */}
                      <div className="rounded-xl bg-muted p-4">
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-4xl font-bold text-foreground">
                              {reviewStats.averageRating.toFixed(1)}
                            </p>
                            <StarRating
                              rating={reviewStats.averageRating}
                              className="mt-1"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("reviewsCount", {
                                count: reviewStats.totalReviews,
                              })}
                            </p>
                          </div>

                          {/* Distribution bars */}
                          <div className="flex-1 space-y-1.5">
                            {[5, 4, 3, 2, 1].map((star) => {
                              const count =
                                reviewStats.ratingDistribution[star] ?? 0;
                              const pct =
                                reviewStats.totalReviews > 0
                                  ? Math.round(
                                      (count / reviewStats.totalReviews) * 100,
                                    )
                                  : 0;
                              return (
                                <div
                                  key={star}
                                  className="flex items-center gap-2"
                                >
                                  <span className="w-4 text-right text-xs text-muted-foreground">
                                    {star}
                                  </span>
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="w-8 text-xs text-muted-foreground">
                                    {pct}%
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Review cards */}
                      <div className="space-y-5">
                        {reviews.slice(0, 5).map((review) => (
                          <div
                            key={review.id}
                            className="border-b border-border pb-5 last:border-0 last:pb-0"
                          >
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-foreground">
                                  {review.customerName ||
                                    t("reviews.anonymous")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(review.createdAt, "long")}
                                </p>
                              </div>
                              <StarRating rating={review.rating} size="sm" />
                            </div>

                            {review.title && (
                              <p className="mb-1 text-sm font-medium text-foreground">
                                {review.title}
                              </p>
                            )}

                            {review.comment && (
                              <p className="text-sm leading-relaxed text-muted-foreground">
                                {review.comment}
                              </p>
                            )}

                            {review.isRecommended && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-success">
                                <ThumbsUp className="h-3 w-3" />
                                <span>Recommends this vehicle</span>
                              </div>
                            )}

                            {/* Owner response */}
                            {review.ownerResponse && (
                              <div className="mt-3 rounded-xl border border-border bg-muted/50 p-3">
                                <p className="mb-1 text-xs font-semibold text-foreground">
                                  Owner response
                                </p>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {review.ownerResponse}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {reviewStats.totalReviews > 5 && (
                        <Button variant="outline" className="w-full">
                          {t("actions.viewAllReviews")}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Similar vehicles */}
              {similarVehicles.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">
                      {t("sections.similarVehicles")}
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {similarVehicles.map((sv) => {
                        const imgUrl = getVehicleImageUrl(sv);
                        return (
                          <Link
                            key={sv.id}
                            href={`/${locale}${isDashboard ? "/dashboard" : ""}/vehicles/${sv.id}`}
                            className="group overflow-hidden rounded-[20px] border border-border transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="relative aspect-video w-full overflow-hidden bg-muted">
                              {imgUrl ? (
                                <Image
                                  src={imgUrl}
                                  alt={sv.name}
                                  fill
                                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                                  sizes="(max-width: 640px) 100vw, 50vw"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                  <Car className="h-8 w-8" />
                                </div>
                              )}
                            </div>
                            <div className="space-y-1 p-4">
                              <p className="line-clamp-1 font-semibold text-foreground">
                                {sv.name}
                              </p>
                              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="line-clamp-1">
                                  {localizePlace(sv.location)}
                                </span>
                              </p>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t("specs.seatsCount", { count: sv.seats })}
                                </span>
                                <span className="font-semibold text-primary">
                                  {formatCurrency(sv.pricePerDay)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Right column ──────────────────────────────────────── */}
            <div className="space-y-6">
              {/* Pricing card */}
              <Card className="lg:top-24">
                <CardContent className="p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("sections.pricing")}
                  </h2>

                  {/* Primary price */}
                  <div className="mb-4 rounded-xl bg-primary/10 p-4">
                    <p className="text-xs text-muted-foreground">
                      {t("pricing.basePrice")}
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      {formatCurrency(vehicle.pricePerDay)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tCommon("perDay")}
                    </p>
                  </div>

                  {/* Additional rates */}
                  <div className="space-y-2 mb-4">
                    {vehicle.pricePerKm && (
                      <div className="flex justify-between border-b border-border py-2 text-sm">
                        <span className="text-muted-foreground">
                          {t("pricing.pricePerKm")}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(vehicle.pricePerKm)}{" "}
                          {tCommon("perKm")}
                        </span>
                      </div>
                    )}
                    {vehicle.pricePerHour && (
                      <div className="flex justify-between border-b border-border py-2 text-sm">
                        <span className="text-muted-foreground">
                          {t("pricing.pricePerHour")}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(vehicle.pricePerHour)}
                        </span>
                      </div>
                    )}
                    {vehicle.driverAllowance && (
                      <div className="flex justify-between border-b border-border py-2 text-sm">
                        <span className="text-muted-foreground">
                          {t("pricing.driverAllowance")}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(vehicle.driverAllowance)}{" "}
                          {tCommon("perDay")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Pricing note */}
                  <div className="mb-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                    <p className="mb-1 font-medium">{t("pricing.noteTitle")}</p>
                    <ul className="list-inside list-disc space-y-0.5">
                      <li>{t("pricing.notes.tripDuration")}</li>
                      <li>{t("pricing.notes.distanceTraveled")}</li>
                      <li>{t("pricing.notes.fuelCosts")}</li>
                      <li>{t("pricing.notes.tollCharges")}</li>
                      <li>{t("pricing.notes.permitFees")}</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleRequestQuotation}
                    size="lg"
                    className="w-full gap-2"
                    disabled={!isActionable}
                  >
                    <Calendar className="h-5 w-5" />
                    {t("actions.requestQuotation")}
                  </Button>

                  {!isActionable && (
                    <p className="mt-2 text-center text-xs text-error">
                      {t("status.unavailable")}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Owner card */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("sections.ownerInfo")}
                  </h2>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.owner.businessName ||
                        vehicle.owner.businessProfile?.businessName
                          ? t("owner.businessName")
                          : t("owner.label")}
                      </p>
                      <p className="font-semibold text-foreground">
                        {ownerDisplayName}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("owner.baseLocation")}
                      </p>
                      <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        {localizePlace(
                          vehicle.owner.baseLocation ?? vehicle.location,
                        )}
                      </p>
                    </div>

                    {reviewStats.totalReviews > 0 && (
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">
                          {t("owner.rating")}
                        </p>
                        <div className="flex items-center gap-2">
                          <StarRating rating={reviewStats.averageRating} />
                          <span className="text-xs text-muted-foreground">
                            (
                            {t("reviewsCount", {
                              count: reviewStats.totalReviews,
                            })}
                            )
                          </span>
                        </div>
                      </div>
                    )}

                    {/* {vehicle.owner.phone && (
                      <a
                        href={`tel:${vehicle.owner.phone}`}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 h-11 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Call ${ownerDisplayName}`}
                      >
                        <Phone className="h-4 w-4" />
                        {t("actions.contactOwner")}
                      </a>
                    )} */}
                  </div>
                </CardContent>
              </Card>

              {/* Availability card */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("sections.availability")}
                  </h2>

                  {availabilityPeriods.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-auto pr-1">
                      {availabilityPeriods.map((period) => (
                        <div
                          key={period.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"
                        >
                          <span
                            className={cn(
                              "text-xs font-semibold uppercase tracking-wide",
                              period.type === "booked"
                                ? "text-error"
                                : "text-muted-foreground",
                            )}
                          >
                            {period.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(period.startDate, "short")} —{" "}
                            {formatDate(period.endDate, "short")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-muted p-4 text-center">
                      <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {availability
                          ? t("availability.noBlockedDates")
                          : t("availability.note")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sticky mobile action bar ──────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-4 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("pricing.startingFrom")}
            </p>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(vehicle.pricePerDay)}
            </p>
          </div>
          <Button
            onClick={handleRequestQuotation}
            size="lg"
            disabled={!isActionable}
            className="gap-2"
          >
            <Calendar className="h-5 w-5" />
            {t("actions.requestQuotation")}
          </Button>
        </div>
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────── */}
      {showLightbox && images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${vehicle.name} photo gallery`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setShowLightbox(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowLightbox(false)}
            aria-label="Close gallery"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Image */}
          <div
            className="relative max-h-[85vh] max-w-[90vw] w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[selectedImage]}
              alt={`${vehicle.name} — photo ${selectedImage + 1} of ${images.length}`}
              fill
              className="object-contain"
              sizes="90vw"
            />
          </div>

          {/* Prev / Next arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(
                    (i) => (i - 1 + images.length) % images.length,
                  );
                }}
                aria-label="Previous photo"
                className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage((i) => (i + 1) % images.length);
                }}
                aria-label="Next photo"
                className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Dot indicators */}
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(index);
                    }}
                    aria-label={`Go to photo ${index + 1}`}
                    aria-current={selectedImage === index ? "true" : undefined}
                    className={cn(
                      "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                      selectedImage === index
                        ? "w-6 bg-white"
                        : "w-2 bg-white/40 hover:bg-white/60",
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
