"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, Badge, Button, Card } from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import { bookingService } from "@/lib/api/services";
import { ArrowLeft, Calendar, MapPin, Users, Clock, Phone, Mail, Bus, Snowflake, CheckCircle, Download, Printer, AlertCircle, XCircle, Hourglass } from 'lucide-react';

interface BookingDetailsPageContentProps {
  locale: string;
  bookingId: string;
}

interface BookingDetails {
  id: string;
  bookingNumber: string;
  status: string;
  totalPrice: number;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  passengers: number;
  specialRequirements?: string;
  createdAt: string;
  updatedAt: string;
  vehicle: {
    id: string;
    name: string;
    brand: string;
    model: string;
    seats: number;
    acType: string;
    type: string;
    licensePlate: string;
    images: string[];
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    businessProfile?: {
      businessName: string;
      businessPhone?: string;
    };
  };
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  quotation?: {
    id: string;
    price: number;
    notes?: string;
  };
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending Confirmation",
    color: "bg-yellow-100 text-yellow-800",
    icon: Hourglass,
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-800",
    icon: Clock,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-gray-100 text-gray-800",
    icon: CheckCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
};

export default function BookingDetailsPageContent({
  locale,
  bookingId,
}: BookingDetailsPageContentProps) {
  const router = useRouter();
  const { isLoading: guardLoading } = useProtectedRoute();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guardLoading) {
      fetchBookingDetails();
    }
  }, [guardLoading, bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await bookingService.getById(bookingId);
      const data = response as any;
      setBooking(data.booking || data);
    } catch (err: any) {
      console.error("Error fetching booking:", err);
      setError(err.message || "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // TODO: Implement PDF download
    alert("PDF download will be available soon");
  };

  if (guardLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (error || !booking) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <Card className="text-center py-12">
            <p className="text-red-600 mb-4">{error || "Booking not found"}</p>
            <Button
              onClick={() => router.push(`/${locale}/dashboard/bookings`)}
            >
              View All Bookings
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const calculateDays = () => {
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const days = calculateDays();
  const statusConfig =
    STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG];
  const StatusIcon = statusConfig?.icon || AlertCircle;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => router.push(`/${locale}/dashboard/bookings`)}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="mr-2" />
            Back to Bookings
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Booking Details
              </h1>
              <p className="text-gray-600 mt-1">
                Booking #{booking.bookingNumber}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="mr-2" />
                Print
              </Button>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>

        {/* Success Banner */}
        {booking.status === "PENDING" && (
          <Card className="mb-6 p-6 bg-green-50 border-green-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-1">
                  Booking Request Submitted Successfully!
                </h3>
                <p className="text-green-800 mb-3">
                  Your booking request has been sent to the vehicle owner. You
                  will receive a confirmation once the owner reviews and
                  approves your booking.
                </p>
                <div className="flex gap-2">
                  <Badge className={statusConfig.color}>
                    <StatusIcon className="mr-1.5 h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Status Badge for other statuses */}
        {booking.status !== "PENDING" && statusConfig && (
          <div className="mb-6">
            <Badge className={`${statusConfig.color} text-lg px-4 py-2`}>
              <StatusIcon className="mr-2 h-4 w-4" />
              {statusConfig.label}
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vehicle Details */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Vehicle Information
              </h2>
              <div className="flex gap-4">
                {booking.vehicle.images &&
                  booking.vehicle.images.length > 0 && (
                    <img
                      src={booking.vehicle.images[0]}
                      alt={booking.vehicle.name}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {booking.vehicle.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {booking.vehicle.brand} {booking.vehicle.model}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    License Plate:{" "}
                    <span className="font-medium">
                      {booking.vehicle.licensePlate}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="mr-1.5" />
                      {booking.vehicle.seats} Seats
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Snowflake className="mr-1.5" />
                      {booking.vehicle.acType.replace(/_/g, " ")}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Bus className="mr-1.5" />
                      {booking.vehicle.type.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Trip Details */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Trip Information
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Pickup Location</p>
                    <p className="font-medium text-gray-900">
                      {booking.pickupLocation}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Dropoff Location</p>
                    <p className="font-medium text-gray-900">
                      {booking.dropoffLocation}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Trip Duration</p>
                    <p className="font-medium text-gray-900">
                      {new Date(booking.startDate).toLocaleDateString()} -{" "}
                      {new Date(booking.endDate).toLocaleDateString()}
                      <span className="text-sm text-gray-600 ml-2">
                        ({days} {days === 1 ? "day" : "days"})
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="text-[#20B0E9] mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">
                      Number of Passengers
                    </p>
                    <p className="font-medium text-gray-900">
                      {booking.passengers} passengers
                    </p>
                  </div>
                </div>
                {booking.specialRequirements && (
                  <div className="flex items-start gap-3">
                    <Clock className="text-[#20B0E9] mt-1" />
                    <div>
                      <p className="text-sm text-gray-600">
                        Special Requirements
                      </p>
                      <p className="font-medium text-gray-900">
                        {booking.specialRequirements}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Owner Details */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Vehicle Owner Contact
              </h2>
              <div className="space-y-3">
                <p className="font-medium text-gray-900">
                  {booking.owner.businessProfile?.businessName ||
                    `${booking.owner.firstName} ${booking.owner.lastName}`}
                </p>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="text-[#20B0E9]" />
                  <a
                    href={`mailto:${booking.owner.email}`}
                    className="text-sm hover:underline"
                  >
                    {booking.owner.email}
                  </a>
                </div>
                {(booking.owner.phone ||
                  booking.owner.businessProfile?.businessPhone) && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="text-[#20B0E9]" />
                    <a
                      href={`tel:${booking.owner.businessProfile?.businessPhone || booking.owner.phone}`}
                      className="text-sm hover:underline"
                    >
                      {booking.owner.businessProfile?.businessPhone ||
                        booking.owner.phone}
                    </a>
                  </div>
                )}
                <Button
                  onClick={() =>
                    (window.location.href = `tel:${booking.owner.businessProfile?.businessPhone || booking.owner.phone}`)
                  }
                  variant="outline"
                  className="mt-3"
                >
                  <Phone className="mr-2" />
                  Call Owner
                </Button>
              </div>
            </Card>

            {/* Quotation Notes */}
            {booking.quotation?.notes && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Additional Notes from Owner
                </h2>
                <p className="text-gray-700">{booking.quotation.notes}</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Price Summary */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Payment Summary
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">
                    Total Amount
                  </span>
                  <span className="font-bold text-[#20B0E9] text-2xl">
                    Rs. {booking.totalPrice.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Payment will be processed directly with the vehicle owner.
                </p>
              </div>
            </Card>

            {/* Booking Information */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Booking Information
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Booking Number</p>
                  <p className="font-medium text-gray-900">
                    {booking.bookingNumber}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Created On</p>
                  <p className="font-medium text-gray-900">
                    {new Date(booking.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Last Updated</p>
                  <p className="font-medium text-gray-900">
                    {new Date(booking.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            {/* Actions */}
            {booking.status === "PENDING" && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Next Steps</h3>
                <p className="text-sm text-gray-600 mb-4">
                  The vehicle owner will review your booking request. You will
                  be notified once they confirm your booking.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/${locale}/dashboard/bookings`)}
                >
                  View All Bookings
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
