"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  MessageSquare,
  RefreshCw,
  ShieldX,
  Trash2,
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
  StarRating,
  Tabs,
} from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useReviewModeration } from "./hooks/useReviewModeration";

// ── Option lists ─────────────────────────────────────────────────────────────

const moderationStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "HIDDEN", label: "Hidden" },
  { value: "DELETED", label: "Deleted" },
];

const resolveStatusOptions = [
  { value: "RESOLVED", label: "Resolved — content is acceptable" },
  { value: "DISMISSED", label: "Dismissed — report is unfounded" },
];

const perPageOptions = [
  { value: "10", label: "10 rows" },
  { value: "20", label: "20 rows" },
  { value: "50", label: "50 rows" },
];

// ── Quick-filter pills ────────────────────────────────────────────────────────

const SCOPE_FILTERS = [
  {
    label: "Flagged Only",
    value: true,
    icon: <Flag className="h-4 w-4" aria-hidden="true" />,
  },
  {
    label: "All Reviews",
    value: false,
    icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const moderationVariant = (status: string) => {
  if (status === "ACTIVE") return "success" as const;
  if (status === "HIDDEN") return "warning" as const;
  if (status === "DELETED") return "danger" as const;
  return "secondary" as const;
};

const truncate = (value: string | null, max = 100) => {
  if (!value) return "No comment";
  return value.length <= max ? value : `${value.slice(0, max)}…`;
};

const getHistoryMessage = (
  changes: Record<string, unknown> | null,
  fallback: string,
) => {
  if (!changes) return fallback;
  const candidate = changes.message;
  if (typeof candidate === "string" && candidate.trim().length > 0)
    return candidate;
  return fallback;
};

// ── Resolve modal state ──────────────────────────────────────────────────────

interface ResolveModalState {
  reviewId: string;
  status: "RESOLVED" | "DISMISSED";
  note: string;
  error: string | null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReviewModerationPage() {
  const { prompt, confirm, dialogs } = useDialogPrompts();

  const {
    isLoading,
    isMutating,
    error,
    filters,
    queueData,
    selectedReview,
    setFilters,
    loadReviewDetails,
    updateModerationStatus,
    resolveReport,
    refetch,
  } = useReviewModeration();

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [resolveModal, setResolveModal] = useState<ResolveModalState | null>(
    null,
  );

  const reviews = queueData?.reviews ?? [];
  const canGoPrev = (queueData?.page ?? 1) > 1;
  const canGoNext = queueData ? queueData.page < queueData.totalPages : false;

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleView = async (reviewId: string) => {
    await loadReviewDetails(reviewId);
    setIsDetailOpen(true);
  };

  const closeDetail = () => setIsDetailOpen(false);

  const handleActivate = async (reviewId: string) => {
    await updateModerationStatus(reviewId, "ACTIVE");
  };

  const handleHide = async (reviewId: string) => {
    const reason = await prompt({
      title: "Hide Review",
      message: "Provide a reason for hiding this review (minimum 3 characters).",
      placeholder: "e.g. Contains inappropriate language",
      defaultValue: "Pending moderator review.",
      minLength: 3,
      confirmText: "Hide",
    });
    if (!reason || reason.trim().length < 3) return;
    await updateModerationStatus(reviewId, "HIDDEN", reason.trim());
  };

  const handleDelete = async (reviewId: string) => {
    const approved = await confirm({
      title: "Delete Review",
      message:
        "This will permanently hide the review from public view. You will be asked for a reason next.",
      confirmText: "Continue",
      variant: "danger",
    });
    if (!approved) return;
    const reason = await prompt({
      title: "Deletion Reason",
      message: "Enter a reason for deletion (minimum 3 characters).",
      defaultValue: "Review violates content policy.",
      minLength: 3,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!reason || reason.trim().length < 3) return;
    await updateModerationStatus(reviewId, "DELETED", reason.trim());
  };

  const openResolveModal = (reviewId: string) => {
    setResolveModal({
      reviewId,
      status: "RESOLVED",
      note: "Reviewed and resolved by moderation team.",
      error: null,
    });
  };

  const submitResolveModal = async () => {
    if (!resolveModal) return;
    if (resolveModal.note.trim().length < 3) {
      setResolveModal((prev) =>
        prev
          ? { ...prev, error: "Resolution note must be at least 3 characters." }
          : prev,
      );
      return;
    }
    await resolveReport(
      resolveModal.reviewId,
      resolveModal.status,
      resolveModal.note.trim(),
    );
    setResolveModal(null);
  };

  // ── Detail modal tab panels ──────────────────────────────────────────────────

  const overviewPanel = selectedReview && (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StarRating rating={selectedReview.rating} size="sm" readOnly />
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {selectedReview.rating}/5
        </span>
        <Badge variant={moderationVariant(selectedReview.moderationStatus)}>
          {selectedReview.moderationStatus}
        </Badge>
        {selectedReview.isFlagged && (
          <Badge variant="warning" size="sm">
            Flagged
          </Badge>
        )}
      </div>

      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Comment
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-primary)]">
          {selectedReview.comment ?? "No comment provided."}
        </p>
        {selectedReview.ownerResponse && (
          <div className="mt-3 border-t border-[var(--color-border-default)] pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Owner response
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {selectedReview.ownerResponse}
            </p>
          </div>
        )}
      </div>

      <dl className="divide-y divide-[var(--color-border-default)] text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Customer</dt>
          <dd className="text-right">
            <p className="font-medium text-[var(--color-text-primary)]">
              {selectedReview.customer.firstName} {selectedReview.customer.lastName}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {selectedReview.customer.email}
            </p>
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Vehicle</dt>
          <dd className="text-right">
            <p className="font-medium text-[var(--color-text-primary)]">
              {selectedReview.vehicle.name}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {selectedReview.vehicle.licensePlate}
            </p>
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Vehicle owner</dt>
          <dd className="text-right">
            <p className="font-medium text-[var(--color-text-primary)]">
              {selectedReview.vehicle.owner.firstName}{" "}
              {selectedReview.vehicle.owner.lastName}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {selectedReview.vehicle.owner.email}
            </p>
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Reviewed on</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {new Date(selectedReview.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Keyword flag</dt>
          <dd>
            <Badge
              variant={selectedReview.flaggedByKeyword ? "warning" : "secondary"}
              size="sm"
            >
              {selectedReview.flaggedByKeyword ? "Yes" : "No"}
            </Badge>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 pt-2">
        {selectedReview.moderationStatus !== "ACTIVE" && (
          <Button
            size="sm"
            onClick={() => void handleActivate(selectedReview.id)}
            disabled={isMutating}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Activate
          </Button>
        )}
        {selectedReview.moderationStatus !== "HIDDEN" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleHide(selectedReview.id)}
            disabled={isMutating}
          >
            <ShieldX className="h-4 w-4" aria-hidden="true" />
            Hide
          </Button>
        )}
        {selectedReview.moderationStatus !== "DELETED" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleDelete(selectedReview.id)}
            disabled={isMutating}
            className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => openResolveModal(selectedReview.id)}
          disabled={isMutating}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Resolve Report
        </Button>
      </div>
    </div>
  );

  const tripContextPanel = selectedReview && (
    <div className="space-y-3">
      <dl className="overflow-hidden rounded-xl border border-[var(--color-border-default)] text-sm">
        <div className="flex justify-between bg-[var(--color-bg-surface)] px-4 py-3">
          <dt className="text-[var(--color-text-tertiary)]">Booking ID</dt>
          <dd className="font-mono text-xs font-medium text-[var(--color-text-primary)]">
            {selectedReview.booking.id.slice(0, 12)}…
          </dd>
        </div>
        <div className="flex justify-between border-t border-[var(--color-border-default)] px-4 py-3">
          <dt className="text-[var(--color-text-tertiary)]">Travel dates</dt>
          <dd className="text-right font-medium text-[var(--color-text-primary)]">
            {new Date(selectedReview.booking.startDate).toLocaleDateString(
              "en-GB",
            )}{" "}
            –{" "}
            {new Date(selectedReview.booking.endDate).toLocaleDateString("en-GB")}
          </dd>
        </div>
        {selectedReview.booking.pickupLocation && (
          <div className="flex justify-between border-t border-[var(--color-border-default)] px-4 py-3">
            <dt className="text-[var(--color-text-tertiary)]">Pick-up</dt>
            <dd className="max-w-[220px] text-right font-medium text-[var(--color-text-primary)]">
              {selectedReview.booking.pickupLocation}
            </dd>
          </div>
        )}
        {selectedReview.booking.dropoffLocation && (
          <div className="flex justify-between border-t border-[var(--color-border-default)] px-4 py-3">
            <dt className="text-[var(--color-text-tertiary)]">Drop-off</dt>
            <dd className="max-w-[220px] text-right font-medium text-[var(--color-text-primary)]">
              {selectedReview.booking.dropoffLocation}
            </dd>
          </div>
        )}
        {selectedReview.booking.totalAmount !== undefined && (
          <div className="flex justify-between border-t border-[var(--color-border-default)] px-4 py-3">
            <dt className="text-[var(--color-text-tertiary)]">Booking value</dt>
            <dd className="font-medium tabular-nums text-[var(--color-text-primary)]">
              LKR {selectedReview.booking.totalAmount.toLocaleString()}
            </dd>
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--color-border-default)] px-4 py-3">
          <dt className="text-[var(--color-text-tertiary)]">Booking status</dt>
          <dd>
            <Badge variant="secondary">{selectedReview.booking.status}</Badge>
          </dd>
        </div>
      </dl>
    </div>
  );

  const historyPanel = selectedReview && (
    <div className="space-y-2">
      {selectedReview.moderationHistory.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No history"
          description="No moderation actions have been recorded for this review yet."
        />
      ) : (
        <ul role="list" className="space-y-2">
          {selectedReview.moderationHistory.slice(0, 10).map((log) => (
            <li
              key={log.id}
              className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {log.action}
                </p>
                <span className="whitespace-nowrap text-xs text-[var(--color-text-tertiary)]">
                  {new Date(log.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {getHistoryMessage(log.changes, log.entityType)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const detailTabs = [
    {
      id: "overview",
      label: "Overview",
      icon: <Eye className="h-4 w-4" aria-hidden="true" />,
      content: overviewPanel,
    },
    {
      id: "trip",
      label: "Trip Context",
      icon: <Clock className="h-4 w-4" aria-hidden="true" />,
      content: tripContextPanel,
    },
    {
      id: "history",
      label: "History",
      icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
      badge: selectedReview?.moderationHistory?.length ?? undefined,
      content: historyPanel,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Review Moderation
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Review flagged content, manage visibility, and resolve reports.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading || isMutating}
          aria-label="Refresh moderation queue"
        >
          <RefreshCw
            className={cn("h-4 w-4", isLoading && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* Queue scope pills */}
      <div className="grid grid-cols-2 gap-3 max-w-sm">
        {SCOPE_FILTERS.map((sf) => {
          const isActive = filters.flaggedOnly === sf.value;
          return (
            <button
              key={String(sf.value)}
              type="button"
              onClick={() => setFilters({ flaggedOnly: sf.value })}
              aria-pressed={isActive}
              className={cn(
                "rounded-[20px] border p-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2",
                isActive
                  ? "border-[var(--color-action-primary)] bg-primary/5"
                  : "border-[var(--color-border-default)] bg-white hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)]",
              )}
            >
              <span
                className={
                  isActive
                    ? "text-[var(--color-action-primary)]"
                    : "text-[var(--color-text-tertiary)]"
                }
              >
                {sf.icon}
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {sf.label}
              </p>
              {isActive && queueData && (
                <p className="mt-0.5 text-xl font-bold text-[var(--color-action-primary)]">
                  {queueData.total.toLocaleString()}
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
              label="Search reviews"
              placeholder="Comment, customer, vehicle or licence plate"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-[180px]">
            <Select
              label="Moderation status"
              options={moderationStatusOptions}
              value={filters.status ?? ""}
              onChange={(value) =>
                setFilters({
                  status: (value || undefined) as
                    | "ACTIVE"
                    | "HIDDEN"
                    | "DELETED"
                    | undefined,
                })
              }
            />
          </div>
          <div className="w-full sm:w-[130px]">
            <Select
              label="Per page"
              options={perPageOptions}
              value={String(filters.limit ?? 20)}
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
          <p className="text-sm font-semibold text-[var(--color-error-text)]">
            Could not load the moderation queue.
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
            {error} — Try refreshing the page.
          </p>
        </div>
      )}

      {/* Reviews table */}
      <Card className="overflow-hidden bg-[var(--color-bg-base)] p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Moderation queue
          </h2>
          {queueData && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {(queueData.page - 1) * queueData.limit + 1}–
              {Math.min(queueData.total, queueData.page * queueData.limit)} of{" "}
              {queueData.total.toLocaleString()}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 pb-6">
            <SkeletonTable rows={filters.limit ?? 20} cols={5} />
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No reviews found"
            description="Try adjusting your search terms or switching to all reviews."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] table-auto text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Rating &amp; Comment
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
                    className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {reviews.map((review) => (
                  <tr
                    key={review.id}
                    className="transition-colors hover:bg-[var(--color-bg-surface)]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StarRating rating={review.rating} size="sm" readOnly />
                        {review.isFlagged && (
                          <Badge size="sm" variant="warning">
                            Flagged
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 max-w-[280px] text-xs text-[var(--color-text-secondary)]">
                        {truncate(review.comment)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        {new Date(review.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {review.customer.firstName} {review.customer.lastName}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {review.customer.email}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {review.vehicle.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {review.vehicle.licensePlate}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={moderationVariant(review.moderationStatus)}
                        dot
                      >
                        {review.moderationStatus}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleView(review.id)}
                          disabled={isMutating}
                          aria-label={`View moderation details for review by ${review.customer.firstName} ${review.customer.lastName}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {review.moderationStatus !== "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleActivate(review.id)}
                            disabled={isMutating}
                            aria-label="Activate review"
                          >
                            <CheckCircle2
                              className="h-4 w-4 text-[var(--color-success-text)]"
                              aria-hidden="true"
                            />
                          </Button>
                        )}
                        {review.moderationStatus !== "HIDDEN" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleHide(review.id)}
                            disabled={isMutating}
                            aria-label="Hide review"
                          >
                            <ShieldX
                              className="h-4 w-4 text-[var(--color-text-secondary)]"
                              aria-hidden="true"
                            />
                          </Button>
                        )}
                        {review.moderationStatus !== "DELETED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDelete(review.id)}
                            disabled={isMutating}
                            aria-label="Delete review"
                            className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openResolveModal(review.id)}
                          disabled={isMutating}
                          aria-label="Resolve flagged report"
                        >
                          <AlertTriangle
                            className="h-4 w-4 text-[var(--color-text-secondary)]"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination — shown only when there is more than one page */}
        {queueData && queueData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isMutating}
              onClick={() => setFilters({ page: (queueData.page ?? 1) - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page {queueData.page} of {queueData.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={!canGoNext || isMutating}
              onClick={() => setFilters({ page: (queueData.page ?? 1) + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Review detail modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetail}
        title={
          selectedReview
            ? `Review by ${selectedReview.customer.firstName} ${selectedReview.customer.lastName}`
            : "Review Details"
        }
        size="full"
      >
        {selectedReview ? (
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
            Loading review details…
          </div>
        )}
      </Modal>

      {/* ── Resolve Report modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(resolveModal)}
        onClose={() => setResolveModal(null)}
        title="Resolve Report"
        size="sm"
      >
        {resolveModal && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Mark this review&apos;s report as resolved or dismissed and record
              a resolution note for the audit trail.
            </p>
            <Select
              label="Resolution status"
              options={resolveStatusOptions}
              value={resolveModal.status}
              onChange={(v) =>
                setResolveModal((prev) =>
                  prev
                    ? {
                        ...prev,
                        status: v as "RESOLVED" | "DISMISSED",
                        error: null,
                      }
                    : prev,
                )
              }
            />
            <Input
              label="Resolution note"
              placeholder="e.g. Reviewed content — no violations found"
              value={resolveModal.note}
              onChange={(e) =>
                setResolveModal((prev) =>
                  prev ? { ...prev, note: e.target.value, error: null } : prev,
                )
              }
            />
            {resolveModal.error && (
              <p
                role="alert"
                className="text-sm text-[var(--color-error-text)]"
              >
                {resolveModal.error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setResolveModal(null)}>
                Cancel
              </Button>
              <Button
                isLoading={isMutating}
                disabled={isMutating}
                onClick={() => void submitResolveModal()}
              >
                Apply Resolution
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {dialogs}
    </div>
  );
}
