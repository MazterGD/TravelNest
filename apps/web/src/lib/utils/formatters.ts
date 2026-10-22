/**
 * Shared formatting utilities
 * Centralizes all formatting functions to avoid duplication
 */

/**
 * Format a number as Sri Lankan Rupees currency
 * @param amount - The amount to format
 * @param options - Optional formatting options
 */
export function formatCurrency(
  amount: number,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(amount);
}

/**
 * Format a date for display
 * @param date - Date to format (Date object or ISO string)
 * @param options - Format variant or custom options
 */
export function formatDate(
  date: Date | string,
  options?: "short" | "medium" | "long" | "full" | Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;

  // Handle invalid dates
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }

  // Predefined format variants
  const formatVariants: Record<string, Intl.DateTimeFormatOptions> = {
    short: {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
    medium: {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    },
    long: {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
    full: {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  };

  const formatOptions =
    typeof options === "string"
      ? formatVariants[options] || formatVariants.short
      : options || formatVariants.short;

  return d.toLocaleDateString("en-LK", formatOptions);
}

/**
 * Format a time for display
 * @param date - Date to format (Date object or ISO string)
 * @param options - Time format options
 */
export function formatTime(
  date: Date | string,
  options?: {
    hour12?: boolean;
    showSeconds?: boolean;
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;

  // Handle invalid dates
  if (isNaN(d.getTime())) {
    return "Invalid time";
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...(options?.showSeconds && { second: "2-digit" }),
    hour12: options?.hour12 ?? false,
  };

  return d.toLocaleTimeString("en-LK", formatOptions);
}

/**
 * Format a date range
 * @param startDate - Start date
 * @param endDate - End date
 */
export function formatDateRange(
  startDate: Date | string,
  endDate: Date | string
): string {
  const start = formatDate(startDate, "short");
  const end = formatDate(endDate, "short");
  return `${start} - ${end}`;
}

/**
 * Get relative time (e.g., "2 days ago", "in 3 hours")
 * @param date - Date to compare
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, "day");
  }
  if (Math.abs(diffHours) >= 1) {
    return rtf.format(diffHours, "hour");
  }
  if (Math.abs(diffMinutes) >= 1) {
    return rtf.format(diffMinutes, "minute");
  }
  return rtf.format(diffSeconds, "second");
}

/**
 * Format a phone number for display
 * @param phone - Phone number string
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, "");

  // Format Sri Lankan phone numbers
  if (cleaned.startsWith("94") && cleaned.length === 11) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(
      4,
      7
    )} ${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }

  return phone; // Return original if format not recognized
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Strip the "#removed-<id>" suffix the API appends to unique fields of soft-removed rows
 */
export function stripRemovedSuffix(value: string): string {
  return value.replace(/#removed-[^#]*$/, "");
}
