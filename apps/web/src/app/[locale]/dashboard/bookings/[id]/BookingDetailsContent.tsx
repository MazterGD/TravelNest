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

interface Location {
  address: string;
  city: string;
  district: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  isOwner: boolean;
}

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: "completed" | "current" | "upcoming";
}

interface BookingDetails {
  id: string;
  bookingReference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  bookingDate: string;
  vehicleId: string;
  vehicleName: string;
  vehicleImage: string;
  vehicleType: string;
  vehicleCapacity: number;
  vehiclePlate: string;
  vehicleAmenities: string[];
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
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
  paidAmount: number;
  paymentMethod: string;
  transactionId: string;
  gpsTrackingEnabled: boolean;
  messages: Message[];
  timeline: TimelineEvent[];
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

      // HARDCODED DATA FOR TESTING
      const mockBooking: BookingDetails = {
        id: bookingId,
        bookingReference: bookingId,
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        bookingDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        vehicleId: "veh1",
        vehicleName: "Toyota Hiace Super GL",
        vehicleImage:
          "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=500&q=80",
        vehicleType: "Van",
        vehicleCapacity: 14,
        vehiclePlate: "CAA-1234",
        vehicleAmenities: [
          "AC",
          "GPS",
          "Music System",
          "Reclining Seats",
          "USB Charging",
        ],
        ownerName: "Kamal Perera",
        ownerPhone: "+94 77 123 4567",
        ownerEmail: "kamal@example.com",
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
        paidAmount: 45000,
        paymentMethod: "Credit Card",
        transactionId: "TXN-2026-001234",
        gpsTrackingEnabled: true,
        messages: [
          {
            id: "msg1",
            senderId: "owner1",
            senderName: "Kamal Perera",
            message: "Booking confirmed! I'll be in touch closer to the date.",
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            isOwner: true,
          },
        ],
        timeline: [
          {
            id: "t1",
            title: "Booking Created",
            description: "Booking successfully created and payment processed",
            timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
            status: "completed",
          },
          {
            id: "t2",
            title: "Booking Confirmed",
            description: "Owner confirmed the booking",
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            status: "completed",
          },
          {
            id: "t3",
            title: "Trip Start",
            description: "Your journey begins",
            timestamp: new Date(Date.now() + 86400000 * 7).toISOString(),
            status: "upcoming",
          },
          {
            id: "t4",
            title: "Trip End",
            description: "Journey completed",
            timestamp: new Date(Date.now() + 86400000 * 9).toISOString(),
            status: "upcoming",
          },
        ],
      };

      setBooking(mockBooking);
    } catch (error) {
      console.error("Error fetching booking details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case BookingStatus.CONFIRMED:
        return "bg-blue-100 text-blue-800";
      case BookingStatus.IN_PROGRESS:
        return "bg-green-100 text-green-800";
      case BookingStatus.COMPLETED:
        return "bg-gray-100 text-gray-800";
      case BookingStatus.CANCELLED:
        return "bg-red-100 text-red-800";
      case BookingStatus.DISPUTED:
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case PaymentStatus.PARTIAL:
        return "bg-orange-100 text-orange-800";
      case PaymentStatus.PAID:
        return "bg-green-100 text-green-800";
      case PaymentStatus.REFUNDED:
        return "bg-purple-100 text-purple-800";
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

  const canCancel = [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(
    booking.status,
  );
  const canRate =
    booking.status === BookingStatus.COMPLETED &&
    !booking.messages.some((m) => m.message.includes("rated"));
  const canPay = [
    PaymentStatus.PENDING,
    PaymentStatus.PARTIAL,
    PaymentStatus.FAILED,
  ].includes(booking.paymentStatus);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
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
                  Reference: {booking.bookingReference}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(booking.status)}>
                {booking.status}
              </Badge>
              <Badge className={getPaymentStatusColor(booking.paymentStatus)}>
                {booking.paymentStatus}
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
                    <p className="text-sm text-gray-600">Start Date & Time</p>
                    <p className="font-medium">
                      {new Date(booking.startDate).toLocaleDateString()} at{" "}
                      {booking.startTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FaCalendarAlt className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">End Date</p>
                    <p className="font-medium">
                      {new Date(booking.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

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
                      <p className="text-sm text-gray-600">Pickup</p>
                      <p className="font-medium">
                        {booking.pickupLocation.address}
                      </p>
                      <p className="text-sm text-gray-600">
                        {booking.pickupLocation.city},{" "}
                        {booking.pickupLocation.district}
                      </p>
                    </div>
                  </div>

                  {booking.stops.map((stop, index) => (
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

                  <div className="flex items-start gap-3 ml-4 mb-2">
                    <div className="w-0.5 h-6 bg-gray-300 ml-3.5" />
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaMapMarkerAlt className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Drop-off</p>
                      <p className="font-medium">
                        {booking.dropoffLocation.address}
                      </p>
                      <p className="text-sm text-gray-600">
                        {booking.dropoffLocation.city},{" "}
                        {booking.dropoffLocation.district}
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
                    {booking.passengerCount} Passengers
                  </span>
                </div>
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
              </div>

              {booking.specialRequirements && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    Special Requirements
                  </p>
                  <p className="text-sm text-yellow-700">
                    {booking.specialRequirements}
                  </p>
                </div>
              )}
            </div>

            {/* Vehicle Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Vehicle Details
              </h2>
              <div className="flex gap-4 mb-4">
                <img
                  src={booking.vehicleImage}
                  alt={booking.vehicleName}
                  className="w-48 h-32 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">
                    {booking.vehicleName}
                  </h3>
                  <p className="text-gray-600 mb-2">
                    {booking.vehicleType} • {booking.vehicleCapacity} Seats
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Registration: {booking.vehiclePlate}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {booking.vehicleAmenities.map((amenity, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
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
                      {booking.ownerName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-lg text-gray-900">
                      {booking.ownerName}
                    </p>
                    <div className="flex items-center gap-2 mb-1">
                      <FaStar className="text-yellow-400" />
                      <span className="text-sm font-medium">
                        {booking.ownerRating} ({booking.ownerTrips} trips)
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {booking.ownerPhone}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    (window.location.href = `tel:${booking.ownerPhone}`)
                  }
                  className="bg-[#20B0E9] hover:bg-[#0B5F7F] text-white"
                >
                  <FaPhoneAlt className="mr-2" />
                  Contact Owner
                </Button>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FaComments />
                Messages with Owner
              </h2>
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {booking.messages.map((msg) => (
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
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Booking Timeline
              </h2>
              <div className="space-y-6">
                {booking.timeline.map((event, index) => (
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
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Pricing Information */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <h3 className="font-semibold text-gray-900 mb-4">
                Pricing Details
              </h3>
              <div className="space-y-3 mb-4 pb-4 border-b">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Vehicle Rental</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown.vehicleRental.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Driver Cost</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown.driverCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Fuel Cost</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown.fuelCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Toll Charges</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown.tollCharges.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Permit Fees</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown.permitFees.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">
                    Rs. {booking.priceBreakdown.tax.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-gray-900">Total Amount</span>
                <span className="font-bold text-xl text-[#20B0E9]">
                  Rs. {booking.totalAmount.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-green-50 rounded-lg mb-4">
                <p className="text-sm font-medium text-green-800">
                  Amount Paid
                </p>
                <p className="text-lg font-bold text-green-600">
                  Rs. {booking.paidAmount.toLocaleString()}
                </p>
              </div>

              {/* Payment Information */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-medium">{booking.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID</span>
                  <span className="font-medium text-xs">
                    {booking.transactionId}
                  </span>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="space-y-2">
                <Button variant="outline" className="w-full" size="sm">
                  <FaDownload className="mr-2" />
                  Download Invoice
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <FaFileInvoiceDollar className="mr-2" />
                  Download Receipt
                </Button>
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
