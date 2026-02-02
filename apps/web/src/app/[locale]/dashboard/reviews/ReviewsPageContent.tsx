"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  EmptyState,
  EmptyBoxIcon,
  SkeletonList,
  Button,
} from "@/components/ui";
import { ReviewDisplay, ReviewForm } from "@/components/features/customer";
import { reviewService, ApiError } from "@/lib/api";

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  customerName: string;
  vehicleName: string;
  ownerName: string;
  ownerResponse?: string;
  ownerResponseDate?: string;
}

interface PendingReview {
  bookingId: string;
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

      // Transform my reviews
      const transformedReviews: Review[] = (
        reviewsData.reviews ||
        reviewsData ||
        []
      ).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        customerName: "You",
        vehicleName: r.vehicleName || r.vehicle?.name || "Vehicle",
        ownerName: r.ownerName || r.owner?.name || "Owner",
        ownerResponse: r.ownerResponse,
        ownerResponseDate: r.ownerResponseDate,
      }));

      // Transform pending reviews
      const transformedPending: PendingReview[] = (
        pendingData.pendingReviews ||
        pendingData.bookings ||
        pendingData ||
        []
      ).map((b: any) => ({
        bookingId: b.bookingId || b.id,
        vehicleName: b.vehicleName || b.vehicle?.name || "Vehicle",
        ownerName: b.ownerName || b.owner?.name || "Owner",
        tripDate: b.tripDate || b.endDate,
      }));

      setReviews(transformedReviews);
      setPendingReviews(transformedPending);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to fetch reviews");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSubmitReview = async (
    bookingId: string,
    data: { bookingId: string; rating: number; comment: string },
  ): Promise<{ success: boolean; error?: string }> => {
    setSubmitting(true);
    try {
      await reviewService.create({
        bookingId: data.bookingId,
        rating: data.rating,
        comment: data.comment,
      });
      setShowReviewForm(null);
      fetchReviews(); // Refresh the list
      return { success: true };
    } catch (err) {
      const errorMsg =
        err instanceof ApiError ? err.message : "Failed to submit review";
      return { success: false, error: errorMsg };
    } finally {
      setSubmitting(false);
    }
  };

  const tabContent = {
    myReviews: (
      <div className="space-y-4">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {review.vehicleName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t("by")} {review.ownerName}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ReviewDisplay review={review} showOwnerResponse />
              </CardContent>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<EmptyBoxIcon />}
            title={t("noReviews")}
            description={t("noReviewsDescription")}
          />
        )}
      </div>
    ),
    pending: (
      <div className="space-y-4">
        {pendingReviews.length > 0 ? (
          pendingReviews.map((pending) => (
            <Card key={pending.bookingId}>
              <CardContent className="p-4">
                {showReviewForm === pending.bookingId ? (
                  <ReviewForm
                    bookingId={pending.bookingId}
                    vehicleName={pending.vehicleName}
                    ownerName={pending.ownerName}
                    onSubmit={(data) =>
                      handleSubmitReview(pending.bookingId, data)
                    }
                    onCancel={() => setShowReviewForm(null)}
                    isLoading={submitting}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">
                        {pending.vehicleName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {t("by")} {pending.ownerName} •{" "}
                        {new Date(pending.tripDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowReviewForm(pending.bookingId)}
                    >
                      {t("writeReview")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<EmptyBoxIcon />}
            title={t("noPendingReviews")}
            description={t("noPendingReviewsDescription")}
          />
        )}
      </div>
    ),
  };

  const tabs = [
    {
      id: "myReviews",
      label: t("myReviews"),
      badge: reviews.length,
      content: tabContent.myReviews,
    },
    {
      id: "pending",
      label: t("pendingReviews"),
      badge: pendingReviews.length,
      content: tabContent.pending,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reviewsTitle")}
        description={t("reviewsDescription")}
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <Button variant="link" onClick={fetchReviews} className="ml-2">
            Retry
          </Button>
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
