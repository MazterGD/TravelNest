"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner, Input, Select, TextArea } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useProtectedRoute } from "@/hooks";
import { quotationService, ApiError } from "@/lib/api";
import {
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaClock,
  FaUsers,
  FaBus,
  FaSnowflake,
  FaPlus,
  FaTimes,
  FaSave,
  FaPaperPlane,
  FaArrowLeft,
  FaRoute,
  FaHistory,
} from "react-icons/fa";

interface Location {
  address: string;
  city: string;
  district: string;
}

interface IntermediateStop {
  id: string;
  location: Location;
}

const DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Mullaitivu",
  "Vavuniya",
  "Trincomalee",
  "Batticaloa",
  "Ampara",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

const VEHICLE_TYPES = [
  { value: "car", label: "Car (4 seats)" },
  { value: "van", label: "Van (8-14 seats)" },
  { value: "minibus", label: "Mini Bus (15-25 seats)" },
  { value: "bus", label: "Bus (25+ seats)" },
  { value: "luxury", label: "Luxury Vehicle" },
];

const RECENT_SEARCHES = [
  { id: "1", from: "Colombo", to: "Kandy", date: "2026-02-15", passengers: 4 },
  {
    id: "2",
    from: "Galle",
    to: "Colombo Airport",
    date: "2026-02-20",
    passengers: 2,
  },
  {
    id: "3",
    from: "Kandy",
    to: "Nuwara Eliya",
    date: "2026-03-01",
    passengers: 6,
  },
];

interface NewQuotationPageContentProps {
  locale: string;
}

export function NewQuotationPageContent({
  locale,
}: NewQuotationPageContentProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: guardLoading, isAuthorized } = useProtectedRoute();

  // Get vehicleId from URL if present (for requests from vehicle detail page)
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

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSaveDraft = () => {
    // Save to localStorage for later
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
    alert("Draft saved successfully!");
  };

  const validateForm = (): string | null => {
    if (!pickupLocation.city || !pickupLocation.district) {
      return "Please enter pickup location details";
    }
    if (!dropoffLocation.city || !dropoffLocation.district) {
      return "Please enter destination details";
    }
    if (!pickupDate) {
      return "Please select a pickup date";
    }
    if (!pickupTime) {
      return "Please select a pickup time";
    }
    if (isRoundTrip && !returnDate) {
      return "Please select a return date for round trip";
    }
    if (passengerCount < 1) {
      return "At least 1 passenger is required";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Build the pickup location string
      const pickupLocationStr = [
        pickupLocation.address,
        pickupLocation.city,
        pickupLocation.district,
      ]
        .filter(Boolean)
        .join(", ");

      // Build the dropoff location string
      const dropoffLocationStr = [
        dropoffLocation.address,
        dropoffLocation.city,
        dropoffLocation.district,
      ]
        .filter(Boolean)
        .join(", ");

      // Calculate end date (same as start date for one-way, or return date for round trip)
      const endDate = isRoundTrip && returnDate ? returnDate : pickupDate;

      await quotationService.requestQuotation({
        vehicleId, // Include vehicleId if requesting for a specific vehicle
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
        vehicleType: (vehicleType || "standard_bus") as any,
        specialRequests: specialRequirements || undefined,
        luggageCount: 0,
        needsAC,
      });

      // Clear draft on successful submission
      localStorage.removeItem("quotation-draft");

      router.push(`/${locale}/dashboard/quotations`);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to submit quotation request. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadRecentSearch = (search: (typeof RECENT_SEARCHES)[0]) => {
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

  const estimatedDistance =
    pickupLocation.city && dropoffLocation.city ? "125 km" : "—";
  const estimatedDuration =
    pickupLocation.city && dropoffLocation.city ? "2h 30min" : "—";

  return (
    <>
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
          <Link
            href={`/${locale}/dashboard`}
            className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <FaArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Request Quotation
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Fill in your trip details to receive quotes from vehicle owners
              </p>
            </div>
            <button
              onClick={() => setShowRecentSearches(!showRecentSearches)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <FaHistory className="h-4 w-4" />
              Recent Searches
            </button>
          </div>
        </div>

        {/* Recent Searches Dropdown */}
        {showRecentSearches && (
          <div className="mx-auto max-w-7xl px-6 pb-4 lg:px-8">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-gray-900">
                Recent Searches
              </h3>
              <div className="space-y-2">
                {RECENT_SEARCHES.map((search) => (
                  <button
                    key={search.id}
                    onClick={() => loadRecentSearch(search)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <FaRoute className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {search.from} → {search.to}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(search.date).toLocaleDateString()} •{" "}
                          {search.passengers} passengers
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
        <form onSubmit={handleSubmit}>
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Form - Left Side */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trip Type Toggle */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsRoundTrip(false)}
                    className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      !isRoundTrip
                        ? "border-[#20B0E9] bg-blue-50 text-[#20B0E9]"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    One Way
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRoundTrip(true)}
                    className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      isRoundTrip
                        ? "border-[#20B0E9] bg-blue-50 text-[#20B0E9]"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Round Trip
                  </button>
                </div>
              </div>

              {/* Locations Section - continuing in next replacement... */}

              {/* Locations */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FaMapMarkerAlt className="h-5 w-5 text-gray-600" />
                  Trip Locations
                </h2>

                {/* Pickup Location */}
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Pickup Location
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      placeholder="Address"
                      value={pickupLocation.address}
                      onChange={(e) =>
                        setPickupLocation({
                          ...pickupLocation,
                          address: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="City"
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
                        { value: "", label: "Select District" },
                        ...DISTRICTS.map((d) => ({ value: d, label: d })),
                      ]}
                      placeholder="Select District"
                    />
                  </div>
                </div>

                {/* Intermediate Stops */}
                {intermediateStops.map((stop, index) => (
                  <div key={stop.id} className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Stop {index + 1}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(stop.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <FaTimes className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Input
                        placeholder="Address"
                        value={stop.location.address}
                        onChange={(e) =>
                          handleUpdateStop(stop.id, { address: e.target.value })
                        }
                      />
                      <Input
                        placeholder="City"
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
                          { value: "", label: "Select District" },
                          ...DISTRICTS.map((d) => ({ value: d, label: d })),
                        ]}
                        placeholder="Select District"
                      />
                    </div>
                  </div>
                ))}

                {/* Add Stop Button */}
                <button
                  type="button"
                  onClick={handleAddStop}
                  className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-100"
                >
                  <FaPlus className="h-4 w-4" />
                  Add Intermediate Stop
                </button>

                {/* Dropoff Location */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Destination
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      placeholder="Address"
                      value={dropoffLocation.address}
                      onChange={(e) =>
                        setDropoffLocation({
                          ...dropoffLocation,
                          address: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="City"
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
                        { value: "", label: "Select District" },
                        ...DISTRICTS.map((d) => ({ value: d, label: d })),
                      ]}
                      placeholder="Select District"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FaCalendarAlt className="h-5 w-5 text-gray-600" />
                  Date & Time
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Pickup Date
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
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Return Date
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
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Pickup Time
                    </label>
                    <Input
                      type="time"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle & Passengers */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FaBus className="h-5 w-5 text-gray-600" />
                  Vehicle Preferences
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Number of Passengers
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setPassengerCount(Math.max(1, passengerCount - 1))
                        }
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
                      >
                        -
                      </button>
                      <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                        <FaUsers className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-gray-900">
                          {passengerCount}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPassengerCount(passengerCount + 1)}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Vehicle Type
                    </label>
                    <Select
                      value={vehicleType}
                      onChange={(value) => setVehicleType(value)}
                      options={[
                        { value: "", label: "Select Vehicle Type" },
                        ...VEHICLE_TYPES,
                      ]}
                      placeholder="Select Vehicle Type"
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={needsAC}
                      onChange={(e) => setNeedsAC(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-[#20B0E9] focus:ring-[#20B0E9]"
                    />
                    <div className="flex items-center gap-2">
                      <FaSnowflake className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Air Conditioning Required
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Special Requirements */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Special Requirements
                </h2>
                <TextArea
                  placeholder="Enter any special requirements (e.g., wheelchair accessibility, child seats, luggage space, etc.)"
                  value={specialRequirements}
                  onChange={(e) => setSpecialRequirements(e.target.value)}
                  rows={4}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Include any additional information that will help owners
                  provide accurate quotes
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <FaSave className="h-5 w-5" />
                  Save as Draft
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#20B0E9] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1a9dd1] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <FaPaperPlane className="h-5 w-5" />
                      Request Quotations
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Sidebar - Route Summary */}
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  Route Summary
                </h3>
                <div className="mb-6 aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <FaRoute className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">
                      Route map will appear here
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {pickupLocation.city && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {pickupLocation.city}
                        </p>
                        <p className="text-xs text-gray-500">
                          {pickupLocation.district || "Pickup location"}
                        </p>
                      </div>
                    </div>
                  )}
                  {intermediateStops.map(
                    (stop, index) =>
                      stop.location.city && (
                        <div key={stop.id} className="flex items-start gap-3">
                          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                            <span className="text-xs font-medium text-blue-600">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {stop.location.city}
                            </p>
                            <p className="text-xs text-gray-500">
                              Stop {index + 1}
                            </p>
                          </div>
                        </div>
                      ),
                  )}
                  {dropoffLocation.city && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {dropoffLocation.city}
                        </p>
                        <p className="text-xs text-gray-500">
                          {dropoffLocation.district || "Destination"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  Trip Estimates
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div>
                      <p className="text-sm text-gray-600">Distance</p>
                      <p className="text-xl font-bold text-gray-900">
                        {estimatedDistance}
                      </p>
                    </div>
                    <FaRoute className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div>
                      <p className="text-sm text-gray-600">Duration</p>
                      <p className="text-xl font-bold text-gray-900">
                        {estimatedDuration}
                      </p>
                    </div>
                    <FaClock className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-500">
                  * Estimates are approximate and may vary based on traffic and
                  route conditions
                </p>
              </div>

              <div className="rounded-lg border border-[#20B0E9] bg-blue-50 p-6">
                <h3 className="mb-2 text-sm font-semibold text-[#20B0E9]">
                  💡 Pro Tip
                </h3>
                <p className="text-sm text-gray-700">
                  Provide detailed information to receive more accurate
                  quotations. Owners typically respond within 24 hours.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
