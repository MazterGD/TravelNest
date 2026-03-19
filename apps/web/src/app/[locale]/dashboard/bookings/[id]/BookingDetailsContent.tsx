"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LoadingSpinner,
  Button,
  Badge,
  TextArea,
  Input,
} from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import { bookingService } from "@/lib/api/services";
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
  FaTimesCircle,
  FaDownload,
  FaFileInvoiceDollar,
  FaMapMarkedAlt,
  FaComments,
  FaExclamationTriangle,
  FaEdit,
  FaTrash,
  FaInfoCircle,
} from "react-icons/fa";

interface BookingDetails {
  id: string;
  bookingRef: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
  vehicle: {
    id: string;
    name: string;
    registration: string;
    type: string;
    brand: string;
    model: string;
    capacity: number;
    image: string | null;
  };
  owner: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
  trip: {
    startDate: string;
    endDate: string;
    pickupLocation: string;
    dropoffLocation: string;
    passengers: number;
  };
  payment: {
    id: string | null;
    total: number;
    paid: number;
    status: string;
    method: string;
    receiptUrl: string | null;
    platformCommission: number;
    netAmount: number;
  };
  status: string;
  notes?: string;
  cancelReason?: string;
  hasReview: boolean;
  review?: any;
  createdAt: string;
  updatedAt: string;

  // Fields available in DB but not currently populated via API
  // startTime?: string;
  // stops?: Array<{address: string; city: string; district: string}>;
  // vehicleAmenities?: string[];
  // gpsTrackingEnabled?: boolean;
  // messages?: Array<{id: string; senderId: string; senderName: string; message: string; timestamp: string; isOwner: boolean}>;
  // timeline?: Array<{id: string; title: string; description: string; timestamp: string; status: string}>;
}

interface BookingDetailsContentProps {
  bookingId: string;
  locale: string;
}

export default function BookingDetailsContent({
  bookingId,
  locale,
}: BookingDetailsContentProps) {
  const router = useRouter();
  const { isLoading: guardLoading } = useProtectedRoute();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  useEffect(() => {
    if (!guardLoading) {
      fetchBookingDetails();
    }
  }, [guardLoading, bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch actual booking data from API
      const response = await bookingService.getById(bookingId);
      const bookingData = response as any;

      // The API returns { booking: BookingDetails } or just the booking object
      const data = bookingData.booking || bookingData;
      setBooking(data);
    } catch (err: any) {
      console.error("Error fetching booking details:", err);
      setError(err.message || "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
      case "ongoing":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "disputed":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "partial":
        return "bg-orange-100 text-orange-800";
      case "paid":
      case "completed":
        return "bg-green-100 text-green-800";
      case "refunded":
        return "bg-purple-100 text-purple-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      alert("Please provide a reason for cancellation");
      return;
    }

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("Booking cancelled successfully");
      setShowCancelDialog(false);
      router.push(`/${locale}/dashboard/bookings`);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Failed to cancel booking");
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      // Simulate sending message
      const message: Message = {
        id: `msg${Date.now()}`,
        senderId: "customer1",
        senderName: "You",
        message: newMessage,
        timestamp: new Date().toISOString(),
        isOwner: false,
      };

      setBooking((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, message],
        };
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleSubmitRating = async () => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("Rating submitted successfully!");
      setShowRatingDialog(false);
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Failed to submit rating");
    }
  };

  if (guardLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Booking not found</p>
          <Button onClick={() => router.push(`/${locale}/dashboard/bookings`)}>
            Go to Bookings
          </Button>
        </div>
      </div>
    );
  }

  if (guardLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push(`/${locale}/dashboard/bookings`)}>
            Go to Bookings
          </Button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Booking not found</p>
          <Button onClick={() => router.push(`/${locale}/dashboard/bookings`)}>
            Go to Bookings
          </Button>
        </div>
      </div>
    );
  }

  const canCancel = ["pending", "confirmed"].includes(
    booking.status?.toLowerCase() || "",
  );
  const canRate =
    booking.status?.toLowerCase() === "completed" && !booking.hasReview;
  const canPay = ["pending", "partial", "failed"].includes(
    booking.payment?.status?.toLowerCase() || "",
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/${locale}/dashboard/bookings`}
                className="text-gray-600 hover:text-[#20B0E9] transition-colors"
              >
                <FaArrowLeft className="text-xl" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Booking Details
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Reference: {booking.bookingRef}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(booking.status)}>
                {booking.status}
              </Badge>
              <Badge className={getPaymentStatusColor(booking.payment?.status)}>
                {booking.payment?.status}
              </Badge>
              {canPay && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/${locale}/dashboard/bookings/${booking.id}/payment`,
                    )
                  }
                >
                  Pay Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trip Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Trip Information
              </h2>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-start gap-3">
                  <FaCalendarAlt className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Start Date</p>
                    <p className="font-medium">
                      {new Date(booking.trip.startDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FaCalendarAlt className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">End Date</p>
                    <p className="font-medium">
                      {new Date(booking.trip.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              {/* NOTE: startTime is not stored in the database yet - will be added in future updates */}

              {/* Route with Map placeholder */}
              <div className="mb-6">
                <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center mb-4">
                  <FaMapMarkedAlt className="text-gray-400 text-4xl" />
                </div>

                {/* Route Details */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pickup Location</p>
                      <p className="font-medium">
                        {booking.trip.pickupLocation}
                      </p>
                    </div>
                  </div>

                  {/* NOTE: Stops are not currently stored in the database - they will be added via trip itinerary
                  {booking.stops?.map((stop, index) => (
                    <div key={index}>
                      <div className="flex items-start gap-3 ml-4 mb-2">
                        <div className="w-0.5 h-6 bg-gray-300 ml-3.5" />
                      </div>
                      <div className="flex items-start gap-3">
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
                    </div>
                  ))}
                  */}

                  <div className="flex items-start gap-3 ml-4 mb-2">
                    <div className="w-0.5 h-6 bg-gray-300 ml-3.5" />
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaMapMarkerAlt className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Drop-off Location</p>
                      <p className="font-medium">
                        {booking.trip.dropoffLocation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="flex items-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <FaUsers className="text-[#20B0E9]" />
                  <span className="font-medium">
                    {booking.trip.passengers} Passengers
                  </span>
                </div>
                {/* NOTE: GPS tracking is not stored in the database yet - will be added in future updates
                {booking.gpsTrackingEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#20B0E9] text-[#20B0E9]"
                  >
                    <FaMapMarkedAlt className="mr-2" />
                    Track Live
                  </Button>
                )}
                */}
              </div>

              {/* NOTE: Special requirements/notes are stored in booking.notes
              {booking.notes && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    Special Requirements
                  </p>
                  <p className="text-sm text-yellow-700">
                    {booking.notes}
                  </p>
                </div>
              )}
              */}
            </div>

            {/* Vehicle Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Vehicle Details
              </h2>
              <div className="flex gap-4 mb-4">
                {booking.vehicle.image && (
                  <img
                    src={booking.vehicle.image}
                    alt={booking.vehicle.name}
                    className="w-48 h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">
                    {booking.vehicle.name}
                  </h3>
                  <p className="text-gray-600 mb-2">
                    {booking.vehicle.type} • {booking.vehicle.capacity} Seats
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Registration: {booking.vehicle.registration}
                  </p>
                  {/* NOTE: Vehicle amenities are not stored in the API response yet - they will be added in future updates
                  <div className="flex flex-wrap gap-2">
                    {booking.vehicleAmenities?.map((amenity, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                  */}
                  <p className="text-xs text-gray-500 mt-2">
                    {booking.vehicle.brand} {booking.vehicle.model}
                  </p>
                </div>
              </div>
            </div>

            {/* Owner Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Owner Details
              </h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-700">
                      {booking.owner.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-lg text-gray-900">
                      {booking.owner.name}
                    </p>
                    {/* NOTE: Owner rating and trips count are not stored in the database yet
                    <div className="flex items-center gap-2 mb-1">
                      <FaStar className="text-yellow-400" />
                      <span className="text-sm font-medium">
                        {booking.ownerRating} ({booking.ownerTrips} trips)
                      </span>
                    </div>
                    */}
                    <p className="text-sm text-gray-600">
                      {booking.owner.phone}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    (window.location.href = `tel:${booking.owner.phone}`)
                  }
                  className="bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
                >
                  <FaPhoneAlt className="mr-2" />
                  Contact Owner
                </Button>
              </div>
            </div>

            {/* NOTE: Messages feature is not integrated yet - will be added in future updates
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FaComments />
                Messages with Owner
              </h2>
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {booking.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isOwner ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.isOwner
                          ? "bg-gray-100 text-gray-900"
                          : "bg-[#20B0E9] text-white"
                      }`}
                    >
                      <p className="text-sm font-medium mb-1">
                        {msg.senderName}
                      </p>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-[#20B0E9] hover:bg-[#0B5F7F]"
                >
                  Send
                </Button>
              </div>
            </div>

            {/* Booking Timeline */}
            {/* NOTE: Timeline data is not currently stored in the database - will be added in future updates
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Booking Timeline
              </h2>
              <div className="space-y-6">
                {booking.timeline?.map((event, index) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          event.status === "completed"
                            ? "bg-green-100 text-green-600"
                            : event.status === "current"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {event.status === "completed" && <FaCheckCircle />}
                        {event.status === "current" && <FaClock />}
                        {event.status === "upcoming" && <FaClock />}
                      </div>
                      {index < booking.timeline.length - 1 && (
                        <div
                          className={`w-0.5 h-12 ${
                            event.status === "completed"
                              ? "bg-green-300"
                              : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <p className="font-semibold text-gray-900">
                        {event.title}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        {event.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            */}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Pricing Information */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <h3 className="font-semibold text-gray-900 mb-4">
                Pricing Details
              </h3>
              {/* NOTE: Detailed price breakdown is not stored in the database yet - will be added in future updates
              <div className="space-y-3 mb-4 pb-4 border-b">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Vehicle Rental</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown?.vehicleRental?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Driver Cost</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown?.driverCost?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Fuel Cost</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown?.fuelCost?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Toll Charges</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown?.tollCharges?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Permit Fees</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown?.permitFees?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown?.tax?.toLocaleString()}
                  </span>
                </div>
              </div>
              */}

              <div className="space-y-3 mb-4 pb-4 border-b">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-medium">
                    Rs. {booking.payment.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Platform Commission</span>
                  <span className="font-medium">
                    Rs. {booking.payment.platformCommission.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Net Amount (Owner)</span>
                  <span className="font-medium">
                    Rs. {booking.payment.netAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-gray-900">Total Payable</span>
                <span className="font-bold text-xl text-[#20B0E9]">
                  Rs. {booking.payment.total.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-green-50 rounded-lg mb-4">
                <p className="text-sm font-medium text-green-800">
                  Amount Paid
                </p>
                <p className="text-lg font-bold text-green-600">
                  Rs. {booking.payment.paid.toLocaleString()}
                </p>
              </div>

              {/* Payment Information */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Status</span>
                  <span className="font-medium capitalize">
                    {booking.payment.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-medium">
                    {booking.payment.method || "N/A"}
                  </span>
                </div>
                {booking.payment.receiptUrl && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Receipt</span>
                    <a
                      href={booking.payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#20B0E9] font-medium"
                    >
                      View
                    </a>
                  </div>
                )}
              </div>

              {/* Download Buttons */}
              <div className="space-y-2">
                <Button variant="outline" className="w-full" size="sm">
                  <FaDownload className="mr-2" />
                  Download Invoice
                </Button>
                {booking.payment.receiptUrl && (
                  <Button variant="outline" className="w-full" size="sm">
                    <FaFileInvoiceDollar className="mr-2" />
                    Download Receipt
                  </Button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                {canCancel && (
                  <Button
                    onClick={() => setShowCancelDialog(true)}
                    variant="outline"
                    className="w-full border-red-500 text-red-500 hover:bg-red-50"
                  >
                    <FaTimesCircle className="mr-2" />
                    Cancel Booking
                  </Button>
                )}
                {canRate && (
                  <Button
                    onClick={() => setShowRatingDialog(true)}
                    className="w-full bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
                  >
                    <FaStar className="mr-2" />
                    Rate Service
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full border-orange-500 text-orange-500 hover:bg-orange-50"
                >
                  <FaExclamationTriangle className="mr-2" />
                  Raise Dispute
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Cancel Booking
            </h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for cancellation. Cancellation fees may
              apply.
            </p>
            <TextArea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              rows={4}
              className="mb-4"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleCancelBooking}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                Confirm Cancellation
              </Button>
              <Button
                onClick={() => setShowCancelDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Keep Booking
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Dialog */}
      {showRatingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Rate Your Experience
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Rating</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="text-3xl transition-colors"
                  >
                    <FaStar
                      className={
                        star <= rating ? "text-yellow-400" : "text-gray-300"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <TextArea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              className="mb-4"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleSubmitRating}
                className="flex-1 bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
              >
                Submit Rating
              </Button>
              <Button
                onClick={() => setShowRatingDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
