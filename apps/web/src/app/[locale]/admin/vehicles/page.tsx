"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BookOpen,
  Car,
  CheckCircle,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Star,
  Truck,
  UserCog,
  Users,
  FileCheck,
  RotateCcw,
} from "lucide-react";
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
  Tabs,
} from "@/components/ui";
import {
  adminService,
  reviewService,
  type AdminBookingRecord,
  type AdminVehicleDocument,
  type AdminVehicleRecord,
} from "@/lib/api";
import { useDialogPrompts } from "@/hooks";
import { useVehicleFilters } from "./hooks/useVehicleFilters";

// ─── Option lists ──────────────────────────────────────────────────────────────

const typeOptions = [
  { value: "", label: "All types" },
  { value: "ORDINARY", label: "Ordinary" },
  { value: "SEMI_LUXURY", label: "Semi Luxury" },
  { value: "LUXURY_AC", label: "Luxury AC" },
];

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "true", label: "Active" },
  { value: "false", label: "Suspended" },
];

const rowsPerPageOptions = [
  { value: "10", label: "10 rows" },
  { value: "25", label: "25 rows" },
  { value: "50", label: "50 rows" },
  { value: "100", label: "100 rows" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  ORDINARY: "Ordinary",
  SEMI_LUXURY: "Semi Luxury",
  LUXURY_AC: "Luxury AC",
};

const BOOKING_BADGE: Record<string, "success" | "danger" | "warning" | "info" | "secondary"> = {
  CONFIRMED: "success",
  COMPLETED: "success",
  ONGOING: "info",
  PENDING: "warning",
  CANCELLED: "danger",
};

const DOC_STATUS_BADGE: Record<string, "success" | "danger" | "warning" | "secondary"> = {
  APPROVED: "success",
  REJECTED: "danger",
  PENDING: "warning",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  DRIVING_LICENSE: "Driving License",
  INSURANCE: "Insurance",
  REGISTRATION_CERTIFICATE: "Registration Certificate",
};

const QUICK_FILTERS = [
  {
    label: "All Vehicles",
    value: undefined as boolean | undefined,
    icon: <Truck className="h-4 w-4" />,
  },
  {
    label: "Active",
    value: true,
    icon: <CheckCircle className="h-4 w-4" />,
  },
  {
    label: "Suspended",
    value: false,
    icon: <ShieldAlert className="h-4 w-4" />,
  },
];

function ownerInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-[var(--color-border-default)]"
          }`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-xs font-medium text-[var(--color-text-secondary)]">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminVehiclesPage() {
  const { locale } = useParams<{ locale: string }>();
  const { confirm, prompt, dialogs } = useDialogPrompts();

  const {
    isLoading,
    isMutating,
    error,
    vehiclesData,
    filters,
    selectedVehicle,
    setFilters,
    selectVehicle,
    clearSelectedVehicle,
    suspendVehicle,
    activateVehicle,
    refetch,
  } = useVehicleFilters();

  // ── Lazy-loaded detail sub-sections ─────────────────────────────────────────

  const [vehicleBookings, setVehicleBookings] = useState<AdminBookingRecord[] | null>(null);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [vehicleReviews, setVehicleReviews] = useState<
    Array<{
      id: string;
      rating: number;
      title: string | null;
      comment: string | null;
      customerName: string;
      customerAvatar: string | null;
      createdAt: string;
    }> | null
  >(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [vehicleDocuments, setVehicleDocuments] = useState<AdminVehicleDocument[] | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const vehicles = vehiclesData?.vehicles ?? [];

  const canGoPrev = (vehiclesData?.pagination.page ?? 1) > 1;
  const canGoNext = vehiclesData
    ? vehiclesData.pagination.page < vehiclesData.pagination.totalPages
    : false;

  const totalSummary = useMemo(() => {
    if (!vehiclesData) return "";
    const { page, limit, total } = vehiclesData.pagination;
    const start = (page - 1) * limit + 1;
    const end = Math.min(total, page * limit);
    return `${start}–${end} of ${total.toLocaleString()}`;
  }, [vehiclesData]);

  // ── Modal open / close ───────────────────────────────────────────────────────

  const handleSelectVehicle = (vehicle: AdminVehicleRecord) => {
    setVehicleBookings(null);
    setVehicleReviews(null);
    setVehicleDocuments(null);
    selectVehicle(vehicle);
  };

  const handleCloseModal = () => {
    clearSelectedVehicle();
    setVehicleBookings(null);
    setVehicleReviews(null);
    setVehicleDocuments(null);
  };

  // ── Lazy loaders ─────────────────────────────────────────────────────────────

  const loadVehicleBookings = async (licensePlate: string) => {
    setIsLoadingBookings(true);
    try {
      const data = await adminService.getBookings({ search: licensePlate, limit: 20 });
      setVehicleBookings(data.bookings);
    } catch {
      setVehicleBookings([]);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const loadVehicleReviews = async (vehicleId: string) => {
    setIsLoadingReviews(true);
    try {
      const data = await reviewService.getByVehicle(vehicleId, { limit: 20 });
      setVehicleReviews(data.reviews);
    } catch {
      setVehicleReviews([]);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const loadVehicleDocuments = async (vehicleId: string) => {
    setIsLoadingDocuments(true);
    try {
      const data = await adminService.getVehicleVerificationById(vehicleId);
      setVehicleDocuments(data.documents);
    } catch {
      setVehicleDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleSuspend = async (vehicle: AdminVehicleRecord) => {
    const reason = await prompt({
      title: "Suspend Vehicle",
      message: `A reason is required. "${vehicle.name}" (${vehicle.licensePlate}) will be immediately removed from the marketplace.`,
      placeholder: "e.g. Failed inspection, documents expired",
      confirmText: "Suspend",
      minLength: 1,
      variant: "danger",
    });
    if (reason) {
      await suspendVehicle(vehicle.id);
    }
  };

  const handleActivate = async (vehicle: AdminVehicleRecord) => {
    const approved = await confirm({
      title: "Reactivate Vehicle",
      message: `"${vehicle.name}" (${vehicle.licensePlate}) will be listed on the marketplace again. Confirm reactivation?`,
      confirmText: "Reactivate",
      variant: "info",
    });
    if (approved) {
      await activateVehicle(vehicle.id);
    }
  };

  // ── Detail tab panels ────────────────────────────────────────────────────────

  const overviewPanel = selectedVehicle && (() => {
    const primaryPhoto = selectedVehicle.photos?.[0]?.url;
    return (
      <div className="space-y-5">
        {/* Photo + identity */}
        <div className="flex gap-4">
          {primaryPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryPhoto}
              alt={selectedVehicle.name}
              className="h-24 w-40 flex-shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-24 w-40 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
              <Car className="h-8 w-8 text-[var(--color-text-tertiary)]" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-[var(--color-text-primary)]">
              {selectedVehicle.name}
            </p>
            <p className="font-mono text-sm text-[var(--color-text-secondary)]">
              {selectedVehicle.licensePlate}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{TYPE_LABEL[selectedVehicle.type] ?? selectedVehicle.type}</Badge>
              <Badge variant={selectedVehicle.isActive ? "success" : "danger"} dot>
                {selectedVehicle.isActive ? "Active" : "Suspended"}
              </Badge>
              {!selectedVehicle.isAvailable && (
                <Badge variant="warning" dot>Unavailable</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{selectedVehicle._count.bookings}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Bookings</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{selectedVehicle._count.reviews}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Reviews</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{selectedVehicle.seats}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Seats</p>
          </div>
        </div>

        {/* Vehicle details */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Vehicle Details
          </h3>
          <dl className="divide-y divide-[var(--color-border-default)] rounded-xl border border-[var(--color-border-default)] text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-[var(--color-text-tertiary)]">Make / Model</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.year})
              </dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-[var(--color-text-tertiary)]">AC type</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">{selectedVehicle.acType ?? "—"}</dd>
            </div>
            {selectedVehicle.color && (
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-[var(--color-text-tertiary)]">Color</dt>
                <dd className="font-medium text-[var(--color-text-primary)]">{selectedVehicle.color}</dd>
              </div>
            )}
            {selectedVehicle.condition && (
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-[var(--color-text-tertiary)]">Condition</dt>
                <dd className="font-medium text-[var(--color-text-primary)]">
                  {selectedVehicle.condition.charAt(0).toUpperCase() + selectedVehicle.condition.slice(1)}
                </dd>
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-[var(--color-text-tertiary)]">Location</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">{selectedVehicle.location}</dd>
            </div>
          </dl>
        </div>

        {/* Pricing */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Pricing
          </h3>
          <dl className="divide-y divide-[var(--color-border-default)] rounded-xl border border-[var(--color-border-default)] text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-[var(--color-text-tertiary)]">Per day</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                LKR {selectedVehicle.pricePerDay.toLocaleString()}
              </dd>
            </div>
            {selectedVehicle.pricePerKm !== null && (
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-[var(--color-text-tertiary)]">Per km</dt>
                <dd className="font-medium text-[var(--color-text-primary)]">
                  LKR {selectedVehicle.pricePerKm.toLocaleString()}
                </dd>
              </div>
            )}
            {selectedVehicle.driverAllowance !== null && (
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-[var(--color-text-tertiary)]">Driver allowance / day</dt>
                <dd className="font-medium text-[var(--color-text-primary)]">
                  LKR {selectedVehicle.driverAllowance.toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Owner */}
        {selectedVehicle.owner && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Owner
            </h3>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border-default)] px-4 py-3">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-[var(--color-action-primary)]"
              >
                {ownerInitials(selectedVehicle.owner.firstName, selectedVehicle.owner.lastName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--color-text-primary)]">
                  {selectedVehicle.owner.firstName} {selectedVehicle.owner.lastName}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">{selectedVehicle.owner.email}</p>
              </div>
              <Link
                href={`/${locale}/admin/users?search=${encodeURIComponent(selectedVehicle.owner.email)}`}
                className="text-xs text-[var(--color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-action-focus)] rounded"
                target="_blank"
                rel="noopener noreferrer"
              >
                View user
              </Link>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {selectedVehicle.isActive ? (
            <Button size="sm" variant="outline" onClick={() => void handleSuspend(selectedVehicle)} disabled={isMutating}>
              <ShieldAlert className="h-4 w-4" />
              Suspend Vehicle
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => void handleActivate(selectedVehicle)} disabled={isMutating}>
                <RotateCcw className="h-4 w-4" />
                Reactivate Vehicle
              </Button>
              <Link
                href={`/${locale}/admin/verifications/vehicles?search=${encodeURIComponent(selectedVehicle.licensePlate)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
              >
                <FileCheck className="h-4 w-4" aria-hidden="true" />
                View Verification
              </Link>
            </>
          )}
        </div>
      </div>
    );
  })();

  const bookingsPanel = selectedVehicle && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Bookings made on this vehicle.
        </p>
        <Link
          href={`/${locale}/admin/bookings?search=${encodeURIComponent(selectedVehicle.licensePlate)}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-action-primary)] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          View all bookings <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {vehicleBookings === null ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-10">
          <BookOpen className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Click below to fetch bookings for this vehicle.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadVehicleBookings(selectedVehicle.licensePlate)}
            disabled={isLoadingBookings}
          >
            {isLoadingBookings ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Load Bookings
          </Button>
        </div>
      ) : isLoadingBookings ? (
        <SkeletonTable rows={4} cols={4} />
      ) : vehicleBookings.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No bookings found"
          description="This vehicle has no bookings yet."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Route</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Customer</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Amount</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-default)]">
              {vehicleBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-[var(--color-bg-surface)]">
                  <td className="px-4 py-3">
                    <p className="max-w-[180px] truncate font-medium text-[var(--color-text-primary)]">
                      {booking.pickupLocation}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {new Date(booking.startDate).toLocaleDateString("en-GB")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {booking.customer
                      ? `${booking.customer.firstName} ${booking.customer.lastName}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={BOOKING_BADGE[booking.status] ?? "secondary"} dot>
                      {booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">
                    LKR {booking.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/bookings?search=${encodeURIComponent(booking.id)}`}
                      className="inline-flex items-center text-[var(--color-action-primary)] hover:underline text-xs"
                      aria-label={`Open booking ${booking.id} in admin bookings page`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const reviewsPanel = selectedVehicle && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Customer reviews submitted for this vehicle.
        </p>
        <Link
          href={`/${locale}/admin/reviews/moderation?search=${encodeURIComponent(selectedVehicle.name)}&flaggedOnly=false`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-action-primary)] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          View in moderation <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {vehicleReviews === null ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-10">
          <Star className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Click below to fetch reviews for this vehicle.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadVehicleReviews(selectedVehicle.id)}
            disabled={isLoadingReviews}
          >
            {isLoadingReviews ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            Load Reviews
          </Button>
        </div>
      ) : isLoadingReviews ? (
        <SkeletonTable rows={3} cols={3} />
      ) : vehicleReviews.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No reviews found"
          description="This vehicle has not received any reviews yet."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border-default)] overflow-hidden rounded-xl border border-[var(--color-border-default)]">
          {vehicleReviews.map((review) => (
            <li key={review.id} className="px-4 py-4 hover:bg-[var(--color-bg-surface)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StarRating rating={review.rating} />
                    {review.title && (
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {review.title}
                      </span>
                    )}
                  </div>
                  {review.comment && (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)] line-clamp-3">
                      {review.comment}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
                    {review.customerName} ·{" "}
                    {new Date(review.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Link
                  href={`/${locale}/admin/reviews/moderation?search=${encodeURIComponent(review.customerName)}&flaggedOnly=false`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${review.customerName}'s review in moderation`}
                  className="mt-0.5 flex-shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-action-primary)] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const documentsPanel = selectedVehicle && (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Vehicle verification documents and their current approval status.
      </p>

      {vehicleDocuments === null ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-10">
          <FileText className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Click below to fetch verification documents for this vehicle.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadVehicleDocuments(selectedVehicle.id)}
            disabled={isLoadingDocuments}
          >
            {isLoadingDocuments ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Load Documents
          </Button>
        </div>
      ) : isLoadingDocuments ? (
        <SkeletonTable rows={3} cols={4} />
      ) : vehicleDocuments.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No documents found"
          description="No verification documents have been submitted for this vehicle."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Document</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Uploaded</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-default)]">
              {vehicleDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-[var(--color-bg-surface)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {DOC_TYPE_LABEL[doc.type] ?? doc.type}
                    </p>
                    {doc.rejectionReason && (
                      <p className="mt-0.5 text-xs text-[var(--color-error-text)]">
                        {doc.rejectionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={DOC_STATUS_BADGE[doc.status] ?? "secondary"}
                      dot
                    >
                      {doc.status.charAt(0) + doc.status.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {new Date(doc.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${doc.fileName} in a new tab`}
                        className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-[var(--color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-text-tertiary)]">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const detailTabs = selectedVehicle
    ? [
        {
          id: "overview",
          label: "Overview",
          icon: <UserCog className="h-4 w-4" />,
          content: overviewPanel,
        },
        {
          id: "bookings",
          label: "Bookings",
          icon: <BookOpen className="h-4 w-4" />,
          badge: selectedVehicle._count.bookings || undefined,
          content: bookingsPanel,
        },
        {
          id: "reviews",
          label: "Reviews",
          icon: <Star className="h-4 w-4" />,
          badge: selectedVehicle._count.reviews || undefined,
          content: reviewsPanel,
        },
        {
          id: "documents",
          label: "Documents",
          icon: <FileText className="h-4 w-4" />,
          content: documentsPanel,
        },
      ]
    : [];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Vehicle Management
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            View all registered vehicles, inspect details, and suspend listings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading || isMutating}
            aria-label="Refresh vehicle list"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick-filter pills */}
      <div className="grid grid-cols-3 gap-3">
        {QUICK_FILTERS.map((qf) => {
          const isSelected = filters.isActive === qf.value;
          return (
            <button
              key={qf.label}
              type="button"
              onClick={() => setFilters({ isActive: qf.value })}
              className={[
                "rounded-[20px] border p-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2",
                isSelected
                  ? "border-[var(--color-action-primary)] bg-primary/5"
                  : "border-[var(--color-border-default)] bg-white hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)]",
              ].join(" ")}
            >
              <span className={isSelected ? "text-[var(--color-action-primary)]" : "text-[var(--color-text-tertiary)]"}>
                {qf.icon}
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{qf.label}</p>
              {isSelected && vehiclesData && (
                <p className="mt-0.5 text-xl font-bold text-[var(--color-action-primary)]">
                  {vehiclesData.pagination.total.toLocaleString()}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card className="bg-background">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search vehicles"
              placeholder="Name, plate, location, or owner"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-[170px]">
            <Select
              label="Type"
              options={typeOptions}
              value={filters.type ?? ""}
              onChange={(v) => setFilters({ type: v || undefined })}
            />
          </div>
          <div className="w-full sm:w-[160px]">
            <Select
              label="Status"
              options={statusOptions}
              value={filters.isActive === undefined ? "" : filters.isActive ? "true" : "false"}
              onChange={(v) => setFilters({ isActive: v === "" ? undefined : v === "true" })}
            />
          </div>
          <div className="w-full sm:w-[130px]">
            <Select
              label="Per page"
              options={rowsPerPageOptions}
              value={String(filters.limit ?? 10)}
              onChange={(v) => setFilters({ limit: Number(v), page: 1 })}
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
          <p className="text-sm font-semibold text-[var(--color-error-text)]">Could not load vehicles.</p>
          <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
            {error} — Try refreshing the page or check your connection.
          </p>
        </div>
      )}

      {/* Vehicles table */}
      <Card className="overflow-hidden bg-background p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Vehicles</h2>
          {vehiclesData && (
            <span className="text-sm text-[var(--color-text-secondary)]">{totalSummary}</span>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 pb-6">
            <SkeletonTable rows={filters.limit ?? 10} cols={6} />
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No vehicles found"
            description="Try adjusting your search or removing a filter to see more results."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] table-auto text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Vehicle</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Type</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Seats</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Owner</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Bookings</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Listed</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="transition-colors hover:bg-[var(--color-bg-surface)]">

                    {/* Vehicle identity */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[var(--color-action-primary)]"
                        >
                          <Car className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--color-text-primary)]">{vehicle.name}</p>
                          <p className="font-mono text-xs text-[var(--color-text-tertiary)]">{vehicle.licensePlate}</p>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-4">
                      <Badge variant="secondary">{TYPE_LABEL[vehicle.type] ?? vehicle.type}</Badge>
                    </td>

                    {/* Seats */}
                    <td className="px-4 py-4 tabular-nums text-[var(--color-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                        {vehicle.seats}
                      </span>
                    </td>

                    {/* Owner — links to that owner in admin/users */}
                    <td className="px-4 py-4">
                      {vehicle.owner ? (
                        <Link
                          href={`/${locale}/admin/users?search=${encodeURIComponent(vehicle.owner.email)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
                        >
                          <p className="truncate text-sm text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-action-primary)] group-hover:underline">
                            {vehicle.owner.firstName} {vehicle.owner.lastName}
                          </p>
                          <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                            {vehicle.owner.email}
                          </p>
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <Badge variant={vehicle.isActive ? "success" : "danger"} dot>
                        {vehicle.isActive ? "Active" : "Suspended"}
                      </Badge>
                    </td>

                    {/* Bookings */}
                    <td className="px-4 py-4 tabular-nums text-[var(--color-text-secondary)]">
                      {vehicle._count.bookings}
                    </td>

                    {/* Listed date */}
                    <td className="px-4 py-4 text-[var(--color-text-secondary)]">
                      {new Date(vehicle.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSelectVehicle(vehicle)}
                          disabled={isMutating}
                          aria-label={`View details for ${vehicle.name}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {vehicle.isActive ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleSuspend(vehicle)}
                            disabled={isMutating}
                            aria-label={`Suspend ${vehicle.name}`}
                          >
                            <ShieldAlert className="h-4 w-4 text-[var(--color-text-secondary)]" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleActivate(vehicle)}
                              disabled={isMutating}
                              aria-label={`Reactivate ${vehicle.name}`}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Link
                              href={`/${locale}/admin/verifications/vehicles?search=${encodeURIComponent(vehicle.licensePlate)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View verification for ${vehicle.name}`}
                              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                            >
                              <FileCheck className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {vehiclesData && vehiclesData.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isMutating}
              onClick={() => setFilters({ page: (vehiclesData.pagination.page ?? 1) - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page {vehiclesData.pagination.page} of {vehiclesData.pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={!canGoNext || isMutating}
              onClick={() => setFilters({ page: (vehiclesData.pagination.page ?? 1) + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Vehicle Detail modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedVehicle}
        onClose={handleCloseModal}
        title={selectedVehicle?.name ?? "Vehicle Details"}
        size="full"
      >
        {selectedVehicle ? (
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto">
            <Tabs
              tabs={detailTabs}
              defaultTab="overview"
              variant="default"
              contentClassName="pb-2"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-text-tertiary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading vehicle details…
          </div>
        )}
      </Modal>

      {dialogs}
    </div>
  );
}
