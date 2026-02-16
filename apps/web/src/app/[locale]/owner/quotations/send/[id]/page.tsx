"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { quotationService } from "@/lib/api/services";
import { vehicleService } from "@/lib/api/services";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import {
  FaArrowLeft,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUsers,
  FaClock,
  FaFileAlt,
  FaPlus,
  FaTrash,
  FaSave,
  FaPaperPlane,
  FaInfoCircle,
} from "react-icons/fa";

interface QuotationRequest {
  id: string;
  vehicleId?: string; // If customer requested a specific vehicle
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  trip: {
    pickupLocation: string;
    dropoffLocation: string;
    startDate: string;
    endDate: string;
    startTime: string;
    estimatedDuration: string;
    estimatedDistance: string;
  };
  passengers: number;
  vehicleType: string;
  specialRequirements: string;
}

interface Vehicle {
  id: string;
  name: string;
  type: string;
  rawType: string; // Original type from API (ORDINARY, SEMI_LUXURY, LUXURY_AC)
  capacity: number;
  baseRate: number;
  acType: string;
}

interface CustomLineItem {
  id: string;
  description: string;
  amount: number;
}

export default function SendQuotationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Protect this route
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  // Request data
  const [request, setRequest] = useState<QuotationRequest | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isSpecificVehicleRequest, setIsSpecificVehicleRequest] =
    useState(false);
  const [requestedVehicle, setRequestedVehicle] = useState<Vehicle | null>(
    null,
  );

  // Form state
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [vehicleRentalCost, setVehicleRentalCost] = useState<number>(0);
  const [driverCost, setDriverCost] = useState<number>(0);
  const [fuelCost, setFuelCost] = useState<number>(0);
  const [tollCharges, setTollCharges] = useState<number>(0);
  const [permitFees, setPermitFees] = useState<number>(0);
  const [customLineItems, setCustomLineItems] = useState<CustomLineItem[]>([]);
  const [validityDays, setValidityDays] = useState<number>(7);
  const [additionalNotes, setAdditionalNotes] = useState<string>("");

  const TAX_RATE = 0.1; // 10% tax

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch quotation request
        const quotationResponse = await quotationService.getById(id);
        const data = quotationResponse.quotation;

        if (!data) {
          console.error("Quotation not found");
          setLoading(false);
          return;
        }

        setRequest({
          id: data.id,
          vehicleId: data.vehicleId || undefined,
          customer: {
            name: `${data.customer?.firstName || ""} ${data.customer?.lastName || ""}`.trim(),
            email: data.customer?.email || "",
            phone: data.customer?.phone || "",
          },
          trip: {
            pickupLocation: data.pickupLocation,
            dropoffLocation: data.dropoffLocation,
            startDate: new Date(data.startDate).toISOString().split("T")[0],
            endDate: new Date(data.endDate).toISOString().split("T")[0],
            startTime: data.startTime || "",
            estimatedDuration: data.estimatedDuration || "",
            estimatedDistance: data.estimatedDistance || "",
          },
          passengers: data.passengerCount,
          vehicleType: data.vehicleType,
          specialRequirements: data.specialRequests || "",
        });

        // Fetch owner's vehicles
        const vehiclesResponse = await vehicleService.getMyVehicles();
        const vehicleList = (vehiclesResponse?.vehicles || []).map(
          (v: any) => ({
            id: v.id,
            name: `${v.brand || v.make || ""} ${v.model} (${v.licensePlate || v.registrationNumber || ""})`,
            type: mapVehicleTypeToDisplay(v.type),
            rawType: v.type, // Keep original type for matching
            capacity: v.seats || v.passengerCapacity || 0,
            baseRate: v.pricePerDay || 0,
            acType: v.acType || "",
          }),
        );
        setVehicles(vehicleList);

        // Check if this is a request for a specific vehicle
        if (data.vehicleId) {
          const specificVehicle = vehicleList.find(
            (v: Vehicle) => v.id === data.vehicleId,
          );
          if (specificVehicle) {
            setIsSpecificVehicleRequest(true);
            setRequestedVehicle(specificVehicle);
            setSelectedVehicle(data.vehicleId);
          } else {
            // Vehicle not found in owner's fleet - this shouldn't happen
            console.warn("Requested vehicle not found in owner's fleet");
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized) {
      fetchData();
    }
  }, [id, isAuthorized]);

  // Helper function to map vehicle type to display name
  const mapVehicleTypeToDisplay = (type: string): string => {
    const typeMap: Record<string, string> = {
      ORDINARY: "Ordinary",
      SEMI_LUXURY: "Semi-Luxury",
      LUXURY_AC: "Luxury AC",
    };
    return typeMap[type] || type;
  };

  // Helper function to check if vehicle matches customer's preference
  const isVehicleTypeMatch = (
    vehicleRawType: string,
    customerPreference: string,
  ): boolean => {
    const preferenceNormalized = customerPreference
      .toUpperCase()
      .replace(/[\s-]/g, "_");

    // Direct match
    if (vehicleRawType === preferenceNormalized) return true;

    // Handle common variations
    const matchMap: Record<string, string[]> = {
      LUXURY_AC: ["LUXURY", "LUXURY_AC", "AC", "FULL_AC"],
      SEMI_LUXURY: ["SEMI_LUXURY", "SEMI", "SEMILUXURY"],
      ORDINARY: ["ORDINARY", "STANDARD", "NORMAL", "BASIC"],
    };

    for (const [dbType, aliases] of Object.entries(matchMap)) {
      if (
        vehicleRawType === dbType &&
        aliases.some((a) => preferenceNormalized.includes(a))
      ) {
        return true;
      }
    }

    return false;
  };

  // Check if vehicle meets requirements
  const getVehicleSuitability = (
    vehicle: Vehicle,
  ): { suitable: boolean; issues: string[] } => {
    const issues: string[] = [];

    // Check passenger capacity
    if (request && vehicle.capacity < request.passengers) {
      issues.push(
        `Insufficient capacity (${vehicle.capacity} seats for ${request.passengers} passengers)`,
      );
    }

    // Check vehicle type preference
    if (
      request &&
      request.vehicleType &&
      !isVehicleTypeMatch(vehicle.rawType, request.vehicleType)
    ) {
      issues.push(`Type mismatch (Customer requested: ${request.vehicleType})`);
    }

    return {
      suitable: issues.length === 0,
      issues,
    };
  };

  // Get filtered and sorted vehicles
  const getSortedVehicles = (): Vehicle[] => {
    return [...vehicles].sort((a, b) => {
      const aSuitability = getVehicleSuitability(a);
      const bSuitability = getVehicleSuitability(b);

      // Suitable vehicles first
      if (aSuitability.suitable && !bSuitability.suitable) return -1;
      if (!aSuitability.suitable && bSuitability.suitable) return 1;

      // Then sort by capacity (closest to passenger count first)
      if (request) {
        const aCapacityDiff = Math.abs(a.capacity - request.passengers);
        const bCapacityDiff = Math.abs(b.capacity - request.passengers);
        if (aCapacityDiff !== bCapacityDiff)
          return aCapacityDiff - bCapacityDiff;
      }

      // Finally sort by price
      return a.baseRate - b.baseRate;
    });
  };

  useEffect(() => {
    // Auto-calculate suggested pricing when vehicle is selected
    if (selectedVehicle && vehicles.length > 0) {
      const vehicle = vehicles.find((v) => v.id === selectedVehicle);
      if (vehicle) {
        setVehicleRentalCost(vehicle.baseRate);
        // Estimate driver cost (20% of base rate)
        setDriverCost(Math.round(vehicle.baseRate * 0.2));
        // Estimate fuel cost (based on distance - 500 LKR per 10km)
        const distance = parseFloat(request?.trip.estimatedDistance || "0");
        setFuelCost(Math.round((distance / 10) * 500));
        // Estimate toll charges
        setTollCharges(2000);
        // Estimate permit fees
        setPermitFees(1500);
      }
    }
  }, [selectedVehicle, vehicles, request]);

  const addCustomLineItem = () => {
    setCustomLineItems([
      ...customLineItems,
      { id: Date.now().toString(), description: "", amount: 0 },
    ]);
  };

  const removeCustomLineItem = (id: string) => {
    setCustomLineItems(customLineItems.filter((item) => item.id !== id));
  };

  const updateCustomLineItem = (
    id: string,
    field: "description" | "amount",
    value: string | number,
  ) => {
    setCustomLineItems(
      customLineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const calculateSubtotal = () => {
    const customTotal = customLineItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    return (
      vehicleRentalCost +
      driverCost +
      fuelCost +
      tollCharges +
      permitFees +
      customTotal
    );
  };

  const calculateTax = () => {
    return Math.round(calculateSubtotal() * TAX_RATE);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSaveDraft = async () => {
    setSubmitting(true);
    try {
      // TODO: Implement save draft API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("Quotation saved as draft");
      router.push(`/${locale}/owner/quotations/sent`);
    } catch (error) {
      console.error("Failed to save draft:", error);
      alert("Failed to save draft");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendQuotation = async () => {
    if (!selectedVehicle) {
      alert("Please select a vehicle");
      return;
    }

    if (!request?.trip.estimatedDistance || !request?.trip.estimatedDuration) {
      alert("Please ensure trip details have estimated distance and duration");
      return;
    }

    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = calculateTotal();

    setSubmitting(true);
    try {
      const response = await quotationService.sendQuotation(id, {
        vehicleId: selectedVehicle,
        startTime: request.trip.startTime || "08:00 AM",
        estimatedDistance: request.trip.estimatedDistance,
        estimatedDuration: request.trip.estimatedDuration,
        vehicleRentalCost,
        driverCost,
        fuelCost,
        tollCharges,
        permitFees,
        customItems: customLineItems.map((item) => ({
          description: item.description,
          amount: item.amount,
        })),
        subtotal,
        tax,
        totalAmount: total,
        additionalNotes,
        validityDays,
      });

      alert("Quotation sent successfully!");
      // Response is auto-unwrapped by API client, so quotation is directly on response
      const quotation = (response as any)?.quotation || response;
      router.push(`/${locale}/owner/quotations/sent/${quotation.id || id}`);
    } catch (error: any) {
      console.error("Failed to send quotation:", error);
      alert(error.message || "Failed to send quotation");
    } finally {
      setSubmitting(false);
    }
  };

  if (guardLoading || !isAuthorized || !user || loading) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!request) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Request not found
            </h3>
            <Link
              href={`/${locale}/owner/quotations`}
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              Back to Quotations
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/quotations`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              <FaArrowLeft className="h-4 w-4" />
              Back to Quotations
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">
              Send Quotation
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Create and send a customized quotation for {request.customer.name}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Form */}
            <div className="space-y-6 lg:col-span-2">
              {/* Request Details Summary */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FaFileAlt className="h-5 w-5 text-primary" />
                  Request Details
                </h2>

                <div className="space-y-4">
                  {/* Customer Information */}
                  <div className="rounded-lg bg-gray-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">
                      Customer Information
                    </h3>
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <span className="text-gray-600">Name:</span>
                        <p className="font-medium text-gray-900">
                          {request.customer.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Email:</span>
                        <p className="font-medium text-gray-900">
                          {request.customer.email}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Phone:</span>
                        <p className="font-medium text-gray-900">
                          {request.customer.phone}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="grid gap-4 text-sm md:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <FaMapMarkerAlt className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Route</div>
                        <div className="font-medium text-gray-900">
                          {request.trip.pickupLocation} →{" "}
                          {request.trip.dropoffLocation}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          {request.trip.estimatedDistance} •{" "}
                          {request.trip.estimatedDuration}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FaCalendarAlt className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Date & Time</div>
                        <div className="font-medium text-gray-900">
                          {formatDate(request.trip.startDate, "medium")}
                        </div>
                        <div className="text-xs text-gray-600">
                          {request.trip.startTime}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FaUsers className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Passengers</div>
                        <div className="font-medium text-gray-900">
                          {request.passengers} passengers
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FaInfoCircle className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">
                          Vehicle Preference
                        </div>
                        <div className="font-medium text-gray-900">
                          {request.vehicleType}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Special Requirements */}
                  {request.specialRequirements && (
                    <div className="rounded-lg bg-yellow-50 p-3">
                      <h4 className="mb-1 text-sm font-semibold text-yellow-900">
                        Special Requirements
                      </h4>
                      <p className="text-sm text-yellow-800">
                        {request.specialRequirements}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle Selection */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  {isSpecificVehicleRequest
                    ? "Requested Vehicle"
                    : "Select Vehicle"}
                </h2>

                {/* Show message if this is a specific vehicle request */}
                {isSpecificVehicleRequest && requestedVehicle && (
                  <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <FaInfoCircle className="mt-0.5 h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-900">
                          Customer Requested This Specific Vehicle
                        </h4>
                        <p className="mt-1 text-sm text-blue-800">
                          The customer selected this vehicle from your fleet.
                          The quotation will be sent for this vehicle only.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Requirements Summary */}
                <div className="mb-4 rounded-lg bg-blue-50 p-3">
                  <h4 className="mb-2 text-sm font-semibold text-blue-900">
                    Customer Requirements
                  </h4>
                  <div className="flex flex-wrap gap-4 text-sm text-blue-800">
                    <span className="flex items-center gap-1.5">
                      <FaUsers className="h-3.5 w-3.5" />
                      {request.passengers} passengers
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FaInfoCircle className="h-3.5 w-3.5" />
                      {request.vehicleType} preferred
                    </span>
                  </div>
                </div>

                {vehicles.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 p-8 text-center">
                    <p className="text-sm text-gray-600">
                      No vehicles available. Please add vehicles to your fleet
                      first.
                    </p>
                    <Link
                      href={`/${locale}/owner/fleet/add`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <FaPlus className="h-3 w-3" />
                      Add Vehicle
                    </Link>
                  </div>
                ) : isSpecificVehicleRequest && requestedVehicle ? (
                  // Show only the requested vehicle (read-only)
                  <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {requestedVehicle.name}
                          </h3>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Requested by Customer
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {requestedVehicle.type} • {requestedVehicle.capacity}{" "}
                          seats
                          {requestedVehicle.acType &&
                            ` • ${requestedVehicle.acType.replace("-", " ").toUpperCase()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Base Rate</p>
                        <p className="font-semibold text-gray-900">
                          LKR {requestedVehicle.baseRate.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">per day</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-primary/20 pt-3 text-sm text-primary">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                        ✓
                      </span>
                      Selected for this quotation
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getSortedVehicles().map((vehicle) => {
                      const suitability = getVehicleSuitability(vehicle);
                      return (
                        <div
                          key={vehicle.id}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                            selectedVehicle === vehicle.id
                              ? "border-primary bg-primary/5"
                              : suitability.suitable
                                ? "border-gray-200 hover:border-gray-300"
                                : "border-orange-200 bg-orange-50/50 hover:border-orange-300"
                          }`}
                          onClick={() => setSelectedVehicle(vehicle.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">
                                  {vehicle.name}
                                </h3>
                                {suitability.suitable ? (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                    Suitable
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                                    Check Issues
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-gray-600">
                                {vehicle.type} • {vehicle.capacity} seats
                                {vehicle.acType &&
                                  ` • ${vehicle.acType.replace("-", " ").toUpperCase()}`}
                              </p>

                              {/* Show suitability issues */}
                              {!suitability.suitable && (
                                <div className="mt-2 space-y-1">
                                  {suitability.issues.map((issue, idx) => (
                                    <p
                                      key={idx}
                                      className="text-xs text-orange-700"
                                    >
                                      • {issue}
                                    </p>
                                  ))}
                                </div>
                              )}

                              {/* Show capacity match info */}
                              {suitability.suitable && (
                                <p className="mt-1 text-xs text-green-700">
                                  • Capacity matches ({vehicle.capacity} seats
                                  for {request.passengers} passengers)
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Base Rate</p>
                              <p className="font-semibold text-gray-900">
                                LKR {vehicle.baseRate.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">per day</p>
                            </div>
                          </div>

                          {/* Selection indicator */}
                          {selectedVehicle === vehicle.id && (
                            <div className="mt-3 flex items-center gap-2 border-t border-primary/20 pt-3 text-sm text-primary">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                                ✓
                              </span>
                              Selected for this quotation
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Warning if selected vehicle doesn't meet requirements */}
                {selectedVehicle &&
                  !isSpecificVehicleRequest &&
                  !getVehicleSuitability(
                    vehicles.find((v) => v.id === selectedVehicle)!,
                  ).suitable && (
                    <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-3">
                      <div className="flex items-start gap-2">
                        <FaInfoCircle className="mt-0.5 h-4 w-4 text-orange-600" />
                        <div className="text-sm text-orange-800">
                          <p className="font-semibold">
                            Selected vehicle may not fully meet customer
                            requirements
                          </p>
                          <p className="mt-1 text-orange-700">
                            You can still send the quotation, but the customer
                            may prefer a different vehicle. Consider mentioning
                            this in your additional notes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {/* Pricing Breakdown */}
              {selectedVehicle && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Pricing Breakdown
                  </h2>

                  <div className="space-y-4">
                    {/* Vehicle Rental Cost */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Vehicle Rental Cost
                      </label>
                      <input
                        type="number"
                        value={vehicleRentalCost}
                        onChange={(e) =>
                          setVehicleRentalCost(Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Driver Cost */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Driver Cost
                      </label>
                      <input
                        type="number"
                        value={driverCost}
                        onChange={(e) => setDriverCost(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Fuel Cost */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Estimated Fuel Cost
                      </label>
                      <input
                        type="number"
                        value={fuelCost}
                        onChange={(e) => setFuelCost(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Toll Charges */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Toll Charges
                      </label>
                      <input
                        type="number"
                        value={tollCharges}
                        onChange={(e) => setTollCharges(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Permit Fees */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Permit Fees
                      </label>
                      <input
                        type="number"
                        value={permitFees}
                        onChange={(e) => setPermitFees(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Custom Line Items */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                          Other Charges
                        </label>
                        <button
                          onClick={addCustomLineItem}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          <FaPlus className="h-3 w-3" />
                          Add Item
                        </button>
                      </div>

                      <div className="space-y-2">
                        {customLineItems.map((item) => (
                          <div key={item.id} className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) =>
                                updateCustomLineItem(
                                  item.id,
                                  "description",
                                  e.target.value,
                                )
                              }
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <input
                              type="number"
                              placeholder="Amount"
                              value={item.amount}
                              onChange={(e) =>
                                updateCustomLineItem(
                                  item.id,
                                  "amount",
                                  Number(e.target.value),
                                )
                              }
                              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              onClick={() => removeCustomLineItem(item.id)}
                              className="rounded-lg border border-red-300 p-2 text-red-600 transition-colors hover:bg-red-50"
                            >
                              <FaTrash className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quotation Settings */}
              {selectedVehicle && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Quotation Settings
                  </h2>

                  <div className="space-y-4">
                    {/* Validity Period */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Validity Period
                      </label>
                      <select
                        value={validityDays}
                        onChange={(e) =>
                          setValidityDays(Number(e.target.value))
                        }
                        className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value={3}>3 days</option>
                        <option value={5}>5 days</option>
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                      </select>
                    </div>

                    {/* Additional Notes */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Additional Notes
                      </label>
                      <textarea
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        rows={4}
                        placeholder="Add any additional information or terms and conditions..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Preview */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                {/* Quotation Preview */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Quotation Preview
                  </h2>

                  {!selectedVehicle ? (
                    <div className="rounded-lg bg-gray-50 p-8 text-center">
                      <FaInfoCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Select a vehicle to see the quotation preview
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Breakdown */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Vehicle Rental</span>
                          <span className="font-medium text-gray-900">
                            LKR {vehicleRentalCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Driver Cost</span>
                          <span className="font-medium text-gray-900">
                            LKR {driverCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fuel Cost</span>
                          <span className="font-medium text-gray-900">
                            LKR {fuelCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Toll Charges</span>
                          <span className="font-medium text-gray-900">
                            LKR {tollCharges.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Permit Fees</span>
                          <span className="font-medium text-gray-900">
                            LKR {permitFees.toLocaleString()}
                          </span>
                        </div>

                        {customLineItems.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span className="text-gray-600">
                              {item.description || "Other"}
                            </span>
                            <span className="font-medium text-gray-900">
                              LKR {item.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}

                        <div className="border-t border-gray-200 pt-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-medium text-gray-900">
                              LKR {calculateSubtotal().toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax (10%)</span>
                          <span className="font-medium text-gray-900">
                            LKR {calculateTax().toLocaleString()}
                          </span>
                        </div>

                        <div className="border-t-2 border-gray-900 pt-2">
                          <div className="flex justify-between">
                            <span className="font-semibold text-gray-900">
                              Grand Total
                            </span>
                            <span className="text-lg font-bold text-gray-900">
                              LKR {calculateTotal().toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Validity Info */}
                      <div className="rounded-lg bg-blue-50 p-3">
                        <div className="flex items-start gap-2">
                          <FaClock className="mt-0.5 h-4 w-4 text-blue-600" />
                          <div className="text-xs text-blue-900">
                            <p className="font-semibold">
                              Valid for {validityDays} days
                            </p>
                            <p className="mt-0.5 text-blue-700">
                              Expires on{" "}
                              {new Date(
                                Date.now() + validityDays * 24 * 60 * 60 * 1000,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleSendQuotation}
                    disabled={!selectedVehicle || submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FaPaperPlane className="h-4 w-4" />
                    {submitting ? "Sending..." : "Send Quotation"}
                  </button>

                  <button
                    onClick={handleSaveDraft}
                    disabled={!selectedVehicle || submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FaSave className="h-4 w-4" />
                    Save as Draft
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
