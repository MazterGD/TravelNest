"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  Clock,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  Plus,
  Route as RouteIcon,
  Save,
  Send,
  Snowflake,
  Users,
  X,
} from "lucide-react";
import {
  CTAButton,
  Input,
  LoadingSpinner,
  LocationAutocomplete,
  Select,
  TextArea,
} from "@/components/ui";
import { useAuthStore } from "@/store";
import { useProtectedRoute } from "@/hooks";
import { ApiError, landingContentService, tripService } from "@/lib/api";

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

interface Location {
  address: string;
  city: string;
  district: string;
  lat?: number;
  lng?: number;
}

interface IntermediateStop {
  id: string;
  location: Location;
}

interface NewTripPageContentProps {
  locale: string;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

export function NewTripPageContent({ locale }: NewTripPageContentProps) {
  const t = useTranslations("trip");
  const tQuotation = useTranslations("quotation");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { isLoading: guardLoading, isAuthorized } = useProtectedRoute();

  // If the customer reached this page via a vehicle CTA, we remember the
  // vehicleId so we can redirect them straight into the quotation form once
  // the trip is created — keeping the flow tight when they arrived intending
  // to book a specific bus.
  const followUpVehicleId = searchParams.get("vehicleId");

  const [title, setTitle] = useState("");
  const [pickupLocation, setPickupLocation] = useState<Location>({
    address: "",
    city: "",
    district: "",
  });
  const [dropoffLocation, setDropoffLocation] = useState<Location>({
    address: "",
    city: "",
    district: "",
  });
  const [intermediateStops, setIntermediateStops] = useState<IntermediateStop[]>([]);
  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [vehicleType, setVehicleType] = useState("");
  const [needsAC, setNeedsAC] = useState(true);
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [isRoundTrip, setIsRoundTrip] = useState(false);

  const [estimatedDistance, setEstimatedDistance] = useState("—");
  const [estimatedDuration, setEstimatedDuration] = useState("—");
  const [itineraryStops, setItineraryStops] = useState<any[]>([]);
  const [itineraryRoute, setItineraryRoute] = useState<any>(null);

  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftSaveSuccess, setDraftSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        setVehicleTypeOptions(response.options.quotationVehicleTypes || []);
      } catch (error) {
        console.error("Failed to fetch config:", error);
      }
    };
    fetchConfig();
  }, []);

  // Re-estimate the route whenever locations change (debounced).
  useEffect(() => {
    const canEstimate =
      pickupLocation.city &&
      pickupLocation.district &&
      dropoffLocation.city &&
      dropoffLocation.district;

    if (!canEstimate) {
      setEstimatedDistance("—");
      setEstimatedDuration("—");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await landingContentService.getRouteEstimate({
          pickupLocation,
          dropoffLocation,
          intermediateStops: intermediateStops
            .map((stop) => stop.location)
            .filter(
              (stop) =>
                Boolean(stop.city?.trim()) && Boolean(stop.district?.trim()),
            ),
          isRoundTrip,
        });
        setEstimatedDistance(response.displayDistance);
        setEstimatedDuration(response.displayDuration);
      } catch (error) {
        console.error("Failed to fetch route estimate:", error);
        setEstimatedDistance("—");
        setEstimatedDuration("—");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [pickupLocation, dropoffLocation, intermediateStops, isRoundTrip]);

  const mapWaypoints = useMemo(() => {
    const wps: Array<{ lat: number; lng: number; name: string }> = [];
    if (pickupLocation.lat && pickupLocation.lng) {
      wps.push({
        lat: pickupLocation.lat,
        lng: pickupLocation.lng,
        name: pickupLocation.city,
      });
    }
    intermediateStops.forEach((stop) => {
      if (stop.location.lat && stop.location.lng) {
        wps.push({
          lat: stop.location.lat,
          lng: stop.location.lng,
          name: stop.location.city,
        });
      }
    });
    if (dropoffLocation.lat && dropoffLocation.lng) {
      wps.push({
        lat: dropoffLocation.lat,
        lng: dropoffLocation.lng,
        name: dropoffLocation.city,
      });
    }
    return wps;
  }, [pickupLocation, intermediateStops, dropoffLocation]);

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    const next = [...intermediateStops];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setIntermediateStops(next);
  };
  const moveStopDown = (index: number) => {
    if (index === intermediateStops.length - 1) return;
    const next = [...intermediateStops];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    setIntermediateStops(next);
  };
  const handleAddStop = () => {
    setIntermediateStops([
      ...intermediateStops,
      {
        id: `stop-${Date.now()}`,
        location: { address: "", city: "", district: "" },
      },
    ]);
  };
  const handleRemoveStop = (id: string) => {
    setIntermediateStops(intermediateStops.filter((s) => s.id !== id));
  };
  const handleUpdateStop = (id: string, location: Partial<Location>) => {
    setIntermediateStops(
      intermediateStops.map((stop) =>
        stop.id === id
          ? { ...stop, location: { ...stop.location, ...location } }
          : stop,
      ),
    );
  };

  const handleSaveDraft = () => {
    const draft = {
      title,
      pickupLocation,
      dropoffLocation,
      intermediateStops,
      pickupDate,
      returnDate,
      pickupTime,
      passengerCount,
      vehicleType,
      needsAC,
      specialRequirements,
      isRoundTrip,
    };
    localStorage.setItem("trip-draft", JSON.stringify(draft));
    setDraftSaveSuccess(true);
    setTimeout(() => setDraftSaveSuccess(false), 3000);
  };

  const validate = (): string | null => {
    if (!pickupLocation.city || !pickupLocation.district) {
      return t("validation.pickup");
    }
    if (!pickupDate) return t("validation.pickupDate");
    if (!pickupTime) return t("validation.pickupTime");
    if (isRoundTrip && !returnDate) return t("validation.returnDate");
    if (passengerCount < 1) return t("validation.passengers");
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await tripService.create({
        title: title.trim() || undefined,
        pickupLocation: {
          address: pickupLocation.address || pickupLocation.city,
          city: pickupLocation.city,
          district: pickupLocation.district,
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
        },
        dropoffLocation: dropoffLocation.city
          ? {
              address: dropoffLocation.address || dropoffLocation.city,
              city: dropoffLocation.city,
              district: dropoffLocation.district,
              lat: dropoffLocation.lat,
              lng: dropoffLocation.lng,
            }
          : undefined,
        intermediateStops: intermediateStops
          .filter((s) => s.location.city)
          .map((s) => ({ id: s.id, location: s.location })),
        startDate: new Date(pickupDate).toISOString(),
        endDate:
          isRoundTrip && returnDate
            ? new Date(returnDate).toISOString()
            : undefined,
        startTime: pickupTime,
        isRoundTrip,
        passengerCount,
        vehicleTypePreference: vehicleType || undefined,
        needsAC,
        specialRequests: specialRequirements || undefined,
        estimatedDistance,
        estimatedDuration,
        itineraryStops: itineraryStops.length > 0 ? itineraryStops : undefined,
        itineraryRoute: itineraryRoute || undefined,
      });

      localStorage.removeItem("trip-draft");
      const tripData = (response as any)?.data?.trip ?? (response as any)?.trip;
      const tripId = tripData?.id;
      if (!tripId) {
        router.push(`/${locale}/dashboard/trips`);
        return;
      }

      if (followUpVehicleId) {
        // Customer arrived from a vehicle CTA — drop them on the quotation
        // form pre-attached to the trip we just created.
        router.push(
          `/${locale}/dashboard/quotations/new?vehicleId=${followUpVehicleId}&tripId=${tripId}`,
        );
      } else {
        router.push(`/${locale}/dashboard/trips/${tripId}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError(t("submitFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (guardLoading || !isAuthorized || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={`/${locale}/dashboard/trips`}
            className={`mb-3 inline-flex items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] ${focusRing}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("backToTrips")}
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {t("newTitle")}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("newSubtitle")}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {submitError ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-text)]"
          >
            {submitError}
          </div>
        ) : null}

        {draftSaveSuccess ? (
          <div
            role="status"
            className="mb-6 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm text-[var(--color-success-text)]"
          >
            {t("draftSaved")}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Trip type toggle */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsRoundTrip(false)}
                    aria-pressed={!isRoundTrip}
                    className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${focusRing} ${
                      !isRoundTrip
                        ? "border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]"
                        : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                    }`}
                  >
                    {tQuotation("oneWay")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRoundTrip(true)}
                    aria-pressed={isRoundTrip}
                    className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${focusRing} ${
                      isRoundTrip
                        ? "border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]"
                        : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                    }`}
                  >
                    {tQuotation("roundTrip")}
                  </button>
                </div>
              </div>

              {/* Title (optional) */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("titleSectionHeading")}
                </h2>
                <label
                  htmlFor="trip-title"
                  className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  {t("titleLabel")}
                </label>
                <Input
                  id="trip-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("titlePlaceholder")}
                  maxLength={120}
                />
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {t("titleHint")}
                </p>
              </div>

              {/* Locations */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  <MapPin
                    className="h-5 w-5 text-[var(--color-text-secondary)]"
                    aria-hidden="true"
                  />
                  {tQuotation("tripLocations")}
                </h2>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                    {tQuotation("pickupLocation")}
                  </label>
                  <LocationAutocomplete
                    placeholder={tQuotation("pickupLocation")}
                    value={pickupLocation.address || pickupLocation.city}
                    onChange={(val) =>
                      setPickupLocation({
                        ...pickupLocation,
                        address: val,
                        city: val,
                      })
                    }
                    onSelectLocation={(loc) => {
                      setPickupLocation({
                        address: loc.displayName,
                        city: loc.city || loc.displayName.split(",")[0],
                        district: loc.district,
                        lat: loc.lat,
                        lng: loc.lng,
                      });
                    }}
                  />
                </div>

                {intermediateStops.map((stop, index) => (
                  <div key={stop.id} className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {tQuotation("stopLabel", { index: index + 1 })}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => moveStopUp(index)}
                          disabled={index === 0}
                          aria-label={t("moveStopUp")}
                          className={`rounded-xl p-1 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-action-primary)] disabled:opacity-50 ${focusRing}`}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStopDown(index)}
                          disabled={index === intermediateStops.length - 1}
                          aria-label={t("moveStopDown")}
                          className={`rounded-xl p-1 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-action-primary)] disabled:opacity-50 ${focusRing}`}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStop(stop.id)}
                          aria-label={tQuotation("removeStop")}
                          className={`rounded-xl p-1 text-[var(--color-error-text)] transition-colors hover:text-[var(--color-error-border)] ${focusRing}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <LocationAutocomplete
                      placeholder={tQuotation("stopLabel", { index: index + 1 })}
                      value={stop.location.address || stop.location.city}
                      onChange={(val) =>
                        handleUpdateStop(stop.id, { address: val, city: val })
                      }
                      onSelectLocation={(loc) => {
                        handleUpdateStop(stop.id, {
                          address: loc.displayName,
                          city: loc.city || loc.displayName.split(",")[0],
                          district: loc.district,
                          lat: loc.lat,
                          lng: loc.lng,
                        });
                      }}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddStop}
                  className={`mb-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)] ${focusRing}`}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {tQuotation("addIntermediateStop")}
                </button>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                    {tQuotation("destination")}
                  </label>
                  <LocationAutocomplete
                    placeholder={tQuotation("destination")}
                    value={dropoffLocation.address || dropoffLocation.city}
                    onChange={(val) =>
                      setDropoffLocation({
                        ...dropoffLocation,
                        address: val,
                        city: val,
                      })
                    }
                    onSelectLocation={(loc) => {
                      setDropoffLocation({
                        address: loc.displayName,
                        city: loc.city || loc.displayName.split(",")[0],
                        district: loc.district,
                        lat: loc.lat,
                        lng: loc.lng,
                      });
                    }}
                  />
                </div>
              </div>

              {/* Trip Details */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  <Calendar
                    className="h-5 w-5 text-[var(--color-text-secondary)]"
                    aria-hidden="true"
                  />
                  {t("dateDetails")}
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      {tQuotation("pickupDate")}
                    </label>
                    <Input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  {isRoundTrip ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                        {tQuotation("returnDate")}
                      </label>
                      <Input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        min={pickupDate || new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      {tQuotation("pickupTime")}
                    </label>
                    <Input
                      type="time"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      {t("passengersLabel")}
                    </label>
                    <div
                      className={`flex items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 focus-within:border-[var(--color-action-primary)] focus-within:ring-2 focus-within:ring-[var(--color-action-focus)] focus-within:ring-offset-2`}
                    >
                      <Users
                        className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={passengerCount === 0 ? "" : String(passengerCount)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "");
                          if (digits === "") setPassengerCount(0);
                          else {
                            const n = parseInt(digits, 10);
                            if (!isNaN(n) && n > 0) setPassengerCount(n);
                          }
                        }}
                        onBlur={() => {
                          if (passengerCount < 1) setPassengerCount(1);
                        }}
                        aria-label={t("passengersLabel")}
                        className="w-full bg-transparent font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle preferences */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("vehiclePreferences")}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      {tQuotation("vehicleType")}
                    </label>
                    <Select
                      value={vehicleType}
                      onChange={(value) => setVehicleType(value)}
                      placeholder={tQuotation("selectVehicleType")}
                      options={vehicleTypeOptions.map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                      }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                        <Snowflake
                          className="h-4 w-4 text-[var(--color-action-primary)]"
                          aria-hidden="true"
                        />
                        {tQuotation("needsAC")}
                      </span>
                      <input
                        type="checkbox"
                        checked={needsAC}
                        onChange={(e) => setNeedsAC(e.target.checked)}
                        className={`h-5 w-5 rounded border-[var(--color-border-default)] accent-[var(--color-action-primary)] ${focusRing}`}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Special requirements */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {tQuotation("specialRequirements")}
                </h2>
                <TextArea
                  placeholder={tQuotation("specialRequestsPlaceholder")}
                  value={specialRequirements}
                  onChange={(e) => setSpecialRequirements(e.target.value)}
                  rows={4}
                />
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {tQuotation("specialRequirementsHint")}
                </p>
              </div>

              <div className="flex gap-4">
                <CTAButton
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={handleSaveDraft}
                  leftIcon={<Save className="h-5 w-5" aria-hidden="true" />}
                >
                  {tQuotation("saveDraft")}
                </CTAButton>
                <CTAButton
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={isSubmitting}
                  leftIcon={
                    isSubmitting ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Send className="h-5 w-5" aria-hidden="true" />
                    )
                  }
                >
                  {followUpVehicleId ? t("createAndQuote") : t("createTrip")}
                </CTAButton>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {tQuotation("routeSummary")}
                </h3>
                <div className="relative z-0 mb-6">
                  <DynamicInteractiveMap
                    readOnly={false}
                    autoCalculate={true}
                    initialWaypoints={mapWaypoints}
                    onRouteCalculated={(data: any) => {
                      if (data?.route) {
                        setEstimatedDistance(
                          `${data.route.distanceKm.toFixed(1)} km`,
                        );
                        const hrs = Math.floor(data.route.durationMinutes / 60);
                        const mins = Math.round(data.route.durationMinutes % 60);
                        setEstimatedDuration(
                          hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`,
                        );
                        setItineraryStops(data.route.optimizedWaypoints || []);
                        setItineraryRoute(data.route.geometry || data.route);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
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
                        {estimatedDistance}
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
                        {estimatedDuration}
                      </p>
                    </div>
                    <Clock
                      className="h-8 w-8 text-[var(--color-text-tertiary)]"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
                  {tQuotation("estimateDisclaimer")}
                </p>
              </div>

              <div className="rounded-[20px] border border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] p-6">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-action-primary)]">
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  {t("proTipTitle")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("proTipBody")}
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
