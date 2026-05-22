"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LoadingSpinner,
  Input,
  Select,
  TextArea,
  CTAButton,
} from "@/components/ui";
import { useAuthStore } from "@/store";
import { useProtectedRoute } from "@/hooks";
import { quotationService, landingContentService, ApiError } from "@/lib/api";
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  Bus,
  Snowflake,
  Plus,
  X,
  Save,
  Send,
  ArrowLeft,
  Route,
  History,
  Lightbulb,
} from "lucide-react";

interface Location {
  address: string;
  city: string;
  district: string;
}

interface IntermediateStop {
  id: string;
  location: Location;
}

interface RecentSearch {
  id: string;
  from: string;
  to: string;
  date: string;
  passengers: number;
}

interface NewQuotationPageContentProps {
  locale: string;
}

export function NewQuotationPageContent({
  locale,
}: NewQuotationPageContentProps) {
  const t = useTranslations("quotation");
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: guardLoading, isAuthorized } = useProtectedRoute();

  const [vehicleId, setVehicleId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const vehicleIdParam = searchParams.get("vehicleId");
    if (vehicleIdParam) {
      setVehicleId(vehicleIdParam);
    }
  }, [searchParams]);

  // Form state
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
  const [intermediateStops, setIntermediateStops] = useState<
    IntermediateStop[]
  >([]);
  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [vehicleType, setVehicleType] = useState("");
  const [needsAC, setNeedsAC] = useState(true);
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [districts, setDistricts] = useState<string[]>([]);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [estimatedDistance, setEstimatedDistance] = useState("—");
  const [estimatedDuration, setEstimatedDuration] = useState("—");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftSaveSuccess, setDraftSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchPublicConfig = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        setDistricts(response.options.districts || []);
        setVehicleTypeOptions(response.options.quotationVehicleTypes || []);
        setRecentSearches(response.recentSearches || []);
      } catch (error) {
        console.error("Failed to fetch quotation config:", error);
      }
    };

    fetchPublicConfig();
  }, []);

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
    setIntermediateStops(intermediateStops.filter((stop) => stop.id !== id));
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
    localStorage.setItem("quotation-draft", JSON.stringify(draft));
    setDraftSaveSuccess(true);
    setTimeout(() => setDraftSaveSuccess(false), 3000);
  };

  const validateForm = (): string | null => {
    if (!pickupLocation.city || !pickupLocation.district) {
      return t("validationError.pickup");
    }
    if (!dropoffLocation.city || !dropoffLocation.district) {
      return t("validationError.dropoff");
    }
    if (!pickupDate) {
      return t("validationError.pickupDate");
    }
    if (!pickupTime) {
      return t("validationError.pickupTime");
    }
    if (isRoundTrip && !returnDate) {
      return t("validationError.returnDate");
    }
    if (passengerCount < 1) {
      return t("validationError.passengers");
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await quotationService.requestQuotation({
        vehicleId,
        pickupLocation: {
          address: pickupLocation.address || pickupLocation.city,
          city: pickupLocation.city,
          district: pickupLocation.district,
        },
        dropoffLocation: {
          address: dropoffLocation.address || dropoffLocation.city,
          city: dropoffLocation.city,
          district: dropoffLocation.district,
        },
        pickupDate: new Date(pickupDate).toISOString(),
        pickupTime,
        returnDate: isRoundTrip ? returnDate : undefined,
        returnTime: undefined,
        isRoundTrip,
        passengerCount,
        vehicleType: (vehicleType || "ORDINARY") as any,
        specialRequests: specialRequirements || undefined,
        luggageCount: 0,
        needsAC,
      });

      localStorage.removeItem("quotation-draft");
      router.push(`/${locale}/dashboard/quotations`);
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

  const loadRecentSearch = (search: RecentSearch) => {
    setPickupLocation({ address: "", city: search.from, district: "" });
    setDropoffLocation({ address: "", city: search.to, district: "" });
    setPickupDate(search.date);
    setPassengerCount(search.passengers);
    setShowRecentSearches(false);
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
      {/* Page header */}
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
        <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
          <Link
            href={`/${locale}/dashboard`}
            className="mb-3 inline-flex items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToDashboard")}
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {t("requestQuotation")}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t("fillDetails")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRecentSearches(!showRecentSearches)}
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
            >
              <History className="h-4 w-4" />
              {t("recentSearchesTitle")}
            </button>
          </div>
        </div>

        {/* Recent Searches Dropdown */}
        {showRecentSearches && recentSearches.length > 0 && (
          <div className="mx-auto max-w-7xl px-6 pb-4 lg:px-8">
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-4">
              <h3 className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
                {t("recentSearchesTitle")}
              </h3>
              <div className="space-y-2">
                {recentSearches.map((search) => (
                  <button
                    key={search.id}
                    type="button"
                    onClick={() => loadRecentSearch(search)}
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border-default)] p-3 text-left transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center gap-3">
                      <Route className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {search.from} → {search.to}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {new Date(search.date).toLocaleDateString(locale)} •{" "}
                          {search.passengers} {t("passengers")}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Validation / submit error */}
        {submitError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-text)]"
          >
            {submitError}
          </div>
        )}

        {/* Draft saved confirmation */}
        {draftSaveSuccess && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm text-[var(--color-success-text)]"
          >
            {t("draftSaved")}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Form */}
            <div className="space-y-6 lg:col-span-2">
              {/* Trip Type Toggle */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsRoundTrip(false)}
                    className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2 ${
                      !isRoundTrip
                        ? "border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]"
                        : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                    }`}
                  >
                    {t("oneWay")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRoundTrip(true)}
                    className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2 ${
                      isRoundTrip
                        ? "border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]"
                        : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                    }`}
                  >
                    {t("roundTrip")}
                  </button>
                </div>
              </div>

              {/* Locations */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  <MapPin className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  {t("tripLocations")}
                </h2>

                {/* Pickup Location */}
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("pickupLocation")}
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      placeholder={t("address")}
                      value={pickupLocation.address}
                      onChange={(e) =>
                        setPickupLocation({
                          ...pickupLocation,
                          address: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder={t("city")}
                      value={pickupLocation.city}
                      onChange={(e) =>
                        setPickupLocation({
                          ...pickupLocation,
                          city: e.target.value,
                        })
                      }
                    />
                    <Select
                      value={pickupLocation.district}
                      onChange={(value) =>
                        setPickupLocation({
                          ...pickupLocation,
                          district: value,
                        })
                      }
                      options={[
                        { value: "", label: t("selectDistrict") },
                        ...districts.map((d) => ({ value: d, label: d })),
                      ]}
                      placeholder={t("selectDistrict")}
                    />
                  </div>
                </div>

                {/* Intermediate Stops */}
                {intermediateStops.map((stop, index) => (
                  <div key={stop.id} className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {t("stopLabel", { index: index + 1 })}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(stop.id)}
                        aria-label={t("removeStop")}
                        className="rounded-xl p-1 text-[var(--color-error-text)] transition-colors hover:text-[var(--color-error-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Input
                        placeholder={t("address")}
                        value={stop.location.address}
                        onChange={(e) =>
                          handleUpdateStop(stop.id, { address: e.target.value })
                        }
                      />
                      <Input
                        placeholder={t("city")}
                        value={stop.location.city}
                        onChange={(e) =>
                          handleUpdateStop(stop.id, { city: e.target.value })
                        }
                      />
                      <Select
                        value={stop.location.district}
                        onChange={(value) =>
                          handleUpdateStop(stop.id, { district: value })
                        }
                        options={[
                          { value: "", label: t("selectDistrict") },
                          ...districts.map((d) => ({ value: d, label: d })),
                        ]}
                        placeholder={t("selectDistrict")}
                      />
                    </div>
                  </div>
                ))}

                {/* Add Stop */}
                <button
                  type="button"
                  onClick={handleAddStop}
                  className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" />
                  {t("addIntermediateStop")}
                </button>

                {/* Destination */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("destination")}
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      placeholder={t("address")}
                      value={dropoffLocation.address}
                      onChange={(e) =>
                        setDropoffLocation({
                          ...dropoffLocation,
                          address: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder={t("city")}
                      value={dropoffLocation.city}
                      onChange={(e) =>
                        setDropoffLocation({
                          ...dropoffLocation,
                          city: e.target.value,
                        })
                      }
                    />
                    <Select
                      value={dropoffLocation.district}
                      onChange={(value) =>
                        setDropoffLocation({
                          ...dropoffLocation,
                          district: value,
                        })
                      }
                      options={[
                        { value: "", label: t("selectDistrict") },
                        ...districts.map((d) => ({ value: d, label: d })),
                      ]}
                      placeholder={t("selectDistrict")}
                    />
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  <Calendar className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  {t("dateTime")}
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      {t("pickupDate")}
                    </label>
                    <Input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  {isRoundTrip && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                        {t("returnDate")}
                      </label>
                      <Input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        min={
                          pickupDate || new Date().toISOString().split("T")[0]
                        }
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      {t("pickupTime")}
                    </label>
                    <Input
                      type="time"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Preferences */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  <Bus className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  {t("vehiclePreferences")}
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      {t("passengers")}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setPassengerCount(Math.max(1, passengerCount - 1))
                        }
                        className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                      >
                        -
                      </button>
                      <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2">
                        <Users className="h-4 w-4 text-[var(--color-text-secondary)]" />
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {passengerCount}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPassengerCount(passengerCount + 1)}
                        className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      {t("vehicleType")}
                    </label>
                    <Select
                      value={vehicleType}
                      onChange={(value) => setVehicleType(value)}
                      options={[
                        { value: "", label: t("selectVehicleType") },
                        ...vehicleTypeOptions,
                      ]}
                      placeholder={t("selectVehicleType")}
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={needsAC}
                      onChange={(e) => setNeedsAC(e.target.checked)}
                      className="h-5 w-5 rounded border-[var(--color-border-default)] accent-[var(--color-action-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                    />
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4 text-[var(--color-action-primary)]" />
                      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {t("acRequired")}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Special Requirements */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("specialRequirements")}
                </h2>
                <TextArea
                  placeholder={t("specialRequestsPlaceholder")}
                  value={specialRequirements}
                  onChange={(e) => setSpecialRequirements(e.target.value)}
                  rows={4}
                />
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {t("specialRequirementsHint")}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <CTAButton
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={handleSaveDraft}
                  leftIcon={<Save className="h-5 w-5" />}
                >
                  {t("saveDraft")}
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
                      <Send className="h-5 w-5" />
                    )
                  }
                >
                  {t("requestQuotations")}
                </CTAButton>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Route Summary */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("routeSummary")}
                </h3>
                <div className="mb-6 flex aspect-square items-center justify-center rounded-xl bg-[var(--color-bg-surface)]">
                  <div className="text-center">
                    <Route className="mx-auto mb-2 h-12 w-12 text-[var(--color-text-tertiary)]" />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("routeMapPlaceholder")}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {pickupLocation.city && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-bg)]">
                        <div className="h-3 w-3 rounded-full bg-[var(--color-success-border)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {pickupLocation.city}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {pickupLocation.district || t("pickupFallback")}
                        </p>
                      </div>
                    </div>
                  )}
                  {intermediateStops.map(
                    (stop, index) =>
                      stop.location.city && (
                        <div key={stop.id} className="flex items-start gap-3">
                          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                            <span className="text-xs font-medium text-[var(--color-action-primary)]">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {stop.location.city}
                            </p>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t("stopLabel", { index: index + 1 })}
                            </p>
                          </div>
                        </div>
                      ),
                  )}
                  {dropoffLocation.city && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-error-bg)]">
                        <div className="h-3 w-3 rounded-full bg-[var(--color-error-border)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {dropoffLocation.city}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {dropoffLocation.district || t("destination")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Trip Estimates */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("tripEstimates")}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg-surface)] p-4">
                    <div>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("estimatedDistance")}
                      </p>
                      <p className="text-xl font-bold text-[var(--color-text-primary)]">
                        {estimatedDistance}
                      </p>
                    </div>
                    <Route className="h-8 w-8 text-[var(--color-text-tertiary)]" />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg-surface)] p-4">
                    <div>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("estimatedDuration")}
                      </p>
                      <p className="text-xl font-bold text-[var(--color-text-primary)]">
                        {estimatedDuration}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-[var(--color-text-tertiary)]" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
                  {t("estimateDisclaimer")}
                </p>
              </div>

              {/* Pro Tip */}
              <div className="rounded-[20px] border border-[var(--color-action-primary)] bg-[var(--color-bg-surface)] p-6">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-action-primary)]">
                  <Lightbulb className="h-4 w-4" />
                  {t("proTip")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("proTipDescription")}
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
