"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  LoadingSpinner,
  Button,
  Badge,
  Input,
  Select,
  TextArea
} from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import {
  bookingService,
  reviewService,
  disputeService,
  type DisputeType,
} from "@/lib/api/services";
import { ArrowLeft, MapPin, Calendar, Users, Star, Phone, XCircle, Download, ReceiptText, Map, MessageSquare, Check, Clock, CheckCircle2, CreditCard, UserCheck, PlayCircle, Flag, Ban } from 'lucide-react';
import dynamic from "next/dynamic";

const InteractiveMap = dynamic(
  () => import("@/components/ui/InteractiveMap"),
  { ssr: false, loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-lg flex items-center justify-center"><Map className="h-8 w-8 text-muted-foreground" /></div> }
);

const DISPUTE_TYPES = [
  "BOOKING_QUALITY_ISSUE",
  "CANCELLATION_DISPUTE",
  "PAYMENT_ISSUE",
  "VEHICLE_CONDITION",
  "BEHAVIOR_COMPLAINT",
  "SERVICE_NOT_PROVIDED",
  "OTHER",
] as const;

interface TimelineEvent {
  event:
    | "booking_created"
    | "booking_confirmed"
    | "payment_received"
    | "driver_assigned"
    | "trip_started"
    | "trip_completed"
    | "booking_cancelled";
  timestamp: string;
  description?: string;
}

interface BookingDetails {
  id: string;
  bookingRef: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
  vehicle: {
    id: string;
    name: string;
    registration: string;
    type: string;
    brand: string;
    model: string;
    year?: number;
    color?: string | null;
    capacity: number;
    image: string | null;
    images?: string[];
    amenities?: string[];
    features?: any;
    fuelType?: string | null;
    transmission?: string | null;
    acType?: string | null;
  };
  owner: {
    id: string;
    name: string;
    phone: string;
    email: string;
    avatar?: string | null;
    memberSince?: string;
    rating?: number;
    reviewCount?: number;
    completedTrips?: number;
  };
  trip: {
    startDate: string;
    endDate: string;
    startTime?: string | null;
    pickupLocation: string;
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    dropoffLocation: string;
    dropoffLatitude?: number | null;
    dropoffLongitude?: number | null;
    estimatedDistance?: string | null;
    estimatedDuration?: string | null;
    passengers: number;
    itineraryStops?: Array<{
      locationName: string;
      coordinates?: [number, number];
      lat?: number;
      lng?: number;
    }>;
    itineraryRoute?: any;
  };
  driver?: {
    name: string;
    phone: string | null;
    license: string | null;
  } | null;
  payment: {
    id: string | null;
    total: number;
    paid: number;
    status: string;
    method: string;
    receiptUrl: string | null;
    paidAt?: string | null;
    platformCommission: number;
    netAmount: number;
    breakdown?: {
      basePrice: number;
      driverAllowance: number;
      additionalCharges: number;
      subtotal?: number;
      tax?: number;
      customItems?: Array<{ description: string; amount: number }>;
    } | null;
  };
  timeline?: TimelineEvent[];
  status: string;
  notes?: string;
  cancelReason?: string;
  hasReview: boolean;
  review?: any;
  createdAt: string;
  updatedAt: string;
}

interface BookingDetailsContentProps {
  bookingId: string;
  locale: string;
}

export default function BookingDetailsContent({
  bookingId,
  locale,
}: BookingDetailsContentProps) {
  const router = useRouter();
  const { isLoading: guardLoading } = useProtectedRoute();
  const tMsg = useTranslations("messages");
  const t = useTranslations("customerBookingDetails");
  const tDispute = useTranslations("dispute");
  const bookingStatusMap: Record<string, string> = {
    pending: t("status.pending"),
    confirmed: t("status.confirmed"),
    in_progress: t("status.ongoing"),
    ongoing: t("status.ongoing"),
    completed: t("status.completed"),
    cancelled: t("status.cancelled"),
    disputed: t("status.disputed"),
  };
  const paymentStatusMap: Record<string, string> = {
    pending: t("paymentStatusLabels.pending"),
    partial: t("paymentStatusLabels.partial"),
    paid: t("paymentStatusLabels.paid"),
    completed: t("paymentStatusLabels.completed"),
    refunded: t("paymentStatusLabels.refunded"),
    failed: t("paymentStatusLabels.failed"),
  };
  const timelineLabelMap: Record<TimelineEvent["event"], string> = {
    booking_created: t("timeline.bookingCreated"),
    booking_confirmed: t("timeline.bookingConfirmed"),
    payment_received: t("timeline.paymentReceived"),
    driver_assigned: t("timeline.driverAssigned"),
    trip_started: t("timeline.tripStarted"),
    trip_completed: t("timeline.tripCompleted"),
    booking_cancelled: t("timeline.bookingCancelled"),
  };
  const timelineIconMap: Record<TimelineEvent["event"], typeof Calendar> = {
    booking_created: Calendar,
    booking_confirmed: CheckCircle2,
    payment_received: CreditCard,
    driver_assigned: UserCheck,
    trip_started: PlayCircle,
    trip_completed: Flag,
    booking_cancelled: Ban,
  };

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeType, setDisputeType] =
    useState<DisputeType>("BOOKING_QUALITY_ISSUE");
  const [disputeSubject, setDisputeSubject] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);

  useEffect(() => {
    if (!guardLoading) {
      fetchBookingDetails();
    }
  }, [guardLoading, bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await bookingService.getById(bookingId);
      const bookingData = response as any;
      const data = bookingData.booking || bookingData;
      setBooking(data);
    } catch (err: any) {
      console.error("Error fetching booking details:", err);
      setError(err.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
      case "ongoing":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "disputed":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "partial":
        return "bg-orange-100 text-orange-800";
      case "paid":
      case "completed":
        return "bg-green-100 text-green-800";
      case "refunded":
        return "bg-purple-100 text-purple-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      alert(t("cancelDialog.reasonRequired"));
      return;
    }

    try {
      setCancelLoading(true);
      await bookingService.cancel(bookingId, cancelReason);
      setShowCancelDialog(false);
      router.push(`/${locale}/dashboard/bookings`);
    } catch (err: any) {
      console.error("Error cancelling booking:", err);
      alert(err.message || t("cancelDialog.error"));
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRaiseDispute = async () => {
    if (
      disputeSubject.trim().length < 3 ||
      disputeDescription.trim().length < 10
    ) {
      return;
    }
    try {
      setDisputeLoading(true);
      await disputeService.create({
        bookingId,
        type: disputeType,
        subject: disputeSubject.trim(),
        description: disputeDescription.trim(),
      });
      setShowDisputeDialog(false);
      setDisputeSubject("");
      setDisputeDescription("");
      router.push(`/${locale}/dashboard/disputes`);
    } catch (err: any) {
      console.error("Error raising dispute:", err);
      alert(err.message || tDispute("createError"));
    } finally {
      setDisputeLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!booking) return;

    try {
      setRatingLoading(true);
      await reviewService.create({
        bookingId: booking.id,
        vehicleId: booking.vehicle.id,
        rating,
        comment: review || undefined,
        isRecommended: true,
      });
      setShowRatingDialog(false);
      await fetchBookingDetails();
    } catch (err: any) {
      console.error("Error submitting rating:", err);
      alert(err.message || t("ratingDialog.error"));
    } finally {
      setRatingLoading(false);
    }
  };

  if (guardLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push(`/${locale}/dashboard/bookings`)}>
            {t("goToBookings")}
          </Button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{t("notFound")}</p>
          <Button onClick={() => router.push(`/${locale}/dashboard/bookings`)}>
            {t("goToBookings")}
          </Button>
        </div>
      </div>
    );
  }

  const canCancel = ["pending", "confirmed"].includes(
    booking.status?.toLowerCase() || "",
  );
  const canRate =
    booking.status?.toLowerCase() === "completed" && !booking.hasReview;
  const canPay = ["pending", "partial", "failed"].includes(
    booking.payment?.status?.toLowerCase() || "",
  );

  // ── Route map waypoints ───────────────────────────────────────────────────
  // The persisted itinerary_stops include the pickup as the first stop and the
  // dropoff as the last, while the map colours markers purely by position
  // (index 0 = green pickup, last = red dropoff). Rendering the raw stop list
  // would therefore drop the real pickup/dropoff pins and label them as
  // intermediate stops. We derive endpoints from the trip's coordinates (with a
  // fallback to the first/last stop) and keep only the genuine in-between stops.
  const rawStops = booking.trip.itineraryStops ?? [];
  const stopLatLng = (s: { coordinates?: [number, number]; lat?: number; lng?: number }) => ({
    lat: s.coordinates?.[1] ?? s.lat ?? null,
    lng: s.coordinates?.[0] ?? s.lng ?? null,
  });
  const pickupPt =
    booking.trip.pickupLatitude != null && booking.trip.pickupLongitude != null
      ? { lat: booking.trip.pickupLatitude, lng: booking.trip.pickupLongitude }
      : rawStops.length
        ? stopLatLng(rawStops[0])
        : null;
  const dropoffPt =
    booking.trip.dropoffLatitude != null && booking.trip.dropoffLongitude != null
      ? { lat: booking.trip.dropoffLatitude, lng: booking.trip.dropoffLongitude }
      : rawStops.length
        ? stopLatLng(rawStops[rawStops.length - 1])
        : null;
  const samePoint = (
    a: { lat: number | null; lng: number | null } | null,
    b: { lat: number | null; lng: number | null } | null,
  ) =>
    !!a &&
    !!b &&
    a.lat != null &&
    a.lng != null &&
    b.lat != null &&
    b.lng != null &&
    Math.abs(a.lat - b.lat) < 1e-4 &&
    Math.abs(a.lng - b.lng) < 1e-4;
  const intermediateStops = rawStops.filter((s) => {
    const p = stopLatLng(s);
    return !samePoint(p, pickupPt) && !samePoint(p, dropoffPt);
  });
  const mapWaypoints: { lat: number; lng: number; name: string }[] = [];
  if (pickupPt?.lat != null && pickupPt.lng != null) {
    mapWaypoints.push({ lat: pickupPt.lat, lng: pickupPt.lng, name: booking.trip.pickupLocation });
  }
  intermediateStops.forEach((s) => {
    const p = stopLatLng(s);
    if (p.lat != null && p.lng != null) {
      mapWaypoints.push({ lat: p.lat, lng: p.lng, name: s.locationName });
    }
  });
  if (dropoffPt?.lat != null && dropoffPt.lng != null) {
    mapWaypoints.push({ lat: dropoffPt.lat, lng: dropoffPt.lng, name: booking.trip.dropoffLocation });
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/${locale}/dashboard/bookings`}
                className="text-gray-600 hover:text-[#20B0E9] transition-colors"
              >
                <ArrowLeft className="text-xl" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {t("title")}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {t("reference", { ref: booking.bookingRef })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={getStatusColor(booking.status)}>
                {bookingStatusMap[booking.status?.toLowerCase()] ?? booking.status}
              </Badge>
              <Badge className={getPaymentStatusColor(booking.payment?.status)}>
                {paymentStatusMap[booking.payment?.status?.toLowerCase()] ?? booking.payment?.status}
              </Badge>
              {canPay && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/${locale}/dashboard/bookings/${booking.id}/payment`,
                    )
                  }
                >
                  {t("payNow")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trip Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                {t("tripInfo")}
              </h2>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="flex items-start gap-3">
                  <Calendar className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">{t("startDate")}</p>
                    <p className="font-medium">
                      {new Date(booking.trip.startDate).toLocaleDateString()}
                    </p>
                    {booking.trip.startTime && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t("startTime")}: {booking.trip.startTime}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">{t("endDate")}</p>
                    <p className="font-medium">
                      {new Date(booking.trip.endDate).toLocaleDateString()}
                    </p>
                    {booking.trip.estimatedDuration && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t("duration")}: {booking.trip.estimatedDuration}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Route with Map */}
              <div className="mb-6">
                <div className="rounded-lg mb-4 overflow-hidden h-[300px]">
                  <InteractiveMap
                    readOnly={true}
                    initialWaypoints={mapWaypoints}
                    initialRouteGeometry={booking.trip?.itineraryRoute?.coordinates?.map(
                      ([lng, lat]: [number, number]) => [lat, lng]
                    ) || []}
                  />
                </div>

                {/* Route Details */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t("pickupLocation")}</p>
                      <p className="font-medium">
                        {booking.trip.pickupLocation}
                      </p>
                    </div>
                  </div>

                  {intermediateStops.map((stop, index) => (
                    <div key={index}>
                      <div className="flex items-start gap-3 ml-4 mb-2">
                        <div className="w-0.5 h-6 bg-gray-300 ml-3.5" />
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <MapPin className="text-blue-500 text-sm" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">
                            {t("stopLabel", { index: index + 1 })}
                          </p>
                          <p className="font-medium">{stop.locationName}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-start gap-3 ml-4 mb-2">
                    <div className="w-0.5 h-6 bg-gray-300 ml-3.5" />
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t("dropoffLocation")}</p>
                      <p className="font-medium">
                        {booking.trip.dropoffLocation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="flex flex-wrap items-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Users className="text-[#20B0E9]" />
                  <span className="font-medium">
                    {t("passengersCount", { count: booking.trip.passengers })}
                  </span>
                </div>
                {booking.trip.estimatedDistance && (
                  <div className="flex items-center gap-2">
                    <Map className="text-[#20B0E9] w-5 h-5" />
                    <span className="font-medium">
                      {booking.trip.estimatedDistance}
                    </span>
                  </div>
                )}
              </div>

              {booking.notes && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    {t("specialRequirements")}
                  </p>
                  <p className="text-sm text-yellow-700">
                    {booking.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Vehicle Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {t("vehicleDetails")}
              </h2>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                {booking.vehicle.image && (
                  <img
                    src={booking.vehicle.image}
                    alt={booking.vehicle.name}
                    className="w-full sm:w-48 h-40 sm:h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">
                    {booking.vehicle.name}
                  </h3>
                  <p className="text-gray-600 mb-2">
                    {booking.vehicle.type} • {t("seats", { count: booking.vehicle.capacity })}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    {t("registrationNumber", { reg: booking.vehicle.registration })}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {booking.vehicle.brand && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700">
                        {booking.vehicle.brand} {booking.vehicle.model}
                        {booking.vehicle.year ? ` • ${booking.vehicle.year}` : ""}
                      </span>
                    )}
                    {booking.vehicle.fuelType && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 capitalize">
                        {booking.vehicle.fuelType.toLowerCase()}
                      </span>
                    )}
                    {booking.vehicle.transmission && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 capitalize">
                        {booking.vehicle.transmission.toLowerCase()}
                      </span>
                    )}
                    {booking.vehicle.acType && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 capitalize">
                        {booking.vehicle.acType}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {booking.vehicle.amenities && booking.vehicle.amenities.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    {t("amenitiesTitle")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {booking.vehicle.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#20B0E9]/10 text-[#0B5F7F] capitalize"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {amenity.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Owner Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {t("ownerDetails")}
              </h2>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  {booking.owner.avatar ? (
                    <img
                      src={booking.owner.avatar}
                      alt={booking.owner.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-700">
                        {booking.owner.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-lg text-gray-900">
                      {booking.owner.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {booking.owner.phone}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                      {typeof booking.owner.rating === "number" &&
                        booking.owner.rating > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                            <span className="font-medium text-gray-900">
                              {booking.owner.rating.toFixed(1)}
                            </span>
                            {typeof booking.owner.reviewCount === "number" &&
                              booking.owner.reviewCount > 0 && (
                                <span className="text-gray-500">
                                  ({booking.owner.reviewCount})
                                </span>
                              )}
                          </span>
                        )}
                      {typeof booking.owner.completedTrips === "number" && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          {t("ownerCompletedTrips", {
                            count: booking.owner.completedTrips,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push(
                        `/${locale}/dashboard/messages?booking=${bookingId}`,
                      )
                    }
                    className="border-[var(--color-action-primary)] text-[var(--color-action-primary)] hover:bg-[var(--color-bg-surface)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                  >
                    <MessageSquare className="mr-2" />
                    {tMsg("messageOwner")}
                  </Button>
                  <Button
                    onClick={() =>
                      (window.location.href = `tel:${booking.owner.phone}`)
                    }
                    className="bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
                  >
                    <Phone className="mr-2" />
                    {t("contactOwner")}
                  </Button>
                </div>
              </div>
            </div>

            {/* Driver Info */}
            {booking.driver && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {t("driverTitle")}
                </h2>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#20B0E9]/10 rounded-full flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-[#20B0E9]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {booking.driver.name}
                    </p>
                    {booking.driver.phone && (
                      <a
                        href={`tel:${booking.driver.phone}`}
                        className="text-sm text-[#20B0E9] hover:underline"
                      >
                        {booking.driver.phone}
                      </a>
                    )}
                    {booking.driver.license && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t("driverLicense")}: {booking.driver.license}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Pricing Information */}
            <div className="bg-white rounded-lg shadow-sm p-6 top-4">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t("pricingDetails")}
              </h3>

              {booking.payment.breakdown && (
                <div className="space-y-3 mb-4 pb-4 border-b">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t("breakdownBasePrice")}</span>
                    <span className="font-medium">
                      Rs. {booking.payment.breakdown.basePrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t("breakdownDriverAllowance")}</span>
                    <span className="font-medium">
                      Rs. {booking.payment.breakdown.driverAllowance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t("breakdownAdditionalCharges")}</span>
                    <span className="font-medium">
                      Rs. {booking.payment.breakdown.additionalCharges.toLocaleString()}
                    </span>
                  </div>
                  {booking.payment.breakdown.customItems &&
                    booking.payment.breakdown.customItems.length > 0 &&
                    booking.payment.breakdown.customItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate pr-2">
                          {item.description}
                        </span>
                        <span className="font-medium whitespace-nowrap">
                          Rs. {Number(item.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  {typeof booking.payment.breakdown.subtotal === "number" &&
                    booking.payment.breakdown.subtotal > 0 && (
                      <div className="flex justify-between text-sm pt-1 border-t">
                        <span className="text-gray-600">{t("breakdownSubtotal")}</span>
                        <span className="font-medium">
                          Rs. {booking.payment.breakdown.subtotal.toLocaleString()}
                        </span>
                      </div>
                    )}
                  {typeof booking.payment.breakdown.tax === "number" &&
                    booking.payment.breakdown.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t("breakdownTax")}</span>
                        <span className="font-medium">
                          Rs. {booking.payment.breakdown.tax.toLocaleString()}
                        </span>
                      </div>
                    )}
                </div>
              )}

              <div className="space-y-3 mb-4 pb-4 border-b">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("totalAmount")}</span>
                  <span className="font-medium">
                    Rs. {booking.payment.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("platformCommission")}</span>
                  <span className="font-medium">
                    Rs. {booking.payment.platformCommission.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("netAmount")}</span>
                  <span className="font-medium">
                    Rs. {booking.payment.netAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-gray-900">{t("totalPayable")}</span>
                <span className="font-bold text-xl text-[#20B0E9]">
                  Rs. {booking.payment.total.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-green-50 rounded-lg mb-4">
                <p className="text-sm font-medium text-green-800">
                  {t("amountPaid")}
                </p>
                <p className="text-lg font-bold text-green-600">
                  Rs. {booking.payment.paid.toLocaleString()}
                </p>
              </div>

              {/* Payment Information */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("paymentStatus")}</span>
                  <span className="font-medium capitalize">
                    {paymentStatusMap[booking.payment.status?.toLowerCase()] ?? booking.payment.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("paymentMethod")}</span>
                  <span className="font-medium">
                    {booking.payment.method || "N/A"}
                  </span>
                </div>
                {booking.payment.receiptUrl && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t("receipt")}</span>
                    <a
                      href={booking.payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#20B0E9] font-medium"
                    >
                      {t("viewReceipt")}
                    </a>
                  </div>
                )}
              </div>

              {/* Download Buttons */}
              <div className="space-y-2">
                <Button variant="outline" className="w-full" size="sm">
                  <Download className="mr-2" />
                  {t("downloadInvoice")}
                </Button>
                {booking.payment.receiptUrl && (
                  <Button variant="outline" className="w-full" size="sm">
                    <ReceiptText className="mr-2" />
                    {t("downloadReceipt")}
                  </Button>
                )}
              </div>
            </div>

            {/* Booking Timeline */}
            {booking.timeline && booking.timeline.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  {t("timelineTitle")}
                </h3>
                <ol className="relative space-y-5">
                  {booking.timeline.map((event, idx) => {
                    const Icon = timelineIconMap[event.event] || Calendar;
                    const isLast = idx === booking.timeline!.length - 1;
                    const isCancelled = event.event === "booking_cancelled";
                    return (
                      <li key={`${event.event}-${idx}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isCancelled
                                ? "bg-red-100 text-red-600"
                                : "bg-[#20B0E9]/10 text-[#20B0E9]"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          {!isLast && (
                            <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-1">
                          <p className="font-medium text-sm text-gray-900">
                            {timelineLabelMap[event.event] || event.event}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                          {event.description && (
                            <p className="text-xs text-gray-600 mt-1">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t("actionsTitle")}</h3>
              <div className="space-y-3">
                {canCancel && (
                  <Button
                    onClick={() => setShowCancelDialog(true)}
                    variant="outline"
                    className="w-full border-red-500 text-red-500 hover:bg-red-50"
                  >
                    <XCircle className="mr-2" />
                    {t("cancelBooking")}
                  </Button>
                )}
                {canRate && (
                  <Button
                    onClick={() => setShowRatingDialog(true)}
                    className="w-full bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
                  >
                    <Star className="mr-2" />
                    {t("rateService")}
                  </Button>
                )}
                <Button
                  onClick={() => setShowDisputeDialog(true)}
                  variant="outline"
                  className="w-full border-[#20B0E9] text-[#20B0E9] hover:bg-[#20B0E9]/5"
                >
                  <Flag className="mr-2" />
                  {tDispute("raiseButton")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {t("cancelDialog.title")}
            </h3>
            <p className="text-gray-600 mb-4">
              {t("cancelDialog.description")}
            </p>
            <TextArea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t("cancelDialog.placeholder")}
              rows={4}
              className="mb-4"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleCancelBooking}
                disabled={cancelLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                {t("cancelDialog.confirm")}
              </Button>
              <Button
                onClick={() => setShowCancelDialog(false)}
                disabled={cancelLoading}
                variant="outline"
                className="flex-1"
              >
                {t("cancelDialog.keep")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Raise Dispute Dialog */}
      {showDisputeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {tDispute("raiseTitle")}
            </h3>
            <div className="space-y-3">
              <Select
                label={tDispute("fieldType")}
                options={DISPUTE_TYPES.map((type) => ({
                  value: type,
                  label: tDispute(`type${type}`),
                }))}
                value={disputeType}
                onChange={(v) => setDisputeType(v as DisputeType)}
              />
              <Input
                label={tDispute("fieldSubject")}
                value={disputeSubject}
                onChange={(e) => setDisputeSubject(e.target.value)}
                placeholder={tDispute("subjectPlaceholder")}
                maxLength={200}
              />
              <TextArea
                label={tDispute("fieldDescription")}
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                placeholder={tDispute("descriptionPlaceholder")}
                rows={5}
                maxLength={3000}
              />
            </div>
            <div className="mt-5 flex gap-3">
              <Button
                onClick={handleRaiseDispute}
                disabled={
                  disputeLoading ||
                  disputeSubject.trim().length < 3 ||
                  disputeDescription.trim().length < 10
                }
                className="flex-1 bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
              >
                {disputeLoading ? tDispute("submitting") : tDispute("submit")}
              </Button>
              <Button
                onClick={() => setShowDisputeDialog(false)}
                disabled={disputeLoading}
                variant="outline"
                className="flex-1"
              >
                {tDispute("cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Dialog */}
      {showRatingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {t("ratingDialog.title")}
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">{t("ratingDialog.ratingLabel")}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="text-3xl transition-colors"
                    aria-label={`${star} star`}
                  >
                    <Star
                      className={
                        star <= rating ? "text-yellow-400" : "text-gray-300"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <TextArea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder={t("ratingDialog.placeholder")}
              rows={4}
              className="mb-4"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleSubmitRating}
                disabled={ratingLoading}
                className="flex-1 bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
              >
                {t("ratingDialog.submit")}
              </Button>
              <Button
                onClick={() => setShowRatingDialog(false)}
                disabled={ratingLoading}
                variant="outline"
                className="flex-1"
              >
                {t("ratingDialog.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
