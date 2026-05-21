"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";

// ── Shared type ──────────────────────────────────────────────
export interface DimensionRatings {
  ratingVehicleCondition?: number;
  ratingDriverBehavior?: number;
  ratingPunctuality?: number;
  ratingCleanliness?: number;
  ratingValueForMoney?: number;
}

export interface ReviewInput {
  bookingId: string;
  vehicleId: string;
  rating: number;
  title?: string;
  comment?: string;
  isRecommended?: boolean;
  dimensions?: DimensionRatings;
}

// ── Constants ────────────────────────────────────────────────
const COMMENT_MAX = 1000;

const DIMENSION_KEYS: Array<{
  field: keyof DimensionRatings;
  labelKey: string;
}> = [
  { field: "ratingVehicleCondition", labelKey: "dimVehicleCondition" },
  { field: "ratingDriverBehavior",   labelKey: "dimDriverBehavior"   },
  { field: "ratingPunctuality",      labelKey: "dimPunctuality"      },
  { field: "ratingCleanliness",      labelKey: "dimCleanliness"      },
  { field: "ratingValueForMoney",    labelKey: "dimValueForMoney"    },
];

// ── Sub-components ───────────────────────────────────────────
function InteractiveStar({
  filled,
  hovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
  label,
}: {
  filled: boolean;
  hovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] rounded"
    >
      <Star
        size={24}
        className={`transition-colors ${
          filled || hovered
            ? "fill-[var(--color-action-primary)] text-[var(--color-action-primary)]"
            : "fill-none text-[var(--color-border-default)]"
        }`}
      />
    </button>
  );
}

function StarRow({
  value,
  onChange,
  size = 24,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" role="group" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((star) => (
        <InteractiveStar
          key={star}
          filled={star <= value}
          hovered={star <= hover}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          label={`${star} star`}
        />
      ))}
    </div>
  );
}

function DimensionSection({
  dimensions,
  onChange,
  t,
}: {
  dimensions: DimensionRatings;
  onChange: (field: keyof DimensionRatings, value: number) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 space-y-4">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {t("dimensionsTitle")}
      </p>
      {DIMENSION_KEYS.map(({ field, labelKey }) => (
        <div key={field} className="flex items-center justify-between gap-4">
          <span className="text-sm text-[var(--color-text-secondary)] min-w-0 flex-1">
            {t(labelKey)}
          </span>
          <StarRow
            value={dimensions[field] ?? 0}
            onChange={(v) => onChange(field, v)}
            ariaLabel={t(labelKey)}
          />
        </div>
      ))}
    </div>
  );
}

// ── ReviewForm ───────────────────────────────────────────────
interface ReviewFormProps {
  bookingId: string;
  vehicleId: string;
  vehicleName: string;
  ownerName: string;
  onSubmit: (data: ReviewInput) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
  onSkip?: () => void;
  isLoading?: boolean;
}

export function ReviewForm({
  bookingId,
  vehicleId,
  vehicleName,
  ownerName,
  onSubmit,
  onCancel,
  onSkip,
  isLoading = false,
}: ReviewFormProps) {
  const t = useTranslations("review");

  const [rating, setRating]               = useState(0);
  const [dimensions, setDimensions]       = useState<DimensionRatings>({});
  const [title, setTitle]                 = useState("");
  const [comment, setComment]             = useState("");
  const [isRecommended, setIsRecommended] = useState<boolean | null>(null);
  const [error, setError]                 = useState("");

  const handleDimensionChange = (field: keyof DimensionRatings, value: number) => {
    setDimensions((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError(t("ratingRequired"));
      return;
    }

    const result = await onSubmit({
      bookingId,
      vehicleId,
      rating,
      title: title.trim() || undefined,
      comment: comment.trim() || undefined,
      isRecommended: isRecommended ?? undefined,
      dimensions: Object.keys(dimensions).length > 0 ? dimensions : undefined,
    });

    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  const ratingLabels = ["", t("ratingTerrible"), t("ratingPoor"), t("ratingAverage"), t("ratingGood"), t("ratingExcellent")];

  return (
    <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-heading-md font-semibold text-[var(--color-text-primary)]">
          {t("leaveReview")}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t("reviewFor")}{" "}
          <span className="font-medium text-[var(--color-text-primary)]">{vehicleName}</span>{" "}
          {t("by")}{" "}
          <span className="font-medium text-[var(--color-text-primary)]">{ownerName}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Overall star rating */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text-primary)]">
            {t("yourRating")}
            <span className="text-[var(--color-error-text)] ml-0.5">*</span>
          </label>
          <div className="flex items-center gap-3">
            <StarRow
              value={rating}
              onChange={(v) => { setRating(v); setError(""); }}
              ariaLabel={t("yourRating")}
            />
            {rating > 0 && (
              <span className="text-sm text-[var(--color-text-secondary)]">
                {ratingLabels[rating]}
              </span>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-[var(--color-error-text)]">
              {error}
            </p>
          )}
        </div>

        {/* 6-dimension sub-ratings */}
        <DimensionSection
          dimensions={dimensions}
          onChange={handleDimensionChange}
          t={t}
        />

        {/* Review title */}
        <div className="space-y-1.5">
          <label
            htmlFor="review-title"
            className="block text-sm font-medium text-[var(--color-text-primary)]"
          >
            {t("reviewTitle")}
          </label>
          <input
            id="review-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("reviewTitlePlaceholder")}
            maxLength={120}
            className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:border-[var(--color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
          />
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <label
            htmlFor="review-comment"
            className="block text-sm font-medium text-[var(--color-text-primary)]"
          >
            {t("yourComment")}
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
            placeholder={t("reviewPlaceholder")}
            rows={4}
            className="w-full resize-none rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:border-[var(--color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {t("reviewHint")}
            </p>
            <span
              className={`text-xs tabular-nums ${
                comment.length >= COMMENT_MAX
                  ? "text-[var(--color-error-text)]"
                  : "text-[var(--color-text-tertiary)]"
              }`}
            >
              {comment.length}/{COMMENT_MAX}
            </span>
          </div>
        </div>

        {/* Recommend toggle */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {t("wouldRecommend")}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsRecommended(true)}
              aria-pressed={isRecommended === true}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] ${
                isRecommended === true
                  ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
              }`}
            >
              <ThumbsUp size={16} />
              {t("yes")}
            </button>
            <button
              type="button"
              onClick={() => setIsRecommended(false)}
              aria-pressed={isRecommended === false}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] ${
                isRecommended === false
                  ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
              }`}
            >
              <ThumbsDown size={16} />
              {t("no")}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-xl bg-[var(--color-action-primary)] px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? t("submitting") : t("submitReview")}
          </button>

          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-6 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              {t("skipReview")}
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-6 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              {t("cancel")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── ReviewDimensionBar ────────────────────────────────────────
function DimensionBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null;
  const pct = Math.round((value / 5) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 flex-shrink-0 text-xs text-[var(--color-text-secondary)]">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
        <div
          className="h-full rounded-full bg-[var(--color-action-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 flex-shrink-0 text-right text-xs font-medium text-[var(--color-text-primary)]">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ── ReviewDisplay ────────────────────────────────────────────
interface ReviewDisplayProps {
  review: {
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
    comment?: string | null;
    isRecommended?: boolean | null;
    createdAt: string;
    customerName: string;
    customerAvatar?: string | null;
    ownerResponse?: string | null;
    ownerResponseDate?: string | null;
  };
  showOwnerResponse?: boolean;
}

export function ReviewDisplay({ review, showOwnerResponse = true }: ReviewDisplayProps) {
  const t = useTranslations("review");
  const dims = review.dimensions;
  const hasDimensions =
    dims &&
    Object.values(dims).some((v) => v !== null && v !== undefined);

  const dimLabels: Record<string, string> = {
    vehicleCondition: t("dimVehicleCondition"),
    driverBehavior:   t("dimDriverBehavior"),
    punctuality:      t("dimPunctuality"),
    cleanliness:      t("dimCleanliness"),
    valueForMoney:    t("dimValueForMoney"),
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-sm font-semibold text-[var(--color-text-primary)]"
          aria-hidden="true"
        >
          {review.customerName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {review.customerName}
            </h4>
            <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
              {formatDate(review.createdAt, "long")}
            </span>
          </div>

          {/* Star row */}
          <div className="mt-1 flex items-center gap-2">
            <div className="flex gap-0.5" aria-label={`${review.rating} out of 5`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={14}
                  className={
                    star <= review.rating
                      ? "fill-[var(--color-action-primary)] text-[var(--color-action-primary)]"
                      : "fill-none text-[var(--color-border-default)]"
                  }
                />
              ))}
            </div>
            {review.isRecommended !== null && review.isRecommended !== undefined && (
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${
                  review.isRecommended
                    ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                    : "bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
                }`}
              >
                {review.isRecommended ? (
                  <><ThumbsUp size={10} /> {t("recommends")}</>
                ) : (
                  <><ThumbsDown size={10} /> {t("notRecommends")}</>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      {review.title && (
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {review.title}
        </p>
      )}

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-[var(--color-text-secondary)]">{review.comment}</p>
      )}

      {/* Dimension bars */}
      {hasDimensions && dims && (
        <div className="space-y-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            {t("dimensionsTitle")}
          </p>
          {(Object.entries(dimLabels) as Array<[string, string]>).map(([key, label]) => {
            const val = dims[key as keyof typeof dims];
            return val !== null && val !== undefined ? (
              <DimensionBar key={key} value={val} label={label} />
            ) : null;
          })}
        </div>
      )}

      {/* Owner response */}
      {showOwnerResponse && review.ownerResponse && (
        <div className="ml-0 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              {t("ownerResponse")}
            </span>
            {review.ownerResponseDate && (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                · {formatDate(review.ownerResponseDate, "long")}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {review.ownerResponse}
          </p>
        </div>
      )}
    </div>
  );
}
