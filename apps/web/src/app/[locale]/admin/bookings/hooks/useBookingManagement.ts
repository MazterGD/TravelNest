"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminService,
  type AdminBookingRecord,
  type AdminBookingsQuery,
  type AdminBookingsResponse,
} from "@/lib/api";

interface UseBookingManagementResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminBookingsQuery;
  bookingsData: AdminBookingsResponse | null;
  selectedBooking: (AdminBookingRecord & Record<string, unknown>) | null;
  setFilters: (next: Partial<AdminBookingsQuery>) => void;
  loadBookingDetails: (bookingId: string) => Promise<void>;
  updateBookingStatus: (
    bookingId: string,
    status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED",
    reason?: string,
  ) => Promise<void>;
  cancelWithRefund: (
    bookingId: string,
    refundReason: string,
    refundAmount?: number,
  ) => Promise<void>;
  exportBookingsCsv: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useBookingManagement = (): UseBookingManagementResult => {
  // Seed filters from URL params so deep-links from the dashboard arrive
  // with the correct view pre-applied (e.g. ?status=PENDING).
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const rawStatus = searchParams.get("status");
  const rawPaymentStatus = searchParams.get("paymentStatus");

  const VALID_STATUSES = ["PENDING", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"] as const;
  const VALID_PAYMENT_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED"] as const;

  const initialStatus = VALID_STATUSES.includes(rawStatus as typeof VALID_STATUSES[number])
    ? (rawStatus as AdminBookingsQuery["status"])
    : undefined;
  const initialPaymentStatus = VALID_PAYMENT_STATUSES.includes(rawPaymentStatus as typeof VALID_PAYMENT_STATUSES[number])
    ? (rawPaymentStatus as AdminBookingsQuery["paymentStatus"])
    : undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] = useState<AdminBookingsQuery>({
    page: 1,
    limit: 20,
    search: initialSearch,
    status: initialStatus,
    paymentStatus: initialPaymentStatus,
  });
  const [bookingsData, setBookingsData] = useState<AdminBookingsResponse | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<
    UseBookingManagementResult["selectedBooking"]
  >(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getBookings({
        ...filters,
        search: filters.search?.trim() || undefined,
      });

      setBookingsData(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load bookings";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const setFilters = useCallback((next: Partial<AdminBookingsQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.status !== undefined ||
              next.paymentStatus !== undefined ||
              next.startDateFrom !== undefined ||
              next.startDateTo !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const loadBookingDetails = useCallback(async (bookingId: string) => {
    // Intentionally does not set isMutating — loading a detail record is a read
    // operation and must not lock the table's write-action buttons.
    setError(null);

    try {
      const booking = await adminService.getBookingById(bookingId);
      setSelectedBooking(booking);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load booking details";
      setError(message);
    }
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<void>) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchBookings();
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Operation failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchBookings],
  );

  const updateBookingStatus = useCallback<
    UseBookingManagementResult["updateBookingStatus"]
  >(
    async (bookingId, status, reason) => {
      await withMutation(async () => {
        await adminService.updateBookingStatus(bookingId, status, reason);
      });
    },
    [withMutation],
  );

  const cancelWithRefund = useCallback<
    UseBookingManagementResult["cancelWithRefund"]
  >(
    async (bookingId, refundReason, refundAmount) => {
      await withMutation(async () => {
        await adminService.cancelBookingWithRefund(
          bookingId,
          refundReason,
          refundAmount,
        );
      });
    },
    [withMutation],
  );

  const exportBookingsCsv = useCallback(async () => {
    setIsMutating(true);
    setError(null);

    try {
      await adminService.exportBookingsCsv({
        search: filters.search?.trim() || undefined,
        status: filters.status,
        paymentStatus: filters.paymentStatus,
        startDateFrom: filters.startDateFrom,
        startDateTo: filters.startDateTo,
      });
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "Failed to export bookings CSV";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, [filters]);

  return {
    isLoading,
    isMutating,
    error,
    filters,
    bookingsData,
    selectedBooking,
    setFilters,
    loadBookingDetails,
    updateBookingStatus,
    cancelWithRefund,
    exportBookingsCsv,
    refetch: fetchBookings,
  };
};
