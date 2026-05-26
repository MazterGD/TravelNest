"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  Users,
  Snowflake,
  MapPin,
  Car,
  Calendar,
  ShieldCheck,
  Phone,
  CheckCircle,
} from "lucide-react";
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  Badge,
  StarRating,
} from "@/components/ui";
import { vehicleService, reviewService, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils/cn";
import { VEHICLE_AMENITIES } from "@/constants";
import { localizePlaceName } from "@/lib/i18n/placeName";

interface VehicleDetailsPageContentProps {
  locale: string;
  vehicleId: string;
  isDashboard?: boolean;
}

interface Vehicle {
  id: string;
  name: string;
  description: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  color: string;
  seats: number;
  fuelType: string;
  transmission: string;
  acType: string;
  condition: string;
  features: any;
  amenities: string[];
  images: string[];
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
    phone: string;
    email: string;
    isVerified: boolean;
    businessName?: string | null;
    baseLocation?: string | null;
    businessProfile?: {
      businessName: string;
    };
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  customer?: {
    firstName: string;
    lastName: string;
  };
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
  images: string[];
  photos?: Array<{ url: string }>;
  averageRating?: number;
  reviewCount?: number;
}

export default function VehicleDetailsPageContent({
  locale,
  vehicleId,
  isDashboard,
}: VehicleDetailsPageContentProps) {
  const t = useTranslations("vehicle");
  const tCommon = useTranslations("common");
  const tLocations = useTranslations("locations");
  const router = useRouter();

  const getLocalizedPlace = (placeName: string) =>
    localizePlaceName(placeName, (key) => tLocations(key));

  const normalizeEnumValue = (value: string) =>
    value.toUpperCase().replace(/[- ]/g, "_");

  const humanizeEnumValue = (value: string) =>
    value
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const getLocalizedVehicleType = (value: string) => {
    switch (normalizeEnumValue(value)) {
      case "ORDINARY":
        return t("valueLabels.vehicleType.ordinary");
      case "SEMI_LUXURY":
        return t("valueLabels.vehicleType.semiLuxury");
      case "LUXURY_AC":
        return t("valueLabels.vehicleType.luxuryAc");
      default:
        return humanizeEnumValue(value);
    }
  };

  const getLocalizedAcType = (value: string) => {
    switch (normalizeEnumValue(value)) {
      case "FULL_AC":
        return t("valueLabels.acType.fullAc");
      case "AC":
        return t("valueLabels.acType.ac");
      case "NON_AC":
        return t("valueLabels.acType.nonAc");
      default:
        return humanizeEnumValue(value);
    }
  };

  const getLocalizedCondition = (value: string) => {
    switch (normalizeEnumValue(value)) {
      case "EXCELLENT":
        return t("valueLabels.condition.excellent");
      case "GOOD":
        return t("valueLabels.condition.good");
      case "FAIR":
        return t("valueLabels.condition.fair");
      default:
        return humanizeEnumValue(value);
    }
  };

  const formatLocalizedDate = (
    date: Date | string,
    variant: "short" | "long",
  ) => {
    const parsedDate = typeof date === "string" ? new Date(date) : date;

    if (Number.isNaN(parsedDate.getTime())) {
      return t("specs.notAvailable");
    }

    const options: Record<"short" | "long", Intl.DateTimeFormatOptions> = {
      short: {
        year: "numeric",
        month: "short",
        day: "numeric",
      },
      long: {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    };

    return parsedDate.toLocaleDateString(locale, options[variant]);
  };

  const getLocalizedAmenityLabel = (
    amenityId: string,
    fallbackLabel: string,
  ) => {
    switch (amenityId) {
      case "wifi":
        return t("amenityLabels.wifi");
      case "usb_charging":
        return t("amenityLabels.usbCharging");
      case "ac":
        return t("amenityLabels.ac");
      case "reclining_seats":
        return t("amenityLabels.recliningSeats");
      case "entertainment":
        return t("amenityLabels.entertainment");
      case "gps":
        return t("amenityLabels.gps");
      case "first_aid":
        return t("amenityLabels.firstAid");
      case "reading_lights":
        return t("amenityLabels.readingLights");
      case "luggage_space":
        return t("amenityLabels.luggageSpace");
      case "water":
        return t("amenityLabels.water");
      default:
        return fallbackLabel;
    }
  };

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [availability, setAvailability] = useState<VehicleAvailability | null>(
    null,
  );
  const [similarVehicles, setSimilarVehicles] = useState<SimilarVehicle[]>([]);

  useEffect(() => {
    fetchVehicleDetails();
  }, [vehicleId]);

  const fetchVehicleDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch vehicle details
      const vehicleResponse = await vehicleService.getById(vehicleId);
      const vehicleData = vehicleResponse as any;
      const v = vehicleData.data?.vehicle || vehicleData.vehicle || vehicleData;

      if (!v || !v.id) {
        throw new Error(t("errors.invalidVehicleData"));
      }

      // Ensure images array exists and has at least a placeholder
      if (!v.images || v.images.length === 0) {
        v.images = [
          "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800",
        ];
      }

      setVehicle(v);

      // Fetch reviews
      try {
        const reviewsResponse = await reviewService.getByVehicle(vehicleId);
        const reviewsData = reviewsResponse as any;
        setReviews(reviewsData.reviews || []);
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
        setReviews([]);
      }

      try {
        const [availabilityResponse, similarResponse] = await Promise.all([
          vehicleService.getAvailability(vehicleId),
          vehicleService.getSimilarVehicles(vehicleId, 4),
        ]);

        setAvailability(availabilityResponse as VehicleAvailability);
        setSimilarVehicles(
          (similarResponse.vehicles || []) as SimilarVehicle[],
        );
      } catch (err) {
        console.error(
          "Failed to fetch vehicle recommendations/availability:",
          err,
        );
        setAvailability(null);
        setSimilarVehicles([]);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("errors.fetchVehicle"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAverageRating = (): number => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return parseFloat((sum / reviews.length).toFixed(1));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleRequestQuotation = () => {
    router.push(`/${locale}/dashboard/quotations/new?vehicleId=${vehicleId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse bg-muted rounded-xl space-y-8">
            <div className="h-96 bg-muted rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-64 bg-muted rounded-lg" />
                <div className="h-48 bg-muted rounded-lg" />
              </div>
              <div className="space-y-6">
                <div className="h-64 bg-muted rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-destructive">
                {error || t("errors.notFound")}
              </p>
              <Button onClick={() => router.back()} className="mt-4">
                {t("actions.goBack")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const avgRating = calculateAverageRating();
  const availabilityMonthLabel = availability
    ? new Date(`${availability.month}-01T00:00:00`).toLocaleString(locale, {
        month: "long",
        year: "numeric",
      })
    : null;

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

  const getSimilarVehicleImage = (similarVehicle: SimilarVehicle) => {
    if (similarVehicle.images?.length) {
      return similarVehicle.images[0];
    }

    if (similarVehicle.photos?.length) {
      return similarVehicle.photos[0].url;
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Image Gallery */}
      <section className="bg-black">
        <div className="container mx-auto px-4 py-8">
          <Link
            href={`/${locale}${isDashboard ? '/dashboard/search' : '/search'}`}
            className="inline-flex items-center text-sm text-white/70 hover:text-white mb-4"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t("actions.backToSearch")}
          </Link>

          {/* Main Image */}
          <div className="relative h-96 md:h-[500px] bg-gray-900 rounded-lg overflow-hidden">
            {vehicle.images && vehicle.images.length > 0 ? (
              <img
                src={vehicle.images[selectedImage]}
                alt={vehicle.name}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setShowLightbox(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <Car className="h-32 w-32 text-gray-600 mb-4" />
                <p className="text-gray-400 text-sm">{t("empty.noImages")}</p>
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {vehicle.images.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto">
              {vehicle.images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={cn(
                    "flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                    selectedImage === index
                      ? "border-primary"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <img
                    src={img}
                    alt={`${vehicle.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Vehicle Overview Card */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground mb-2">
                        {vehicle.name}
                      </h1>
                      <p className="text-muted-foreground">
                        {vehicle.brand} {vehicle.model} • {vehicle.year}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        <MapPin className="inline mr-1" />
                        {getLocalizedPlace(vehicle.location)}
                      </p>
                    </div>
                    {vehicle.isAvailable && vehicle.isActive && (
                      <Badge variant="success" className="text-sm">
                        {t("status.available")}
                      </Badge>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-4 py-4 border-y border-border">
                    <div className="flex items-center">
                      <Star className="h-5 w-5 text-accent mr-2" />
                      <span className="text-lg font-semibold">{avgRating}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {t("reviewsCount", { count: reviews.length })}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {vehicle.licensePlate}
                    </span>
                  </div>

                  {/* Key Features */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("specs.capacity")}
                        </p>
                        <p className="font-semibold">
                          {t("specs.seatsCount", { count: vehicle.seats })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("specs.acType")}
                        </p>
                        <p className="font-semibold">
                          {vehicle.acType
                            ? getLocalizedAcType(vehicle.acType)
                            : t("specs.notAvailable")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("specs.type")}
                        </p>
                        <p className="font-semibold capitalize">
                          {getLocalizedVehicleType(vehicle.type)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("specs.condition")}
                        </p>
                        <p className="font-semibold capitalize">
                          {vehicle.condition
                            ? getLocalizedCondition(vehicle.condition)
                            : t("valueLabels.condition.good")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              {vehicle.description && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold mb-4">
                      {t("sections.description")}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {vehicle.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Specifications */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">
                    {t("sections.specifications")}
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border-b border-border pb-3">
                      <p className="text-sm text-muted-foreground">
                        {t("specs.brand")}
                      </p>
                      <p className="font-semibold">{vehicle.brand}</p>
                    </div>
                    <div className="border-b border-border pb-3">
                      <p className="text-sm text-muted-foreground">
                        {t("specs.model")}
                      </p>
                      <p className="font-semibold">{vehicle.model}</p>
                    </div>
                    <div className="border-b border-border pb-3">
                      <p className="text-sm text-muted-foreground">
                        {t("specs.year")}
                      </p>
                      <p className="font-semibold">{vehicle.year}</p>
                    </div>
                    <div className="border-b border-border pb-3">
                      <p className="text-sm text-muted-foreground">
                        {t("specs.color")}
                      </p>
                      <p className="font-semibold capitalize">
                        {vehicle.color}
                      </p>
                    </div>
                    <div className="border-b border-border pb-3">
                      <p className="text-sm text-muted-foreground">
                        {t("specs.fuelType")}
                      </p>
                      <p className="font-semibold capitalize">
                        {vehicle.fuelType}
                      </p>
                    </div>
                    <div className="border-b border-border pb-3">
                      <p className="text-sm text-muted-foreground">
                        {t("specs.transmission")}
                      </p>
                      <p className="font-semibold capitalize">
                        {vehicle.transmission}
                      </p>
                    </div>
                    <div className="border-b border-border pb-3">
                      <p className="text-sm text-muted-foreground">
                        {t("specs.seatingCapacity")}
                      </p>
                      <p className="font-semibold">
                        {t("specs.passengersCount", { count: vehicle.seats })}
                      </p>
                    </div>
                    <div className="border-b border-border pb-3">
                      <p className="text-sm text-muted-foreground">
                        {t("specs.acType")}
                      </p>
                      <p className="font-semibold">
                        {vehicle.acType
                          ? getLocalizedAcType(vehicle.acType)
                          : t("specs.notAvailable")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Amenities */}
              {vehicle.amenities && vehicle.amenities.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold mb-4">
                      {t("sections.amenities")}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {vehicle.amenities.map((amenityId) => {
                        const amenity = VEHICLE_AMENITIES.find(
                          (a) => a.id === amenityId,
                        );
                        return amenity ? (
                          <div
                            key={amenityId}
                            className="flex items-center gap-2"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm">
                              {getLocalizedAmenityLabel(
                                amenityId,
                                amenity.label,
                              )}
                            </span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reviews Section */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">
                    {t("reviewsTitle", { count: reviews.length })}
                  </h2>

                  {reviews.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {t("empty.noReviews")}
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {/* Rating Breakdown */}
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-center">
                          <p className="text-4xl font-bold">
                            {avgRating.toFixed(1)}
                          </p>
                          <StarRating rating={avgRating} />
                          <p className="text-sm text-muted-foreground mt-1">
                            {t("reviewsCount", { count: reviews.length })}
                          </p>
                        </div>
                      </div>

                      {/* Review Cards */}
                      {reviews.slice(0, 5).map((review) => (
                        <div
                          key={review.id}
                          className="border-b border-border pb-4 last:border-0"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold">
                                {review.customer?.firstName ||
                                  t("reviews.anonymous")}{" "}
                                {review.customer?.lastName || ""}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatLocalizedDate(review.createdAt, "long")}
                              </p>
                            </div>
                            <StarRating rating={review.rating} size="sm" />
                          </div>
                          <p className="text-muted-foreground">
                            {review.comment}
                          </p>
                        </div>
                      ))}

                      {reviews.length > 5 && (
                        <Button variant="outline" className="w-full">
                          {t("actions.viewAllReviews")}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Similar Vehicles */}
              {similarVehicles.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold mb-4">
                      {t("sections.similarVehicles")}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {similarVehicles.map((similarVehicle) => {
                        const imageUrl = getSimilarVehicleImage(similarVehicle);

                        return (
                          <Link
                            key={similarVehicle.id}
                            href={`/${locale}${isDashboard ? '/dashboard' : ''}/vehicles/${similarVehicle.id}`}
                            className="border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                          >
                            <div className="h-36 bg-muted">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={similarVehicle.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <Car className="h-8 w-8" />
                                </div>
                              )}
                            </div>
                            <div className="p-4 space-y-2">
                              <p className="font-semibold line-clamp-1">
                                {similarVehicle.name}
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                <MapPin className="inline h-4 w-4 mr-1" />
                                {getLocalizedPlace(similarVehicle.location)}
                              </p>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t("specs.seatsCount", {
                                    count: similarVehicle.seats,
                                  })}
                                </span>
                                <span className="font-semibold text-primary">
                                  {formatCurrency(similarVehicle.pricePerDay)}
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

            {/* Right Column - Pricing & Owner Info */}
            <div className="space-y-6">
              {/* Pricing Card */}
              <Card className="top-4">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">
                    {t("sections.pricing")}
                  </h2>

                  <div className="space-y-4">
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        {t("pricing.basePrice")}
                      </p>
                      <p className="text-3xl font-bold text-primary">
                        {formatCurrency(vehicle.pricePerDay)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {tCommon("perDay")}
                      </p>
                    </div>

                    {vehicle.pricePerKm && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">
                          {t("pricing.pricePerKm")}
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(vehicle.pricePerKm)}
                        </span>
                      </div>
                    )}

                    {vehicle.pricePerHour && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">
                          {t("pricing.pricePerHour")}
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(vehicle.pricePerHour)}
                        </span>
                      </div>
                    )}

                    {vehicle.driverAllowance && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">
                          {t("pricing.driverAllowance")}
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(vehicle.driverAllowance)}{" "}
                          {tCommon("perDay")}
                        </span>
                      </div>
                    )}

                    <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
                      <p className="mb-2">{t("pricing.noteTitle")}</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
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
                      className="w-full"
                      disabled={!vehicle.isAvailable || !vehicle.isActive}
                    >
                      <Calendar className="mr-2" />
                      {t("actions.requestQuotation")}
                    </Button>

                    {(!vehicle.isAvailable || !vehicle.isActive) && (
                      <p className="text-sm text-destructive text-center">
                        {t("status.unavailable")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Owner Information Card */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">
                      {t("sections.ownerInfo")}
                    </h2>
                    {vehicle.owner.isVerified && (
                      <Badge variant="success" className="text-xs">
                        <CheckCircle className="mr-1" />
                        {t("status.verified")}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    {vehicle.owner.businessName ||
                    vehicle.owner.businessProfile?.businessName ? (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("owner.businessName")}
                        </p>
                        <p className="font-semibold">
                          {vehicle.owner.businessName ||
                            vehicle.owner.businessProfile?.businessName}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("owner.label")}
                        </p>
                        <p className="font-semibold">
                          {vehicle.owner.firstName} {vehicle.owner.lastName}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("owner.baseLocation")}
                      </p>
                      <p className="font-semibold">
                        <MapPin className="inline mr-1" />
                        {getLocalizedPlace(
                          vehicle.owner.baseLocation || vehicle.location,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t("owner.rating")}
                      </p>
                      <div className="flex items-center gap-2">
                        <StarRating rating={avgRating} />
                        <span className="text-sm text-muted-foreground">
                          ({t("reviewsCount", { count: reviews.length })})
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(`tel:${vehicle.owner.phone}`)}
                    >
                      <Phone className="mr-2" />
                      {t("actions.contactOwner")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Availability Calendar - Placeholder */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">
                    {t("sections.availability")}
                  </h2>

                  {availability ? (
                    <div className="space-y-3">
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {availabilityMonthLabel ||
                            t("availability.currentMonth")}
                        </p>
                        <p className="text-sm">
                          {t("availability.bookedBlocked", {
                            booked: availability.booked.length,
                            blocked: availability.blocked.length,
                          })}
                        </p>
                      </div>

                      {availabilityPeriods.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-auto pr-1">
                          {availabilityPeriods.slice(0, 6).map((period) => (
                            <div
                              key={period.id}
                              className="border border-border rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={cn(
                                    "text-xs font-semibold uppercase tracking-wide",
                                    period.type === "booked"
                                      ? "text-amber-600"
                                      : "text-rose-600",
                                  )}
                                >
                                  {period.label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatLocalizedDate(
                                    period.startDate,
                                    "short",
                                  )}{" "}
                                  -{" "}
                                  {formatLocalizedDate(period.endDate, "short")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-muted p-4 rounded-lg text-center">
                          <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {t("availability.noBlockedDates")}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted p-4 rounded-lg text-center">
                      <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t("availability.note")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Action Bar (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 lg:hidden z-50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("pricing.startingFrom")}
            </p>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(vehicle.pricePerDay)}
            </p>
          </div>
          <Button
            onClick={handleRequestQuotation}
            size="lg"
            disabled={!vehicle.isAvailable || !vehicle.isActive}
          >
            {t("actions.requestQuotation")}
          </Button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {showLightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 text-white text-4xl"
          >
            ×
          </button>
          <img
            src={vehicle.images[selectedImage]}
            alt={vehicle.name}
            className="max-w-full max-h-full object-contain"
          />
          {vehicle.images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              {vehicle.images.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(index);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    selectedImage === index ? "bg-white" : "bg-white/50",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
