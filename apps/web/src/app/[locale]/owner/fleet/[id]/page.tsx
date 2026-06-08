"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CTAButton, LoadingSpinner, Badge, ConfirmDialog } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { ApiError, vehicleService } from "@/lib/api";
import type { Vehicle } from "@/types";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bus,
  Calendar,
  Camera,
  Edit,
  MapPin,
  Star,
  BookOpen,
  FileText,
  BarChart3,
  DollarSign,
  Trash,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  X,
} from "lucide-react";

type VehicleActiveStatus = "active" | "unavailable" | "inactive" | "pending";

type VehiclePhoto = {
  id?: string;
  url?: string | null;
  fileName?: string | null;
  isPrimary?: boolean | null;
  sortOrder?: number | null;
};

type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  customer?: { firstName?: string; lastName?: string } | null;
};

const getVehicleImageUrl = (vehicle: Vehicle): string | null => {
  const photos = Array.isArray(vehicle.photos)
    ? (vehicle.photos as VehiclePhoto[])
    : [];
  const primary = photos.find((p) => p?.isPrimary && p?.url);
  const first = photos.find((p) => p?.url);
  return primary?.url ?? first?.url ?? vehicle.images?.[0] ?? null;
};

const getVehicleStatus = (vehicle: Vehicle): VehicleActiveStatus => {
  if (vehicle.isActive && vehicle.isAvailable) return "active";
  if (vehicle.isActive && !vehicle.isAvailable) return "unavailable";
  if (!vehicle.isActive && vehicle.isAvailable) return "pending";
  return "inactive";
};

const statusToBadgeVariant = (
  s: VehicleActiveStatus,
): "success" | "info" | "secondary" | "warning" => {
  if (s === "active") return "success";
  if (s === "pending") return "info";
  if (s === "unavailable") return "warning";
  return "secondary";
};

/** Converts DB enum values like SEMI_LUXURY → Semi Luxury */
const formatVehicleType = (type: string): string => {
  const map: Record<string, string> = {
    ORDINARY: "Ordinary",
    SEMI_LUXURY: "Semi Luxury",
    LUXURY_AC: "Luxury AC",
  };
  return (
    map[type] ??
    type
      .replace(/_/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
  );
};

/** Converts raw amenity strings like wifi / usb_charging → human-readable */
const formatAmenity = (amenity: string): string => {
  const map: Record<string, string> = {
    wifi: "Wi-Fi",
    "wi-fi": "Wi-Fi",
    ac: "Air Conditioning",
    air_conditioning: "Air Conditioning",
    "air conditioning": "Air Conditioning",
    full_ac: "Full AC",
    "full-ac": "Full AC",
    "full ac": "Full AC",
    usb: "USB Charging",
    usb_charging: "USB Charging",
    "usb charging": "USB Charging",
    tv: "Entertainment System",
    entertainment: "Entertainment System",
    reclining_seats: "Reclining Seats",
    "reclining seats": "Reclining Seats",
    toilet: "Onboard Toilet",
    luggage_rack: "Luggage Rack",
    luggage: "Luggage Storage",
    gps: "GPS Tracking",
    first_aid: "First Aid Kit",
    "first aid": "First Aid Kit",
    fire_extinguisher: "Fire Extinguisher",
    curtains: "Window Curtains",
    reading_lights: "Reading Lights",
    power_outlet: "Power Outlets",
    music_system: "Music System",
    cctv: "CCTV Camera",
    footrest: "Footrest",
  };
  const key = amenity.toLowerCase();
  if (map[key]) return map[key];
  return amenity
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export default function OwnerFleetVehicleDetailsPage() {
  const { user } = useAuthStore();
  const params = useParams<{ id?: string | string[]; locale?: string }>();
  const locale = typeof params?.locale === "string" ? params.locale : "en";
  const vehicleId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const t = useTranslations("fleetManagement");
  const tForm = useTranslations("vehicleForm");

  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Per-action toggle state (4 possible actions based on status)
  const [confirmToggleAction, setConfirmToggleAction] = useState<
    "pause" | "resume" | "requestActivation" | "cancelRequest" | null
  >(null);
  const [isToggling, setIsToggling] = useState(false);

  // "has active bookings" error dialog
  const [bookingsBlockError, setBookingsBlockError] = useState<string | null>(null);

  const fetchVehicle = useCallback(async () => {
    if (!vehicleId) {
      setError(t("detailsNotFound"));
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await vehicleService.getById(vehicleId);
      const data = (response as { vehicle?: Vehicle })?.vehicle ?? response;
      setVehicle(data as Vehicle);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("detailsErrorLoad"));
      setVehicle(null);
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId, t]);

  useEffect(() => {
    if (isAuthorized && user) fetchVehicle();
  }, [fetchVehicle, isAuthorized, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const status = useMemo(
    () => (vehicle ? getVehicleStatus(vehicle) : "inactive"),
    [vehicle],
  );

  const STATUS_LABELS: Record<VehicleActiveStatus, string> = {
    active: t("statusActive"),
    inactive: t("statusInactive"),
    pending: t("statusPending"),
    unavailable: t("statusUnavailable"),
  };

  const formatText = (value?: string | null): string =>
    value && value.trim().length > 0 ? value : t("detailsNotProvided");

  const formatPrice = (value?: number | null): string =>
    value === null || value === undefined
      ? t("detailsNotProvided")
      : `${t("currency")} ${value.toLocaleString()}`;

  const handleDelete = useCallback(async () => {
    if (!vehicle) return;
    setIsDeleting(true);
    try {
      await vehicleService.delete(vehicle.id);
      window.location.href = `/${locale}/owner/fleet`;
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }, [vehicle, locale]);

  // Single handler used after ConfirmDialog confirmed; action is already set
  const handleToggle = useCallback(async () => {
    if (!vehicle || !confirmToggleAction) return;
    setIsToggling(true);
    setBookingsBlockError(null);
    try {
      switch (confirmToggleAction) {
        case "pause":
          await vehicleService.setAvailability(vehicle.id, false);
          setToast({ message: t("pauseSuccess"), type: "success" });
          break;
        case "resume":
          await vehicleService.setAvailability(vehicle.id, true);
          setToast({ message: t("resumeSuccess"), type: "success" });
          break;
        case "requestActivation":
          await vehicleService.requestActivation(vehicle.id);
          setToast({ message: t("activationRequestSent"), type: "success" });
          break;
        case "cancelRequest":
          await vehicleService.cancelActivation(vehicle.id);
          setToast({ message: t("activationRequestCancelled"), type: "success" });
          break;
      }
      await fetchVehicle();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("toggleError");
      // Surface booking-block errors in a dedicated info dialog
      if (confirmToggleAction === "pause" && err instanceof ApiError) {
        setBookingsBlockError(msg);
      } else {
        setToast({ message: msg, type: "error" });
      }
    } finally {
      setIsToggling(false);
      setConfirmToggleAction(null);
    }
  }, [vehicle, confirmToggleAction, fetchVehicle, t]);

  if (guardLoading || !isAuthorized || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[var(--color-bg-surface)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-surface)]">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-[var(--color-error-text)]" />
            <p className="text-body text-[var(--color-error-text)]">
              {error ?? t("detailsNotFound")}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <CTAButton variant="secondary" href={`/${locale}/owner/fleet`}>
                {tForm("backToFleet")}
              </CTAButton>
              <CTAButton onClick={fetchVehicle}>{t("errorRetry")}</CTAButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const imageUrl = getVehicleImageUrl(vehicle);
  const amenities = Array.isArray(vehicle.amenities)
    ? vehicle.amenities.filter((a) => a)
    : [];
  const allPhotos = Array.isArray(vehicle.photos)
    ? (vehicle.photos as VehiclePhoto[]).filter((p) => p?.url)
    : [];
  const thumbnails = allPhotos.filter((p) => !p.isPrimary).slice(0, 5);
  const recentReviews = Array.isArray((vehicle as any).reviews)
    ? ((vehicle as any).reviews as ReviewItem[]).slice(0, 3)
    : [];

  // Dialog metadata per toggle action
  const TOGGLE_DIALOG: Record<NonNullable<typeof confirmToggleAction>, { title: string; message: string; confirmText: string; variant: "warning" | "info" }> = {
    pause: { title: t("confirmPauseTitle"), message: t("confirmPauseMsg"), confirmText: t("actionPause"), variant: "warning" },
    resume: { title: t("confirmResumeTitle"), message: t("confirmResumeMsg"), confirmText: t("actionResume"), variant: "info" },
    requestActivation: { title: t("confirmRequestActivationTitle"), message: t("confirmRequestActivationMsg"), confirmText: t("actionRequestActivation"), variant: "info" },
    cancelRequest: { title: t("confirmCancelRequestTitle"), message: t("confirmCancelRequestMsg"), confirmText: t("actionCancelRequest"), variant: "warning" },
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border-default)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={`/${locale}/owner/fleet`}
            className="mb-3 flex w-fit items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            {tForm("backToFleet")}
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-heading-md font-semibold text-[var(--color-text-primary)]">
                {vehicle.name || vehicle.licensePlate}
              </h1>
              <p className="text-body text-[var(--color-text-secondary)]">
                {vehicle.brand} {vehicle.model}
                {vehicle.year ? ` • ${vehicle.year}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Availability */}
              <CTAButton
                variant="secondary"
                href={`/${locale}/owner/fleet/${vehicle.id}/availability`}
                leftIcon={<Calendar className="h-4 w-4" />}
              >
                {t("detailsSetAvailability")}
              </CTAButton>
              {/* Edit */}
              <CTAButton
                variant="secondary"
                href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                leftIcon={<Edit className="h-4 w-4" />}
              >
                {t("actionEdit")}
              </CTAButton>
              {/* Status toggle button — action varies by current state */}
              {status === "active" && (
                <button
                  onClick={() => setConfirmToggleAction("pause")}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ToggleLeft className="h-4 w-4" />
                  {t("actionPause")}
                </button>
              )}
              {status === "unavailable" && (
                <button
                  onClick={() => setConfirmToggleAction("resume")}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ToggleRight className="h-4 w-4" />
                  {t("actionResume")}
                </button>
              )}
              {status === "inactive" && (
                <button
                  onClick={() => setConfirmToggleAction("requestActivation")}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ToggleRight className="h-4 w-4" />
                  {t("actionRequestActivation")}
                </button>
              )}
              {status === "pending" && (
                <button
                  onClick={() => setConfirmToggleAction("cancelRequest")}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ToggleLeft className="h-4 w-4" />
                  {t("actionCancelRequest")}
                </button>
              )}
              {/* Delete */}
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label={t("actionDelete")}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 text-sm font-medium text-[var(--color-error-text)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash className="h-4 w-4" />
                {t("actionDelete")}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Pending activation request alert */}
        {status === "pending" && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="flex-1 text-body text-[var(--color-text-primary)]">
              {t("pendingActivationAlert")}
            </p>
            <button
              onClick={() => setConfirmToggleAction("cancelRequest")}
              className="shrink-0 text-caption font-medium text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("actionCancelRequest")}
            </button>
          </div>
        )}

        {/*
          DOM order: right column first so it appears at top on mobile.
          CSS order reversal on lg brings photo/spec column visually left.
        */}
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* ── LEFT COLUMN ── */}
          <div className="order-2 space-y-6 lg:order-1">
            {/* Photo gallery card */}
            <div className="overflow-hidden rounded-[20px] border border-[var(--color-border-default)] bg-white">
              <div className="relative aspect-video bg-[var(--color-bg-surface)]">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={vehicle.licensePlate}
                    fill
                    priority
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Bus className="h-16 w-16 text-[var(--color-text-tertiary)]" />
                  </div>
                )}
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <Badge variant={statusToBadgeVariant(status)} dot size="sm">
                    {STATUS_LABELS[status]}
                  </Badge>
                  <Badge
                    variant={vehicle.isAvailable ? "success" : "secondary"}
                    dot
                    size="sm"
                  >
                    {vehicle.isAvailable
                      ? t("detailsAvailable")
                      : t("detailsUnavailable")}
                  </Badge>
                </div>
              </div>
              {thumbnails.length > 0 ? (
                <div className="p-4">
                  <p className="mb-3 text-caption font-medium text-[var(--color-text-secondary)]">
                    {tForm("photosTitle")}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {thumbnails.map((photo, idx) => (
                      <div
                        key={photo.id || idx}
                        className="group relative overflow-hidden rounded-xl border border-[var(--color-border-default)]"
                      >
                        <Image
                          src={photo.url!}
                          alt={photo.fileName || `Photo ${idx + 2}`}
                          width={160}
                          height={120}
                          className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : allPhotos.length === 0 ? (
                <div className="flex items-center gap-3 border-t border-[var(--color-border-default)] px-6 py-4">
                  <Camera className="h-5 w-5 shrink-0 text-[var(--color-text-tertiary)]" />
                  <p className="text-caption text-[var(--color-text-secondary)]">
                    {t("detailsNoPhotos")}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Specifications card */}
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-white p-6">
              <h3 className="text-body-lg font-semibold text-[var(--color-text-primary)]">
                {tForm("sectionBasic")}
              </h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-caption text-[var(--color-text-secondary)]">
                    {tForm("fieldBusType")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {vehicle.type ? formatVehicleType(vehicle.type as string) : t("detailsNotProvided")}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-[var(--color-text-secondary)]">
                    {tForm("fieldCapacity")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {vehicle.seats} {t("seats")}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-[var(--color-text-secondary)]">
                    {tForm("fieldMake")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {formatText(vehicle.brand)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-[var(--color-text-secondary)]">
                    {tForm("fieldModel")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {formatText(vehicle.model)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-[var(--color-text-secondary)]">
                    {tForm("fieldYear")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {vehicle.year ?? t("detailsNotProvided")}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-[var(--color-text-secondary)]">
                    {tForm("fieldAcType")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {vehicle.acType ? formatVehicleType(vehicle.acType) : t("detailsNotProvided")}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-[var(--color-text-secondary)]">
                    {tForm("fieldCondition")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {formatText(vehicle.condition ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-[var(--color-text-secondary)]">
                    {tForm("fieldLocation")}
                  </dt>
                  <dd className="flex items-center gap-2 text-body font-medium text-[var(--color-text-primary)]">
                    <MapPin className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                    {formatText(vehicle.location)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Description card */}
            {vehicle.description && vehicle.description.trim().length > 0 && (
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-white p-6">
                <h3 className="text-body-lg font-semibold text-[var(--color-text-primary)]">
                  {tForm("fieldDescription")}
                </h3>
                <p className="mt-3 text-body text-[var(--color-text-secondary)]">
                  {vehicle.description}
                </p>
              </div>
            )}

            {/* Recent reviews */}
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-white p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-body-lg font-semibold text-[var(--color-text-primary)]">
                  {t("detailsRecentReviews")}
                </h3>
                <Link
                  href={`/${locale}/owner/reviews?vehicleId=${vehicle.id}`}
                  className="flex items-center gap-1 text-caption font-medium text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("detailsViewAllReviews")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {recentReviews.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {recentReviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-xl border border-[var(--color-border-default)] p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3.5 w-3.5 ${
                                star <= review.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-[var(--color-border-default)]"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-caption text-[var(--color-text-tertiary)]">
                          {review.customer
                            ? `${review.customer.firstName ?? ""} ${review.customer.lastName ?? ""}`.trim()
                            : ""}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-caption text-[var(--color-text-secondary)] line-clamp-2">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-body text-[var(--color-text-secondary)]">
                  {t("detailsNoRecentReviews")}
                </p>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="order-1 space-y-6 lg:order-2">
            {/* Status & Performance card */}
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-white p-6">
              <h3 className="text-body-lg font-semibold text-[var(--color-text-primary)]">
                {t("detailsStatusOverview")}
              </h3>
              <dl className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-body text-[var(--color-text-secondary)]">
                    {t("colStatus")}
                  </dt>
                  <dd>
                    <Badge variant={statusToBadgeVariant(status)} dot size="sm">
                      {STATUS_LABELS[status]}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-body text-[var(--color-text-secondary)]">
                    {t("detailsAvailability")}
                  </dt>
                  <dd>
                    <Badge
                      variant={vehicle.isAvailable ? "success" : "secondary"}
                      dot
                      size="sm"
                    >
                      {vehicle.isAvailable
                        ? t("detailsAvailable")
                        : t("detailsUnavailable")}
                    </Badge>
                  </dd>
                </div>

                <div className="border-t border-[var(--color-border-default)]" />

                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-body text-[var(--color-text-secondary)]">
                    <BookOpen className="h-4 w-4 shrink-0" />
                    {t("statBookings")}
                  </dt>
                  <dd className="text-body font-semibold text-[var(--color-text-primary)]">
                    {vehicle.totalBookings ?? 0}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-body text-[var(--color-text-secondary)]">
                    <FileText className="h-4 w-4 shrink-0" />
                    {t("detailsQuotations")}
                  </dt>
                  <dd className="text-body font-semibold text-[var(--color-text-primary)]">
                    {vehicle.quotationCount ?? 0}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-body text-[var(--color-text-secondary)]">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    {t("statRating")}
                  </dt>
                  <dd>
                    {(vehicle.averageRating ?? 0) > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-body font-semibold text-[var(--color-text-primary)]">
                          {(vehicle.averageRating ?? 0).toFixed(1)}/5
                        </span>
                        {vehicle.reviewCount != null && vehicle.reviewCount > 0 && (
                          <span className="text-caption text-[var(--color-text-tertiary)]">
                            ({vehicle.reviewCount})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-body text-[var(--color-text-secondary)]">
                        {t("na")}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Pricing card */}
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-white p-6">
              <h3 className="text-body-lg font-semibold text-[var(--color-text-primary)]">
                {tForm("pricingTitle")}
              </h3>
              <dl className="mt-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-body text-[var(--color-text-secondary)]">
                    {tForm("fieldPricePerKm")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {formatPrice(vehicle.pricePerKm ?? null)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-body text-[var(--color-text-secondary)]">
                    {tForm("fieldPricePerDay")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {formatPrice(vehicle.pricePerDay ?? null)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-body text-[var(--color-text-secondary)]">
                    {tForm("fieldDriverAllowance")}
                  </dt>
                  <dd className="text-body font-medium text-[var(--color-text-primary)]">
                    {formatPrice(vehicle.driverAllowance ?? null)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Amenities card */}
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-white p-6">
              <h3 className="text-body-lg font-semibold text-[var(--color-text-primary)]">
                {tForm("sectionAmenities")}
              </h3>
              {amenities.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-caption text-[var(--color-text-secondary)]"
                    >
                      {formatAmenity(amenity)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-body text-[var(--color-text-secondary)]">
                  {t("detailsNoAmenities")}
                </p>
              )}
            </div>

            {/* Vehicle Activity quick-nav */}
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-white p-6">
              <h3 className="mb-4 text-body-lg font-semibold text-[var(--color-text-primary)]">
                {t("detailsQuickNav")}
              </h3>
              <div className="space-y-2">
                {/* Bookings */}
                <Link
                  href={`/${locale}/owner/bookings?vehicleId=${vehicle.id}&vehicleReg=${encodeURIComponent(vehicle.licensePlate)}`}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-body font-medium text-[var(--color-text-primary)]">
                        {t("detailsViewAllBookings")}
                      </p>
                      <p className="text-caption text-[var(--color-text-tertiary)]">
                        {vehicle.totalBookings ?? 0} {t("statBookings").toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                </Link>

                {/* Quotations */}
                <Link
                  href={`/${locale}/owner/quotations?vehicleId=${vehicle.id}`}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-body font-medium text-[var(--color-text-primary)]">
                        {t("detailsViewAllQuotations")}
                      </p>
                      <p className="text-caption text-[var(--color-text-tertiary)]">
                        {vehicle.quotationCount ?? 0} {t("detailsQuotations").toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                </Link>

                {/* Reviews */}
                <Link
                  href={`/${locale}/owner/reviews?vehicleId=${vehicle.id}`}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Star className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-body font-medium text-[var(--color-text-primary)]">
                        {t("detailsViewAllReviews")}
                      </p>
                      <p className="text-caption text-[var(--color-text-tertiary)]">
                        {vehicle.reviewCount ?? 0} {t("statRating").toLowerCase()}s
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                </Link>

                {/* Analytics */}
                <Link
                  href={`/${locale}/owner/analytics?vehicleId=${vehicle.id}`}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-body font-medium text-[var(--color-text-primary)]">
                      {t("detailsViewAnalytics")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                </Link>

                {/* Earnings */}
                <Link
                  href={`/${locale}/owner/earnings?vehicleId=${vehicle.id}`}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-body font-medium text-[var(--color-text-primary)]">
                      {t("detailsViewEarnings")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                </Link>

                {/* Availability */}
                <Link
                  href={`/${locale}/owner/fleet/${vehicle.id}/availability`}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-body font-medium text-[var(--color-text-primary)]">
                      {t("detailsSetAvailability")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={t("confirmDeleteTitle")}
        message={t("confirmDelete")}
        confirmText={t("actionDelete")}
        isLoading={isDeleting}
        variant="danger"
      />

      {/* Toggle status confirmation (adapts per action) */}
      {confirmToggleAction && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirmToggleAction(null)}
          onConfirm={handleToggle}
          title={TOGGLE_DIALOG[confirmToggleAction].title}
          message={TOGGLE_DIALOG[confirmToggleAction].message}
          confirmText={TOGGLE_DIALOG[confirmToggleAction].confirmText}
          isLoading={isToggling}
          variant={TOGGLE_DIALOG[confirmToggleAction].variant}
        />
      )}

      {/* Booking-block error dialog (cannot pause — active bookings exist) */}
      <ConfirmDialog
        isOpen={bookingsBlockError !== null}
        onClose={() => setBookingsBlockError(null)}
        onConfirm={() => setBookingsBlockError(null)}
        title={t("hasActiveBookingsTitle")}
        message={bookingsBlockError ?? t("hasActiveBookingsMsg")}
        confirmText="OK"
        variant="warning"
      />

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "border border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
              : "border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
          }`}
        >
          {toast.message}
          <button
            onClick={() => setToast(null)}
            aria-label={t("close")}
            className="rounded-lg p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
