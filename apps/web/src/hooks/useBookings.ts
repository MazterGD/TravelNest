"use client";

import { useCallback } from "react";
import { useBookingStore, type BookingWithDetails } from "@/store";
import { bookingService, paymentService, ApiError } from "@/lib/api";
import type { BookingStatus, PaymentStatus } from "@/types";

/**
 * Result type for booking operations
 */
interface BookingResult {
  success: boolean;
  error?: string;
  code?: string;
}

/**
 * useBookings hook - handles all booking-related operations
 * with proper error handling and state management
 */
export function useBookings() {
  const {
    bookings,
    activeBooking,
    isLoading,
    error,
    statusFilter,
    dateFilter,
    setBookings,
    addBooking,
    updateBooking,
    setActiveBooking,
    setLoading,
    setError,
    setStatusFilter,
    setDateFilter,
    getUpcomingBookings,
    getPastBookings,
  } = useBookingStore();

  /**
   * Fetch user's bookings (as customer)
   */
  const fetchBookings = useCallback(
    async (params?: { status?: string; page?: number; limit?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await bookingService.getMyBookings(params);
        setBookings(response as unknown as BookingWithDetails[]);
        return { success: true, data: response };
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to fetch bookings";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setBookings, setLoading, setError],
  );

  /**
   * Fetch owner's vehicle bookings
   */
  const fetchOwnerBookings = useCallback(
    async (params?: { status?: string; page?: number; limit?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await bookingService.getOwnerBookings(params);
        setBookings(response as unknown as BookingWithDetails[]);
        return { success: true, data: response };
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to fetch bookings";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setBookings, setLoading, setError],
  );

  /**
   * Get single booking details
   */
  const fetchBookingDetails = useCallback(
    async (bookingId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await bookingService.getById(bookingId);
        setActiveBooking(response as unknown as BookingWithDetails);
        return { success: true, data: response };
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to fetch booking";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setActiveBooking, setLoading, setError],
  );

  /**
   * Cancel a booking
   */
  const cancelBooking = useCallback(
    async (bookingId: string, reason: string): Promise<BookingResult> => {
      setLoading(true);
      try {
        await bookingService.cancel(bookingId, reason);
        updateBooking(bookingId, { status: "cancelled" as BookingStatus });
        return { success: true };
      } catch (err) {
        const apiError = err instanceof ApiError ? err : null;
        const message = apiError?.message || "Failed to cancel booking";
        setError(message);
        return {
          success: false,
          error: message,
          code: apiError?.code,
        };
      } finally {
        setLoading(false);
      }
    },
    [updateBooking, setLoading, setError],
  );

  /**
   * Confirm a booking (owner only)
   */
  const confirmBooking = useCallback(
    async (bookingId: string): Promise<BookingResult> => {
      setLoading(true);
      try {
        await bookingService.confirmBooking(bookingId);
        updateBooking(bookingId, { status: "confirmed" as BookingStatus });
        return { success: true };
      } catch (err) {
        const apiError = err instanceof ApiError ? err : null;
        const message = apiError?.message || "Failed to confirm booking";
        setError(message);
        return {
          success: false,
          error: message,
          code: apiError?.code,
        };
      } finally {
        setLoading(false);
      }
    },
    [updateBooking, setLoading, setError],
  );

  /**
   * Start a trip (owner only)
   */
  const startTrip = useCallback(
    async (bookingId: string): Promise<BookingResult> => {
      setLoading(true);
      try {
        await bookingService.startTrip(bookingId);
        updateBooking(bookingId, { status: "in_progress" as BookingStatus });
        return { success: true };
      } catch (err) {
        const apiError = err instanceof ApiError ? err : null;
        const message = apiError?.message || "Failed to start trip";
        setError(message);
        return {
          success: false,
          error: message,
          code: apiError?.code,
        };
      } finally {
        setLoading(false);
      }
    },
    [updateBooking, setLoading, setError],
  );

  /**
   * Complete a booking
   */
  const completeBooking = useCallback(
    async (bookingId: string): Promise<BookingResult> => {
      setLoading(true);
      try {
        await bookingService.complete(bookingId);
        updateBooking(bookingId, { status: "completed" as BookingStatus });
        return { success: true };
      } catch (err) {
        const apiError = err instanceof ApiError ? err : null;
        const message = apiError?.message || "Failed to complete booking";
        setError(message);
        return {
          success: false,
          error: message,
          code: apiError?.code,
        };
      } finally {
        setLoading(false);
      }
    },
    [updateBooking, setLoading, setError],
  );

  /**
   * Create payment intent for a booking
   */
  const initiatePayment = useCallback(
    async (bookingId: string, method: "CARD" | "BANK_TRANSFER" | "CASH") => {
      setLoading(true);
      try {
        const response = await paymentService.createPaymentIntent(
          bookingId,
          method,
        );
        return { success: true, data: response };
      } catch (err) {
        const apiError = err instanceof ApiError ? err : null;
        const message = apiError?.message || "Failed to initiate payment";
        setError(message);
        return {
          success: false,
          error: message,
          code: apiError?.code,
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  /**
   * Confirm payment completion
   */
  const confirmPayment = useCallback(
    async (bookingId: string, paymentId: string): Promise<BookingResult> => {
      setLoading(true);
      try {
        await paymentService.confirmPayment(paymentId);
        updateBooking(bookingId, {
          paymentStatus: "paid" as PaymentStatus,
        });
        return { success: true };
      } catch (err) {
        const apiError = err instanceof ApiError ? err : null;
        const message = apiError?.message || "Payment confirmation failed";
        setError(message);
        return {
          success: false,
          error: message,
          code: apiError?.code,
        };
      } finally {
        setLoading(false);
      }
    },
    [updateBooking, setLoading, setError],
  );

  // Filter bookings based on current filters
  const filteredBookings = bookings.filter((booking) => {
    // Status filter
    if (statusFilter !== "all" && booking.status !== statusFilter) {
      return false;
    }

    // Date filter
    const now = new Date();
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);

    if (dateFilter === "upcoming" && startDate <= now) return false;
    if (dateFilter === "past" && endDate >= now) return false;

    return true;
  });

  return {
    // State
    bookings: filteredBookings,
    allBookings: bookings,
    activeBooking,
    upcomingBookings: getUpcomingBookings(),
    pastBookings: getPastBookings(),
    isLoading,
    error,
    statusFilter,
    dateFilter,

    // Actions - Customer
    fetchBookings,
    fetchBookingDetails,
    cancelBooking,
    completeBooking,
    initiatePayment,
    confirmPayment,

    // Actions - Owner
    fetchOwnerBookings,
    confirmBooking,
    startTrip,

    // State setters
    setActiveBooking,
    setStatusFilter,
    setDateFilter,
  };
}
