"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Star,
  MessageSquare,
  ChevronLeft,
  RefreshCcw,
  Send,
  X,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useOwnerGuard } from "@/hooks";
import { ownerService, reviewService } from "@/lib/api/services";
import { ApiError } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────
interface DimensionAverages {
  vehicleCondition: number | null;
  driverBehavior: number | null;
  punctuality: number | null;
  cleanliness: number | null;
  valueForMoney: number | null;
}

interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  pendingResponses: number;
  responseRate: number;
  ratingDistribution: Record<number, number>;
  dimensionAverages: DimensionAverages;
}

interface OwnerReview {
  id: string;
  rating: number;
  dimensions?: {
    vehicleCondition?: number | null;
    driverBehavior?: number | null;
    punctuality?: number | null;
    cleanliness?: number | null;
    valueForMoney?: number | null;
  } | null;
  title?: string | null;
  comment: string | null;
  isRecommended?: boolean | null;
  ownerResponse: string | null;
  createdAt: string;
  tripDate: string;
  customerName: string;
  customerAvatar: string | null;
  vehicleId: string;
  vehicleName: string;
}

type TabId = "all" | "pending" | "responded";

const TABS: Array<{ id: TabId; hasResponse?: boolean }> = [
  { id: "all" },
  { id: "pending",   hasResponse: false },
  { id: "responded", hasResponse: true  },
];

// ── Sub-components ────────────────────────────────────────────
function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? "fill-current text-[var(--color-action-primary)]"
              : "text-[var(--color-border-default)]"
          }`}
        />
      ))}
    </div>
  );
}

function DimensionBar({
  value,
  label,
}: {
  value: number | null | undefined;
  label: string;
}) {
  if (value === null || value === undefined) return null;
  const pct = Math.round((value / 5) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 flex-shrink-0 text-xs text-[var(--color-text-secondary)]">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
        <div
          className="h-full rounded-full bg-[var(--color-action-primary)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 flex-shrink-0 text-right text-xs font-medium text-[var(--color-text-primary)]">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function OwnerReviewsPage() {
  const t      = useTranslations("ownerReviews");
  const tReview = useTranslations("review");
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();
  const vehicleIdFilter = searchParams?.get("vehicleId") ?? null;
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [activeTab,     setActiveTab]     = useState<TabId>("all");
  const [summary,       setSummary]       = useState<ReviewSummary | null>(null);
  const [reviews,       setReviews]       = useState<OwnerReview[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [respondingTo,  setRespondingTo]  = useState<string | null>(null);
  const [responseText,  setResponseText]  = useState("");
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [respondError,  setRespondError]  = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dimLabels: Record<keyof DimensionAverages, string> = {
    vehicleCondition: tReview("dimVehicleCondition"),
    driverBehavior:   tReview("dimDriverBehavior"),
    punctuality:      tReview("dimPunctuality"),
    cleanliness:      tReview("dimCleanliness"),
    valueForMoney:    tReview("dimValueForMoney"),
  };

  const loadData = useCallback(
    async (tab: TabId) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const tabConfig   = TABS.find((t) => t.id === tab);
        const reviewParams =
          tabConfig && tabConfig.hasResponse !== undefined
            ? { hasResponse: tabConfig.hasResponse }
            : undefined;

        const [summaryData, reviewsData] = await Promise.all([
          ownerService.getReviewSummary(),
          ownerService.getReviews(reviewParams),
        ]);
        setSummary(summaryData as unknown as ReviewSummary);
        setReviews((reviewsData.reviews as unknown as OwnerReview[]) ?? []);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 429) setLoadError(t("error.loadFailedRateLimited"));
          else if (err.status === 401 || err.status === 403) setLoadError(t("error.loadFailedUnauthorized"));
          else if (err.status === 0 || err.code === "NETWORK_ERROR") setLoadError(t("error.loadFailedNetwork"));
          else if (err.status >= 500) setLoadError(t("error.loadFailedServer"));
          else setLoadError(err.message || t("error.loadFailed"));
        } else {
          setLoadError(t("error.loadFailed"));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (isAuthorized) loadData(activeTab);
  }, [isAuthorized, activeTab, loadData]);

  useEffect(() => {
    if (respondingTo && textareaRef.current) textareaRef.current.focus();
  }, [respondingTo]);

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim()) return;
    setIsSubmitting(true);
    setRespondError(null);
    try {
      await reviewService.respond(reviewId, responseText.trim());
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, ownerResponse: responseText.trim() } : r,
        ),
      );
      if (summary) {
        const newPending   = Math.max(0, summary.pendingResponses - 1);
        const newResponded = summary.totalReviews - newPending;
        setSummary({
          ...summary,
          pendingResponses: newPending,
          responseRate:
            summary.totalReviews > 0
              ? Math.round((newResponded / summary.totalReviews) * 100)
              : 0,
        });
      }
      setRespondingTo(null);
      setResponseText("");
    } catch (err) {
      setRespondError(
        err instanceof ApiError ? err.message : t("error.respondFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRespond = () => {
    setRespondingTo(null);
    setResponseText("");
    setRespondError(null);
  };

  if (guardLoading || !isAuthorized) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  const distEntries = summary
    ? [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: summary.ratingDistribution[star] ?? 0,
      }))
    : [];
  const maxDist = Math.max(...distEntries.map((e) => e.count), 1);

  // Filter by vehicleId when navigating from the fleet detail page
  const displayedReviews = vehicleIdFilter
    ? reviews.filter((r) => r.vehicleId === vehicleIdFilter)
    : reviews;
  const vehicleNameFilter = vehicleIdFilter
    ? (displayedReviews[0]?.vehicleName ?? null)
    : null;

  const hasDimAvg =
    summary?.dimensionAverages &&
    Object.values(summary.dimensionAverages).some((v) => v !== null);

  return (
      <div className="min-h-screen bg-[var(--color-bg-surface)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-xl text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("backToDashboard")}
            </Link>
            <h1 className="text-heading-lg font-bold text-[var(--color-text-primary)]">
              {t("title")}
            </h1>
            <p className="mt-1 text-body text-[var(--color-text-secondary)]">
              {t("subtitle")}
            </p>
          </div>

          {/* Error banner */}
          {loadError && !isLoading && (
            <div className="mb-6 flex items-center justify-between rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-text)]">
              <span>{loadError}</span>
              <button
                onClick={() => loadData(activeTab)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--color-error-border)] px-3 text-sm font-medium transition-colors hover:bg-[var(--color-error-bg)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {t("error.tryAgain")}
              </button>
            </div>
          )}

          {/* Summary metric cards */}
          {summary && !isLoading && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Average Rating */}
              <div className="col-span-2 flex items-center gap-4 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6 sm:col-span-1">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                  <Star className="h-6 w-6 fill-current text-[var(--color-action-primary)]" />
                </div>
                <div>
                  <p className="text-caption text-[var(--color-text-secondary)]">
                    {t("summary.averageRating")}
                  </p>
                  <p className="text-heading-md font-bold text-[var(--color-text-primary)]">
                    {summary.averageRating.toFixed(1)}
                    <span className="text-caption font-normal text-[var(--color-text-tertiary)]"> /5</span>
                  </p>
                </div>
              </div>

              {/* Total Reviews */}
              <div className="flex items-center gap-4 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                  <MessageSquare className="h-6 w-6 text-[var(--color-text-secondary)]" />
                </div>
                <div>
                  <p className="text-caption text-[var(--color-text-secondary)]">
                    {t("summary.totalReviews")}
                  </p>
                  <p className="text-heading-md font-bold text-[var(--color-text-primary)]">
                    {summary.totalReviews}
                  </p>
                </div>
              </div>

              {/* Pending Responses */}
              <div className="flex items-center gap-4 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                    summary.pendingResponses > 0
                      ? "bg-[var(--color-error-bg)] border border-[var(--color-error-border)]"
                      : "bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]"
                  }`}
                >
                  <Send
                    className={`h-6 w-6 ${
                      summary.pendingResponses > 0
                        ? "text-[var(--color-error-text)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-caption text-[var(--color-text-secondary)]">
                    {t("summary.pendingResponses")}
                  </p>
                  <p
                    className={`text-heading-md font-bold ${
                      summary.pendingResponses > 0
                        ? "text-[var(--color-error-text)]"
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {summary.pendingResponses}
                  </p>
                </div>
              </div>

              {/* Response Rate */}
              <div className="flex items-center gap-4 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                    summary.responseRate >= 80
                      ? "bg-[var(--color-success-bg)] border border-[var(--color-success-border)]"
                      : "bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]"
                  }`}
                >
                  <TrendingUp
                    className={`h-6 w-6 ${
                      summary.responseRate >= 80
                        ? "text-[var(--color-success-text)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-caption text-[var(--color-text-secondary)]">
                    {t("summary.responseRate")}
                  </p>
                  <p className="text-heading-md font-bold text-[var(--color-text-primary)]">
                    {summary.responseRate}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rating distribution + Dimension averages */}
          {summary && !isLoading && summary.totalReviews > 0 && (
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              {/* Rating distribution */}
              <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                <p className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
                  {t("summary.ratingDistribution")}
                </p>
                <div className="space-y-2">
                  {distEntries.map(({ star, count }) => (
                    <div key={star} className="flex items-center gap-3">
                      <div className="flex w-12 flex-shrink-0 items-center justify-end gap-1">
                        <span className="text-caption text-[var(--color-text-secondary)]">{star}</span>
                        <Star className="h-3 w-3 fill-current text-[var(--color-action-primary)]" />
                      </div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-action-primary)] transition-all duration-500"
                          style={{ width: `${Math.round((count / maxDist) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 flex-shrink-0 text-right text-caption text-[var(--color-text-secondary)]">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dimension averages panel */}
              {hasDimAvg && (
                <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
                  <p className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
                    {tReview("dimensionsTitle")}
                  </p>
                  <div className="space-y-3">
                    {(Object.keys(dimLabels) as Array<keyof DimensionAverages>).map((key) => (
                      <DimensionBar
                        key={key}
                        value={summary.dimensionAverages?.[key]}
                        label={dimLabels[key]}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vehicle filter banner */}
          {vehicleIdFilter && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
              <p className="text-caption text-[var(--color-text-primary)]">
                Showing reviews for{" "}
                <strong className="font-semibold">
                  {vehicleNameFilter ?? "this vehicle"}
                </strong>
              </p>
              <Link
                href={`/${locale}/owner/reviews`}
                className="text-caption font-medium text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View all
              </Link>
            </div>
          )}

          {/* Filter tabs */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] ${
                  activeTab === tab.id
                    ? "bg-[var(--color-text-primary)] text-[var(--color-bg-base)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                }`}
              >
                {t(`tabs.${tab.id}`)}
                {tab.id === "pending" && summary && summary.pendingResponses > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-error-border)] px-1 text-xs font-medium text-white">
                    {summary.pendingResponses}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-[20px] bg-[var(--color-bg-surface)]" />
              ))}
            </div>
          )}

          {/* Reviews list */}
          {!isLoading && !loadError && displayedReviews.length > 0 && (
            <div className="space-y-4">
              {displayedReviews.map((review) => {
                const dims = review.dimensions;
                const hasDims =
                  dims &&
                  Object.values(dims).some((v) => v !== null && v !== undefined);

                return (
                  <div
                    key={review.id}
                    className="overflow-hidden rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)]"
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {review.vehicleName}
                        </p>
                        <p className="mt-0.5 text-caption text-[var(--color-text-secondary)]">
                          {review.customerName}
                          {" · "}
                          {new Date(review.tripDate).toLocaleDateString(locale, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="ml-4 flex flex-shrink-0 flex-wrap items-center gap-2">
                        <StarRow rating={review.rating} />
                        {review.isRecommended !== null &&
                          review.isRecommended !== undefined && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${
                                review.isRecommended
                                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                  : "bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
                              }`}
                            >
                              {review.isRecommended ? (
                                <><ThumbsUp className="h-3 w-3" /> {tReview("recommends")}</>
                              ) : (
                                <><ThumbsDown className="h-3 w-3" /> {tReview("notRecommends")}</>
                              )}
                            </span>
                          )}
                        {review.ownerResponse ? (
                          <span className="inline-flex h-6 items-center rounded-lg bg-[var(--color-success-bg)] px-2 text-xs font-medium text-[var(--color-success-text)]">
                            {t("card.responded")}
                          </span>
                        ) : (
                          <span className="inline-flex h-6 items-center rounded-lg bg-[var(--color-error-bg)] px-2 text-xs font-medium text-[var(--color-error-text)]">
                            {t("tabs.pending")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-6 py-4 space-y-4">
                      {/* Title */}
                      {review.title && (
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {review.title}
                        </p>
                      )}

                      {/* Comment */}
                      {review.comment ? (
                        <p className="text-body text-[var(--color-text-primary)]">
                          {review.comment}
                        </p>
                      ) : (
                        <p className="text-body italic text-[var(--color-text-tertiary)]">—</p>
                      )}

                      {/* Dimension breakdown */}
                      {hasDims && dims && (
                        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 space-y-2">
                          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                            {tReview("dimensionsTitle")}
                          </p>
                          {(Object.keys(dimLabels) as Array<keyof DimensionAverages>).map((key) => (
                            <DimensionBar
                              key={key}
                              value={dims[key]}
                              label={dimLabels[key]}
                            />
                          ))}
                        </div>
                      )}

                      {/* Existing owner response */}
                      {review.ownerResponse && (
                        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                          <p className="mb-1 text-caption font-semibold text-[var(--color-text-secondary)]">
                            {t("card.yourResponse")}
                          </p>
                          <p className="text-body text-[var(--color-text-primary)]">
                            {review.ownerResponse}
                          </p>
                        </div>
                      )}

                      {/* Respond form */}
                      {!review.ownerResponse && (
                        <div className="border-t border-[var(--color-border-default)] pt-4">
                          {respondingTo === review.id ? (
                            <div className="space-y-3">
                              {respondError && (
                                <p className="text-caption text-[var(--color-error-text)]">
                                  {respondError}
                                </p>
                              )}
                              <label className="block text-caption font-medium text-[var(--color-text-primary)]">
                                {t("card.responseLabel")}
                              </label>
                              <textarea
                                ref={textareaRef}
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                placeholder={t("card.responsePlaceholder")}
                                rows={3}
                                className="w-full resize-none rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:border-[var(--color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRespond(review.id)}
                                  disabled={!responseText.trim() || isSubmitting}
                                  className="flex h-9 min-w-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isSubmitting ? (
                                    <LoadingSpinner size="sm" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  {t("card.submit")}
                                </button>
                                <button
                                  onClick={handleCancelRespond}
                                  className="flex h-9 min-w-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  {t("card.cancel")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setRespondingTo(review.id);
                                setResponseText("");
                                setRespondError(null);
                              }}
                              aria-label={`${t("card.respond")} to ${review.customerName}`}
                              className="flex h-9 min-w-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              {t("card.respond")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !loadError && reviews.length === 0 && (
            <div className="flex flex-col items-center rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-8 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                <Star className="h-8 w-8 text-[var(--color-action-primary)]" />
              </div>
              <h2 className="mb-2 text-heading-md font-semibold text-[var(--color-text-primary)]">
                {activeTab === "pending"
                  ? t("noReviews.pendingTitle")
                  : activeTab === "responded"
                    ? t("noReviews.respondedTitle")
                    : t("noReviews.allTitle")}
              </h2>
              <p className="max-w-sm text-body text-[var(--color-text-secondary)]">
                {activeTab === "pending"
                  ? t("noReviews.pendingDescription")
                  : activeTab === "responded"
                    ? t("noReviews.respondedDescription")
                    : t("noReviews.description")}
              </p>
            </div>
          )}
        </div>
      </div>
  );
}
