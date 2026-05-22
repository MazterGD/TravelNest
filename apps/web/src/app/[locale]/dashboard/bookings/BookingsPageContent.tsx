"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AlertCircle, Download, X } from "lucide-react";
import {
  PageHeader,
  TabsList,
  EmptyState,
  EmptyCalendarIcon,
  SkeletonList,
  ConfirmDialog,
  CTAButton,
  Input,
  Select,
} from "@/components/ui";
import { BookingCard } from "@/components/features/customer";
import { BookingStatus, PaymentStatus } from "@/types";
import { bookingService, ApiError } from "@/lib/api";
import type { BookingWithDetails } from "@/store";

interface BookingsPageContentProps {
  locale: string;
}

type SortOption =
  | "createdAt_desc"
  | "createdAt_asc"
  | "startDate_asc"
  | "startDate_desc"
  | "totalAmount_asc"
  | "totalAmount_desc";

const PAGE_SIZE = 6;

function generateCSV(bookings: BookingWithDetails[]): string {
  const headers = [
    "Booking Ref",
    "Status",
    "Vehicle",
    "Vehicle Type",
    "Owner",
    "Pickup",
    "Dropoff",
    "Start Date",
    "End Date",
    "Passengers",
    "Total (LKR)",
    "Payment Status",
  ];
  const escape = (v: unknown) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = bookings.map((b) => [
    b.bookingReference ?? b.id,
    b.status,
    b.vehicleName,
    b.vehicleType ?? "",
    b.ownerName,
    b.pickupLocation?.address ?? "",
    b.dropoffLocation?.address ?? "",
    new Date(b.startDate).toLocaleDateString(),
    new Date(b.endDate).toLocaleDateString(),
    b.passengerCount ?? "",
    b.totalAmount,
    b.paymentStatus,
  ]);
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
}

export function BookingsPageContent({ locale }: BookingsPageContentProps) {
  const t = useTranslations("booking");
  const router = useRouter();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Filter state
  const [activeTab, setActiveTab] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await bookingService.getMyBookings({
        status: activeTab !== "all" ? activeTab : undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        vehicleType: vehicleType || undefined,
        sort,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      const data = response as any;
      const list = data.bookings || [];
      const pag = data.pagination || {};

      const transformed: BookingWithDetails[] = list.map((b: any) => ({
        id: b.id,
        vehicleId: b.vehicleId,
        customerId: b.customerId,
        ownerId: b.ownerId,
        bookingReference: b.bookingReference ?? b.bookingRef,
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        startTime: b.startTime,
        passengerCount: b.passengerCount,
        stops: [],
        paidAmount: b.paidAmount ?? 0,
        totalAmount: b.totalAmount,
        status: b.status as BookingStatus,
        paymentStatus: (b.paymentStatus ?? "pending") as PaymentStatus,
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt),
        vehicleName: b.vehicleName || t("vehicleFallback"),
        vehicleType: b.vehicleType,
        vehicleImage: b.vehicleImage,
        ownerName: b.ownerName || t("ownerFallback"),
        ownerPhone: b.ownerPhone ?? "",
        hasReview: b.hasReview,
        pickupLocation:
          typeof b.pickupLocation === "string"
            ? { address: b.pickupLocation, city: b.pickupLocation.split(",")[0]?.trim() ?? "" }
            : b.pickupLocation,
        dropoffLocation:
          typeof b.dropoffLocation === "string"
            ? { address: b.dropoffLocation, city: b.dropoffLocation.split(",")[0]?.trim() ?? "" }
            : b.dropoffLocation,
      }));

      setBookings(transformed);
      setTotal(pag.total ?? 0);
      setTotalPages(pag.totalPages ?? 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.fetchBookings"));
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, vehicleType, sort, currentPage, t]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleVehicleTypeChange = (v: string) => {
    setVehicleType(v);
    setCurrentPage(1);
  };

  const handleSortChange = (v: string) => {
    setSort(v as SortOption);
    setCurrentPage(1);
  };

  const handleDateFromChange = (v: string) => {
    setDateFrom(v);
    setCurrentPage(1);
  };

  const handleDateToChange = (v: string) => {
    setDateTo(v);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setVehicleType("");
    setSort("createdAt_desc");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    !!dateFrom || !!dateTo || !!vehicleType || sort !== "createdAt_desc";

  const handleCancelBooking = (bookingId: string) => {
    setBookingToCancel(bookingId);
    setCancelDialogOpen(true);
  };

  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    setIsCancelling(true);
    try {
      await bookingService.cancel(bookingToCancel, "Cancelled by customer");
      await fetchBookings();
      setCancelDialogOpen(false);
      setBookingToCancel(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("errors.cancelFailed");
      setCancelError(message);
      setTimeout(() => setCancelError(null), 4000);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReview = (bookingId: string) => {
    router.push(`/${locale}/dashboard/reviews?booking=${bookingId}`);
  };

  const handleViewDetails = (bookingId: string) => {
    router.push(`/${locale}/dashboard/bookings/${bookingId}`);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const response = await bookingService.getMyBookings({
        status: activeTab !== "all" ? activeTab : undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        vehicleType: vehicleType || undefined,
        sort,
        page: 1,
        limit: 1000,
      });
      const data = response as any;
      const list = data.bookings || [];
      const allBookings: BookingWithDetails[] = list.map((b: any) => ({
        id: b.id,
        vehicleId: b.vehicleId,
        customerId: b.customerId,
        ownerId: b.ownerId,
        bookingReference: b.bookingReference,
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        totalAmount: b.totalAmount,
        status: b.status as BookingStatus,
        paymentStatus: b.paymentStatus as PaymentStatus,
        vehicleName: b.vehicleName || "",
        vehicleType: b.vehicleType,
        ownerName: b.ownerName || "",
        ownerPhone: b.ownerPhone || "",
        passengerCount: b.passengerCount,
        pickupLocation: { address: typeof b.pickupLocation === "string" ? b.pickupLocation : b.pickupLocation?.address ?? "" },
        dropoffLocation: { address: typeof b.dropoffLocation === "string" ? b.dropoffLocation : b.dropoffLocation?.address ?? "" },
      }));

      const csv = generateCSV(allBookings);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bookings-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Export failure is non-critical — user still has the page view
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: "all", label: t("all"), badge: activeTab === "all" ? total : undefined },
    { id: "pending", label: t("pending") },
    { id: "confirmed", label: t("confirmed") },
    { id: "ongoing", label: t("ongoing") },
    { id: "completed", label: t("completed") },
    { id: "cancelled", label: t("cancelled") },
  ];

  const vehicleTypeOptions = [
    { value: "", label: t("filters.allTypes") },
    { value: "ORDINARY", label: t("vehicleTypes.ordinary") },
    { value: "SEMI_LUXURY", label: t("vehicleTypes.semiLuxury") },
    { value: "LUXURY_AC", label: t("vehicleTypes.luxuryAC") },
  ];

  const sortOptions = [
    { value: "createdAt_desc", label: t("filters.sortDateDesc") },
    { value: "createdAt_asc", label: t("filters.sortDateAsc") },
    { value: "startDate_asc", label: t("filters.sortTripAsc") },
    { value: "startDate_desc", label: t("filters.sortTripDesc") },
    { value: "totalAmount_asc", label: t("filters.sortAmountAsc") },
    { value: "totalAmount_desc", label: t("filters.sortAmountDesc") },
  ];

  const pageFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageTo = Math.min(currentPage * PAGE_SIZE, total);

  return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8 space-y-8">
      <PageHeader
        title={t("myBookings")}
        description={t("bookingsDescription")}
      />

      {/* Status tabs */}
      <TabsList
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabs={tabs}
        variant="pills"
        className="overflow-x-auto flex-nowrap"
      />

      {/* Filter panel */}
      <div className="rounded-[20px] bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            type="date"
            label={t("filters.dateFrom")}
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            max={dateTo || undefined}
          />
          <Input
            type="date"
            label={t("filters.dateTo")}
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            min={dateFrom || undefined}
          />
          <Select
            label={t("filters.vehicleType")}
            value={vehicleType}
            options={vehicleTypeOptions}
            placeholder={t("filters.allTypes")}
            onChange={handleVehicleTypeChange}
          />
          <Select
            label={t("filters.sortBy")}
            value={sort}
            options={sortOptions}
            onChange={handleSortChange}
          />
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {t("filters.activeFilters")}:
            </span>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm bg-[var(--color-bg-base)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-error-text)] hover:border-[var(--color-error-border)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
              aria-label={t("filters.clearFilters")}
            >
              <X size={14} />
              {t("filters.clearFilters")}
            </button>
          </div>
        )}
      </div>

      {/* Error banners */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl text-[var(--color-error-text)]"
        >
          <AlertCircle size={20} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={fetchBookings}
            className="underline hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-error-border)] focus-visible:ring-offset-2"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {cancelError && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl text-[var(--color-error-text)]"
        >
          <AlertCircle size={20} className="shrink-0" />
          <span>{cancelError}</span>
        </div>
      )}

      {/* Results bar */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("pagination.showing", { from: pageFrom, to: pageTo, total })}
          </p>
          <CTAButton
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={isExporting}
            leftIcon={<Download size={16} />}
          >
            {t("exportCSV")}
          </CTAButton>
        </div>
      )}

      {/* Booking grid */}
      {isLoading ? (
        <SkeletonList count={3} />
      ) : bookings.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {bookings.map((booking) => (
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
            <CTAButton href={`/${locale}/dashboard/quotations/new`}>
              {t("startSearching")}
            </CTAButton>
          }
        />
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={currentPage === 1}
            className="min-h-11 px-4 py-2 rounded-xl border border-[var(--color-border-default)] text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
          >
            {t("pagination.previous")}
          </button>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {t("pagination.page", { current: currentPage, total: totalPages })}
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage === totalPages}
            className="min-h-11 px-4 py-2 rounded-xl border border-[var(--color-border-default)] text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
          >
            {t("pagination.next")}
          </button>
        </div>
      )}

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
