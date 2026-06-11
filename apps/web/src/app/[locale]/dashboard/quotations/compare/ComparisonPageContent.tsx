"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner, Button, Select, CTAButton } from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import {
  type ReceivedQuotation,
  type QuotationRequest,
} from "@/store";
import { quotationService, tripService } from "@/lib/api/services";
import {
  ArrowLeft,
  Check,
  X,
  Phone,
  Star,
  MapPin,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Plus,
  Trophy,
  Download,
} from "lucide-react";

interface PriceBreakdown {
  vehicleRentalCost: number;
  driverCost: number;
  fuelCost: number;
  tollCharges: number;
  permitFees: number;
  otherCharges: number;
  tax: number;
}

interface ExtendedQuotation extends ReceivedQuotation {
  priceBreakdown?: PriceBreakdown;
  vehicleSpecifications?: {
    brand: string;
    model: string;
    year: number;
    seats: number;
    fuelType: string;
    transmission: string;
  };
  amenities?: string[];
  contactPhone?: string;
}

interface ComparisonPageContentProps {
  locale: string;
}

export default function ComparisonPageContent({
  locale,
}: ComparisonPageContentProps) {
  const t = useTranslations("quotation");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: guardLoading } = useProtectedRoute();

  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState<ExtendedQuotation[]>([]);
  const [requestDetails, setRequestDetails] =
    useState<QuotationRequest | null>(null);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(
    new Set(),
  );
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(
    new Set(),
  );
  const [sortBy, setSortBy] = useState<string>("price-asc");
  const [filterBy, setFilterBy] = useState<string>("all");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [pdfNotice, setPdfNotice] = useState(false);

  const quotationIds = searchParams.get("ids")?.split(",") || [];
  const requestId = searchParams.get("requestId");
  const tripId = searchParams.get("tripId");

  useEffect(() => {
    if (!guardLoading) {
      fetchData();
    }
  }, [guardLoading, requestId, tripId, quotationIds.join(",")]);

  // Auto-dismiss pdf notice after 4 seconds
  useEffect(() => {
    if (!pdfNotice) return;
    const timer = setTimeout(() => setPdfNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [pdfNotice]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (tripId) {
        // Trip-scoped comparison: load the parent trip and only quotations that
        // have an owner response (SENT / VIEWED / ACCEPTED). PENDING means the
        // owner hasn't priced yet and EXPIRED means the validity period passed
        // — neither belongs in a side-by-side price comparison.
        const tripResponse = await tripService.getById(tripId);
        const tripData =
          (tripResponse as any)?.data?.trip ||
          (tripResponse as any)?.trip ||
          (tripResponse as any);
        if (!tripData) {
          setLoading(false);
          return;
        }
        const allQs: any[] = Array.isArray(tripData.quotations)
          ? tripData.quotations
          : [];
        const comparable = allQs.filter((q) => {
          const status = String(q.status || "").toUpperCase();
          return (
            (status === "SENT" || status === "VIEWED" || status === "ACCEPTED") &&
            q.totalAmount != null &&
            q.vehicleId
          );
        });

        const tripStart = tripData.startDate
          ? String(tripData.startDate).split("T")[0]
          : "";
        const tripEnd = tripData.endDate
          ? String(tripData.endDate).split("T")[0]
          : tripStart;
        const request: QuotationRequest = {
          id: tripData.id,
          customerId: tripData.customerId,
          pickupLocation: {
            address: tripData.pickupLocation || "",
            city:
              tripData.pickupCity ||
              tripData.pickupLocation?.split(",")[0]?.trim() ||
              "",
            district: tripData.pickupDistrict || "",
          },
          dropoffLocation: {
            address: tripData.dropoffLocation || "",
            city:
              tripData.dropoffCity ||
              tripData.dropoffLocation?.split(",")[0]?.trim() ||
              "",
            district: tripData.dropoffDistrict || "",
          },
          pickupDate: tripStart,
          pickupTime: tripData.startTime || "",
          returnDate: tripEnd,
          returnTime: undefined,
          isRoundTrip: !!tripData.isRoundTrip,
          passengerCount: tripData.passengerCount || 0,
          vehicleType: tripData.vehicleTypePreference || "",
          specialRequests: tripData.specialRequests,
          luggageCount: 0,
          needsAC: !!tripData.needsAC,
          status: "quoted",
          quotationsCount: comparable.length,
          createdAt: tripData.createdAt,
          updatedAt: tripData.updatedAt,
        };
        setRequestDetails(request);

        const transformed: ExtendedQuotation[] = comparable.map((q: any) => ({
          id: q.id,
          requestId: tripData.id,
          ownerId: q.vehicle?.owner?.id || q.ownerId || "",
          ownerName: q.vehicle?.owner
            ? `${q.vehicle.owner.firstName} ${q.vehicle.owner.lastName}`
            : t("comparison.ownerFallback"),
          vehicleId: q.vehicleId || "",
          vehicleName:
            q.vehicle?.name ||
            (q.vehicle
              ? `${q.vehicle.brand || ""} ${q.vehicle.model || ""}`.trim()
              : "") ||
            t("comparison.vehicleFallback"),
          vehicleImage: q.vehicle?.images?.[0] || "",
          status: (String(q.status || "pending").toLowerCase() as any),
          totalAmount: q.totalAmount || 0,
          price: q.totalAmount || 0,
          expiryDate: q.expiryDate || q.validUntil,
          validUntil: q.validUntil
            ? new Date(q.validUntil).toLocaleDateString(locale)
            : "",
          notes: q.additionalNotes || q.notes || "",
          message: q.additionalNotes || q.notes || "",
          sentAt: q.sentAt,
          createdAt: q.createdAt,
          rating: null,
          totalTrips: null,
          priceBreakdown: {
            vehicleRentalCost: q.vehicleRentalCost || 0,
            driverCost: q.driverCost || 0,
            fuelCost: q.fuelCost || 0,
            tollCharges: q.tollCharges || 0,
            permitFees: q.permitFees || 0,
            otherCharges: (q.customItems || []).reduce(
              (sum: number, item: any) => sum + (item.amount || 0),
              0,
            ),
            tax: q.tax || 0,
          },
          vehicleSpecifications: q.vehicle
            ? {
                brand: q.vehicle.brand || "",
                model: q.vehicle.model || "",
                year: q.vehicle.year || 0,
                seats: q.vehicle.seats || 0,
                fuelType: q.vehicle.fuelType || "",
                transmission: q.vehicle.transmission || "",
              }
            : undefined,
          amenities: Array.isArray(q.vehicle?.features)
            ? q.vehicle.features
            : [],
          contactPhone: q.vehicle?.owner?.phone || "",
          customItems: q.customItems || [],
        }));

        setQuotations(transformed);
        setSelectedQuotations(new Set(transformed.map((q) => q.id)));
        return;
      }

      if (requestId) {
        const requestResponse = await quotationService.getById(requestId);
        const requestData = requestResponse as any;
        const baseQuotation =
          requestData.data?.quotation || requestData.quotation;

        const response = await quotationService.getMyRequests();
        const data = response as any;
        const allQuotations = data.data?.quotations || data.quotations || [];

        const request: QuotationRequest = {
          id: baseQuotation.id,
          customerId: baseQuotation.customerId,
          pickupLocation:
            typeof baseQuotation.pickupLocation === "string"
              ? {
                  address: baseQuotation.pickupLocation,
                  city:
                    baseQuotation.pickupLocation.split(",")[0]?.trim() || "",
                }
              : baseQuotation.pickupLocation,
          dropoffLocation:
            typeof baseQuotation.dropoffLocation === "string"
              ? {
                  address: baseQuotation.dropoffLocation,
                  city:
                    baseQuotation.dropoffLocation.split(",")[0]?.trim() || "",
                }
              : baseQuotation.dropoffLocation,
          pickupDate: baseQuotation.startDate?.split("T")[0] || "",
          pickupTime: baseQuotation.startTime || "",
          returnDate: baseQuotation.endDate?.split("T")[0],
          returnTime: baseQuotation.returnTime,
          isRoundTrip: baseQuotation.isRoundTrip || false,
          passengerCount: baseQuotation.passengerCount || 0,
          vehicleType: baseQuotation.vehicleType || "",
          specialRequests: baseQuotation.specialRequests,
          luggageCount: baseQuotation.luggageCount || 0,
          needsAC: baseQuotation.needsAC ?? true,
          status: baseQuotation.status?.toLowerCase() || "pending",
          quotationsCount: 0,
          createdAt: baseQuotation.createdAt,
          updatedAt: baseQuotation.updatedAt,
        };

        const baseStartDate = baseQuotation.startDate?.split("T")[0];
        // Only include owner-priced quotations that match this trip
        const comparableQuotations = allQuotations.filter((q: any) => {
          const qStartDate = q.startDate?.split("T")[0];
          const matchesLocation =
            q.pickupLocation === baseQuotation.pickupLocation &&
            q.dropoffLocation === baseQuotation.dropoffLocation;
          const matchesDate = qStartDate === baseStartDate;
          const isComparable =
            ["sent", "viewed", "accepted"].includes(
              q.status?.toLowerCase(),
            ) && q.totalAmount != null;
          return matchesLocation && matchesDate && isComparable;
        });

        request.quotationsCount = comparableQuotations.length;
        setRequestDetails(request);

        const transformedQuotations: ExtendedQuotation[] =
          comparableQuotations.map((q: any) => ({
            id: q.id,
            requestId: requestId,
            ownerId: q.vehicle?.owner?.id || q.ownerId || "",
            ownerName: q.vehicle?.owner
              ? `${q.vehicle.owner.firstName} ${q.vehicle.owner.lastName}`
              : t("comparison.ownerFallback"),
            vehicleId: q.vehicleId || "",
            vehicleName: q.vehicle?.name || t("comparison.vehicleFallback"),
            vehicleImage: q.vehicle?.images?.[0] || "",
            status: q.status?.toLowerCase() || "pending",
            totalAmount: q.totalAmount || 0,
            price: q.totalAmount || 0,
            expiryDate: q.expiryDate || q.validUntil,
            validUntil: q.validUntil
              ? new Date(q.validUntil).toLocaleDateString(locale)
              : "",
            notes: q.additionalNotes || q.notes || "",
            message: q.additionalNotes || q.notes || "",
            sentAt: q.sentAt,
            createdAt: q.createdAt,
            // ratings fetched from aggregated owner reviews — not yet available per API
            rating: null,
            totalTrips: null,
            priceBreakdown: {
              vehicleRentalCost: q.vehicleRentalCost || 0,
              driverCost: q.driverCost || 0,
              fuelCost: q.fuelCost || 0,
              tollCharges: q.tollCharges || 0,
              permitFees: q.permitFees || 0,
              otherCharges: (q.customItems || []).reduce(
                (sum: number, item: any) => sum + (item.amount || 0),
                0,
              ),
              tax: q.tax || 0,
            },
            vehicleSpecifications: q.vehicle
              ? {
                  brand: q.vehicle.brand || "",
                  model: q.vehicle.model || "",
                  year: q.vehicle.year || 0,
                  seats: q.vehicle.seats || 0,
                  fuelType: q.vehicle.fuelType || "",
                  transmission: q.vehicle.transmission || "",
                }
              : undefined,
            amenities: Array.isArray(q.vehicle?.features)
              ? q.vehicle.features
              : [],
            contactPhone: q.vehicle?.owner?.phone || "",
            customItems: q.customItems || [],
          }));

        setQuotations(transformedQuotations);
        setSelectedQuotations(new Set(transformedQuotations.map((q) => q.id)));
      } else if (quotationIds.length > 0) {
        const quotationsData = await Promise.all(
          quotationIds.map((id) => quotationService.getById(id)),
        );

        const transformedQuotations: ExtendedQuotation[] = quotationsData.map(
          (response) => {
            const data = response as any;
            const q = data.data?.quotation || data.quotation || data;

            return {
              id: q.id,
              requestId: q.requestId || requestId || "",
              ownerId: q.ownerId,
              vehicleId: q.vehicleId,
              status: q.status?.toLowerCase() || "pending",
              totalAmount: q.totalAmount,
              expiryDate: q.expiryDate || q.validUntil,
              notes: q.notes,
              createdAt: q.createdAt,
              ownerName:
                q.ownerName ||
                (q.owner
                  ? `${q.owner.firstName} ${q.owner.lastName}`
                  : t("comparison.ownerFallback")),
              vehicleName:
                q.vehicleName ||
                q.vehicle?.name ||
                t("comparison.vehicleFallback"),
              vehicleImage: q.vehicleImage || q.vehicle?.images?.[0] || "",
              // ratings not yet aggregated from review API
              rating: null,
              totalTrips: null,
              price: q.totalAmount,
              message: q.additionalNotes || q.message || "",
              validUntil:
                q.validUntil ||
                (q.expiryDate
                  ? new Date(q.expiryDate).toLocaleDateString(locale)
                  : ""),
              priceBreakdown: q.vehicleRentalCost
                ? {
                    vehicleRentalCost: q.vehicleRentalCost || 0,
                    driverCost: q.driverCost || 0,
                    fuelCost: q.fuelCost || 0,
                    tollCharges: q.tollCharges || 0,
                    permitFees: q.permitFees || 0,
                    otherCharges: (q.customItems || []).reduce(
                      (sum: number, item: any) => sum + (item.amount || 0),
                      0,
                    ),
                    tax: q.tax || 0,
                  }
                : undefined,
              vehicleSpecifications: q.vehicle
                ? {
                    brand: q.vehicle.brand,
                    model: q.vehicle.model,
                    year: q.vehicle.year,
                    seats: q.vehicle.seats,
                    fuelType: q.vehicle.fuelType,
                    transmission: q.vehicle.transmission,
                  }
                : undefined,
              amenities: q.vehicle?.features || [],
              contactPhone: q.ownerPhone || q.owner?.phone || "",
            };
          },
        );

        setQuotations(transformedQuotations);
        setSelectedQuotations(new Set(quotationIds));
      }
    } catch (error) {
      console.error("Error fetching comparison data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBreakdown = (id: string) => {
    const newExpanded = new Set(expandedBreakdowns);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedBreakdowns(newExpanded);
  };

  const toggleQuotationSelection = (id: string) => {
    const newSelected = new Set(selectedQuotations);
    if (newSelected.has(id)) {
      if (newSelected.size > 1) {
        newSelected.delete(id);
        setSelectedQuotations(newSelected);
      }
    } else {
      if (newSelected.size < 4) {
        newSelected.add(id);
        setSelectedQuotations(newSelected);
      }
    }
  };

  const getSortedQuotations = () => {
    let sorted = [...quotations];

    if (filterBy !== "all") {
      sorted = sorted.filter((q) => {
        if (filterBy === "best-value") {
          return q.price === Math.min(...quotations.map((q) => q.price));
        }
        // top-rated filter is suppressed when ratings are not yet available
        return true;
      });
    }

    switch (sortBy) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
    }

    return sorted.filter((q) => selectedQuotations.has(q.id));
  };

  const getBestValueId = () => {
    if (quotations.length === 0) return null;
    const minPrice = Math.min(...quotations.map((q) => q.price));
    return quotations.find((q) => q.price === minPrice)?.id;
  };

  const handleAcceptQuotation = (quotationId: string) => {
    router.push(
      `/${locale}/dashboard/bookings/confirm?quotationId=${quotationId}`,
    );
  };

  const handleRejectQuotation = async (quotationId: string) => {
    setRejectError(null);
    try {
      await quotationService.respondToQuotation(quotationId, {
        status: "REJECTED",
        rejectionReason: "Selected another quotation",
      });
      const newSelected = new Set(selectedQuotations);
      newSelected.delete(quotationId);
      setSelectedQuotations(newSelected);
      setQuotations((prev) => prev.filter((q) => q.id !== quotationId));
    } catch {
      setRejectError(t("comparison.rejectError"));
    }
  };

  const handleDownloadPDF = () => {
    setPdfNotice(true);
  };

  if (guardLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const sortedQuotations = getSortedQuotations();
  const bestValueId = getBestValueId();

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface)] pb-12">
      {/* Sticky header */}
      <div className="bg-[var(--color-bg-base)] border-b border-[var(--color-border-default)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/${locale}/dashboard/quotations`}
                aria-label={t("comparison.backToQuotations")}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-action-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 rounded-lg p-1"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("comparison.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("comparison.subtitle")}
                </p>
              </div>
            </div>
            <CTAButton
              variant="secondary"
              onClick={handleDownloadPDF}
              leftIcon={<Download size={16} />}
            >
              {t("comparison.downloadPDF")}
            </CTAButton>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* PDF not-available notice */}
        {pdfNotice && (
          <div
            role="status"
            aria-live="polite"
            className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-secondary)]"
          >
            {t("comparison.pdfNotAvailable")}
          </div>
        )}

        {/* Reject error banner */}
        {rejectError && (
          <div
            role="alert"
            className="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-error-text)]"
          >
            {rejectError}
          </div>
        )}

        {/* Trip details summary */}
        {requestDetails && (
          <div className="bg-[var(--color-bg-base)] rounded-[20px] shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              {t("comparison.tripDetails")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <MapPin
                  size={20}
                  className="text-[var(--color-action-primary)] mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("comparison.route")}
                  </p>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {requestDetails.pickupLocation.city} →{" "}
                    {requestDetails.dropoffLocation.city}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar
                  size={20}
                  className="text-[var(--color-action-primary)] mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("comparison.dates")}
                  </p>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {new Date(requestDetails.pickupDate).toLocaleDateString(
                      locale,
                    )}{" "}
                    {t("comparison.at")} {requestDetails.pickupTime}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users
                  size={20}
                  className="text-[var(--color-action-primary)] mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("comparison.passengers")}
                  </p>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {t("comparison.passengerCount", {
                      count: requestDetails.passengerCount,
                    })}
                  </p>
                </div>
              </div>
            </div>
            {requestDetails.specialRequests && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border-default)]">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("comparison.specialRequirements")}
                </p>
                <p className="text-[var(--color-text-primary)] mt-1">
                  {requestDetails.specialRequests}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filter and sort controls */}
        <div className="bg-[var(--color-bg-base)] rounded-[20px] shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">
                {t("comparison.filterBy")}
              </label>
              <Select
                value={filterBy}
                onChange={(value) => setFilterBy(value)}
                options={[
                  {
                    value: "all",
                    label: t("comparison.allQuotations"),
                  },
                  {
                    value: "best-value",
                    label: t("comparison.bestValue"),
                  },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">
                {t("comparison.sortBy")}
              </label>
              <Select
                value={sortBy}
                onChange={(value) => setSortBy(value)}
                options={[
                  {
                    value: "price-asc",
                    label: t("comparison.priceLowHigh"),
                  },
                  {
                    value: "price-desc",
                    label: t("comparison.priceHighLow"),
                  },
                ]}
              />
            </div>
            <div className="flex items-end">
              <p className="text-sm font-medium text-[var(--color-text-secondary)] pb-2">
                {t("comparison.selectedCount", {
                  count: selectedQuotations.size,
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Comparison grid */}
        {sortedQuotations.length === 0 ? (
          <div className="bg-[var(--color-bg-base)] rounded-[20px] shadow-sm p-12 text-center">
            <p className="text-[var(--color-text-secondary)]">
              {t("comparison.noQuotationsSelected")}
            </p>
            <div className="mt-4 flex justify-center">
              <CTAButton
                href={`/${locale}/dashboard/quotations`}
                variant="primary"
              >
                {t("comparison.viewAllQuotations")}
              </CTAButton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedQuotations.map((quotation) => {
              const isBestValue = quotation.id === bestValueId;
              const isExpanded = expandedBreakdowns.has(quotation.id);

              return (
                <div
                  key={quotation.id}
                  className={`bg-[var(--color-bg-base)] rounded-[20px] shadow-sm overflow-hidden border-2 transition-colors ${
                    isBestValue
                      ? "border-[var(--color-success-border)] ring-2 ring-[var(--color-success-bg)]"
                      : "border-[var(--color-border-default)]"
                  }`}
                >
                  {/* Best value banner */}
                  {isBestValue && (
                    <div className="bg-[var(--color-success-bg)] text-[var(--color-success-text)] px-4 py-2 flex items-center justify-center gap-2">
                      <Trophy size={16} />
                      <span className="font-semibold text-sm">
                        {t("comparison.bestValueBadge")}
                      </span>
                    </div>
                  )}

                  {/* Vehicle image */}
                  <div className="relative h-48 bg-[var(--color-bg-surface)]">
                    <Image
                      src={quotation.vehicleImage || "/placeholder-vehicle.jpg"}
                      alt={quotation.vehicleName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <button
                      onClick={() => toggleQuotationSelection(quotation.id)}
                      aria-label={
                        selectedQuotations.has(quotation.id)
                          ? t("comparison.removeFromComparison")
                          : t("comparison.addToComparison")
                      }
                      className="absolute top-2 right-2 bg-[var(--color-bg-base)] rounded-full p-2 shadow-md hover:bg-[var(--color-bg-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2"
                    >
                      {selectedQuotations.has(quotation.id) ? (
                        <Check
                          size={16}
                          className="text-[var(--color-success-border)]"
                        />
                      ) : (
                        <Plus
                          size={16}
                          className="text-[var(--color-text-secondary)]"
                        />
                      )}
                    </button>
                  </div>

                  {/* Card content */}
                  <div className="p-4 space-y-4">
                    {/* Vehicle name */}
                    <h3 className="font-bold text-lg text-[var(--color-text-primary)]">
                      {quotation.vehicleName}
                    </h3>

                    {/* Owner info */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {quotation.ownerName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {quotation.ownerName}
                        </p>
                        <div className="flex items-center gap-1">
                          <Star
                            size={12}
                            className="text-[var(--color-action-primary)] shrink-0"
                          />
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {t("comparison.ratingUnavailable")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Total price */}
                    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-4">
                      <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                        {t("comparison.totalPrice")}
                      </p>
                      <p className="text-2xl font-bold text-[var(--color-action-primary)]">
                        Rs. {quotation.price.toLocaleString()}
                      </p>
                    </div>

                    {/* Price breakdown */}
                    <div>
                      <button
                        onClick={() => toggleBreakdown(quotation.id)}
                        className="w-full flex items-center justify-between text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-action-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 rounded-lg py-1"
                      >
                        <span>{t("comparison.priceBreakdown")}</span>
                        {isExpanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>

                      {isExpanded && quotation.priceBreakdown && (
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                              {t("comparison.vehicleRental")}
                            </span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              Rs.{" "}
                              {quotation.priceBreakdown.vehicleRentalCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                              {t("comparison.driverCost")}
                            </span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              Rs.{" "}
                              {quotation.priceBreakdown.driverCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                              {t("comparison.fuelCost")}
                            </span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              Rs.{" "}
                              {quotation.priceBreakdown.fuelCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                              {t("comparison.tollCharges")}
                            </span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              Rs.{" "}
                              {quotation.priceBreakdown.tollCharges.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                              {t("comparison.permitFees")}
                            </span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              Rs.{" "}
                              {quotation.priceBreakdown.permitFees.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                              {t("comparison.otherCharges")}
                            </span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              Rs.{" "}
                              {quotation.priceBreakdown.otherCharges.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-[var(--color-border-default)]">
                            <span className="text-[var(--color-text-secondary)]">
                              {t("comparison.tax")}
                            </span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              Rs.{" "}
                              {quotation.priceBreakdown.tax.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vehicle specifications */}
                    {quotation.vehicleSpecifications && (
                      <div className="p-3 bg-[var(--color-bg-surface)] rounded-xl">
                        <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          {t("comparison.specifications")}
                        </p>
                        <div className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                          <p>
                            {quotation.vehicleSpecifications.brand}{" "}
                            {quotation.vehicleSpecifications.model}{" "}
                            {quotation.vehicleSpecifications.year > 0 &&
                              `(${quotation.vehicleSpecifications.year})`}
                          </p>
                          {quotation.vehicleSpecifications.seats > 0 && (
                            <p>
                              {t("comparison.seats", {
                                count:
                                  quotation.vehicleSpecifications.seats,
                              })}
                            </p>
                          )}
                          {quotation.vehicleSpecifications.fuelType && (
                            <p>{quotation.vehicleSpecifications.fuelType}</p>
                          )}
                          {quotation.vehicleSpecifications.transmission && (
                            <p>
                              {quotation.vehicleSpecifications.transmission}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Amenities */}
                    {quotation.amenities && quotation.amenities.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                          {t("comparison.amenities")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {quotation.amenities.map((amenity, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-xs rounded-lg"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Validity */}
                    {quotation.validUntil && (
                      <div className="text-sm">
                        <span className="text-[var(--color-text-secondary)]">
                          {t("comparison.validUntil")}{" "}
                        </span>
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {quotation.validUntil}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <CTAButton
                        variant="primary"
                        fullWidth
                        onClick={() => handleAcceptQuotation(quotation.id)}
                        leftIcon={<Check size={16} />}
                      >
                        {t("comparison.acceptAndBook")}
                      </CTAButton>
                      <Button
                        onClick={() => handleRejectQuotation(quotation.id)}
                        variant="outline"
                        className="w-full border-[var(--color-error-border)] text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)] flex items-center justify-center gap-2 rounded-xl focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 min-h-[44px]"
                      >
                        <X size={16} />
                        {t("comparison.reject")}
                      </Button>
                      {quotation.contactPhone && (
                        <a
                          href={`tel:${quotation.contactPhone}`}
                          aria-label={`${t("comparison.contactOwner")}: ${quotation.contactPhone}`}
                          className="w-full min-h-[44px] border border-[var(--color-action-primary)] text-[var(--color-action-primary)] hover:bg-[var(--color-bg-surface)] flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2"
                        >
                          <Phone size={16} />
                          {t("comparison.contactOwner")}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add more quotations panel */}
        {quotations.filter((q) => !selectedQuotations.has(q.id)).length > 0 &&
          selectedQuotations.size < 4 && (
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                {t("comparison.addMore")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {quotations
                  .filter((q) => !selectedQuotations.has(q.id))
                  .map((quotation) => (
                    <button
                      key={quotation.id}
                      onClick={() => toggleQuotationSelection(quotation.id)}
                      className="bg-[var(--color-bg-base)] rounded-[20px] shadow-sm p-4 border border-[var(--color-border-default)] hover:border-[var(--color-action-primary)] transition-colors text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 min-h-[44px]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--color-bg-surface)] shrink-0">
                          <Image
                            src={
                              quotation.vehicleImage ||
                              "/placeholder-vehicle.jpg"
                            }
                            alt={quotation.vehicleName}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--color-text-primary)] truncate text-sm">
                            {quotation.vehicleName}
                          </p>
                          <p className="text-sm text-[var(--color-action-primary)] font-semibold">
                            Rs. {quotation.price.toLocaleString()}
                          </p>
                        </div>
                        <Plus
                          size={16}
                          className="text-[var(--color-text-tertiary)] shrink-0"
                        />
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
