"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  Map as MapIcon,
  PlusCircle,
  Route as RouteIcon,
  Snowflake,
  Users,
  XCircle,
} from "lucide-react";
import { Badge, CTAButton, LoadingSpinner } from "@/components/ui";
import { ApiError, tripService, type TripDTO } from "@/lib/api";
import { useProtectedRoute } from "@/hooks";

const DynamicInteractiveMap = dynamic(
  () =>
    import("@/components/ui/InteractiveMap").then(
      (mod) => mod.InteractiveMap || mod.default || mod,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] w-full animate-pulse items-center justify-center rounded-[20px] bg-[var(--color-bg-surface)]">
        <MapIcon className="h-8 w-8 text-[var(--color-text-tertiary)]" />
      </div>
    ),
  },
);

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

const badgeVariantForStatus = (
  status: TripDTO["status"],
): "info" | "success" | "warning" | "danger" | "secondary" => {
  switch (status) {
    case "AWAITING_QUOTES":
      return "info";
    case "PLANNING":
      return "warning";
    case "CONFIRMED":
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
    case "EXPIRED":
    default:
      return "secondary";
  }
};

interface TripDetailPageContentProps {
  locale: string;
  tripId: string;
}

const formatCurrency = (amount: number | null | undefined, locale: string) => {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-LK" : `${locale}-LK`, {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount)));
};

const quotationStatusBadgeVariant = (
  status?: string,
): "info" | "success" | "warning" | "danger" | "secondary" => {
  switch ((status || "").toUpperCase()) {
    case "ACCEPTED":
      return "success";
    case "SENT":
    case "VIEWED":
      return "info";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "danger";
    case "EXPIRED":
    default:
      return "secondary";
  }
};

export function TripDetailPageContent({
  locale,
  tripId,
}: TripDetailPageContentProps) {
  const t = useTranslations("trip");
  const tQuotation = useTranslations("quotation");
  const router = useRouter();
  const { isLoading: guardLoading, isAuthorized } = useProtectedRoute();

  const [trip, setTrip] = useState<TripDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchTrip = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tripService.getById(tripId);
      const raw = (response as any)?.data ?? response;
      const tripData = (raw?.trip ?? raw) as TripDTO;
      setTrip(tripData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("fetchError"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [tripId, t]);

  useEffect(() => {
    if (!isAuthorized) return;
    fetchTrip();
  }, [fetchTrip, isAuthorized]);

  const handleCancel = async () => {
    if (!trip) return;
    setIsCancelling(true);
    try {
      await tripService.cancel(trip.id);
      setCancelOpen(false);
      fetchTrip();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("cancelFailed"));
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (guardLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]"
        >
          {error || t("notFound")}
        </div>
        <Link
          href={`/${locale}/dashboard/trips`}
          className={`mt-4 inline-flex items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${focusRing}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("backToTrips")}
        </Link>
      </div>
    );
  }

  const startDate = new Date(trip.startDate).toLocaleDateString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endDate = new Date(trip.endDate).toLocaleDateString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isMultiDay =
    new Date(trip.startDate).toDateString() !==
    new Date(trip.endDate).toDateString();
  const isEditable =
    trip.status === "PLANNING" || trip.status === "AWAITING_QUOTES";
  const isCancellable = isEditable;

  const mapWaypoints: Array<{ lat: number; lng: number; name: string }> = [];
  if (trip.pickupLatitude && trip.pickupLongitude) {
    mapWaypoints.push({
      lat: trip.pickupLatitude,
      lng: trip.pickupLongitude,
      name: trip.pickupCity || trip.pickupLocation,
    });
  }
  // Intermediate stops captured during trip creation
  if (Array.isArray(trip.intermediateStops)) {
    for (const s of trip.intermediateStops) {
      const lat = s?.location?.lat;
      const lng = s?.location?.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        mapWaypoints.push({
          lat,
          lng,
          name: s.location.city || s.location.address || "",
        });
      }
    }
  }
  if (trip.dropoffLatitude && trip.dropoffLongitude) {
    mapWaypoints.push({
      lat: trip.dropoffLatitude,
      lng: trip.dropoffLongitude,
      name: trip.dropoffCity || trip.dropoffLocation || "",
    });
  }

  const quotations = trip.quotations ?? [];
  const ownerResponses = quotations.filter(
    (q) => (q.status as string)?.toUpperCase() !== "PENDING" || q.vehicleId,
  );
  const totalQuotes = quotations.length;
  const respondedQuotes = quotations.filter((q) => {
    const status = (q.status as string)?.toUpperCase();
    return status === "SENT" || status === "VIEWED" || status === "ACCEPTED";
  }).length;

  const tripTitle =
    trip.title ||
    `${trip.pickupCity || trip.pickupLocation.split(",")[0]} → ${
      trip.dropoffCity ||
      trip.dropoffLocation?.split(",")[0] ||
      t("noDestination")
    }`;

  return (
    <>
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
        <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
          <Link
            href={`/${locale}/dashboard/trips`}
            className={`mb-3 inline-flex items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] ${focusRing}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("backToTrips")}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
                  {trip.tripCode}
                </p>
                <Badge variant={badgeVariantForStatus(trip.status)}>
                  {t(`status.${trip.status.toLowerCase()}`)}
                </Badge>
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold text-[var(--color-text-primary)]">
                {tripTitle}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {isMultiDay
                  ? t("dateRange", { start: startDate, end: endDate })
                  : startDate}
                {trip.startTime ? ` · ${trip.startTime}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isEditable ? (
                <Link
                  href={`/${locale}/dashboard/search?tripId=${trip.id}`}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing}`}
                >
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  {t("addMoreVehicles")}
                </Link>
              ) : null}
              {isCancellable ? (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-sm font-medium text-[var(--color-error-text)] transition-colors hover:bg-[var(--color-error-bg)] ${focusRing}`}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  {t("cancelTrip")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 space-y-8">
        {/* Status banner */}
        {trip.status === "PLANNING" ? (
          <div
            role="status"
            className="rounded-xl border border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-text-primary)]"
          >
            <p className="font-semibold text-[var(--color-action-primary)]">
              {t("planningBannerTitle")}
            </p>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              {t("planningBannerBody")}
            </p>
          </div>
        ) : trip.status === "AWAITING_QUOTES" ? (
          <div
            role="status"
            className="rounded-xl border border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-text-primary)]"
          >
            <p className="font-semibold text-[var(--color-action-primary)]">
              {t("awaitingBannerTitle")}
            </p>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              {t("awaitingBannerBody", {
                received: respondedQuotes,
                total: totalQuotes,
              })}
            </p>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Trip info */}
            <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                <MapPin
                  className="h-5 w-5 text-[var(--color-text-secondary)]"
                  aria-hidden="true"
                />
                {t("tripInfoHeading")}
              </h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <DescriptionItem
                  icon={
                    <Calendar
                      className="h-4 w-4 text-[var(--color-text-tertiary)]"
                      aria-hidden="true"
                    />
                  }
                  label={tQuotation("pickupDate")}
                  value={
                    isMultiDay
                      ? t("dateRange", { start: startDate, end: endDate })
                      : startDate
                  }
                />
                {trip.startTime ? (
                  <DescriptionItem
                    icon={
                      <Clock
                        className="h-4 w-4 text-[var(--color-text-tertiary)]"
                        aria-hidden="true"
                      />
                    }
                    label={tQuotation("pickupTime")}
                    value={trip.startTime}
                  />
                ) : null}
                <DescriptionItem
                  icon={
                    <MapPin
                      className="h-4 w-4 text-[var(--color-text-tertiary)]"
                      aria-hidden="true"
                    />
                  }
                  label={tQuotation("pickupLocation")}
                  value={trip.pickupLocation}
                />
                <DescriptionItem
                  icon={
                    <MapPin
                      className="h-4 w-4 text-[var(--color-text-tertiary)]"
                      aria-hidden="true"
                    />
                  }
                  label={tQuotation("destination")}
                  value={trip.dropoffLocation || t("noDestination")}
                />
                <DescriptionItem
                  icon={
                    <Users
                      className="h-4 w-4 text-[var(--color-text-tertiary)]"
                      aria-hidden="true"
                    />
                  }
                  label={t("passengersLabel")}
                  value={String(trip.passengerCount)}
                />
                <DescriptionItem
                  icon={
                    <Snowflake
                      className="h-4 w-4 text-[var(--color-text-tertiary)]"
                      aria-hidden="true"
                    />
                  }
                  label={tQuotation("needsAC")}
                  value={trip.needsAC ? t("yes") : t("no")}
                />
                {trip.vehicleTypePreference ? (
                  <DescriptionItem
                    icon={
                      <ClipboardList
                        className="h-4 w-4 text-[var(--color-text-tertiary)]"
                        aria-hidden="true"
                      />
                    }
                    label={tQuotation("vehicleType")}
                    value={trip.vehicleTypePreference}
                  />
                ) : null}
              </dl>

              {trip.specialRequests ? (
                <div className="mt-6 rounded-xl bg-[var(--color-bg-surface)] p-4">
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
                    {tQuotation("specialRequirements")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                    {trip.specialRequests}
                  </p>
                </div>
              ) : null}
            </section>

            {/* Quotation responses */}
            <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
              <header className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {t("quotationsHeading")}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {t("quotationsSubtitle", {
                      received: respondedQuotes,
                      total: totalQuotes,
                    })}
                  </p>
                </div>
                {ownerResponses.length > 1 ? (
                  <Link
                    href={`/${locale}/dashboard/quotations/compare?tripId=${trip.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] px-3 py-1.5 text-sm font-medium text-[var(--color-action-primary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
                  >
                    {tQuotation("compareQuotations")}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </header>

              {ownerResponses.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <ClipboardList
                    className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-tertiary)]"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {t("noQuotesTitle")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {t("noQuotesBody")}
                  </p>
                  {isEditable ? (
                    <CTAButton
                      href={`/${locale}/dashboard/search?tripId=${trip.id}`}
                      size="sm"
                      className="mt-4 inline-flex"
                      leftIcon={
                        <PlusCircle className="h-4 w-4" aria-hidden="true" />
                      }
                    >
                      {t("addMoreVehicles")}
                    </CTAButton>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border-default)]">
                  {ownerResponses.map((q: any) => {
                    const vehicle = q.vehicle;
                    const owner = vehicle?.owner;
                    const status = String(q.status || "").toUpperCase();
                    const hasResponse =
                      status === "SENT" ||
                      status === "VIEWED" ||
                      status === "ACCEPTED" ||
                      status === "REJECTED";
                    return (
                      <li key={q.id}>
                        <Link
                          href={`/${locale}/dashboard/quotations/${q.id}`}
                          className={`flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]">
                            {status === "ACCEPTED" ? (
                              <CheckCircle2
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            ) : (
                              <ClipboardList
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                                {vehicle
                                  ? `${vehicle.brand || ""} ${
                                      vehicle.model || ""
                                    }`.trim() ||
                                    vehicle.name ||
                                    vehicle.licensePlate
                                  : t("vehicleUnassigned")}
                              </p>
                              <Badge
                                variant={quotationStatusBadgeVariant(status)}
                              >
                                {tQuotation(
                                  `statusBadge.${status.toLowerCase()}` as any,
                                )}
                              </Badge>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                              {owner
                                ? `${owner.firstName} ${owner.lastName}`
                                : t("ownerFallback")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[var(--color-text-tertiary)]">
                              {tQuotation("total")}
                            </p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {hasResponse && q.totalAmount
                                ? `LKR ${formatCurrency(q.totalAmount, locale)}`
                                : "—"}
                            </p>
                          </div>
                          <ArrowRight
                            className="h-4 w-4 text-[var(--color-text-tertiary)]"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Map */}
            <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
              <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                {tQuotation("routeSummary")}
              </h3>
              <DynamicInteractiveMap
                readOnly={true}
                initialWaypoints={mapWaypoints}
              />
            </section>

            {/* Estimates */}
            <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
              <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                {tQuotation("tripEstimates")}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg-surface)] p-4">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {tQuotation("estimatedDistance")}
                    </p>
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">
                      {trip.estimatedDistance || "—"}
                    </p>
                  </div>
                  <RouteIcon
                    className="h-8 w-8 text-[var(--color-text-tertiary)]"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg-surface)] p-4">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {tQuotation("estimatedDuration")}
                    </p>
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">
                      {trip.estimatedDuration || "—"}
                    </p>
                  </div>
                  <Clock
                    className="h-8 w-8 text-[var(--color-text-tertiary)]"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {cancelOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-trip-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text-primary)]/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-error-bg)]">
              <AlertTriangle
                className="h-6 w-6 text-[var(--color-error-text)]"
                aria-hidden="true"
              />
            </div>
            <h2
              id="cancel-trip-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              {t("cancelConfirmTitle")}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t("cancelConfirmBody")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                disabled={isCancelling}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
              >
                {t("keepTrip")}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-error-border)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 ${focusRing} disabled:opacity-60`}
              >
                {isCancelling ? <LoadingSpinner size="sm" /> : null}
                {t("confirmCancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DescriptionItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {value}
        </dd>
      </div>
    </div>
  );
}
