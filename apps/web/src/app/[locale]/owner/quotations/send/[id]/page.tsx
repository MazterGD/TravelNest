"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import {
  quotationService,
  vehicleService,
  landingContentService,
} from "@/lib/api/services";
import { formatDate } from "@/lib/utils/formatters";
import dynamic from "next/dynamic";
import { Map } from "lucide-react";

const InteractiveMap = dynamic(
  () => import("@/components/ui/InteractiveMap"),
  { ssr: false, loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-lg flex items-center justify-center"><Map className="h-8 w-8 text-muted-foreground" /></div> }
);
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Clock,
  FileText,
  Plus,
  Trash2,
  Send,
  Info,
  AlertCircle,
} from "lucide-react";

interface QuotationRequest {
  id: string;
  vehicleId?: string;
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
    // PostGIS data attached to Quotation
    itineraryStops?: any[];
    itineraryRoute?: any;
  };
  passengers: number;
  vehicleType: string;
  specialRequirements: string;
}

interface Vehicle {
  id: string;
  name: string;
  type: string;
  rawType: string;
  capacity: number;
  baseRate: number;
  acType: string;
  fuelCostPerKm?: number;
}

interface CustomLineItem {
  id: string;
  description: string;
  amount: number;
}

type VehicleIssue =
  | { type: "capacity"; vehicleCapacity: number; requiredPassengers: number }
  | { type: "vehicleType"; requestedType: string };

export default function SendQuotationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const t = useTranslations("sendQuotation");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [request, setRequest] = useState<QuotationRequest | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isSpecificVehicleRequest, setIsSpecificVehicleRequest] =
    useState(false);
  const [requestedVehicle, setRequestedVehicle] = useState<Vehicle | null>(
    null,
  );

  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [vehicleRentalCost, setVehicleRentalCost] = useState<number>(0);
  const [driverCost, setDriverCost] = useState<number>(0);
  const [fuelCost, setFuelCost] = useState<number>(0);
  const [fuelPricePerKm, setFuelPricePerKm] = useState<number>(0);
  const [tollCharges, setTollCharges] = useState<number>(0);
  const [permitFees, setPermitFees] = useState<number>(0);
  const [customLineItems, setCustomLineItems] = useState<CustomLineItem[]>([]);
  const [validityDays, setValidityDays] = useState<number>(0);
  const [additionalNotes, setAdditionalNotes] = useState<string>("");
  const [quotationPricing, setQuotationPricing] = useState({
    driverCostPercentage: 0,
    fuelCostPerKm: 0,
    tollChargesBase: 0,
    permitFeesBase: 0,
    taxRate: 0,
    defaultValidityDays: 0,
    validityOptionsDays: [] as number[],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const publicConfig = await landingContentService.getPublicConfig();
        const pricing = publicConfig.quotationPricing;
        setQuotationPricing(pricing);
        setValidityDays(pricing.defaultValidityDays || 0);

        const quotationResponse = await quotationService.getById(id);
        const data = quotationResponse.quotation;

        if (!data) {
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
            itineraryStops: (data as any).itineraryStops,
            itineraryRoute: (data as any).itineraryRoute,
          },
          passengers: data.passengerCount,
          vehicleType: data.vehicleType,
          specialRequirements: data.specialRequests || "",
        });

        const vehiclesResponse = await vehicleService.getMyVehicles();
        const vehicleList = (vehiclesResponse?.vehicles || []).map(
          (v: {
            id: string;
            brand?: string;
            make?: string;
            model: string;
            licensePlate?: string;
            registrationNumber?: string;
            type: string;
            seats?: number;
            passengerCapacity?: number;
            pricePerDay?: number;
            acType?: string;
          }) => ({
            id: v.id,
            name: `${v.brand || v.make || ""} ${v.model} (${v.licensePlate || v.registrationNumber || ""})`,
            type: mapVehicleTypeToDisplay(v.type),
            rawType: v.type,
            capacity: v.seats || v.passengerCapacity || 0,
            baseRate: v.pricePerDay || 0,
            acType: v.acType || "",
            fuelCostPerKm: (v as any).fuelCostPerKm || 0,
          }),
        );
        setVehicles(vehicleList);

        if (data.vehicleId) {
          const specificVehicle = vehicleList.find(
            (v: Vehicle) => v.id === data.vehicleId,
          );
          if (specificVehicle) {
            setIsSpecificVehicleRequest(true);
            setRequestedVehicle(specificVehicle);
            setSelectedVehicle(data.vehicleId);

            if (specificVehicle.fuelCostPerKm && data.estimatedDistance) {
              const distanceMatch = data.estimatedDistance.match(/([\d.]+)/);
              if (distanceMatch) {
                const distance = parseFloat(distanceMatch[1]);
                setFuelCost(Math.round(distance * specificVehicle.fuelCostPerKm));
              }
            }
          }
        }
      } catch {
        setErrorMessage(t("errors.generic"));
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized) {
      fetchData();
    }
  }, [id, isAuthorized, t]);

  const mapVehicleTypeToDisplay = (type: string): string => {
    const typeMap: Record<string, string> = {
      ORDINARY: "Ordinary",
      SEMI_LUXURY: "Semi-Luxury",
      LUXURY_AC: "Luxury AC",
    };
    return typeMap[type] || type;
  };

  const isVehicleTypeMatch = (
    vehicleRawType: string,
    customerPreference: string,
  ): boolean => {
    const preferenceNormalized = customerPreference
      .toUpperCase()
      .replace(/[\s-]/g, "_");
    if (vehicleRawType === preferenceNormalized) return true;
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

  const getVehicleSuitability = (
    vehicle: Vehicle,
  ): { suitable: boolean; issues: VehicleIssue[] } => {
    const issues: VehicleIssue[] = [];
    if (request && vehicle.capacity < request.passengers) {
      issues.push({
        type: "capacity",
        vehicleCapacity: vehicle.capacity,
        requiredPassengers: request.passengers,
      });
    }
    if (
      request &&
      request.vehicleType &&
      !isVehicleTypeMatch(vehicle.rawType, request.vehicleType)
    ) {
      issues.push({ type: "vehicleType", requestedType: request.vehicleType });
    }
    return { suitable: issues.length === 0, issues };
  };

  const getSortedVehicles = (): Vehicle[] => {
    return [...vehicles].sort((a, b) => {
      const aSuitability = getVehicleSuitability(a);
      const bSuitability = getVehicleSuitability(b);
      if (aSuitability.suitable && !bSuitability.suitable) return -1;
      if (!aSuitability.suitable && bSuitability.suitable) return 1;
      if (request) {
        const aCapacityDiff = Math.abs(a.capacity - request.passengers);
        const bCapacityDiff = Math.abs(b.capacity - request.passengers);
        if (aCapacityDiff !== bCapacityDiff)
          return aCapacityDiff - bCapacityDiff;
      }
      return a.baseRate - b.baseRate;
    });
  };

  useEffect(() => {
    if (selectedVehicle && vehicles.length > 0) {
      const vehicle = vehicles.find((v) => v.id === selectedVehicle);
      if (vehicle) {
        setVehicleRentalCost(vehicle.baseRate);
        setDriverCost(
          Math.round(vehicle.baseRate * quotationPricing.driverCostPercentage),
        );
        const distance = parseFloat(request?.trip.estimatedDistance || "0");
        const perKmRate = vehicle.fuelCostPerKm || quotationPricing.fuelCostPerKm || 0;
        setFuelPricePerKm(perKmRate);
        setTollCharges(quotationPricing.tollChargesBase);
        setPermitFees(quotationPricing.permitFeesBase);
      }
    }
  }, [selectedVehicle, vehicles, request, quotationPricing]);

  useEffect(() => {
    const distance = parseFloat(request?.trip.estimatedDistance || "0");
    setFuelCost(Math.round(distance * fuelPricePerKm));
  }, [fuelPricePerKm, request]);

  const addCustomLineItem = () => {
    setCustomLineItems([
      ...customLineItems,
      { id: Date.now().toString(), description: "", amount: 0 },
    ]);
  };

  const removeCustomLineItem = (itemId: string) => {
    setCustomLineItems(customLineItems.filter((item) => item.id !== itemId));
  };

  const updateCustomLineItem = (
    itemId: string,
    field: "description" | "amount",
    value: string | number,
  ) => {
    setCustomLineItems(
      customLineItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
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

  const calculateTax = () =>
    Math.round(calculateSubtotal() * quotationPricing.taxRate);

  const calculateTotal = () => calculateSubtotal() + calculateTax();

  const handleSendQuotation = async () => {
    setErrorMessage(null);

    if (!selectedVehicle) {
      setErrorMessage(t("errors.noVehicleSelected"));
      return;
    }

    if (!request?.trip.estimatedDistance || !request?.trip.estimatedDuration) {
      setErrorMessage(t("errors.missingTripDetails"));
      return;
    }

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
        subtotal: calculateSubtotal(),
        tax: calculateTax(),
        totalAmount: calculateTotal(),
        additionalNotes,
        validityDays,
      });

      const quotationId =
        (response as { quotation?: { id: string } })?.quotation?.id || id;
      router.push(`/${locale}/owner/quotations/sent/${quotationId}`);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.sendFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (guardLoading || !isAuthorized || !user || loading) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  if (!request) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("errors.notFound")}
            </h3>
            <Link
              href={`/${locale}/owner/quotations`}
              className="mt-4 inline-block text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("errors.backToQuotations")}
            </Link>
          </div>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-muted">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/quotations`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("backToQuotations")}
            </Link>
            <h1 className="text-xl font-semibold text-foreground">
              {t("title")}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("pageDescription", { name: request.customer.name })}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          {/* Inline error banner */}
          {errorMessage && (
            <div
              className="mb-6 flex items-start gap-3 rounded-md border border-error bg-[var(--color-error-bg)] p-4"
              role="alert"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-error-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-error-foreground">{errorMessage}</p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column — Form */}
            <div className="space-y-6 lg:col-span-2">
              {/* Request Details Summary */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <FileText
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                  {t("requestDetails.title")}
                </h2>

                <div className="space-y-4">
                  {/* Customer Information */}
                  <div className="rounded-md bg-[var(--color-bg-surface)] p-4">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      {t("requestDetails.customerInfo")}
                    </h3>
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">
                          {t("requestDetails.nameLabel")}:
                        </span>
                        <p className="font-medium text-foreground">
                          {request.customer.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t("requestDetails.emailLabel")}:
                        </span>
                        <p className="font-medium text-foreground">
                          {request.customer.email}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t("requestDetails.phoneLabel")}:
                        </span>
                        <p className="font-medium text-foreground">
                          {request.customer.phone}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="grid gap-4 text-sm md:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <MapPin
                        className="mt-0.5 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {t("requestDetails.route")}
                        </div>
                        <div className="font-medium text-foreground">
                          {request.trip.pickupLocation} →{" "}
                          {request.trip.dropoffLocation}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {request.trip.estimatedDistance} •{" "}
                          {request.trip.estimatedDuration}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Calendar
                        className="mt-0.5 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {t("requestDetails.dateAndTime")}
                        </div>
                        <div className="font-medium text-foreground">
                          {formatDate(request.trip.startDate, "medium")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {request.trip.startTime}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Users
                        className="mt-0.5 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {t("requestDetails.passengers")}
                        </div>
                        <div className="font-medium text-foreground">
                          {t("vehicleSelection.passengersCount", {
                            count: request.passengers,
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Info
                        className="mt-0.5 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {t("requestDetails.vehiclePreference")}
                        </div>
                        <div className="font-medium text-foreground">
                          {request.vehicleType}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Map (Read-Only) */}
                  <div className="mt-6">
                    <InteractiveMap
                      readOnly={true}
                      initialWaypoints={request.trip.itineraryStops?.map((stop: any) => ({
                        lat: stop.coordinates?.[1] || stop.lat,
                        lng: stop.coordinates?.[0] || stop.lng,
                        name: stop.locationName,
                      })) || []}
                      initialRouteGeometry={request.trip.itineraryRoute?.coordinates?.map(
                        ([lng, lat]: [number, number]) => [lat, lng]
                      ) || []}
                    />
                  </div>

                  {/* Special Requirements */}
                  {request.specialRequirements && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                      <h4 className="mb-1 text-sm font-semibold text-primary">
                        {t("requestDetails.specialRequirements")}
                      </h4>
                      <p className="text-sm text-primary/80">
                        {request.specialRequirements}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle Selection */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {isSpecificVehicleRequest
                    ? t("vehicleSelection.requested")
                    : t("vehicleSelection.select")}
                </h2>

                {/* Customer Requirements Summary */}
                <div className="mb-4 rounded-md p-3">
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    {t("vehicleSelection.customerRequirements")}
                  </h4>
                  <div className="flex flex-wrap gap-4 text-sm text-foreground/80">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("vehicleSelection.passengersCount", {
                        count: request.passengers,
                      })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("vehicleSelection.preferred", {
                        type: request.vehicleType,
                      })}
                    </span>
                  </div>
                </div>

                {vehicles.length === 0 ? (
                  <div className="rounded-md bg-[var(--color-bg-surface)] p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t("vehicleSelection.noVehicles")}
                    </p>
                    <Link
                      href={`/${locale}/owner/fleet/add`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      {t("vehicleSelection.addVehicle")}
                    </Link>
                  </div>
                ) : isSpecificVehicleRequest && requestedVehicle ? (
                  <div className="rounded-md border-2 border-primary bg-primary/5 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {requestedVehicle.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {requestedVehicle.type} •{" "}
                          {requestedVehicle.capacity} seats
                          {requestedVehicle.acType &&
                            ` • ${requestedVehicle.acType.replace("-", " ").toUpperCase()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {t("vehicleSelection.baseRate")}
                        </p>
                        <p className="font-semibold text-foreground">
                          LKR {requestedVehicle.baseRate.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("vehicleSelection.perDay")}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getSortedVehicles().map((vehicle) => {
                      const suitability = getVehicleSuitability(vehicle);
                      return (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => setSelectedVehicle(vehicle.id)}
                          aria-pressed={selectedVehicle === vehicle.id}
                          className={`w-full cursor-pointer rounded-md border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selectedVehicle === vehicle.id
                              ? "border-primary bg-primary/5"
                              : suitability.suitable
                                ? "border-border hover:border-primary/40"
                                : "border-error bg-[var(--color-error-bg)] hover:border-error"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground">
                                  {vehicle.name}
                                </h3>
                                {suitability.suitable ? (
                                  <span className="rounded-sm bg-[var(--color-success-bg)] px-2 py-0.5 text-xs font-medium text-success-foreground">
                                    {t("vehicleSelection.suitable")}
                                  </span>
                                ) : (
                                  <span className="rounded-sm bg-[var(--color-error-bg)] px-2 py-0.5 text-xs font-medium text-error-foreground">
                                    {t("vehicleSelection.checkIssues")}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {vehicle.type} • {vehicle.capacity} seats
                                {vehicle.acType &&
                                  ` • ${vehicle.acType.replace("-", " ").toUpperCase()}`}
                              </p>

                              {!suitability.suitable && (
                                <div className="mt-2 space-y-1">
                                  {suitability.issues.map((issue, idx) => (
                                    <p
                                      key={idx}
                                      className="text-xs text-error-foreground"
                                    >
                                      •{" "}
                                      {issue.type === "capacity"
                                        ? t(
                                            "vehicleSelection.insufficientCapacity",
                                            {
                                              capacity: issue.vehicleCapacity,
                                              passengers:
                                                issue.requiredPassengers,
                                            },
                                          )
                                        : t("vehicleSelection.typeMismatch", {
                                            type: issue.requestedType,
                                          })}
                                    </p>
                                  ))}
                                </div>
                              )}

                              {suitability.suitable && (
                                <p className="mt-1 text-xs text-success-foreground">
                                  •{" "}
                                  {t("vehicleSelection.capacityMatches", {
                                    capacity: vehicle.capacity,
                                    passengers: request.passengers,
                                  })}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                {t("vehicleSelection.baseRate")}
                              </p>
                              <p className="font-semibold text-foreground">
                                LKR {vehicle.baseRate.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("vehicleSelection.perDay")}
                              </p>
                            </div>
                          </div>

                          {selectedVehicle === vehicle.id && (
                            <div className="mt-3 flex items-center gap-2 border-t border-primary/20 pt-3 text-sm text-primary">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white"
                                style={{ fontSize: "10px" }}
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                              {t("vehicleSelection.selected")}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Warning if selected vehicle does not meet requirements */}
                {selectedVehicle &&
                  !isSpecificVehicleRequest &&
                  (() => {
                    const selected = vehicles.find(
                      (v) => v.id === selectedVehicle,
                    );
                    return selected && !getVehicleSuitability(selected).suitable;
                  })() && (
                    <div className="mt-4 rounded-md border border-error bg-[var(--color-error-bg)] p-3">
                      <div className="flex items-start gap-2">
                        <Info
                          className="mt-0.5 h-4 w-4 text-error-foreground"
                          aria-hidden="true"
                        />
                        <div className="text-sm text-error-foreground">
                          <p className="font-semibold">
                            {t("vehicleSelection.warningTitle")}
                          </p>
                          <p className="mt-1">
                            {t("vehicleSelection.warningDesc")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {/* Pricing Breakdown */}
              {selectedVehicle && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("pricing.title")}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {t("pricing.vehicleRental")}
                      </label>
                      <input
                        type="number"
                        value={vehicleRentalCost}
                        onChange={(e) =>
                          setVehicleRentalCost(Number(e.target.value))
                        }
                        className="h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {t("pricing.driverCost")}
                      </label>
                      <input
                        type="number"
                        value={driverCost}
                        onChange={(e) => setDriverCost(Number(e.target.value))}
                        className="h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {t("pricing.fuelPricePerKm", { defaultValue: "Fuel Price per Km" })}
                      </label>
                      <input
                        type="number"
                        value={fuelPricePerKm}
                        onChange={(e) => setFuelPricePerKm(Number(e.target.value))}
                        className="h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {t("pricing.fuelCost")}
                      </label>
                      <input
                        type="number"
                        value={fuelCost}
                        disabled
                        readOnly
                        className="h-11 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm transition-colors cursor-not-allowed text-muted-foreground"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {t("pricing.tollCharges")}
                      </label>
                      <input
                        type="number"
                        value={tollCharges}
                        onChange={(e) =>
                          setTollCharges(Number(e.target.value))
                        }
                        className="h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {t("pricing.permitFees")}
                      </label>
                      <input
                        type="number"
                        value={permitFees}
                        onChange={(e) => setPermitFees(Number(e.target.value))}
                        className="h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    {/* Custom Line Items */}
                    <div className="border-t border-border pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground">
                          {t("pricing.otherCharges")}
                        </label>
                        <button
                          type="button"
                          onClick={addCustomLineItem}
                          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          {t("pricing.addItem")}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {customLineItems.map((item) => (
                          <div key={item.id} className="flex gap-2">
                            <input
                              type="text"
                              placeholder={t("pricing.descriptionPlaceholder")}
                              value={item.description}
                              onChange={(e) =>
                                updateCustomLineItem(
                                  item.id,
                                  "description",
                                  e.target.value,
                                )
                              }
                              className="h-11 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <input
                              type="number"
                              placeholder={t("pricing.amountPlaceholder")}
                              value={item.amount}
                              onChange={(e) =>
                                updateCustomLineItem(
                                  item.id,
                                  "amount",
                                  Number(e.target.value),
                                )
                              }
                              className="h-11 w-32 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <button
                              type="button"
                              onClick={() => removeCustomLineItem(item.id)}
                              aria-label={t("pricing.removeItem")}
                              className="rounded-md border border-error p-2 text-error-foreground transition-colors hover:bg-[var(--color-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Trash2
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
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
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("settings.title")}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {t("settings.validityPeriod")}
                      </label>
                      <select
                        className="h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={validityDays}
                        onChange={(e) =>
                          setValidityDays(Number(e.target.value))
                        }
                      >
                        {quotationPricing.validityOptionsDays.map((days) => (
                          <option key={days} value={days}>
                            {t("settings.validityDays", { days })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {t("settings.additionalNotes")}
                      </label>
                      <textarea
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        rows={4}
                        placeholder={t("settings.notesPlaceholder")}
                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column — Preview */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("preview.title")}
                  </h2>

                  {!selectedVehicle ? (
                    <div className="rounded-md bg-[var(--color-bg-surface)] p-8 text-center">
                      <Info
                        className="mx-auto mb-2 h-8 w-8 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-muted-foreground">
                        {t("preview.selectVehiclePrompt")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t("preview.vehicleRental")}
                          </span>
                          <span className="font-medium text-foreground">
                            LKR {vehicleRentalCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t("preview.driverCost")}
                          </span>
                          <span className="font-medium text-foreground">
                            LKR {driverCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t("preview.fuelCost")}
                          </span>
                          <span className="font-medium text-foreground">
                            LKR {fuelCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t("preview.tollCharges")}
                          </span>
                          <span className="font-medium text-foreground">
                            LKR {tollCharges.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t("preview.permitFees")}
                          </span>
                          <span className="font-medium text-foreground">
                            LKR {permitFees.toLocaleString()}
                          </span>
                        </div>

                        {customLineItems.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {item.description || t("preview.other")}
                            </span>
                            <span className="font-medium text-foreground">
                              LKR {item.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}

                        <div className="border-t border-border pt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t("preview.subtotal")}
                            </span>
                            <span className="font-medium text-foreground">
                              LKR {calculateSubtotal().toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t("preview.tax", {
                              rate: Math.round(
                                quotationPricing.taxRate * 100,
                              ),
                            })}
                          </span>
                          <span className="font-medium text-foreground">
                            LKR {calculateTax().toLocaleString()}
                          </span>
                        </div>

                        <div className="border-t-2 border-foreground pt-2">
                          <div className="flex justify-between">
                            <span className="font-semibold text-foreground">
                              {t("preview.grandTotal")}
                            </span>
                            <span className="text-lg font-bold text-foreground">
                              LKR {calculateTotal().toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md bg-primary/5 p-3">
                        <div className="flex items-start gap-2">
                          <Clock
                            className="mt-0.5 h-4 w-4 text-primary"
                            aria-hidden="true"
                          />
                          <div className="text-xs text-primary">
                            <p className="font-semibold">
                              {t("preview.validFor", { days: validityDays })}
                            </p>
                            <p className="mt-0.5 text-primary/80">
                              {t("preview.expiresOn", {
                                date: new Date(
                                  Date.now() +
                                    validityDays * 24 * 60 * 60 * 1000,
                                ).toLocaleDateString(),
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div>
                  <button
                    type="button"
                    onClick={handleSendQuotation}
                    disabled={!selectedVehicle || submitting}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {submitting ? t("actions.sending") : t("actions.send")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
