"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useOwnerGuard } from "@/hooks";
import { ownerService, reviewService } from "@/lib/api/services";
import { ApiError } from "@/lib/api";

interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  pendingResponses: number;
  responseRate: number;
  ratingDistribution: Record<number, number>;
}

interface OwnerReview {
  id: string;
  rating: number;
  comment: string | null;
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
  { id: "pending", hasResponse: false },
  { id: "responded", hasResponse: true },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? "fill-current text-primary"
              : "text-[--color-text-tertiary]"
          }`}
        />
      ))}
    </div>
  );
}

export default function OwnerReviewsPage() {
  const t = useTranslations("ownerReviews");
  const params = useParams();
  const locale = params.locale as string;
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<OwnerReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadData = useCallback(
    async (tab: TabId) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const tabConfig = TABS.find((t) => t.id === tab);
        const reviewParams =
          tabConfig && tabConfig.hasResponse !== undefined
            ? { hasResponse: tabConfig.hasResponse }
            : undefined;

        const [summaryData, reviewsData] = await Promise.all([
          ownerService.getReviewSummary(),
          ownerService.getReviews(reviewParams),
        ]);
        setSummary(summaryData);
        setReviews(reviewsData.reviews);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 429) {
            setLoadError(t("error.loadFailedRateLimited"));
          } else if (err.status === 401 || err.status === 403) {
            setLoadError(t("error.loadFailedUnauthorized"));
          } else if (err.status === 0 || err.code === "NETWORK_ERROR") {
            setLoadError(t("error.loadFailedNetwork"));
          } else if (err.status >= 500) {
            setLoadError(t("error.loadFailedServer"));
          } else {
            setLoadError(err.message || t("error.loadFailed"));
          }
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
    if (isAuthorized) {
      loadData(activeTab);
    }
  }, [isAuthorized, activeTab, loadData]);

  useEffect(() => {
    if (respondingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [respondingTo]);

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim()) return;
    setIsSubmitting(true);
    setRespondError(null);
    try {
      await reviewService.respond(reviewId, responseText.trim());
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, ownerResponse: responseText.trim() }
            : r,
        ),
      );
      if (summary) {
        const newPending = Math.max(0, summary.pendingResponses - 1);
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
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  const distEntries = summary
    ? [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: summary.ratingDistribution[star] ?? 0,
      }))
    : [];
  const maxDist = Math.max(...distEntries.map((e) => e.count), 1);

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-xl text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("backToDashboard")}
            </Link>
            <h1 className="text-heading-lg font-bold text-foreground">
              {t("title")}
            </h1>
            <p className="mt-1 text-body text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>

          {/* Error banner */}
          {loadError && !isLoading && (
            <div className="mb-6 flex items-center justify-between rounded-[20px] border border-error bg-[var(--color-error-bg)] px-4 py-3 text-sm text-error-foreground">
              <span>{loadError}</span>
              <button
                onClick={() => loadData(activeTab)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-error px-3 text-sm font-medium transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <div className="col-span-2 flex items-center gap-4 rounded-[20px] border border-border bg-card p-6 sm:col-span-1">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Star className="h-6 w-6 fill-current text-primary" />
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    {t("summary.averageRating")}
                  </p>
                  <p className="text-heading-md font-bold text-foreground">
                    {summary.averageRating.toFixed(1)}
                    <span className="text-caption font-normal text-muted-foreground">
                      {" "}
                      /5
                    </span>
                  </p>
                </div>
              </div>

              {/* Total Reviews */}
              <div className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    {t("summary.totalReviews")}
                  </p>
                  <p className="text-heading-md font-bold text-foreground">
                    {summary.totalReviews}
                  </p>
                </div>
              </div>

              {/* Pending Responses */}
              <div className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-6">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                    summary.pendingResponses > 0
                      ? "bg-[var(--color-error-bg)]"
                      : "bg-muted"
                  }`}
                >
                  <Send
                    className={`h-6 w-6 ${
                      summary.pendingResponses > 0
                        ? "text-error-foreground"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    {t("summary.pendingResponses")}
                  </p>
                  <p
                    className={`text-heading-md font-bold ${
                      summary.pendingResponses > 0
                        ? "text-error-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {summary.pendingResponses}
                  </p>
                </div>
              </div>

              {/* Response Rate */}
              <div className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-6">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                    summary.responseRate >= 80
                      ? "bg-[var(--color-success-bg)]"
                      : "bg-muted"
                  }`}
                >
                  <TrendingUp
                    className={`h-6 w-6 ${
                      summary.responseRate >= 80
                        ? "text-success-foreground"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    {t("summary.responseRate")}
                  </p>
                  <p className="text-heading-md font-bold text-foreground">
                    {summary.responseRate}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rating distribution */}
          {summary && !isLoading && summary.totalReviews > 0 && (
            <div className="mb-6 rounded-[20px] border border-border bg-card p-6">
              <p className="mb-4 text-sm font-semibold text-foreground">
                {t("summary.ratingDistribution")}
              </p>
              <div className="space-y-2">
                {distEntries.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-3">
                    <div className="flex w-12 flex-shrink-0 items-center justify-end gap-1">
                      <span className="text-caption text-muted-foreground">
                        {star}
                      </span>
                      <Star className="h-3 w-3 fill-current text-primary" />
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${Math.round((count / maxDist) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 flex-shrink-0 text-right text-caption text-muted-foreground">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeTab === tab.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t(`tabs.${tab.id}`)}
                {tab.id === "pending" &&
                  summary &&
                  summary.pendingResponses > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-medium text-white">
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
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-[20px] bg-muted"
                />
              ))}
            </div>
          )}

          {/* Reviews list */}
          {!isLoading && !loadError && reviews.length > 0 && (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="overflow-hidden rounded-[20px] border border-border bg-card"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between border-b border-border bg-muted/30 px-6 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {review.vehicleName}
                      </p>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        {review.customerName}
                        {" · "}
                        {new Date(review.tripDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="ml-4 flex flex-shrink-0 items-center gap-2">
                      <StarRating rating={review.rating} />
                      {review.ownerResponse ? (
                        <span className="inline-flex h-6 items-center rounded-lg bg-[var(--color-success-bg)] px-2 text-xs font-medium text-success-foreground">
                          {t("card.responded")}
                        </span>
                      ) : (
                        <span className="inline-flex h-6 items-center rounded-lg bg-[var(--color-error-bg)] px-2 text-xs font-medium text-error-foreground">
                          {t("tabs.pending")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-6 py-4">
                    {review.comment ? (
                      <p className="text-body text-foreground">
                        {review.comment}
                      </p>
                    ) : (
                      <p className="text-body italic text-muted-foreground">
                        —
                      </p>
                    )}

                    {/* Existing owner response */}
                    {review.ownerResponse && (
                      <div className="mt-4 rounded-xl border border-border bg-muted p-4">
                        <p className="mb-1 text-caption font-semibold text-muted-foreground">
                          {t("card.yourResponse")}
                        </p>
                        <p className="text-body text-foreground">
                          {review.ownerResponse}
                        </p>
                      </div>
                    )}

                    {/* Respond form */}
                    {!review.ownerResponse && (
                      <div className="mt-4 border-t border-border pt-4">
                        {respondingTo === review.id ? (
                          <div className="space-y-3">
                            {respondError && (
                              <p className="text-caption text-error-foreground">
                                {respondError}
                              </p>
                            )}
                            <label className="block text-caption font-medium text-foreground">
                              {t("card.responseLabel")}
                            </label>
                            <textarea
                              ref={textareaRef}
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder={t("card.responsePlaceholder")}
                              rows={3}
                              className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRespond(review.id)}
                                disabled={
                                  !responseText.trim() || isSubmitting
                                }
                                className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                                className="flex h-9 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                            className="flex h-9 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {t("card.respond")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !loadError && reviews.length === 0 && (
            <div className="flex flex-col items-center rounded-[20px] border border-border bg-card px-8 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Star className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 text-heading-md font-semibold text-foreground">
                {activeTab === "pending"
                  ? t("noReviews.pendingTitle")
                  : activeTab === "responded"
                    ? t("noReviews.respondedTitle")
                    : t("noReviews.allTitle")}
              </h2>
              <p className="max-w-sm text-body text-muted-foreground">
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
    </MainLayout>
  );
}
