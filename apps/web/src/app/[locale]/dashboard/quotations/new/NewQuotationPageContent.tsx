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
  LocationAutocomplete,
} from "@/components/ui";
import dynamic from "next/dynamic";
import { Map } from "lucide-react";

const DynamicInteractiveMap = dynamic(
  () => import("@/components/ui/InteractiveMap").then((mod) => mod.InteractiveMap || mod.default || mod),
  { ssr: false, loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-[20px] flex items-center justify-center"><Map className="h-8 w-8 text-muted-foreground" /></div> }
);
import { useAuthStore } from "@/store";
import { useProtectedRoute } from "@/hooks";
import {
  quotationService,
  landingContentService,
  vehicleService,
  tripService,
  ApiError,
  type TripDTO,
} from "@/lib/api";
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
  ArrowUp,
  ArrowDown,
} from "lucide-react";

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
  const [vehicleAmenities, setVehicleAmenities] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  // Trip-attachment state. When the customer has an active trip in flight,
  // we ALWAYS prompt them whether to add this quotation to that trip or
  // start a fresh one — per the chosen UX, no defaulting.
  const [activeTrips, setActiveTrips] = useState<TripDTO[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripPromptResolved, setTripPromptResolved] = useState(false);

  useEffect(() => {
    const vehicleIdParam = searchParams.get("vehicleId");
    const tripIdParam = searchParams.get("tripId");
    if (vehicleIdParam) {
      setVehicleId(vehicleIdParam);
      // Load vehicle data to get amenities
      vehicleService.getById(vehicleIdParam).then((res: any) => {
        const vehicle = res?.vehicle ?? res;
        if (vehicle) {
          setSelectedVehicle(vehicle);
          setVehicleAmenities(vehicle.amenities || []);
        }
      }).catch(console.error);
    } else {
      router.push(`/${locale}/dashboard/search`);
    }
    if (tripIdParam) {
      // Trip was pre-attached via URL (e.g. from Add-more-vehicles flow).
      // Skip the prompt entirely.
      setSelectedTripId(tripIdParam);
      setTripPromptResolved(true);
    }
  }, [searchParams, router, locale]);

  // Look up active trips on mount. If exactly one exists and the URL didn't
  // already attach a trip, show the chooser modal.
  useEffect(() => {
    if (tripPromptResolved) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await tripService.getActive();
        const trips = ((response as any)?.data?.trips ?? []) as TripDTO[];
        if (cancelled) return;
        setActiveTrips(trips);
        if (trips.length === 0) {
          setTripPromptResolved(true);
        }
      } catch (error) {
        console.error("Failed to fetch active trips:", error);
        if (!cancelled) setTripPromptResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripPromptResolved]);

  // When the user picks an existing trip from the chooser, pre-fill the form
  // so they don't have to retype anything.
  const applyTripDetails = (trip: TripDTO) => {
    setSelectedTripId(trip.id);
    setPickupLocation({
      address: trip.pickupLocation,
      city: trip.pickupCity || trip.pickupLocation.split(",")[0] || "",
      district: trip.pickupDistrict || "",
      lat: trip.pickupLatitude ?? undefined,
      lng: trip.pickupLongitude ?? undefined,
    });
    if (trip.dropoffLocation) {
      setDropoffLocation({
        address: trip.dropoffLocation,
        city: trip.dropoffCity || trip.dropoffLocation.split(",")[0] || "",
        district: trip.dropoffDistrict || "",
        lat: trip.dropoffLatitude ?? undefined,
        lng: trip.dropoffLongitude ?? undefined,
      });
    }
    if (Array.isArray(trip.intermediateStops)) {
      setIntermediateStops(
        trip.intermediateStops.map((stop: any, i: number) => ({
          id: stop.id || `stop-${i}-${Date.now()}`,
          location: {
            address: stop.location?.address || "",
            city: stop.location?.city || "",
            district: stop.location?.district || "",
            lat: stop.location?.lat,
            lng: stop.location?.lng,
          },
        })),
      );
    }
    setPickupDate(new Date(trip.startDate).toISOString().split("T")[0]);
    if (trip.startDate !== trip.endDate) {
      setReturnDate(new Date(trip.endDate).toISOString().split("T")[0]);
      setIsRoundTrip(trip.isRoundTrip || true);
    }
    if (trip.startTime) setPickupTime(trip.startTime);
    setPassengerCount(trip.passengerCount);
    if (trip.vehicleTypePreference) setVehicleType(trip.vehicleTypePreference);
    setNeedsAC(trip.needsAC);
    if (trip.specialRequests) setSpecialRequirements(trip.specialRequests);
    if (trip.estimatedDistance) setEstimatedDistance(trip.estimatedDistance);
    if (trip.estimatedDuration) setEstimatedDuration(trip.estimatedDuration);
    setTripPromptResolved(true);
  };

  const startFreshTrip = () => {
    setSelectedTripId(null);
    setTripPromptResolved(true);
  };

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
  const [itineraryStops, setItineraryStops] = useState<any[]>([]);
  const [itineraryRoute, setItineraryRoute] = useState<any>(null);
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

  const [mapWaypoints, setMapWaypoints] = useState<any[]>([]);

  useEffect(() => {
    const waypoints = [];
    if (pickupLocation.lat && pickupLocation.lng) {
      waypoints.push({ lat: pickupLocation.lat, lng: pickupLocation.lng, name: pickupLocation.city });
    }
    intermediateStops.forEach(stop => {
      if (stop.location.lat && stop.location.lng) {
        waypoints.push({ lat: stop.location.lat, lng: stop.location.lng, name: stop.location.city });
      }
    });
    if (dropoffLocation.lat && dropoffLocation.lng) {
      waypoints.push({ lat: dropoffLocation.lat, lng: dropoffLocation.lng, name: dropoffLocation.city });
    }
    setMapWaypoints(waypoints);
  }, [pickupLocation, intermediateStops, dropoffLocation]);

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    const newStops = [...intermediateStops];
    [newStops[index - 1], newStops[index]] = [newStops[index], newStops[index - 1]];
    setIntermediateStops(newStops);
  };

  const moveStopDown = (index: number) => {
    if (index === intermediateStops.length - 1) return;
    const newStops = [...intermediateStops];
    [newStops[index + 1], newStops[index]] = [newStops[index], newStops[index + 1]];
    setIntermediateStops(newStops);
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
      const response = (await quotationService.requestQuotation({
        vehicleId,
        tripId: selectedTripId || undefined,
        pickupLocation: {
          address: pickupLocation.address || pickupLocation.city,
          city: pickupLocation.city,
          district: pickupLocation.district,
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
        } as any,
        dropoffLocation: {
          address: dropoffLocation.address || dropoffLocation.city,
          city: dropoffLocation.city,
          district: dropoffLocation.district,
          lat: dropoffLocation.lat,
          lng: dropoffLocation.lng,
        } as any,
        startDate: new Date(pickupDate).toISOString(),
        startTime: pickupTime,
        endDate: isRoundTrip ? returnDate : undefined,
        returnTime: undefined,
        isRoundTrip,
        passengerCount,
        vehicleType: (vehicleType || "ORDINARY") as any,
        specialRequests: specialRequirements || undefined,
        luggageCount: 0,
        needsAC,
        estimatedDistance,
        estimatedDuration,
        intermediateStops: intermediateStops as any,
        itineraryStops: itineraryStops.length > 0 ? itineraryStops : undefined,
        itineraryRoute: itineraryRoute || undefined,
      } as any)) as any;

      localStorage.removeItem("quotation-draft");
      const quotationTripId =
        response?.data?.quotation?.tripId ||
        response?.quotation?.tripId ||
        selectedTripId;
      if (quotationTripId) {
        router.push(`/${locale}/dashboard/trips/${quotationTripId}`);
      } else {
        router.push(`/${locale}/dashboard/trips`);
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

  const showTripPrompt =
    !tripPromptResolved && activeTrips.length > 0 && !!vehicleId;

  return (
    <>
      {/* Trip-attachment chooser. Shown when the customer has at least one
          active trip and the URL didn't already attach a trip. Forces an
          explicit choice — attach to an existing trip (with pre-filled
          details) or start a new one. */}
      {showTripPrompt ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="trip-prompt-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text-primary)]/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
            <h2
              id="trip-prompt-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              {t("tripPrompt.title")}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t("tripPrompt.body")}
            </p>
            <ul className="mt-5 space-y-2" role="list">
              {activeTrips.map((trip) => {
                const date = new Date(trip.startDate).toLocaleDateString(
                  locale,
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  },
                );
                const tripTitle =
                  trip.title ||
                  `${trip.pickupCity || trip.pickupLocation.split(",")[0]} → ${
                    trip.dropoffCity ||
                    trip.dropoffLocation?.split(",")[0] ||
                    t("tripPrompt.noDestination")
                  }`;
                return (
                  <li key={trip.id}>
                    <button
                      type="button"
                      onClick={() => applyTripDetails(trip)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-3 text-left transition-colors hover:border-[var(--color-action-primary)] hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {tripTitle}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                          {date} · {trip.tripCode}
                        </p>
                      </div>
                      <span className="rounded-lg bg-[var(--color-action-primary)] px-2.5 py-1 text-xs font-medium text-white">
                        {t("tripPrompt.attach")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={startFreshTrip}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
              >
                {t("tripPrompt.startNew")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Page header */}
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={`/${locale}/dashboard`}
            className="mb-3 inline-flex items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToDashboard")}
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
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

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

              {/* Selected Vehicle Info */}
              {selectedVehicle && (
                <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                    <Bus className="h-5 w-5 text-[var(--color-text-secondary)]" />
                    Selected Vehicle
                  </h2>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[var(--color-bg-surface)] p-4 rounded-xl border border-[var(--color-border-default)]">
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg text-[var(--color-text-primary)]">{selectedVehicle.brand} {selectedVehicle.model}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{selectedVehicle.type} • {selectedVehicle.licensePlate}</span>
                    </div>
                    <div className="mt-3 sm:mt-0 flex flex-col sm:text-right">
                      <span className="text-sm text-[var(--color-text-secondary)]">Max Capacity</span>
                      <span className="font-medium text-[var(--color-text-primary)] flex items-center gap-1 sm:justify-end">
                        <Users className="h-4 w-4" /> {selectedVehicle.seats}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                  <LocationAutocomplete
                    placeholder={t("pickupLocation")}
                    value={pickupLocation.address || pickupLocation.city}
                    onChange={(val) => setPickupLocation({ ...pickupLocation, address: val, city: val })}
                    onSelectLocation={(loc) => {
                      setPickupLocation({ address: loc.displayName, city: loc.city || loc.displayName.split(",")[0], district: loc.district, lat: loc.lat, lng: loc.lng });
                    }}
                  />
                </div>

                {/* Intermediate Stops */}
                {intermediateStops.map((stop, index) => (
                  <div key={stop.id} className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {t("stopLabel", { index: index + 1 })}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => moveStopUp(index)}
                          disabled={index === 0}
                          className="rounded-xl p-1 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-action-primary)] disabled:opacity-50"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStopDown(index)}
                          disabled={index === intermediateStops.length - 1}
                          className="rounded-xl p-1 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-action-primary)] disabled:opacity-50"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStop(stop.id)}
                          aria-label={t("removeStop")}
                          className="rounded-xl p-1 text-[var(--color-error-text)] transition-colors hover:text-[var(--color-error-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <LocationAutocomplete
                      placeholder={t("stopLabel", { index: index + 1 })}
                      value={stop.location.address || stop.location.city}
                      onChange={(val) => handleUpdateStop(stop.id, { address: val, city: val })}
                      onSelectLocation={(loc) => {
                        handleUpdateStop(stop.id, { address: loc.displayName, city: loc.city || loc.displayName.split(",")[0], district: loc.district, lat: loc.lat, lng: loc.lng });
                      }}
                    />
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
                  <LocationAutocomplete
                    placeholder={t("destination")}
                    value={dropoffLocation.address || dropoffLocation.city}
                    onChange={(val) => setDropoffLocation({ ...dropoffLocation, address: val, city: val })}
                    onSelectLocation={(loc) => {
                      setDropoffLocation({ address: loc.displayName, city: loc.city || loc.displayName.split(",")[0], district: loc.district, lat: loc.lat, lng: loc.lng });
                    }}
                  />
                </div>
              </div>

              {/* Trip Details */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  <Calendar className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  Trip Details
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
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                      Passenger Count
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 focus-within:ring-2 focus-within:ring-[var(--color-action-focus)] focus-within:ring-offset-2">
                      <Users className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={passengerCount === 0 ? "" : String(passengerCount)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "");
                          if (digits === "") {
                            setPassengerCount(0);
                          } else {
                            const n = parseInt(digits, 10);
                            if (!isNaN(n) && n > 0) setPassengerCount(n);
                          }
                        }}
                        onBlur={() => {
                          if (passengerCount < 1) setPassengerCount(1);
                        }}
                        placeholder="Enter count"
                        aria-label="Passenger count"
                        className="w-full bg-transparent font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                      />
                    </div>
                  </div>
                </div>

                {vehicleAmenities.length > 0 && (
                  <div className="mt-6">
                    <label className="mb-3 block text-sm font-medium text-[var(--color-text-secondary)]">
                      Required Amenities
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {vehicleAmenities.map((amenity) => (
                        <label key={amenity} className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedAmenities.includes(amenity)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAmenities([...selectedAmenities, amenity]);
                              } else {
                                setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
                              }
                            }}
                            className="h-5 w-5 rounded border-[var(--color-border-default)] accent-[var(--color-action-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                          />
                          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                            {amenity}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
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
                <div className="mb-6 relative z-0">
                  <DynamicInteractiveMap
                    readOnly={false}
                    autoCalculate={true}
                    initialWaypoints={mapWaypoints}
                    onRouteCalculated={(data) => {
                      if (data?.route) {
                        setEstimatedDistance(`${data.route.distanceKm.toFixed(1)} km`);
                        const hrs = Math.floor(data.route.durationMinutes / 60);
                        const mins = Math.round(data.route.durationMinutes % 60);
                        setEstimatedDuration(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
                        setItineraryStops(data.route.optimizedWaypoints || []);
                        setItineraryRoute(data.route.geometry || data.route);
                      }
                    }}
                  />
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
