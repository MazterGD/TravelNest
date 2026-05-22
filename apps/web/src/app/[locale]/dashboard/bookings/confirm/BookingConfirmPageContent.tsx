"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, Badge, Button, Card } from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import { quotationService, bookingService } from "@/lib/api/services";
import { ArrowLeft, Calendar, MapPin, Users, Clock, Phone, Mail, Bus, Snowflake, CheckCircle, Banknote } from 'lucide-react';

interface BookingConfirmPageContentProps {
  locale: string;
}

interface QuotationDetails {
  id: string;
  quotationId: string;
  vehicleId: string;
  vehicleType: string;
  customerId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  pickupLocation: string;
  dropoffLocation: string;
  passengerCount: number;
  estimatedDistance: string;
  estimatedDuration: string;
  specialRequests?: string;
  status: string;
  vehicleRentalCost: number;
  driverCost: number;
  fuelCost: number;
  tollCharges: number;
  permitFees: number;
  subtotal: number;
  tax: number;
  totalAmount: number;
  additionalNotes?: string;
  validUntil: string;
  createdAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  vehicle: {
    id: string;
    licensePlate: string;
    year: number;
    pricePerDay: number;
    ownerId: string;
    owner: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
  };
}

export default function BookingConfirmPageContent({
  locale,
}: BookingConfirmPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: guardLoading } = useProtectedRoute();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [quotation, setQuotation] = useState<QuotationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quotationId = searchParams.get("quotationId");

  useEffect(() => {
    if (!guardLoading && quotationId) {
      fetchQuotationDetails();
    }
  }, [guardLoading, quotationId]);

  const fetchQuotationDetails = async () => {
    if (!quotationId) {
      setError("No quotation ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await quotationService.getById(quotationId);
      const data = response as any;
      const quotationData = data.data?.quotation || data.quotation || data;
      console.log("Fetched quotation:", quotationData);
      setQuotation(quotationData);
    } catch (err: any) {
      console.error("Error fetching quotation:", err);
      setError(err.message || "Failed to load quotation details");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!quotationId) return;

    try {
      setCreating(true);
      setError(null);

      const response = await bookingService.createFromQuotation(quotationId);
      const data = response as any;
      const bookingId = data.booking?.id || data.id;

      // Redirect to booking details page
      router.push(`/${locale}/dashboard/bookings/${bookingId}`);
    } catch (err: any) {
      console.error("Error creating booking:", err);
      setError(err.message || "Failed to create booking");
      setCreating(false);
    }
  };

  if (guardLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <p className="text-red-600 mb-4">{error || "Quotation not found"}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </Card>
      </div>
    );
  }

  const calculateDays = () => {
    if (!quotation?.startDate || !quotation?.endDate) return 1;
    const start = new Date(quotation.startDate);
    const end = new Date(quotation.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const days = calculateDays();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mb-4"
        >
          <ArrowLeft className="mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Confirm Booking</h1>
        <p className="text-gray-600 mt-2">
          Review your booking details before confirming
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Vehicle Details
            </h2>
            <div className="flex gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {quotation.vehicleType.replace(/_/g, " ")} Bus
                </h3>
                <p className="text-sm text-gray-600">
                  License Plate: {quotation.vehicle.licensePlate}
                </p>
                <p className="text-sm text-gray-600">
                  Year: {quotation.vehicle.year}
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="mr-1.5" />
                    {quotation.passengerCount} Passengers
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Snowflake className="mr-1.5" />
                    {quotation.vehicleType.replace(/_/g, " ")}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Trip Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Trip Details
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="text-[#20B0E9] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Pickup Location</p>
                  <p className="font-medium text-gray-900">
                    {quotation.pickupLocation}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="text-[#20B0E9] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Dropoff Location</p>
                  <p className="font-medium text-gray-900">
                    {quotation.dropoffLocation}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="text-[#20B0E9] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-medium text-gray-900">
                    {new Date(quotation.startDate).toLocaleDateString()}
                    {" - "}
                    {new Date(quotation.endDate).toLocaleDateString()}
                    <span className="text-sm text-gray-600 ml-2">
                      ({days} {days === 1 ? "day" : "days"})
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Start time: {quotation.startTime}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="text-[#20B0E9] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-medium text-gray-900">
                    {new Date(quotation.startDate).toLocaleDateString()} -{" "}
                    {new Date(quotation.endDate).toLocaleDateString()}
                    <span className="text-sm text-gray-600 ml-2">
                      ({days} {days === 1 ? "day" : "days"})
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Start time: {quotation.startTime}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="text-[#20B0E9] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Passengers</p>
                  <p className="font-medium text-gray-900">
                    {quotation.passengerCount} passengers
                  </p>
                </div>
              </div>
              {quotation.specialRequests && (
                <div className="flex items-start gap-3">
                  <Clock className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">
                      Special Requirements
                    </p>
                    <p className="font-medium text-gray-900">
                      {quotation.specialRequests}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Owner Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Vehicle Owner
            </h2>
            <div className="space-y-3">
              <p className="font-medium text-gray-900">
                {quotation.vehicle.owner.firstName}{" "}
                {quotation.vehicle.owner.lastName}
              </p>
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="text-[#20B0E9]" />
                <span className="text-sm">{quotation.vehicle.owner.email}</span>
              </div>
              {quotation.vehicle.owner.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="text-[#20B0E9]" />
                  <span className="text-sm">
                    {quotation.vehicle.owner.phone}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Notes */}
          {quotation.additionalNotes && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Additional Notes
              </h2>
              <p className="text-gray-700">{quotation.additionalNotes}</p>
            </Card>
          )}
        </div>

        {/* Sidebar - Price Summary */}
        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-24">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Price Summary
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Vehicle Rental</span>
                <span className="font-medium">
                  Rs. {quotation.vehicleRentalCost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Driver Cost</span>
                <span className="font-medium">
                  Rs. {quotation.driverCost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Fuel Cost</span>
                <span className="font-medium">
                  Rs. {quotation.fuelCost.toLocaleString()}
                </span>
              </div>
              {quotation.tollCharges > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Toll Charges</span>
                  <span className="font-medium">
                    Rs. {quotation.tollCharges.toLocaleString()}
                  </span>
                </div>
              )}
              {quotation.permitFees > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Permit Fees</span>
                  <span className="font-medium">
                    Rs. {quotation.permitFees.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">
                  Rs. {quotation.tax.toLocaleString()}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">
                    Total Amount
                  </span>
                  <span className="font-bold text-[#20B0E9] text-xl">
                    Rs. {quotation.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                onClick={handleConfirmBooking}
                disabled={creating}
                className="w-full bg-[#20B0E9] hover:bg-[#1a9ad1] text-white"
              >
                {creating ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    Creating Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2" />
                    Confirm Booking
                  </>
                )}
              </Button>
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="w-full"
                disabled={creating}
              >
                Cancel
              </Button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Banknote className="text-[#20B0E9] mt-1" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">Payment Note</p>
                  <p>
                    Payment processing will be available soon. For now, the
                    booking will be created and you can coordinate payment
                    directly with the owner.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
