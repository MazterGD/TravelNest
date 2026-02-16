"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LoadingSpinner,
  Button,
  Input,
  TextArea,
  Badge,
} from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import { BookingStatus, PaymentStatus } from "@/types";
import {
  FaArrowLeft,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaClock,
  FaUsers,
  FaBus,
  FaStar,
  FaPhoneAlt,
  FaCheckCircle,
  FaCreditCard,
  FaFileInvoiceDollar,
  FaInfoCircle,
} from "react-icons/fa";

interface Location {
  address: string;
  city: string;
  district: string;
}

interface BookingData {
  bookingId: string;
  bookingReference: string;
  quotationId: string;
  vehicleId: string;
  vehicleName: string;
  vehicleImage: string;
  vehicleType: string;
  vehicleCapacity: number;
  vehiclePlate: string;
  ownerName: string;
  ownerPhone: string;
  ownerRating: number;
  ownerTrips: number;
  pickupLocation: Location;
  dropoffLocation: Location;
  stops: Location[];
  startDate: string;
  endDate: string;
  startTime: string;
  passengerCount: number;
  specialRequirements?: string;
  priceBreakdown: {
    vehicleRental: number;
    driverCost: number;
    fuelCost: number;
    tollCharges: number;
    permitFees: number;
    otherCharges: number;
    tax: number;
  };
  totalAmount: number;
}

interface BookingConfirmationContentProps {
  locale: string;
}

export default function BookingConfirmationContent({
  locale,
}: BookingConfirmationContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: guardLoading } = useProtectedRoute();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [paymentOption, setPaymentOption] = useState<"full" | "partial">(
    "full",
  );
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const quotationId = searchParams.get("quotationId");

  useEffect(() => {
    if (!guardLoading) {
      fetchBookingData();
    }
  }, [guardLoading]);

  const fetchBookingData = async () => {
    try {
      setLoading(true);

      // HARDCODED DATA FOR TESTING
      const mockBooking: BookingData = {
        bookingId: "BK-2026-001",
        bookingReference: "BK-2026-001",
        quotationId: quotationId || "quo1",
        vehicleId: "veh1",
        vehicleName: "Toyota Hiace Super GL",
        vehicleImage:
          "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=500&q=80",
        vehicleType: "Van",
        vehicleCapacity: 14,
        vehiclePlate: "CAA-1234",
        ownerName: "Kamal Perera",
        ownerPhone: "+94 77 123 4567",
        ownerRating: 4.8,
        ownerTrips: 156,
        pickupLocation: {
          address: "Bandaranaike International Airport",
          city: "Katunayake",
          district: "Gampaha",
        },
        dropoffLocation: {
          address: "Grand Hotel, Nuwara Eliya",
          city: "Nuwara Eliya",
          district: "Nuwara Eliya",
        },
        stops: [
          {
            address: "Pinnawala Elephant Orphanage",
            city: "Pinnawala",
            district: "Kegalle",
          },
        ],
        startDate: new Date(Date.now() + 86400000 * 7)
          .toISOString()
          .split("T")[0],
        endDate: new Date(Date.now() + 86400000 * 9)
          .toISOString()
          .split("T")[0],
        startTime: "08:00",
        passengerCount: 6,
        specialRequirements: "Need 2 child seats",
        priceBreakdown: {
          vehicleRental: 20000,
          driverCost: 12000,
          fuelCost: 8000,
          tollCharges: 2500,
          permitFees: 1000,
          otherCharges: 500,
          tax: 1000,
        },
        totalAmount: 45000,
      };

      setBookingData(mockBooking);
      setPartialAmount(mockBooking.totalAmount * 0.3); // 30% as partial payment
    } catch (error) {
      console.error("Error fetching booking data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!termsAccepted) {
      alert("Please accept the terms and conditions");
      return;
    }

    if (!bookingData) {
      alert("Booking data is missing");
      return;
    }

    try {
      setSubmitting(true);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect to payment page
      router.push(
        `/${locale}/dashboard/bookings/${bookingData.bookingId}/payment`,
      );
    } catch (error) {
      console.error("Error proceeding to payment:", error);
      alert("Failed to proceed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (guardLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!bookingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Booking data not found</p>
          <Button onClick={() => router.push(`/${locale}/dashboard/bookings`)}>
            Go to Bookings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/dashboard/quotations`}
              className="text-gray-600 hover:text-[#20B0E9] transition-colors"
            >
              <FaArrowLeft className="text-xl" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Confirm Your Booking
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Review details and proceed to payment
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Booking Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Booking Summary
                </h2>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Booking Reference</p>
                  <p className="font-bold text-[#20B0E9]">
                    {bookingData.bookingReference}
                  </p>
                </div>
              </div>

              {/* Vehicle Info */}
              <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <img
                  src={bookingData.vehicleImage}
                  alt={bookingData.vehicleName}
                  className="w-32 h-24 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">
                    {bookingData.vehicleName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {bookingData.vehicleType} • {bookingData.vehicleCapacity}{" "}
                    Seats • {bookingData.vehiclePlate}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <FaStar className="text-yellow-400" />
                    <span className="text-sm font-medium">
                      {bookingData.ownerRating}
                    </span>
                    <span className="text-sm text-gray-600">
                      ({bookingData.ownerTrips} trips)
                    </span>
                  </div>
                </div>
              </div>

              {/* Trip Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Trip Details</h3>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <FaCalendarAlt className="text-[#20B0E9] mt-1" />
                    <div>
                      <p className="text-sm text-gray-600">Start Date</p>
                      <p className="font-medium">
                        {new Date(bookingData.startDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaCalendarAlt className="text-[#20B0E9] mt-1" />
                    <div>
                      <p className="text-sm text-gray-600">End Date</p>
                      <p className="font-medium">
                        {new Date(bookingData.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Route */}
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pickup</p>
                      <p className="font-medium">
                        {bookingData.pickupLocation.address}
                      </p>
                      <p className="text-sm text-gray-600">
                        {bookingData.pickupLocation.city},{" "}
                        {bookingData.pickupLocation.district} •{" "}
                        {bookingData.startTime}
                      </p>
                    </div>
                  </div>

                  {bookingData.stops.map((stop, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 mb-3 ml-4"
                    >
                      <div className="w-0.5 h-6 bg-gray-300 ml-3.5" />
                    </div>
                  ))}

                  {bookingData.stops.map((stop, index) => (
                    <div key={index} className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <FaMapMarkerAlt className="text-blue-500 text-sm" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          Stop {index + 1}
                        </p>
                        <p className="font-medium">{stop.address}</p>
                        <p className="text-sm text-gray-600">
                          {stop.city}, {stop.district}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaMapMarkerAlt className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Drop-off</p>
                      <p className="font-medium">
                        {bookingData.dropoffLocation.address}
                      </p>
                      <p className="text-sm text-gray-600">
                        {bookingData.dropoffLocation.city},{" "}
                        {bookingData.dropoffLocation.district}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Passengers */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <FaUsers className="text-[#20B0E9]" />
                  <span className="font-medium">
                    {bookingData.passengerCount} Passengers
                  </span>
                </div>

                {bookingData.specialRequirements && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      Special Requirements
                    </p>
                    <p className="text-sm text-yellow-700">
                      {bookingData.specialRequirements}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Owner Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Owner Details
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-700">
                      {bookingData.ownerName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {bookingData.ownerName}
                    </p>
                    <div className="flex items-center gap-2">
                      <FaStar className="text-yellow-400 text-sm" />
                      <span className="text-sm text-gray-600">
                        {bookingData.ownerRating} ({bookingData.ownerTrips}{" "}
                        trips)
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    (window.location.href = `tel:${bookingData.ownerPhone}`)
                  }
                  variant="outline"
                  className="border-[#20B0E9] text-[#20B0E9] hover:bg-blue-50"
                >
                  <FaPhoneAlt className="mr-2" />
                  Contact
                </Button>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Special Instructions (Optional)
              </h3>
              <TextArea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Any special requests or instructions for the owner..."
                rows={4}
              />
            </div>

            {/* Terms and Conditions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#20B0E9] border-gray-300 rounded focus:ring-[#20B0E9]"
                />
                <label htmlFor="terms" className="text-sm text-gray-700">
                  I accept the{" "}
                  <Link href="#" className="text-[#20B0E9] hover:underline">
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-[#20B0E9] hover:underline">
                    Cancellation Policy
                  </Link>
                  . I understand that cancellation fees may apply.
                </label>
              </div>
            </div>
          </div>

          {/* Right Column - Payment Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">
                Payment Summary
              </h3>

              {/* Price Breakdown */}
              <div className="space-y-3 mb-4 pb-4 border-b">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Vehicle Rental</span>
                  <span className="font-medium">
                    Rs.{" "}
                    {bookingData.priceBreakdown.vehicleRental.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Driver Cost</span>
                  <span className="font-medium">
                    Rs. {bookingData.priceBreakdown.driverCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Fuel Cost</span>
                  <span className="font-medium">
                    Rs. {bookingData.priceBreakdown.fuelCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Toll Charges</span>
                  <span className="font-medium">
                    Rs.{" "}
                    {bookingData.priceBreakdown.tollCharges.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Permit Fees</span>
                  <span className="font-medium">
                    Rs. {bookingData.priceBreakdown.permitFees.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Other Charges</span>
                  <span className="font-medium">
                    Rs.{" "}
                    {bookingData.priceBreakdown.otherCharges.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">
                    Rs. {bookingData.priceBreakdown.tax.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-lg text-gray-900">
                  Total Amount
                </span>
                <span className="font-bold text-2xl text-[#20B0E9]">
                  Rs. {bookingData.totalAmount.toLocaleString()}
                </span>
              </div>

              {/* Payment Options */}
              <div className="space-y-3 mb-6">
                <p className="font-medium text-gray-900">Payment Option</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-[#20B0E9] transition-colors">
                    <input
                      type="radio"
                      name="paymentOption"
                      value="full"
                      checked={paymentOption === "full"}
                      onChange={() => setPaymentOption("full")}
                      className="text-[#20B0E9] focus:ring-[#20B0E9]"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        Pay Full Amount
                      </p>
                      <p className="text-sm text-gray-600">
                        Rs. {bookingData.totalAmount.toLocaleString()}
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-[#20B0E9] transition-colors">
                    <input
                      type="radio"
                      name="paymentOption"
                      value="partial"
                      checked={paymentOption === "partial"}
                      onChange={() => setPaymentOption("partial")}
                      className="text-[#20B0E9] focus:ring-[#20B0E9]"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        Partial Payment (30%)
                      </p>
                      <p className="text-sm text-gray-600">
                        Rs. {partialAmount.toLocaleString()} now, rest later
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-3 bg-blue-50 rounded-lg mb-6">
                <div className="flex gap-2">
                  <FaInfoCircle className="text-[#20B0E9] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700">
                    {paymentOption === "full"
                      ? "Full payment secures your booking immediately."
                      : "Pay 30% now and the remaining 70% before your trip starts."}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleProceedToPayment}
                  disabled={!termsAccepted || submitting}
                  className="w-full bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaCreditCard className="mr-2" />
                      Proceed to Payment
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  className="w-full"
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
