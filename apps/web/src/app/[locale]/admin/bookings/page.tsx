"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  LayoutList,
  Loader2,
  RefreshCw,
  Wallet,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Badge,
  Button,
  Card,
  EmptySearchIcon,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonTable,
} from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useBookingManagement } from "./hooks/useBookingManagement";

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_QUICK_FILTERS = [
  { label: "All", value: undefined as string | undefined, icon: <LayoutList className="h-4 w-4" /> },
  { label: "Pending", value: "PENDING", icon: <Clock className="h-4 w-4" /> },
  { label: "Confirmed", value: "CONFIRMED", icon: <CheckCircle2 className="h-4 w-4" /> },
  { label: "Ongoing", value: "ONGOING", icon: <Activity className="h-4 w-4" /> },
  { label: "Completed", value: "COMPLETED", icon: <CheckCheck className="h-4 w-4" /> },
  { label: "Cancelled", value: "CANCELLED", icon: <XCircle className="h-4 w-4" /> },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All payment statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

// Valid forward transitions from context.md §Booking & Payment state machine.
// Terminal states (COMPLETED, CANCELLED) have no valid transitions.
const NEXT_STATUS_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  PENDING: [
    { value: "CONFIRMED", label: "Confirmed" },
    { value: "CANCELLED", label: "Cancelled" },
  ],
  CONFIRMED: [
    { value: "ONGOING", label: "Ongoing" },
    { value: "CANCELLED", label: "Cancelled" },
  ],
  ONGOING: [
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOOKING_BADGE: Record<string, "success" | "danger" | "warning" | "info" | "secondary"> = {
  CONFIRMED: "success",
  COMPLETED: "success",
  ONGOING: "info",
  PENDING: "warning",
  CANCELLED: "danger",
};

const PAYMENT_BADGE: Record<string, "success" | "danger" | "warning" | "info" | "secondary"> = {
  COMPLETED: "success",
  FAILED: "danger",
  REFUNDED: "info",
  PENDING: "warning",
  PROCESSING: "warning",
};

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBookingsPage() {
  const { confirm, dialogs } = useDialogPrompts();

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

  // Detail modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewingBookingId, setViewingBookingId] = useState<string | null>(null);

  // Status update form — scoped to the open booking
  const [nextStatus, setNextStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");

  // Refund form — scoped to the open booking
  const [refundReason, setRefundReason] = useState("Cancelled by admin review");
  const [refundAmount, setRefundAmount] = useState("");

  // Reset both forms whenever a different booking is loaded into the panel
  useEffect(() => {
    if (!selectedBooking) return;
    const validNext = NEXT_STATUS_OPTIONS[selectedBooking.status] ?? [];
    setNextStatus(validNext[0]?.value ?? "");
    setStatusReason("");
    setRefundReason("Cancelled by admin review");
    setRefundAmount("");
  }, [selectedBooking?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived state ───────────────────────────────────────────────────────────

  const bookings = bookingsData?.bookings ?? [];
  const canGoPrev = (bookingsData?.page ?? 1) > 1;
  const canGoNext = bookingsData ? bookingsData.page < bookingsData.totalPages : false;

  const totalSummary = useMemo(() => {
    if (!bookingsData) return "";
    const start = (bookingsData.page - 1) * bookingsData.limit + 1;
    const end = Math.min(bookingsData.total, bookingsData.page * bookingsData.limit);
    return `${start}–${end} of ${bookingsData.total.toLocaleString()}`;
  }, [bookingsData]);

  const validNextStatuses = selectedBooking
    ? (NEXT_STATUS_OPTIONS[selectedBooking.status] ?? [])
    : [];

  const isTerminalStatus =
    !selectedBooking ||
    selectedBooking.status === "COMPLETED" ||
    selectedBooking.status === "CANCELLED";

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleViewBooking = async (bookingId: string) => {
    setViewingBookingId(bookingId);
    await loadBookingDetails(bookingId);
    setViewingBookingId(null);
    setIsDetailOpen(true);
  };

  const closeDetailModal = () => setIsDetailOpen(false);

  const handleStatusUpdate = async () => {
    if (!selectedBooking || !nextStatus) return;
    const approved = await confirm({
      title: "Update Booking Status",
      message: `Move this booking from ${selectedBooking.status} to ${nextStatus}?`,
      confirmText: "Update Status",
      variant: nextStatus === "CANCELLED" ? "warning" : undefined,
    });
    if (!approved) return;
    await updateBookingStatus(
      selectedBooking.id,
      nextStatus as "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED",
      statusReason.trim() || "Updated by admin",
    );
    closeDetailModal();
  };

  const handleCancelWithRefund = async () => {
    if (!selectedBooking || !refundReason.trim()) return;
    const approved = await confirm({
      title: "Cancel Booking & Process Refund",
      message:
        "This will immediately cancel the booking and initiate a refund. This action cannot be undone.",
      confirmText: "Cancel & Refund",
      variant: "danger",
    });
    if (!approved) return;
    await cancelWithRefund(
      selectedBooking.id,
      refundReason,
      refundAmount ? Number(refundAmount) : undefined,
    );
    closeDetailModal();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Booking Management
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Monitor and manage all platform bookings, payments, and refunds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading || isMutating}
            aria-label="Refresh bookings list"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void exportBookingsCsv()}
            disabled={isMutating}
            aria-label="Export bookings as CSV"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Quick-filter status pills */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {BOOKING_QUICK_FILTERS.map((qf) => {
          const isActive = filters.status === qf.value;
          return (
            <button
              key={qf.label}
              type="button"
              onClick={() =>
                setFilters({ status: qf.value as typeof filters.status })
              }
              className={cn(
                "rounded-[20px] border p-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2",
                isActive
                  ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-base)] hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)]",
              )}
            >
              <span
                className={
                  isActive
                    ? "text-[var(--color-action-primary)]"
                    : "text-[var(--color-text-tertiary)]"
                }
                aria-hidden="true"
              >
                {qf.icon}
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {qf.label}
              </p>
              {isActive && bookingsData && (
                <p className="mt-0.5 text-xl font-bold text-[var(--color-action-primary)]">
                  {bookingsData.total.toLocaleString()}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card className="bg-[var(--color-bg-base)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search bookings"
              placeholder="Booking ID, customer, or location"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-[190px]">
            <Select
              label="Payment status"
              options={PAYMENT_STATUS_OPTIONS}
              value={filters.paymentStatus ?? ""}
              onChange={(v) =>
                setFilters({
                  paymentStatus: (v || undefined) as typeof filters.paymentStatus,
                })
              }
            />
          </div>
          <div className="w-full sm:w-[160px]">
            <Input
              label="Start date from"
              type="date"
              value={filters.startDateFrom ?? ""}
              onChange={(e) =>
                setFilters({ startDateFrom: e.target.value || undefined })
              }
            />
          </div>
          <div className="w-full sm:w-[160px]">
            <Input
              label="Start date to"
              type="date"
              value={filters.startDateTo ?? ""}
              onChange={(e) =>
                setFilters({ startDateTo: e.target.value || undefined })
              }
            />
          </div>
        </div>
      </Card>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--color-error-text)]">
                Could not load bookings.
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
                {error} — Try refreshing the page or check your connection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bookings table */}
      <Card className="overflow-hidden bg-[var(--color-bg-base)] p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Bookings
          </h2>
          {bookingsData && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {totalSummary}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 pb-6">
            <SkeletonTable rows={10} cols={6} />
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No bookings found"
            description="Try adjusting your search terms or removing a filter to see more results."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-auto text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Booking
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Customer
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Vehicle
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="transition-colors hover:bg-[var(--color-bg-surface)]"
                  >
                    {/* Booking ID + dates */}
                    <td className="px-6 py-4">
                      <p className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                        #{booking.id.slice(-8).toUpperCase()}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                        {new Date(booking.startDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        {" — "}
                        {new Date(booking.endDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {booking.customer.firstName} {booking.customer.lastName}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {booking.customer.email}
                      </p>
                    </td>

                    {/* Vehicle */}
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {booking.vehicle.name}
                      </p>
                      <p className="font-mono text-xs text-[var(--color-text-tertiary)]">
                        {booking.vehicle.licensePlate}
                      </p>
                    </td>

                    {/* Status badges */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        <Badge variant={BOOKING_BADGE[booking.status] ?? "secondary"} dot>
                          {titleCase(booking.status)}
                        </Badge>
                        {booking.payment && (
                          <Badge
                            size="sm"
                            variant={PAYMENT_BADGE[booking.payment.status] ?? "secondary"}
                          >
                            {booking.payment.status}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-4 tabular-nums text-[var(--color-text-secondary)]">
                      {currencyFormatter.format(booking.totalAmount)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleViewBooking(booking.id)}
                          disabled={viewingBookingId !== null}
                          aria-label={`View details for booking ${booking.id.slice(-8).toUpperCase()}`}
                        >
                          {viewingBookingId === booking.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination — only when there is more than one page */}
        {bookingsData && bookingsData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isMutating}
              onClick={() => setFilters({ page: (bookingsData.page ?? 1) - 1 })}
              aria-label="Go to previous page"
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page {bookingsData.page} of {bookingsData.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={!canGoNext || isMutating}
              onClick={() => setFilters({ page: (bookingsData.page ?? 1) + 1 })}
              aria-label="Go to next page"
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Booking detail modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        title={
          selectedBooking
            ? `Booking #${selectedBooking.id.slice(-8).toUpperCase()}`
            : "Booking Details"
        }
        size="lg"
      >
        {selectedBooking ? (
          <div className="max-h-[calc(90vh-8rem)] space-y-6 overflow-y-auto">

            {/* Identity strip */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[var(--color-text-primary)]">
                  {selectedBooking.customer.firstName} {selectedBooking.customer.lastName}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {selectedBooking.customer.email}
                </p>
              </div>
              <Badge variant={BOOKING_BADGE[selectedBooking.status] ?? "secondary"} dot>
                {titleCase(selectedBooking.status)}
              </Badge>
            </div>

            {/* Trip & vehicle details */}
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Trip Details
              </p>
              <dl className="mt-3 divide-y divide-[var(--color-border-default)] text-sm">
                <div className="flex justify-between py-2">
                  <dt className="text-[var(--color-text-tertiary)]">Pickup</dt>
                  <dd className="text-right font-medium text-[var(--color-text-primary)]">
                    {selectedBooking.pickupLocation}
                  </dd>
                </div>
                {selectedBooking.dropoffLocation && (
                  <div className="flex justify-between py-2">
                    <dt className="text-[var(--color-text-tertiary)]">Drop-off</dt>
                    <dd className="text-right font-medium text-[var(--color-text-primary)]">
                      {selectedBooking.dropoffLocation}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <dt className="text-[var(--color-text-tertiary)]">Start</dt>
                  <dd className="text-right font-medium text-[var(--color-text-primary)]">
                    {new Date(selectedBooking.startDate).toLocaleString("en-GB")}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-[var(--color-text-tertiary)]">End</dt>
                  <dd className="text-right font-medium text-[var(--color-text-primary)]">
                    {new Date(selectedBooking.endDate).toLocaleString("en-GB")}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-[var(--color-text-tertiary)]">Vehicle</dt>
                  <dd className="text-right">
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {selectedBooking.vehicle?.name ?? "—"}
                    </p>
                    {selectedBooking.vehicle?.licensePlate && (
                      <p className="font-mono text-xs text-[var(--color-text-tertiary)]">
                        {selectedBooking.vehicle.licensePlate}
                      </p>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Payment details */}
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Payment
              </p>
              <dl className="mt-3 divide-y divide-[var(--color-border-default)] text-sm">
                <div className="flex justify-between py-2">
                  <dt className="text-[var(--color-text-tertiary)]">Total</dt>
                  <dd className="font-bold text-[var(--color-text-primary)]">
                    {currencyFormatter.format(selectedBooking.totalAmount)}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-[var(--color-text-tertiary)]">Status</dt>
                  <dd>
                    {selectedBooking.payment ? (
                      <Badge
                        size="sm"
                        variant={PAYMENT_BADGE[selectedBooking.payment.status] ?? "secondary"}
                      >
                        {selectedBooking.payment.status}
                      </Badge>
                    ) : (
                      <span className="text-[var(--color-text-tertiary)]">
                        No payment recorded
                      </span>
                    )}
                  </dd>
                </div>
                {selectedBooking.payment?.amount != null && (
                  <div className="flex justify-between py-2">
                    <dt className="text-[var(--color-text-tertiary)]">Amount paid</dt>
                    <dd className="tabular-nums font-medium text-[var(--color-text-primary)]">
                      {currencyFormatter.format(selectedBooking.payment.amount)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Status management — hidden for terminal bookings */}
            {!isTerminalStatus && validNextStatuses.length > 0 && (
              <div className="rounded-xl border border-[var(--color-border-default)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Update Status
                </p>
                <div className="mt-3 space-y-3">
                  <Select
                    label="Move to"
                    options={validNextStatuses}
                    value={nextStatus}
                    onChange={(v) => setNextStatus(v)}
                  />
                  <Input
                    label="Reason (optional)"
                    placeholder="e.g. Confirmed by admin after verification"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => void handleStatusUpdate()}
                    disabled={isMutating || !nextStatus}
                    isLoading={isMutating}
                  >
                    Update Status
                  </Button>
                </div>
              </div>
            )}

            {/* Cancel & refund — hidden for terminal bookings */}
            {!isTerminalStatus && (
              <div className="rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4">
                <div className="flex items-center gap-2">
                  <Wallet
                    className="h-4 w-4 text-[var(--color-error-text)]"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-error-text)]">
                    Cancel & Refund
                  </p>
                </div>
                <p className="mt-1 text-xs text-[var(--color-error-text)]/80">
                  Cancels the booking and initiates a refund. This action cannot be undone.
                </p>
                <div className="mt-3 space-y-3">
                  <Input
                    label="Refund reason"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                  />
                  <Input
                    label="Refund amount (leave blank for full refund)"
                    type="number"
                    min={0}
                    placeholder="e.g. 5000"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="w-full border-[var(--color-error-border)] text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                    onClick={() => void handleCancelWithRefund()}
                    disabled={isMutating || !refundReason.trim()}
                    isLoading={isMutating}
                  >
                    Cancel Booking & Process Refund
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <Loader2
              className="h-5 w-5 animate-spin text-[var(--color-text-tertiary)]"
              aria-label="Loading booking details"
            />
          </div>
        )}
      </Modal>

      {dialogs}
    </div>
  );
}
