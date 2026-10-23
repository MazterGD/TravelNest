"use client";

import { cn } from "@/lib/utils/cn";
import { StarIcon } from "./Icons";

interface StarRatingProps {
  /** Current rating value (1-5) */
  rating: number;
  /** Maximum rating value (default: 5) */
  maxRating?: number;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg";
  /** Whether the rating is interactive (clickable) */
  interactive?: boolean;
  /** Callback when rating changes (only works when interactive=true) */
  onChange?: (rating: number) => void;
  /** Hover rating value (for interactive mode) */
  hoverRating?: number;
  /** Callback when hover state changes */
  onHoverChange?: (rating: number) => void;
  /** Whether to show the rating number */
  showValue?: boolean;
  /** Additional label text */
  label?: string;
  /** Custom className */
  className?: string;
  /** Read-only mode (disables interaction even if interactive=true) */
  readOnly?: boolean;
}

const sizeMap = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const gapMap = {
  xs: "gap-0.5",
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1",
};

/**
 * StarRating Component
 *
 * A reusable star rating component that can be used for both display and input.
 *
 * @example Display mode (default)
 * ```tsx
 * <StarRating rating={4.5} showValue />
 * ```
 *
 * @example Interactive mode
 * ```tsx
 * const [rating, setRating] = useState(0);
 * const [hover, setHover] = useState(0);
 *
 * <StarRating
 *   rating={rating}
 *   interactive
 *   onChange={setRating}
 *   hoverRating={hover}
 *   onHoverChange={setHover}
 * />
 * ```
 */
export function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  interactive = false,
  onChange,
  hoverRating = 0,
  onHoverChange,
  showValue = false,
  label,
  className,
  readOnly = false,
}: StarRatingProps) {
  const effectiveRating = interactive && hoverRating > 0 ? hoverRating : rating;
  const isInteractive = interactive && !readOnly;

  const handleClick = (star: number) => {
    if (isInteractive && onChange) {
      onChange(star);
    }
  };

  const handleMouseEnter = (star: number) => {
    if (isInteractive && onHoverChange) {
      onHoverChange(star);
    }
  };

  const handleMouseLeave = () => {
    if (isInteractive && onHoverChange) {
      onHoverChange(0);
    }
  };

  const stars = Array.from({ length: maxRating }, (_, i) => i + 1);

  return (
    <div className={cn("flex items-center", gapMap[size], className)}>
      <div className={cn("flex items-center", gapMap[size])}>
        {stars.map((star) => {
          const isFilled = star <= effectiveRating;
          const isHalfFilled = !isFilled && star - 0.5 <= effectiveRating;

          return isInteractive ? (
            <button
              key={star}
              type="button"
              onClick={() => handleClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
              onMouseLeave={handleMouseLeave}
              className="p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-colors"
              aria-label={`Rate ${star} out of ${maxRating}`}
            >
              <StarIcon
                className={cn(
                  sizeMap[size],
                  "transition-colors",
                  isFilled || isHalfFilled
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-muted-foreground/40"
                )}
              />
            </button>
          ) : (
            <StarIcon
              key={star}
              className={cn(
                sizeMap[size],
                isFilled || isHalfFilled
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-muted-foreground/40"
              )}
            />
          );
        })}
      </div>

      {showValue && (
        <span className="text-sm font-medium text-muted-foreground ml-1">
          {rating.toFixed(1)}
        </span>
      )}

      {label && (
        <span className="text-sm text-muted-foreground ml-1">{label}</span>
      )}
    </div>
  );
}

export default StarRating;
