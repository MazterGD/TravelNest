"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { AlertCircle, RefreshCw, Star, Calendar } from "lucide-react";
import {
  PageHeader,
  Tabs,
  EmptyState,
  EmptyBoxIcon,
  SkeletonList,
} from "@/components/ui";
import { ReviewDisplay, ReviewForm } from "@/components/features/customer";
import type { ReviewInput } from "@/components/features/customer/ReviewForm";
import { reviewService, ApiError } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────
interface ReviewDimensions {
  vehicleCondition?: number | null;
  driverBehavior?: number | null;
  punctuality?: number | null;
  cleanliness?: number | null;
  valueForMoney?: number | null;
}

interface Review {
  id: string;
  rating: number;
  dimensions?: ReviewDimensions | null;
  title?: string | null;
  comment?: string | null;
  isRecommended?: boolean | null;
  createdAt: string;
  customerName: string;
  vehicleName: string;
  ownerName: string;
  ownerResponse?: string | null;
  ownerResponseDate?: string | null;
  tripDate?: string;
}

interface PendingReview {
  bookingId: string;
  vehicleId: string;
  vehicleName: string;
  ownerName: string;
  tripDate: string;
}

interface ReviewsPageContentProps {
  locale: string;
}

export function ReviewsPageContent({ locale }: ReviewsPageContentProps) {
  const t = useTranslations("review");
  const searchParams = useSearchParams();
  const bookingParam = searchParams.get("booking");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [showReviewForm, setShowReviewForm] = useState<string | null>(
    bookingParam,
  );
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reviewsResponse, pendingResponse] = await Promise.all([
        reviewService.getMyReviews(),
        reviewService.getPendingReviews(),
      ]);

      const reviewsData = reviewsResponse as any;
      const pendingData = pendingResponse as any;

      const transformedReviews: Review[] = (
        reviewsData.reviews ??
        reviewsData ??
        []
      ).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        dimensions: r.dimensions ?? null,
        title: r.title ?? null,
        comment: r.comment ?? null,
        isRecommended: r.isRecommended ?? null,
        createdAt: r.createdAt,
        customerName: t("you"),
        vehicleName: r.vehicleName ?? r.vehicle?.name ?? t("vehicleFallback"),
        ownerName: r.ownerName ?? r.owner?.name ?? t("ownerFallback"),
        ownerResponse: r.ownerResponse ?? null,
        ownerResponseDate: r.ownerResponseDate ?? null,
        tripDate: r.tripDate,
      }));

      const transformedPending: PendingReview[] = (
        pendingData.pendingReviews ??
        pendingData.bookings ??
        pendingData ??
        []
      ).map((b: any) => ({
        bookingId: b.bookingId ?? b.id,
        vehicleId: b.vehicleId ?? "",
        vehicleName: b.vehicleName ?? b.vehicle?.name ?? t("vehicleFallback"),
        ownerName: b.ownerName ?? b.owner?.name ?? t("ownerFallback"),
        tripDate: b.tripDate ?? b.endDate,
      }));

      setReviews(transformedReviews);
      setPendingReviews(transformedPending);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("fetchError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSubmitReview = async (
    data: ReviewInput,
  ): Promise<{ success: boolean; error?: string }> => {
    setSubmitting(true);
    try {
      await reviewService.create({
        bookingId: data.bookingId,
        vehicleId: data.vehicleId,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        isRecommended: data.isRecommended,
        dimensions: data.dimensions,
      });
      setShowReviewForm(null);
      fetchReviews();
      return { success: true };
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("submitError");
      return { success: false, error: msg };
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tab: My Reviews ──────────────────────────────────────────
  const myReviewsContent = (
    <div className="space-y-4">
      {reviews.length > 0 ? (
        reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {review.vehicleName}
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("by")} {review.ownerName}
                </p>
              </div>
              {review.tripDate && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
                  <Calendar size={12} />
                  {new Date(review.tripDate).toLocaleDateString(locale)}
                </span>
              )}
            </div>
            <ReviewDisplay review={review} showOwnerResponse />
          </div>
        ))
      ) : (
        <EmptyState
          icon={<EmptyBoxIcon />}
          title={t("noReviews")}
          description={t("noReviewsDescription")}
        />
      )}
    </div>
  );

  // ── Tab: Pending Reviews ─────────────────────────────────────
  const pendingContent = (
    <div className="space-y-4">
      {pendingReviews.length > 0 ? (
        pendingReviews.map((pending) => (
          <div
            key={pending.bookingId}
            className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)]"
          >
            {showReviewForm === pending.bookingId ? (
              <div className="p-6">
                <ReviewForm
                  bookingId={pending.bookingId}
                  vehicleId={pending.vehicleId}
                  vehicleName={pending.vehicleName}
                  ownerName={pending.ownerName}
                  onSubmit={handleSubmitReview}
                  onCancel={() => setShowReviewForm(null)}
                  onSkip={() => setShowReviewForm(null)}
                  isLoading={submitting}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 p-6">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {pending.vehicleName}
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("by")} {pending.ownerName}
                    {" · "}
                    {new Date(pending.tripDate).toLocaleDateString(locale)}
                  </p>
                </div>
                <button
                  onClick={() => setShowReviewForm(pending.bookingId)}
                  className="inline-flex h-11 min-w-[44px] flex-shrink-0 items-center gap-2 rounded-xl border border-[var(--color-action-primary)] bg-[var(--color-bg-base)] px-4 text-sm font-medium text-[var(--color-action-primary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
                >
                  <Star size={16} />
                  {t("writeReview")}
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <EmptyState
          icon={<EmptyBoxIcon />}
          title={t("noPendingReviews")}
          description={t("noPendingReviewsDescription")}
        />
      )}
    </div>
  );

  const tabs = [
    {
      id: "myReviews",
      label: t("myReviews"),
      badge: reviews.length,
      content: myReviewsContent,
    },
    {
      id: "pending",
      label: t("pendingReviews"),
      badge: pendingReviews.length,
      content: pendingContent,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reviewsTitle")}
        description={t("reviewsDescription")}
      />

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-text)]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
          <button
            onClick={fetchReviews}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-error-border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-error-border)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
          >
            <RefreshCw size={12} />
            {t("retry")}
          </button>
        </div>
      )}

      {isLoading ? (
        <SkeletonList count={3} />
      ) : (
        <Tabs
          tabs={tabs}
          defaultTab={bookingParam ? "pending" : "myReviews"}
          variant="default"
        />
      )}
    </div>
  );
}
