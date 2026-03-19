"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  PageHeader,
  Button,
  TabsList,
  EmptyState,
  EmptyCalendarIcon,
  SkeletonList,
  ConfirmDialog,
} from "@/components/ui";
import { BookingCard } from "@/components/features/customer";
import { BookingStatus, PaymentStatus } from "@/types";
import { bookingService, ApiError } from "@/lib/api";
import type { BookingWithDetails } from "@/store";

interface BookingsPageContentProps {
  locale: string;
}

export function BookingsPageContent({ locale }: BookingsPageContentProps) {
  const t = useTranslations("booking");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  // Confirmation dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await bookingService.getMyBookings();
      const data = response as any;
      const bookingsList = data.bookings || data || [];

      // Transform API response to BookingWithDetails format
      const transformedBookings: BookingWithDetails[] = bookingsList.map(
        (booking: any) => ({
          id: booking.id,
          vehicleId: booking.vehicleId,
          customerId: booking.customerId,
          ownerId: booking.ownerId,
          bookingReference: booking.bookingReference || booking.bookingRef,
          startDate: new Date(booking.startDate),
          endDate: new Date(booking.endDate),
          startTime: booking.startTime,
          passengerCount: booking.passengerCount,
          stops: [],
          paidAmount: booking.paidAmount || 0,
          totalAmount: booking.totalAmount,
          status: booking.status as BookingStatus,
          paymentStatus: (booking.paymentStatus || "pending") as PaymentStatus,
          createdAt: new Date(booking.createdAt),
          updatedAt: new Date(booking.updatedAt),
          vehicleName: booking.vehicleName || "Vehicle",
          vehicleImage: booking.vehicleImage,
          ownerName: booking.ownerName || "Owner",
          ownerPhone: booking.ownerPhone || "",
          hasReview: booking.hasReview,
          pickupLocation:
            typeof booking.pickupLocation === "string"
              ? {
                  address: booking.pickupLocation,
                  city: booking.pickupLocation.split(",")[0]?.trim() || "",
                }
              : booking.pickupLocation,
          dropoffLocation:
            typeof booking.dropoffLocation === "string"
              ? {
                  address: booking.dropoffLocation,
                  city: booking.dropoffLocation.split(",")[0]?.trim() || "",
                }
              : booking.dropoffLocation,
        }),
      );

      setBookings(transformedBookings);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("errors.fetchBookings"));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const now = new Date();
  const filteredBookings = bookings.filter((booking) => {
    if (activeTab === "upcoming") return new Date(booking.startDate) > now;
    if (activeTab === "past") return new Date(booking.endDate) < now;
    if (activeTab === "cancelled")
      return booking.status === BookingStatus.CANCELLED;
    return true;
  });

  const tabs = [
    { id: "all", label: t("all"), badge: bookings.length },
    {
      id: "upcoming",
      label: t("upcoming"),
      badge: bookings.filter((b) => new Date(b.startDate) > now).length,
    },
    {
      id: "past",
      label: t("past"),
      badge: bookings.filter((b) => new Date(b.endDate) < now).length,
    },
    {
      id: "cancelled",
      label: t("cancelled"),
      badge: bookings.filter((b) => b.status === BookingStatus.CANCELLED)
        .length,
    },
  ];

  const handleCancelBooking = async (bookingId: string) => {
    // Open confirmation dialog instead of cancelling directly
    setBookingToCancel(bookingId);
    setCancelDialogOpen(true);
  };

  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;

    setIsCancelling(true);
    try {
      await bookingService.cancel(bookingToCancel, "Cancelled by customer");
      // Refresh bookings after cancellation
      await fetchBookings();
      setCancelDialogOpen(false);
      setBookingToCancel(null);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert(t("errors.cancelFailed"));
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReview = (bookingId: string) => {
    window.location.href = `/${locale}/dashboard/reviews?booking=${bookingId}`;
  };

  const handleViewDetails = (bookingId: string) => {
    window.location.href = `/${locale}/dashboard/bookings/${bookingId}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("myBookings")}
        description={t("bookingsDescription")}
      />

      <TabsList
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
        variant="pills"
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <Button variant="link" onClick={fetchBookings} className="ml-2">
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <SkeletonList count={3} />
      ) : filteredBookings.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onCancel={() => handleCancelBooking(booking.id)}
              onReview={() => handleReview(booking.id)}
              onViewDetails={() => handleViewDetails(booking.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<EmptyCalendarIcon />}
          title={t("noBookings")}
          description={t("noBookingsDescription")}
          action={
            <Link href={`/${locale}/dashboard/quotations/new`}>
              <Button>{t("startSearching")}</Button>
            </Link>
          }
        />
      )}

      {/* Cancel Booking Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setBookingToCancel(null);
        }}
        onConfirm={confirmCancelBooking}
        title={t("cancelDialog.title")}
        message={t("cancelDialog.message")}
        confirmText={t("cancelDialog.confirm")}
        cancelText={t("cancelDialog.cancel")}
        variant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
}
