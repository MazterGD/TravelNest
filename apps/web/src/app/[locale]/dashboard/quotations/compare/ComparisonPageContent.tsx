"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner, Button, Select } from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import {
  useQuotationStore,
  type ReceivedQuotation,
  type QuotationRequest,
} from "@/store";
import { quotationService } from "@/lib/api/services";
import { ArrowLeft, Check, X, Phone, Star, MapPin, Calendar, Users, ChevronDown, ChevronUp, Plus, Trophy, Download } from 'lucide-react';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: guardLoading } = useProtectedRoute();

  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState<ExtendedQuotation[]>([]);
  const [requestDetails, setRequestDetails] = useState<QuotationRequest | null>(
    null,
  );
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(
    new Set(),
  );
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(
    new Set(),
  );
  const [sortBy, setSortBy] = useState<string>("price-asc");
  const [filterBy, setFilterBy] = useState<string>("all");

  // Get quotation IDs from URL params
  const quotationIds = searchParams.get("ids")?.split(",") || [];
  const requestId = searchParams.get("requestId");

  useEffect(() => {
    if (!guardLoading) {
      fetchData();
    }
  }, [guardLoading, requestId, quotationIds.join(",")]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (requestId) {
        // Fetch the specific quotation that was clicked
        const requestResponse = await quotationService.getById(requestId);
        const requestData = requestResponse as any;
        const baseQuotation =
          requestData.data?.quotation || requestData.quotation;

        // Fetch all quotations for the customer
        const response = await quotationService.getMyRequests();
        const data = response as any;
        const allQuotations = data.data?.quotations || data.quotations || [];

        // Set request details from the base quotation
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

        // Filter quotations that match the same trip details
        // Compare dates as strings (YYYY-MM-DD)
        const baseStartDate = baseQuotation.startDate?.split("T")[0];
        const comparableQuotations = allQuotations.filter((q: any) => {
          const qStartDate = q.startDate?.split("T")[0];
          const matchesLocation =
            q.pickupLocation === baseQuotation.pickupLocation &&
            q.dropoffLocation === baseQuotation.dropoffLocation;
          const matchesDate = qStartDate === baseStartDate;
          // Only include quotations that have been sent by owners (with pricing)
          const isComparable =
            ["sent", "viewed", "accepted"].includes(q.status?.toLowerCase()) &&
            q.totalAmount != null;

          return matchesLocation && matchesDate && isComparable;
        });

        request.quotationsCount = comparableQuotations.length;
        setRequestDetails(request);

        // Transform to ExtendedQuotation format
        const transformedQuotations: ExtendedQuotation[] =
          comparableQuotations.map((q: any) => ({
            id: q.id,
            requestId: requestId,
            ownerId: q.vehicle?.owner?.id || q.ownerId || "",
            ownerName: q.vehicle?.owner
              ? `${q.vehicle.owner.firstName} ${q.vehicle.owner.lastName}`
              : "Unknown Owner",
            vehicleId: q.vehicleId || "",
            vehicleName: q.vehicle?.name || "Vehicle",
            vehicleImage: q.vehicle?.images?.[0] || "/placeholder-vehicle.jpg",
            status: q.status?.toLowerCase() || "pending",
            totalAmount: q.totalAmount || 0,
            price: q.totalAmount || 0,
            expiryDate: q.expiryDate || q.validUntil,
            validUntil: q.validUntil
              ? new Date(q.validUntil).toLocaleDateString()
              : "",
            notes: q.additionalNotes || q.notes || "",
            message: q.additionalNotes || q.notes || "",
            sentAt: q.sentAt,
            createdAt: q.createdAt,
            rating: 4.5, // Default rating, should be fetched from owner reviews
            totalTrips: 0, // Default, should be fetched from owner stats
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

        // Auto-select all quotations for comparison
        setSelectedQuotations(new Set(transformedQuotations.map((q) => q.id)));
      } else if (quotationIds.length > 0) {
        // Legacy: fetch by quotation IDs
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
                  : "Owner"),
              vehicleName: q.vehicleName || q.vehicle?.name || "Vehicle",
              vehicleImage:
                q.vehicleImage ||
                q.vehicle?.images?.[0] ||
                "/placeholder-vehicle.jpg",
              rating: q.rating || q.owner?.rating || 4.5,
              totalTrips: q.totalTrips || q.owner?.totalTrips || 0,
              price: q.totalAmount,
              message: q.additionalNotes || q.message || "",
              validUntil:
                q.validUntil ||
                (q.expiryDate
                  ? new Date(q.expiryDate).toLocaleDateString()
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
      console.error("Error fetching data:", error);
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

    // Apply filter
    if (filterBy !== "all") {
      sorted = sorted.filter((q) => {
        if (filterBy === "best-value") {
          return q.price === Math.min(...quotations.map((q) => q.price));
        }
        if (filterBy === "top-rated") {
          return q.rating >= 4.5;
        }
        return true;
      });
    }

    // Apply sort
    switch (sortBy) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "rating-desc":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "rating-asc":
        sorted.sort((a, b) => a.rating - b.rating);
        break;
    }

    return sorted.filter((q) => selectedQuotations.has(q.id));
  };

  const getBestValueId = () => {
    if (quotations.length === 0) return null;
    const minPrice = Math.min(...quotations.map((q) => q.price));
    return quotations.find((q) => q.price === minPrice)?.id;
  };

  const handleAcceptQuotation = async (quotationId: string) => {
    // Redirect to booking confirmation page
    router.push(
      `/${locale}/dashboard/bookings/confirm?quotationId=${quotationId}`,
    );
  };

  const handleRejectQuotation = async (quotationId: string) => {
    try {
      await quotationService.respondToQuotation(quotationId, {
        status: "REJECTED",
        rejectionReason: "Selected another quotation",
      });
      // Remove from selected
      const newSelected = new Set(selectedQuotations);
      newSelected.delete(quotationId);
      setSelectedQuotations(newSelected);
    } catch (error) {
      console.error("Error rejecting quotation:", error);
    }
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    alert("PDF download functionality will be implemented");
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
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/${locale}/dashboard/quotations`}
                className="text-gray-600 hover:text-[#20B0E9] transition-colors"
              >
                <ArrowLeft className="text-xl" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Compare Quotations
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Compare up to 4 quotations side-by-side
                </p>
              </div>
            </div>
            <Button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
            >
              <Download />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Request Details Summary */}
        {requestDetails && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Trip Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="text-[#20B0E9] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Route</p>
                  <p className="font-medium text-gray-900">
                    {requestDetails.pickupLocation.city} →{" "}
                    {requestDetails.dropoffLocation.city}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="text-[#20B0E9] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Dates</p>
                  <p className="font-medium text-gray-900">
                    {new Date(requestDetails.pickupDate).toLocaleDateString()}{" "}
                    at {requestDetails.pickupTime}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="text-[#20B0E9] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Passengers</p>
                  <p className="font-medium text-gray-900">
                    {requestDetails.passengerCount} passengers
                  </p>
                </div>
              </div>
            </div>
            {requestDetails.specialRequests && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Special Requirements</p>
                <p className="text-gray-900 mt-1">
                  {requestDetails.specialRequests}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filter and Sort Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Filter By
              </label>
              <Select
                value={filterBy}
                onChange={(value) => setFilterBy(value)}
                options={[
                  { value: "all", label: "All Quotations" },
                  { value: "best-value", label: "Best Value" },
                  { value: "top-rated", label: "Top Rated (4.5+)" },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Sort By
              </label>
              <Select
                value={sortBy}
                onChange={(value) => setSortBy(value)}
                options={[
                  { value: "price-asc", label: "Price: Low to High" },
                  { value: "price-desc", label: "Price: High to Low" },
                  { value: "rating-desc", label: "Rating: High to Low" },
                  { value: "rating-asc", label: "Rating: Low to High" },
                ]}
              />
            </div>
            <div className="flex items-end gap-2">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Selected: {selectedQuotations.size}/4
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Grid */}
        {sortedQuotations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600">
              No quotations selected for comparison
            </p>
            <Button
              onClick={() => router.push(`/${locale}/dashboard/quotations`)}
              className="mt-4 bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
            >
              View All Quotations
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedQuotations.map((quotation) => {
              const isBestValue = quotation.id === bestValueId;
              const isExpanded = expandedBreakdowns.has(quotation.id);

              return (
                <div
                  key={quotation.id}
                  className={`bg-white rounded-lg shadow-sm overflow-hidden border-2 transition-all ${
                    isBestValue
                      ? "border-green-500 ring-2 ring-green-200"
                      : "border-gray-200"
                  }`}
                >
                  {/* Best Value Badge */}
                  {isBestValue && (
                    <div className="bg-green-500 text-white px-4 py-2 flex items-center justify-center gap-2">
                      <Trophy />
                      <span className="font-semibold">Best Value</span>
                    </div>
                  )}

                  {/* Vehicle Image */}
                  <div className="relative h-48 bg-gray-200">
                    <img
                      src={quotation.vehicleImage || "/placeholder-vehicle.jpg"}
                      alt={quotation.vehicleName}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => toggleQuotationSelection(quotation.id)}
                      className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-md hover:bg-gray-100"
                    >
                      {selectedQuotations.has(quotation.id) ? (
                        <Check className="text-green-500" />
                      ) : (
                        <Plus className="text-gray-600" />
                      )}
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    {/* Vehicle Name */}
                    <h3 className="font-bold text-lg text-gray-900 mb-2">
                      {quotation.vehicleName}
                    </h3>

                    {/* Owner Info */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-gray-700">
                          {quotation.ownerName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {quotation.ownerName}
                        </p>
                        <div className="flex items-center gap-1">
                          <Star className="text-yellow-400 text-xs" />
                          <span className="text-xs text-gray-600">
                            {quotation.rating} ({quotation.totalTrips} trips)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Total Price */}
                    <div className="bg-[#20B0E9] bg-opacity-10 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-600 mb-1">Total Price</p>
                      <p className="text-2xl font-bold text-[#20B0E9]">
                        Rs. {quotation.price.toLocaleString()}
                      </p>
                    </div>

                    {/* Price Breakdown */}
                    <div className="mb-4">
                      <button
                        onClick={() => toggleBreakdown(quotation.id)}
                        className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-[#20B0E9] transition-colors"
                      >
                        <span>Price Breakdown</span>
                        {isExpanded ? <ChevronUp /> : <ChevronDown />}
                      </button>

                      {isExpanded && quotation.priceBreakdown && (
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Vehicle Rental
                            </span>
                            <span className="font-medium">
                              Rs.{" "}
                              {quotation.priceBreakdown.vehicleRentalCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Driver Cost</span>
                            <span className="font-medium">
                              Rs.{" "}
                              {quotation.priceBreakdown.driverCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fuel Cost</span>
                            <span className="font-medium">
                              Rs.{" "}
                              {quotation.priceBreakdown.fuelCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Toll Charges</span>
                            <span className="font-medium">
                              Rs.{" "}
                              {quotation.priceBreakdown.tollCharges.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Permit Fees</span>
                            <span className="font-medium">
                              Rs.{" "}
                              {quotation.priceBreakdown.permitFees.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Other Charges</span>
                            <span className="font-medium">
                              Rs.{" "}
                              {quotation.priceBreakdown.otherCharges.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-gray-200">
                            <span className="text-gray-600">Tax</span>
                            <span className="font-medium">
                              Rs.{" "}
                              {quotation.priceBreakdown.tax.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vehicle Specifications */}
                    {quotation.vehicleSpecifications && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Specifications
                        </p>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p>
                            {quotation.vehicleSpecifications.brand}{" "}
                            {quotation.vehicleSpecifications.model} (
                            {quotation.vehicleSpecifications.year})
                          </p>
                          <p>{quotation.vehicleSpecifications.seats} Seats</p>
                          <p>{quotation.vehicleSpecifications.fuelType}</p>
                          <p>{quotation.vehicleSpecifications.transmission}</p>
                        </div>
                      </div>
                    )}

                    {/* Amenities */}
                    {quotation.amenities && quotation.amenities.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Amenities
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {quotation.amenities.map((amenity, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Validity */}
                    <div className="mb-4 text-sm">
                      <span className="text-gray-600">Valid until: </span>
                      <span className="font-medium text-gray-900">
                        {quotation.validUntil}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleAcceptQuotation(quotation.id)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
                      >
                        <Check />
                        Accept & Book
                      </Button>
                      <Button
                        onClick={() =>
                          router.push(
                            `/${locale}/dashboard/bookings/confirm?quotationId=${quotation.id}`,
                          )
                        }
                        className="w-full bg-[#20B0E9] hover:bg-[#1a9ad1] text-white flex items-center justify-center gap-2"
                      >
                        <Check />
                        Select Quotation
                      </Button>
                      <Button
                        onClick={() => handleRejectQuotation(quotation.id)}
                        variant="outline"
                        className="w-full border-red-500 text-red-500 hover:bg-red-50 flex items-center justify-center gap-2"
                      >
                        <X />
                        Reject
                      </Button>
                      <Button
                        onClick={() =>
                          (window.location.href = `tel:${quotation.contactPhone}`)
                        }
                        variant="outline"
                        className="w-full border-[#20B0E9] text-[#20B0E9] hover:bg-blue-50 flex items-center justify-center gap-2"
                      >
                        <Phone />
                        Contact Owner
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Available Quotations (Not in comparison) */}
        {quotations.filter((q) => !selectedQuotations.has(q.id)).length > 0 &&
          selectedQuotations.size < 4 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Add More Quotations (up to 4)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {quotations
                  .filter((q) => !selectedQuotations.has(q.id))
                  .map((quotation) => (
                    <div
                      key={quotation.id}
                      className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-[#20B0E9] transition-all cursor-pointer"
                      onClick={() => toggleQuotationSelection(quotation.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            quotation.vehicleImage || "/placeholder-vehicle.jpg"
                          }
                          alt={quotation.vehicleName}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {quotation.vehicleName}
                          </p>
                          <p className="text-sm text-[#20B0E9] font-semibold">
                            Rs. {quotation.price.toLocaleString()}
                          </p>
                        </div>
                        <Plus className="text-gray-400" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
