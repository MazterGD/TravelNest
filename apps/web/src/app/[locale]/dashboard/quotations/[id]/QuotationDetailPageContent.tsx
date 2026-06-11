"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowLeft,
  Bus,
  Calendar,
  CheckCircle2,
  Clock,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  StickyNote,
  Users,
  XCircle,
} from "lucide-react";
import {
  Badge,
  CTAButton,
  EmptyBoxIcon,
  EmptyState,
  LoadingSpinner,
} from "@/components/ui";
import { ApiError, quotationService } from "@/lib/api";
import { useProtectedRoute } from "@/hooks";

const InteractiveMap = dynamic(
  () =>
    import("@/components/ui/InteractiveMap").then(
      (mod) => mod.InteractiveMap || (mod as any).default || mod,
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

interface QuotationDetailPageContentProps {
  locale: string;
  requestId: string;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

const formatCurrency = (amount: number | null | undefined, locale: string) => {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat(
    locale === "en" ? "en-LK" : `${locale}-LK`,
    { maximumFractionDigits: 0 },
  ).format(Math.max(0, Math.round(amount)));
};

const statusBadgeVariant = (
  status: string,
): "info" | "success" | "warning" | "danger" | "secondary" => {
  switch (status?.toUpperCase()) {
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

export function QuotationDetailPageContent({
  locale,
  requestId,
}: QuotationDetailPageContentProps) {
  const t = useTranslations("quotation");
  const tTrip = useTranslations("trip");
  const router = useRouter();
  const { isLoading: guardLoading, isAuthorized } = useProtectedRoute();

  const [quotation, setQuotation] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmAccept, setConfirmAccept] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchQuotation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await quotationService.getById(requestId);
      const raw = response as any;
      const q = raw?.data?.quotation || raw?.quotation || raw;
      setQuotation(q);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("errorLoadingQuotations"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [requestId, t]);

  useEffect(() => {
    if (!isAuthorized) return;
    fetchQuotation();
  }, [fetchQuotation, isAuthorized]);

  const handleAccept = async () => {
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      await quotationService.respondToQuotation(requestId, {
        status: "ACCEPTED",
      });
      setConfirmAccept(false);
      // Acceptance creates a booking; route the customer to the bookings list
      // so they can review and pay.
      router.push(`/${locale}/dashboard/bookings`);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError(t("submitFailed"));
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReject = async () => {
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      await quotationService.respondToQuotation(requestId, {
        status: "REJECTED",
        rejectionReason: rejectReason.trim() || undefined,
      });
      setConfirmReject(false);
      fetchQuotation();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError(t("submitFailed"));
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (guardLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <EmptyState
          icon={<EmptyBoxIcon />}
          title={t("errorLoadingQuotations")}
          description={error || t("quotationNotFound")}
        />
        <Link
          href={`/${locale}/dashboard/trips`}
          className={`mt-4 inline-flex items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${focusRing}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {tTrip("backToTrips")}
        </Link>
      </div>
    );
  }

  const status = (quotation.status as string)?.toUpperCase();
  const isRespondable = status === "SENT" || status === "VIEWED";
  // Show the price breakdown whenever the owner actually priced this quote —
  // even if it later expired or was rejected. The customer often still wants
  // to see what they were offered.
  const hasPricing =
    typeof quotation.totalAmount === "number" && quotation.totalAmount > 0;

  const vehicle = quotation.vehicle;
  const owner = vehicle?.owner;
  const vehicleName =
    vehicle?.name ||
    (vehicle ? `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() : "") ||
    vehicle?.licensePlate ||
    tTrip("vehicleUnassigned");

  const startDate = quotation.startDate
    ? new Date(quotation.startDate).toLocaleDateString(locale, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const endDate = quotation.endDate
    ? new Date(quotation.endDate).toLocaleDateString(locale, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const isMultiDay =
    quotation.startDate &&
    quotation.endDate &&
    new Date(quotation.startDate).toDateString() !==
      new Date(quotation.endDate).toDateString();

  const customItems: Array<{ description: string; amount: number }> =
    Array.isArray(quotation.customItems) ? quotation.customItems : [];

  const validUntilLabel = quotation.validUntil
    ? new Date(quotation.validUntil).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const tripBackHref = quotation.tripId
    ? `/${locale}/dashboard/trips/${quotation.tripId}`
    : `/${locale}/dashboard/trips`;

  const stopNames: string[] = Array.isArray(quotation.trip?.intermediateStops)
    ? (quotation.trip.intermediateStops as any[])
        .map((s) => s?.location?.city || s?.location?.address || "")
        .filter((n: string) => Boolean(n))
    : [];

  return (
    <>
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={tripBackHref}
            className={`mb-3 inline-flex items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] ${focusRing}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {quotation.tripId ? tTrip("backToTrips") : t("back")}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
                  {quotation.quotationId}
                </p>
                <Badge variant={statusBadgeVariant(status)}>
                  {t(`statusBadge.${status.toLowerCase()}`, {
                    defaultValue: status,
                  })}
                </Badge>
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold text-[var(--color-text-primary)]">
                {vehicleName}
              </h1>
              {owner ? (
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {tTrip("ownerLabel", { defaultValue: "Owner" })}: {owner.firstName} {owner.lastName}
                </p>
              ) : null}
            </div>
            {hasPricing ? (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  {t("total")}
                </p>
                <p className="text-2xl font-bold text-[var(--color-action-primary)]">
                  LKR {formatCurrency(quotation.totalAmount, locale)}
                </p>
                {validUntilLabel ? (
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {t("validUntil")} {validUntilLabel}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {actionError ? (
          <div
            role="alert"
            className="rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]"
          >
            {actionError}
          </div>
        ) : null}

        {/* Pending banner — owner hasn't responded yet */}
        {status === "PENDING" ? (
          <div
            role="status"
            className="rounded-xl border border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-text-primary)]"
          >
            <p className="font-semibold text-[var(--color-action-primary)]">
              {t("statusBanner.pendingTitle")}
            </p>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              {t("statusBanner.pendingBody")}
            </p>
          </div>
        ) : null}

        {status === "EXPIRED" ? (
          <div
            role="status"
            className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-text-secondary)]"
          >
            {t("statusBanner.expiredBody")}
          </div>
        ) : null}

        {status === "REJECTED" ? (
          <div
            role="status"
            className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-text-secondary)]"
          >
            {t("statusBanner.rejectedBody")}
            {quotation.rejectionReason ? (
              <p className="mt-1 italic">
                {t("rejectionReason")}: {quotation.rejectionReason}
              </p>
            ) : null}
          </div>
        ) : null}

        {status === "ACCEPTED" ? (
          <div
            role="status"
            className="rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-4 text-sm text-[var(--color-success-text)]"
          >
            {t("statusBanner.acceptedBody")}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: trip + vehicle + price breakdown */}
          <div className="space-y-6 lg:col-span-2">
            {/* Trip details snapshot */}
            <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                <MapPin
                  className="h-5 w-5 text-[var(--color-text-secondary)]"
                  aria-hidden="true"
                />
                {t("tripDetails")}
              </h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail
                  icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                  label={t("from")}
                  value={quotation.pickupLocation || "—"}
                />
                <Detail
                  icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                  label={t("to")}
                  value={quotation.dropoffLocation || tTrip("noDestination")}
                />
                <Detail
                  icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
                  label={t("pickupDate")}
                  value={
                    isMultiDay
                      ? tTrip("dateRange", { start: startDate, end: endDate })
                      : startDate
                  }
                />
                {quotation.startTime ? (
                  <Detail
                    icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                    label={t("pickupTime")}
                    value={quotation.startTime}
                  />
                ) : null}
                <Detail
                  icon={<Users className="h-4 w-4" aria-hidden="true" />}
                  label={t("passengers")}
                  value={String(quotation.passengerCount ?? "—")}
                />
                {quotation.estimatedDistance ? (
                  <Detail
                    icon={<MapIcon className="h-4 w-4" aria-hidden="true" />}
                    label={t("estimatedDistance")}
                    value={quotation.estimatedDistance}
                  />
                ) : null}
              </dl>
              {stopNames.length > 0 ? (
                <div className="mt-6">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {t("intermediateStops")}
                  </p>
                  <ol className="mt-2 space-y-1.5">
                    {stopNames.map((name, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-surface)] text-xs font-medium text-[var(--color-action-primary)]">
                          {i + 1}
                        </span>
                        {name}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {quotation.specialRequests ? (
                <div className="mt-6 rounded-xl bg-[var(--color-bg-surface)] p-4">
                  <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
                    {t("specialRequirements")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                    {quotation.specialRequests}
                  </p>
                </div>
              ) : null}
            </section>

            {/* Vehicle card */}
            {vehicle ? (
              <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  <Bus
                    className="h-5 w-5 text-[var(--color-text-secondary)]"
                    aria-hidden="true"
                  />
                  {t("vehicleDetails", { defaultValue: "Vehicle" })}
                </h2>
                <div className="flex flex-col gap-4 sm:flex-row">
                  {Array.isArray(vehicle.images) && vehicle.images[0] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={vehicle.images[0]}
                      alt={vehicleName}
                      className="h-32 w-full rounded-xl object-cover sm:w-48"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded-xl bg-[var(--color-bg-surface)] sm:w-48">
                      <Bus
                        className="h-10 w-10 text-[var(--color-text-tertiary)]"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-[var(--color-text-primary)]">
                      {vehicleName}
                    </p>
                    {vehicle.licensePlate ? (
                      <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                        {vehicle.licensePlate}
                      </p>
                    ) : null}
                    {vehicle.year ? (
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        {vehicle.year}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {/* Price breakdown — shown whenever the owner priced the quote,
                including EXPIRED so the customer can still see what was
                offered. */}
            {hasPricing ? (
              <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("priceBreakdown")}
                </h2>
                <dl className="space-y-2 text-sm">
                  <BreakdownRow label={t("vehicleRental")} amount={quotation.vehicleRentalCost} locale={locale} />
                  <BreakdownRow label={t("driverCost")} amount={quotation.driverCost} locale={locale} />
                  <BreakdownRow label={t("fuelCost")} amount={quotation.fuelCost} locale={locale} />
                  {quotation.tollCharges ? (
                    <BreakdownRow label={t("tollCharges")} amount={quotation.tollCharges} locale={locale} />
                  ) : null}
                  {quotation.permitFees ? (
                    <BreakdownRow label={t("permitFees")} amount={quotation.permitFees} locale={locale} />
                  ) : null}
                  {customItems.map((item, idx) => (
                    <BreakdownRow
                      key={`custom-${idx}`}
                      label={item.description}
                      amount={item.amount}
                      locale={locale}
                    />
                  ))}
                  {quotation.tax ? (
                    <BreakdownRow label={t("tax")} amount={quotation.tax} locale={locale} />
                  ) : null}
                  <div className="mt-3 flex justify-between border-t border-[var(--color-border-default)] pt-3 text-base font-semibold text-[var(--color-text-primary)]">
                    <span>{t("total")}</span>
                    <span>LKR {formatCurrency(quotation.totalAmount, locale)}</span>
                  </div>
                </dl>

                {quotation.additionalNotes ? (
                  <div className="mt-6 rounded-xl bg-[var(--color-bg-surface)] p-4">
                    <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-tertiary)]">
                      <StickyNote className="h-4 w-4" aria-hidden="true" />
                      {t("additionalNotes")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                      {quotation.additionalNotes}
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* Actions */}
            {isRespondable ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <CTAButton
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => setConfirmAccept(true)}
                  leftIcon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                >
                  {t("acceptQuotation")}
                </CTAButton>
                <CTAButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setConfirmReject(true)}
                  leftIcon={<XCircle className="h-5 w-5" aria-hidden="true" />}
                >
                  {t("decline")}
                </CTAButton>
              </div>
            ) : null}
          </div>

          {/* Right column: map + owner contact */}
          <div className="space-y-6">
            <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
              <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                {t("routeSummary")}
              </h3>
              <InteractiveMap
                readOnly={true}
                initialWaypoints={buildWaypoints(quotation)}
                initialRouteGeometry={
                  quotation.itineraryRoute?.coordinates?.map(
                    ([lng, lat]: [number, number]) => [lat, lng],
                  ) ?? []
                }
              />
            </section>

            {owner ? (
              <section className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("ownerContact", { defaultValue: "Owner contact" })}
                </h3>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {owner.firstName} {owner.lastName}
                </p>
                {owner.email ? (
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                    {owner.email}
                  </p>
                ) : null}
                {/* Chat link. If the customer has already accepted this
                    quote, a booking exists — deep-link directly into that
                    conversation. Otherwise drop them on the messages list
                    where they can find any existing thread with this owner
                    (booking-scoped chat opens once a booking is created). */}
                {quotation.booking?.id ? (
                  <Link
                    href={`/${locale}/dashboard/messages?booking=${quotation.booking.id}`}
                    className={`mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing}`}
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    {t("chatWithOwner", { defaultValue: "Chat with owner" })}
                  </Link>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Link
                      href={`/${locale}/dashboard/messages`}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      {t("openMessages", { defaultValue: "Open messages" })}
                    </Link>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {t("chatPreBookingHint", {
                        defaultValue:
                          "Chat opens once the booking is confirmed.",
                      })}
                    </p>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </div>

      {/* Accept confirmation */}
      {confirmAccept ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="accept-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text-primary)]/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)]">
              <CheckCircle2
                className="h-6 w-6 text-[var(--color-success-text)]"
                aria-hidden="true"
              />
            </div>
            <h2 id="accept-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
              {t("confirm.acceptTitle")}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t("confirm.acceptBody")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAccept(false)}
                disabled={isSubmittingAction}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
              >
                {t("confirm.cancelAction")}
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={isSubmittingAction}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing} disabled:opacity-60`}
              >
                {isSubmittingAction ? <LoadingSpinner size="sm" /> : null}
                {t("acceptQuotation")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reject confirmation */}
      {confirmReject ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text-primary)]/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-error-bg)]">
              <AlertTriangle
                className="h-6 w-6 text-[var(--color-error-text)]"
                aria-hidden="true"
              />
            </div>
            <h2 id="reject-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
              {t("confirm.rejectTitle")}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t("confirm.rejectBody")}
            </p>
            <label className="mt-4 block text-sm font-medium text-[var(--color-text-secondary)]">
              {t("rejectionReason")}
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder={t("confirm.rejectReasonPlaceholder")}
              className={`mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] ${focusRing}`}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmReject(false)}
                disabled={isSubmittingAction}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
              >
                {t("confirm.cancelAction")}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmittingAction}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-error-border)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 ${focusRing} disabled:opacity-60`}
              >
                {isSubmittingAction ? <LoadingSpinner size="sm" /> : null}
                {t("decline")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function buildWaypoints(quotation: any): Array<{ lat: number; lng: number; name: string }> {
  const wps: Array<{ lat: number; lng: number; name: string }> = [];
  const trip = quotation?.trip;
  if (trip?.pickupLatitude && trip?.pickupLongitude) {
    wps.push({
      lat: trip.pickupLatitude,
      lng: trip.pickupLongitude,
      name: trip.pickupCity || "",
    });
  }
  if (Array.isArray(trip?.intermediateStops)) {
    for (const stop of trip.intermediateStops) {
      const lat = stop?.location?.lat;
      const lng = stop?.location?.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        wps.push({
          lat,
          lng,
          name: stop.location.city || stop.location.address || "",
        });
      }
    }
  }
  if (trip?.dropoffLatitude && trip?.dropoffLongitude) {
    wps.push({
      lat: trip.dropoffLatitude,
      lng: trip.dropoffLongitude,
      name: trip.dropoffCity || "",
    });
  }
  return wps;
}

function Detail({
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
      <div className="mt-0.5 text-[var(--color-text-tertiary)]">{icon}</div>
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

function BreakdownRow({
  label,
  amount,
  locale,
}: {
  label: string;
  amount: number | null | undefined;
  locale: string;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="font-medium text-[var(--color-text-primary)]">
        LKR {formatCurrency(amount, locale)}
      </dd>
    </div>
  );
}
