import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-muted text-muted-foreground border border-border",
  success: "bg-success-bg text-success-text border border-success-border",
  warning: "bg-muted text-foreground border border-border",
  danger: "bg-error-bg text-error-text border border-error-border",
  info: "bg-muted text-primary border border-border",
  outline: "border border-border bg-transparent text-foreground",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-primary-foreground",
  secondary: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-foreground",
  danger: "bg-error",
  info: "bg-primary",
  outline: "bg-current",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg font-medium",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full mr-1.5", dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}

// Status-specific badges for convenience
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const statusConfig: Record<string, { variant: BadgeVariant; label: string }> =
    {
      // Quotation statuses
      pending: { variant: "warning", label: "Pending" },
      accepted: { variant: "success", label: "Accepted" },
      declined: { variant: "danger", label: "Declined" },
      expired: { variant: "secondary", label: "Expired" },

      // Booking statuses
      confirmed: { variant: "success", label: "Confirmed" },
      in_progress: { variant: "info", label: "In Progress" },
      completed: { variant: "success", label: "Completed" },
      cancelled: { variant: "danger", label: "Cancelled" },

      // Payment statuses
      paid: { variant: "success", label: "Paid" },
      unpaid: { variant: "warning", label: "Unpaid" },
      refunded: { variant: "info", label: "Refunded" },

      // Verification statuses
      verified: { variant: "success", label: "Verified" },
      unverified: { variant: "warning", label: "Unverified" },
      rejected: { variant: "danger", label: "Rejected" },

      // Generic
      active: { variant: "success", label: "Active" },
      inactive: { variant: "secondary", label: "Inactive" },
    };

  const config = statusConfig[status.toLowerCase()] || {
    variant: "secondary" as BadgeVariant,
    label: status,
  };

  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}
