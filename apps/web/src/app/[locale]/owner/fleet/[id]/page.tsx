"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { CTAButton, LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { ApiError, vehicleService } from "@/lib/api";
import type { Vehicle } from "@/types";
import {
  AlertCircle,
  ArrowLeft,
  Bus,
  Calendar,
  Camera,
  Edit,
  MapPin,
} from "lucide-react";

type VehicleActiveStatus = "active" | "inactive" | "pending";

type VehiclePhoto = {
  id?: string;
  url?: string | null;
  fileName?: string | null;
  isPrimary?: boolean | null;
  sortOrder?: number | null;
};

const getVehicleImageUrl = (vehicle: Vehicle): string | null => {
  const photos = Array.isArray(vehicle.photos)
    ? (vehicle.photos as VehiclePhoto[])
    : [];
  const primary = photos.find((photo) => photo?.isPrimary && photo?.url);
  const first = photos.find((photo) => photo?.url);
  return primary?.url ?? first?.url ?? vehicle.images?.[0] ?? null;
};

const getVehicleStatus = (vehicle: Vehicle): VehicleActiveStatus => {
  if (!vehicle.isActive) return "pending";
  if (!vehicle.isAvailable) return "inactive";
  return "active";
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
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("detailsErrorLoad"));
      }
      setVehicle(null);
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId, t]);

  useEffect(() => {
    if (isAuthorized && user) {
      fetchVehicle();
    }
  }, [fetchVehicle, isAuthorized, user]);

  const status = useMemo(
    () => (vehicle ? getVehicleStatus(vehicle) : "pending"),
    [vehicle],
  );

  const STATUS_LABELS: Record<VehicleActiveStatus, string> = {
    active: t("statusActive"),
    inactive: t("statusInactive"),
    pending: t("statusPending"),
  };

  const statusBadgeClass = (value: VehicleActiveStatus): string => {
    if (value === "active")
      return "border border-success bg-[var(--color-success-bg)] text-success-foreground";
    if (value === "pending")
      return "border border-primary/30 bg-primary/10 text-primary";
    return "border border-border bg-muted text-muted-foreground";
  };

  const availabilityBadgeClass = (available: boolean): string =>
    available
      ? "border border-success bg-[var(--color-success-bg)] text-success-foreground"
      : "border border-border bg-muted text-muted-foreground";

  const formatText = (value?: string | null): string =>
    value && value.trim().length > 0 ? value : t("detailsNotProvided");

  const formatNumber = (value?: number | null): string =>
    value === null || value === undefined
      ? t("detailsNotProvided")
      : `${t("currency")} ${value.toLocaleString()}`;

  const acTypeLabel = (value?: string | null): string => {
    if (!value) return t("detailsNotProvided");
    const normalized = value.toLowerCase().replace(/_/g, "-");
    if (normalized === "full-ac") return t("acTypeFull");
    if (normalized === "ac") return t("acTypeAc");
    if (normalized === "non-ac" || normalized === "nonac")
      return t("acTypeNonAc");
    return value;
  };

  if (guardLoading || !isAuthorized || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center bg-muted">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (error || !vehicle) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-muted">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="rounded-[20px] border border-error bg-[var(--color-error-bg)] p-6 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-error-foreground" />
              <p className="text-body text-error-foreground">
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
      </MainLayout>
    );
  }

  const imageUrl = getVehicleImageUrl(vehicle);
  const amenities = Array.isArray(vehicle.amenities)
    ? vehicle.amenities.filter((amenity) => amenity)
    : [];

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/fleet`}
              className="mb-3 flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
              {tForm("backToFleet")}
            </Link>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-heading-md font-semibold text-foreground">
                  {t("detailsTitle")}
                </h1>
                <p className="text-body text-muted-foreground">
                  {t("detailsSubtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <CTAButton
                  variant="secondary"
                  href={`/${locale}/owner/fleet/${vehicle.id}/availability`}
                  leftIcon={<Calendar className="h-5 w-5" />}
                >
                  {t("actionAvailability")}
                </CTAButton>
                <CTAButton
                  href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                  leftIcon={<Edit className="h-5 w-5" />}
                >
                  {t("actionEdit")}
                </CTAButton>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[20px] border border-border bg-card">
                <div className="relative aspect-video bg-muted">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={vehicle.licensePlate}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Bus className="h-16 w-16 text-muted-foreground opacity-30" />
                    </div>
                  )}
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-caption font-medium ${statusBadgeClass(
                        status,
                      )}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-caption font-medium ${availabilityBadgeClass(
                        vehicle.isAvailable,
                      )}`}
                    >
                      {vehicle.isAvailable
                        ? t("detailsAvailable")
                        : t("detailsUnavailable")}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-body-lg font-semibold text-foreground">
                      {vehicle.name || vehicle.licensePlate}
                    </h2>
                    <span className="text-caption text-muted-foreground">
                      {vehicle.licensePlate}
                    </span>
                  </div>
                  <p className="mt-1 text-body text-muted-foreground">
                    {vehicle.brand} {vehicle.model}
                    {vehicle.year ? ` • ${vehicle.year}` : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-[20px] border border-border bg-card p-6">
                <h3 className="text-body-lg font-semibold text-foreground">
                  {tForm("sectionBasic")}
                </h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldBusName")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatText(vehicle.name)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldRegistration")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatText(vehicle.licensePlate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldBusType")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatText(vehicle.type as string)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldCapacity")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {vehicle.seats} {t("seats")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldMake")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatText(vehicle.brand)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldModel")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatText(vehicle.model)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldYear")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {vehicle.year ?? t("detailsNotProvided")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldAcType")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {acTypeLabel(vehicle.acType)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldCondition")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatText(vehicle.condition ?? null)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {tForm("fieldLocation")}
                    </dt>
                    <dd className="flex items-center gap-2 text-body font-medium text-foreground">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {formatText(vehicle.location)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {t("colStatus")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {STATUS_LABELS[status]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">
                      {t("detailsAvailability")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {vehicle.isAvailable
                        ? t("detailsAvailable")
                        : t("detailsUnavailable")}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[20px] border border-border bg-card p-6">
                <h3 className="text-body-lg font-semibold text-foreground">
                  {tForm("fieldDescription")}
                </h3>
                <p className="mt-3 text-body text-muted-foreground">
                  {formatText(vehicle.description ?? null)}
                </p>
              </div>

              {/* Photo Gallery */}
              <div className="rounded-[20px] border border-border bg-card p-6">
                <h3 className="text-body-lg font-semibold text-foreground">
                  {tForm("photosTitle")}
                </h3>
                {(() => {
                  const allPhotos = Array.isArray(vehicle.photos)
                    ? (vehicle.photos as VehiclePhoto[]).filter((p) => p?.url)
                    : [];
                  if (allPhotos.length === 0) {
                    return (
                      <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                        <Camera className="mb-3 h-10 w-10 text-muted-foreground/40" />
                        <p className="text-body text-muted-foreground">
                          No photos uploaded yet
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {allPhotos.map((photo, idx) => (
                        <div
                          key={photo.id || idx}
                          className="group relative overflow-hidden rounded-xl border border-border"
                        >
                          <Image
                            src={photo.url!}
                            alt={photo.fileName || `Vehicle photo ${idx + 1}`}
                            width={400}
                            height={300}
                            className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"
                          />
                          {photo.isPrimary && (
                            <span className="absolute left-2 top-2 rounded-lg bg-[var(--color-action-primary)] px-2 py-0.5 text-xs font-medium text-white">
                              {tForm("photoPrimary")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[20px] border border-border bg-card p-6">
                <h3 className="text-body-lg font-semibold text-foreground">
                  {tForm("pricingTitle")}
                </h3>
                <dl className="mt-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-body text-muted-foreground">
                      {tForm("fieldPricePerKm")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatNumber(vehicle.pricePerKm ?? null)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-body text-muted-foreground">
                      {tForm("fieldPricePerDay")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatNumber(vehicle.pricePerDay ?? null)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-body text-muted-foreground">
                      {tForm("fieldDriverAllowance")}
                    </dt>
                    <dd className="text-body font-medium text-foreground">
                      {formatNumber(vehicle.driverAllowance ?? null)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[20px] border border-border bg-card p-6">
                <h3 className="text-body-lg font-semibold text-foreground">
                  {tForm("sectionAmenities")}
                </h3>
                {amenities.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="rounded-lg border border-border bg-background px-3 py-1 text-caption text-muted-foreground"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-body text-muted-foreground">
                    {t("detailsNoAmenities")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
