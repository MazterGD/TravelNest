"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FaStar,
  FaUsers,
  FaSnowflake,
  FaMapMarkerAlt,
  FaCar,
  FaCalendarAlt,
  FaShieldAlt,
  FaPhone,
  FaCheckCircle,
} from "react-icons/fa";
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
import { formatDate } from "@/lib/utils/formatters";
import { VEHICLE_AMENITIES } from "@/constants";

interface VehicleDetailsPageContentProps {
  locale: string;
  vehicleId: string;
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

export default function VehicleDetailsPageContent({
  locale,
  vehicleId,
}: VehicleDetailsPageContentProps) {
  const t = useTranslations("vehicle");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

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
    return new Intl.NumberFormat("en-LK", {
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
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-muted rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
              <p className="text-destructive">{error || "Vehicle not found"}</p>
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

  return (
    <div className="min-h-screen bg-background">
      {/* Image Gallery */}
      <section className="bg-black">
        <div className="container mx-auto px-4 py-8">
          <Link
            href={`/${locale}/search`}
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
                <FaCar className="h-32 w-32 text-gray-600 mb-4" />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                        <FaMapMarkerAlt className="inline mr-1" />
                        {vehicle.location}
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
                      <FaStar className="h-5 w-5 text-accent mr-2" />
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
                      <FaUsers className="h-5 w-5 text-muted-foreground" />
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
                      <FaSnowflake className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("specs.acType")}
                        </p>
                        <p className="font-semibold">
                          {vehicle.acType || t("specs.notAvailable")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaCar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("specs.type")}
                        </p>
                        <p className="font-semibold capitalize">
                          {vehicle.type.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaShieldAlt className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("specs.condition")}
                        </p>
                        <p className="font-semibold capitalize">
                          {vehicle.condition || t("specs.good")}
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
                      <p className="font-semibold">{vehicle.acType}</p>
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
                            <FaCheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm">{amenity.label}</span>
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
                                {formatDate(review.createdAt, "long")}
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
            </div>

            {/* Right Column - Pricing & Owner Info */}
            <div className="space-y-6">
              {/* Pricing Card */}
              <Card className="sticky top-4">
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
                          {formatCurrency(vehicle.driverAllowance)}/day
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
                      <FaCalendarAlt className="mr-2" />
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
                        <FaCheckCircle className="mr-1" />
                        {t("status.verified")}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    {vehicle.owner.businessProfile?.businessName ? (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("owner.businessName")}
                        </p>
                        <p className="font-semibold">
                          {vehicle.owner.businessProfile.businessName}
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
                        <FaMapMarkerAlt className="inline mr-1" />
                        {vehicle.location}
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
                      <FaPhone className="mr-2" />
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
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <FaCalendarAlt className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t("availability.note")}
                    </p>
                  </div>
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
