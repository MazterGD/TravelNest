"use client";

import { useMemo, useState } from "react";
import { Download, Eye, RefreshCw, Wallet } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select } from "@/components/ui";
import { useBookingManagement } from "./hooks/useBookingManagement";

const bookingStatusOptions = [
  { value: "", label: "All booking statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "ONGOING", label: "Ongoing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const paymentStatusOptions = [
  { value: "", label: "All payment statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const statusVariant = (status: string) => {
  if (status === "COMPLETED") return "success" as const;
  if (status === "CANCELLED" || status === "FAILED") return "danger" as const;
  if (status === "PENDING" || status === "PROCESSING") return "warning" as const;
  return "secondary" as const;
};

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

export default function AdminBookingsPage() {
  const {
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
    refetch,
  } = useBookingManagement();

  const [refundReason, setRefundReason] = useState("Cancelled by admin review");
  const [refundAmount, setRefundAmount] = useState("");

  const bookings = bookingsData?.bookings || [];
  const canGoPrev = (bookingsData?.page || 1) > 1;
  const canGoNext =
    bookingsData !== null ? bookingsData.page < bookingsData.totalPages : false;

  const totalSummary = useMemo(() => {
    if (!bookingsData) return "";

    const start = (bookingsData.page - 1) * bookingsData.limit + 1;
    const end = Math.min(bookingsData.total, bookingsData.page * bookingsData.limit);
    return `${start}-${end} of ${bookingsData.total}`;
  }, [bookingsData]);

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Input
              label="Search bookings"
              placeholder="Booking ID, customer, location"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div>
            <Select
              label="Booking status"
              options={bookingStatusOptions}
              value={filters.status || ""}
              onChange={(value) =>
                setFilters({
                  status: (value || undefined) as
                    | "PENDING"
                    | "CONFIRMED"
                    | "ONGOING"
                    | "COMPLETED"
                    | "CANCELLED"
                    | undefined,
                })
              }
            />
          </div>
          <div>
            <Select
              label="Payment status"
              options={paymentStatusOptions}
              value={filters.paymentStatus || ""}
              onChange={(value) =>
                setFilters({
                  paymentStatus: (value || undefined) as
                    | "PENDING"
                    | "PROCESSING"
                    | "COMPLETED"
                    | "FAILED"
                    | "REFUNDED"
                    | undefined,
                })
              }
            />
          </div>
          <div>
            <Input
              label="Start date from"
              type="date"
              value={filters.startDateFrom || ""}
              onChange={(event) =>
                setFilters({
                  startDateFrom: event.target.value || undefined,
                })
              }
            />
          </div>
          <div>
            <Input
              label="Start date to"
              type="date"
              value={filters.startDateTo || ""}
              onChange={(event) =>
                setFilters({
                  startDateTo: event.target.value || undefined,
                })
              }
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" />
            Reload
          </Button>
          <Button onClick={() => void exportBookingsCsv()} disabled={isMutating}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Booking operations</h2>
            {bookingsData && <p className="text-sm text-muted-foreground">{totalSummary}</p>}
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : bookings.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No bookings found with current filters.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Booking</th>
                    <th className="py-3">Customer</th>
                    <th className="py-3">Vehicle</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Amount</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-border/70 align-top">
                      <td className="py-3">
                        <p className="font-medium text-foreground">{booking.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">
                          {booking.customer.firstName} {booking.customer.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{booking.customer.email}</p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">{booking.vehicle.name}</p>
                        <p className="text-xs text-muted-foreground">{booking.vehicle.licensePlate}</p>
                      </td>
                      <td className="py-3 space-y-2">
                        <Badge variant={statusVariant(booking.status)}>{booking.status}</Badge>
                        <div>
                          <Badge
                            size="sm"
                            variant={statusVariant(booking.payment?.status || "PENDING")}
                          >
                            {booking.payment?.status || "NO_PAYMENT"}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {currencyFormatter.format(booking.totalAmount)}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadBookingDetails(booking.id)}
                            disabled={isMutating}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void updateBookingStatus(
                                booking.id,
                                booking.status === "PENDING"
                                  ? "CONFIRMED"
                                  : booking.status === "CONFIRMED"
                                    ? "ONGOING"
                                    : booking.status === "ONGOING"
                                      ? "COMPLETED"
                                      : "CONFIRMED",
                                "Updated by admin",
                              )
                            }
                            disabled={isMutating}
                          >
                            Move Status
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {bookingsData && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                disabled={!canGoPrev || isMutating}
                onClick={() => setFilters({ page: (bookingsData.page || 1) - 1 })}
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {bookingsData.page} of {bookingsData.totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={!canGoNext || isMutating}
                onClick={() => setFilters({ page: (bookingsData.page || 1) + 1 })}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Booking details & refund</h3>
          {selectedBooking ? (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{selectedBooking.id}</p>
                <p className="text-muted-foreground">
                  {selectedBooking.customer.firstName} {selectedBooking.customer.lastName}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Trip</p>
                <p className="mt-1 text-foreground">{selectedBooking.pickupLocation}</p>
                <p className="text-foreground">{selectedBooking.dropoffLocation || "N/A"}</p>
                <p className="mt-1 text-muted-foreground">
                  {new Date(selectedBooking.startDate).toLocaleString()} to {" "}
                  {new Date(selectedBooking.endDate).toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment</p>
                <p className="mt-1 text-foreground">
                  Total: {currencyFormatter.format(selectedBooking.totalAmount)}
                </p>
                <p className="text-muted-foreground">
                  Status: {selectedBooking.payment?.status || "NO_PAYMENT"}
                </p>
                <p className="text-muted-foreground">
                  Paid: {currencyFormatter.format(selectedBooking.payment?.amount || 0)}
                </p>
              </div>

              <Input
                label="Refund reason"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
              />
              <Input
                label="Refund amount (optional)"
                type="number"
                min={0}
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
              />

              <Button
                className="w-full"
                variant="outline"
                onClick={() =>
                  void cancelWithRefund(
                    selectedBooking.id,
                    refundReason,
                    refundAmount ? Number(refundAmount) : undefined,
                  )
                }
                disabled={isMutating || refundReason.trim().length === 0}
              >
                <Wallet className="h-4 w-4" />
                Cancel Booking + Refund
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Select a booking to review trip details and process refunds.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
