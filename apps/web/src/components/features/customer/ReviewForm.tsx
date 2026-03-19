"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  TextArea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  StarRating,
} from "@/components/ui";
import { formatDate } from "@/lib/utils/formatters";

interface ReviewInput {
  bookingId: string;
  rating: number;
  comment: string;
}

interface ReviewFormProps {
  bookingId: string;
  vehicleName: string;
  ownerName: string;
  onSubmit: (
    data: ReviewInput,
  ) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ReviewForm({
  bookingId,
  vehicleName,
  ownerName,
  onSubmit,
  onCancel,
  isLoading = false,
}: ReviewFormProps) {
  const t = useTranslations("review");
  const [hoverRating, setHoverRating] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError(t("ratingRequired"));
      return;
    }

    const result = await onSubmit({
      bookingId,
      rating,
      comment,
    });

    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  const ratingLabels = [
    "",
    t("ratingTerrible"),
    t("ratingPoor"),
    t("ratingAverage"),
    t("ratingGood"),
    t("ratingExcellent"),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("leaveReview")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("reviewFor")} <span className="font-medium">{vehicleName}</span>{" "}
          {t("by")} <span className="font-medium">{ownerName}</span>
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Star Rating */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t("yourRating")}
            </label>
            <div className="flex items-center gap-2">
              <StarRating
                rating={rating}
                size="lg"
                interactive
                onChange={(newRating) => {
                  setRating(newRating);
                  setError("");
                }}
                hoverRating={hoverRating}
                onHoverChange={setHoverRating}
              />
              {(hoverRating || rating) > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {ratingLabels[hoverRating || rating]}
                </span>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t("yourComment")}
            </label>
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("reviewPlaceholder")}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{t("reviewHint")}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("cancel")}
              </Button>
            )}
            <Button type="submit" isLoading={isLoading}>
              {t("submitReview")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Review Display Component
interface ReviewDisplayProps {
  review: {
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    customerName: string;
    customerAvatar?: string;
    ownerResponse?: string;
    ownerResponseDate?: string;
  };
  showOwnerResponse?: boolean;
}

export function ReviewDisplay({
  review,
  showOwnerResponse = true,
}: ReviewDisplayProps) {
  const t = useTranslations("review");

  return (
    <div className="space-y-4">
      {/* Review Header */}
      <div className="flex items-start gap-4">
        <Avatar
          name={review.customerName}
          src={review.customerAvatar}
          size="md"
        />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">
              {review.customerName}
            </h4>
            <span className="text-sm text-muted-foreground">
              {formatDate(review.createdAt, "long")}
            </span>
          </div>

          {/* Star Rating */}
          <StarRating rating={review.rating} size="sm" className="mt-1" />
        </div>
      </div>

      {/* Review Comment */}
      {review.comment && <p className="text-foreground">{review.comment}</p>}

      {/* Owner Response */}
      {showOwnerResponse && review.ownerResponse && (
        <div className="ml-8 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-foreground">
              {t("ownerResponse")}
            </span>
            {review.ownerResponseDate && (
              <span className="text-xs text-muted-foreground">
                • {formatDate(review.ownerResponseDate, "long")}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {review.ownerResponse}
          </p>
        </div>
      )}
    </div>
  );
}
