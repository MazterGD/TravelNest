"use client";

import { AlertTriangle, CheckCircle2, Eye, RefreshCw, ShieldX, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select } from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useReviewModeration } from "./hooks/useReviewModeration";

const moderationStatusOptions = [
  { value: "", label: "All moderation statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "HIDDEN", label: "Hidden" },
  { value: "DELETED", label: "Deleted" },
];

const flaggedScopeOptions = [
  { value: "true", label: "Flagged only" },
  { value: "false", label: "All reviews" },
];

const moderationVariant = (status: string) => {
  if (status === "ACTIVE") return "success" as const;
  if (status === "HIDDEN") return "warning" as const;
  if (status === "DELETED") return "danger" as const;
  return "secondary" as const;
};

const ratingVariant = (rating: number) => {
  if (rating >= 4) return "success" as const;
  if (rating <= 2) return "danger" as const;
  return "warning" as const;
};

const truncate = (value: string | null, max = 120) => {
  if (!value) {
    return "No comment";
  }

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}...`;
};

const getHistoryMessage = (changes: Record<string, unknown> | null, fallback: string) => {
  if (!changes) {
    return fallback;
  }

  const candidate = changes.message;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate;
  }

  return fallback;
};

export default function AdminReviewModerationPage() {
  const { prompt, dialogs } = useDialogPrompts();

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

  const reviews = queueData?.reviews || [];
  const canGoPrev = (queueData?.page || 1) > 1;
  const canGoNext = queueData ? queueData.page < queueData.totalPages : false;

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Input
              label="Search reviews"
              placeholder="Comment, customer, owner, vehicle"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div>
            <Select
              label="Moderation status"
              options={moderationStatusOptions}
              value={filters.status || ""}
              onChange={(value) =>
                setFilters({
                  status: (value || undefined) as "ACTIVE" | "HIDDEN" | "DELETED" | undefined,
                })
              }
            />
          </div>
          <div>
            <Select
              label="Queue scope"
              options={flaggedScopeOptions}
              value={String(filters.flaggedOnly ?? true)}
              onChange={(value) =>
                setFilters({
                  flaggedOnly: value === "true",
                })
              }
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="secondary" onClick={() => void refetch()}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          </div>
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
            <h2 className="text-base font-semibold text-foreground">Review moderation queue</h2>
            {queueData && (
              <p className="text-sm text-muted-foreground">
                {(queueData.page - 1) * queueData.limit + 1}-
                {Math.min(queueData.total, queueData.page * queueData.limit)} of {queueData.total}
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No reviews match these filters.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[960px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Review</th>
                    <th className="py-3">Customer</th>
                    <th className="py-3">Vehicle</th>
                    <th className="py-3">Moderation</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review.id} className="border-b border-border/70 align-top">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={ratingVariant(review.rating)}>{review.rating}/5</Badge>
                          {review.isFlagged && (
                            <Badge size="sm" variant="warning">
                              Flagged
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{truncate(review.comment)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">
                          {review.customer.firstName} {review.customer.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{review.customer.email}</p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">{review.vehicle.name}</p>
                        <p className="text-xs text-muted-foreground">{review.vehicle.licensePlate}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant={moderationVariant(review.moderationStatus)}>
                          {review.moderationStatus}
                        </Badge>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Keyword flag: {review.flaggedByKeyword ? "Yes" : "No"}
                        </p>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadReviewDetails(review.id)}
                            disabled={isMutating}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>

                          {review.moderationStatus !== "ACTIVE" && (
                            <Button
                              size="sm"
                              onClick={() => void updateModerationStatus(review.id, "ACTIVE")}
                              disabled={isMutating}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Activate
                            </Button>
                          )}

                          {review.moderationStatus !== "HIDDEN" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void (async () => {
                                  const reason = await prompt({
                                    title: "Hide Review",
                                    message: "Reason for hiding this review (minimum 3 characters)",
                                    defaultValue: "Pending moderator review.",
                                    minLength: 3,
                                    confirmText: "Hide",
                                  });

                                  if (!reason || reason.trim().length < 3) {
                                    return;
                                  }

                                  await updateModerationStatus(review.id, "HIDDEN", reason.trim());
                                })();
                              }}
                              disabled={isMutating}
                            >
                              <ShieldX className="h-4 w-4" />
                              Hide
                            </Button>
                          )}

                          {review.moderationStatus !== "DELETED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void (async () => {
                                  const reason = await prompt({
                                    title: "Delete Review",
                                    message: "Reason for deletion (minimum 3 characters)",
                                    defaultValue: "Review violates content policy.",
                                    minLength: 3,
                                    confirmText: "Delete",
                                  });

                                  if (!reason || reason.trim().length < 3) {
                                    return;
                                  }

                                  await updateModerationStatus(review.id, "DELETED", reason.trim());
                                })();
                              }}
                              disabled={isMutating}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void (async () => {
                                const resolution = await prompt({
                                  title: "Resolve Review Report",
                                  message: "Report resolution note (minimum 3 characters)",
                                  defaultValue:
                                    "Reviewed and resolved by moderation team.",
                                  minLength: 3,
                                  confirmText: "Continue",
                                });

                                if (!resolution || resolution.trim().length < 3) {
                                  return;
                                }

                                const statusInput = await prompt({
                                  title: "Report Resolution Status",
                                  message: "Use RESOLVED or DISMISSED",
                                  defaultValue: "RESOLVED",
                                  confirmText: "Apply",
                                });

                                const normalized = statusInput?.trim().toUpperCase();
                                if (normalized !== "RESOLVED" && normalized !== "DISMISSED") {
                                  return;
                                }

                                await resolveReport(review.id, normalized, resolution.trim());
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Resolve Report
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {queueData && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                disabled={!canGoPrev || isMutating}
                onClick={() => setFilters({ page: (queueData.page || 1) - 1 })}
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {queueData.page} of {queueData.totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={!canGoNext || isMutating}
                onClick={() => setFilters({ page: (queueData.page || 1) + 1 })}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Review details</h3>
          {selectedReview ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={ratingVariant(selectedReview.rating)}>
                    {selectedReview.rating}/5
                  </Badge>
                  <Badge variant={moderationVariant(selectedReview.moderationStatus)}>
                    {selectedReview.moderationStatus}
                  </Badge>
                </div>
                <p className="mt-2 text-foreground">{selectedReview.comment || "No comment"}</p>
                <p className="mt-1 text-muted-foreground">
                  Customer: {selectedReview.customer.firstName} {selectedReview.customer.lastName}
                </p>
                <p className="text-muted-foreground">
                  Vehicle: {selectedReview.vehicle.name} ({selectedReview.vehicle.licensePlate})
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Trip context</p>
                <p className="mt-1 text-foreground">
                  Booking: {selectedReview.booking.id}
                </p>
                <p className="text-muted-foreground">
                  {new Date(selectedReview.booking.startDate).toLocaleDateString()} to {" "}
                  {new Date(selectedReview.booking.endDate).toLocaleDateString()}
                </p>
                <p className="text-muted-foreground">
                  Status: {selectedReview.booking.status}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Moderation history
                </p>
                <div className="mt-2 space-y-2">
                  {selectedReview.moderationHistory.slice(0, 8).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-border bg-muted/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getHistoryMessage(log.changes, log.entityType)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Select a review to inspect moderation context and history.
            </p>
          )}
        </Card>
      </div>

      {dialogs}
    </div>
  );
}
