import { cn } from "@/lib/utils/cn";
import { Card } from "./Card";
import type { ReactNode } from "react";

interface StatCardProps {
  value: string | number;
  label: string;
  icon: ReactNode;
  variant?: "primary" | "success" | "warning" | "info" | "error";
  trend?: { value: number; isPositive: boolean };
  subStat?: string;
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
  },
  success: {
    bg: "bg-[var(--color-success-bg)]",
    text: "text-[var(--color-success-text)]",
  },
  warning: {
    bg: "bg-[var(--color-bg-surface)]",
    text: "text-[var(--color-text-secondary)]",
  },
  info: {
    bg: "bg-primary/10",
    text: "text-primary",
  },
  error: {
    bg: "bg-[var(--color-error-bg)]",
    text: "text-[var(--color-error-text)]",
  },
};

export function StatCard({
  value,
  label,
  icon,
  variant = "primary",
  trend,
  subStat,
  className,
  onClick,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        onClick && "cursor-pointer transition-shadow hover:shadow-md",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
            styles.bg,
          )}
          aria-hidden="true"
        >
          <div className={styles.text}>{icon}</div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold leading-tight text-[var(--color-text-primary)]">
            {value}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {label}
          </p>
          {subStat && (
            <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
              {subStat}
            </p>
          )}
          {trend && (
            <p
              className={cn(
                "mt-0.5 text-xs font-medium",
                trend.isPositive
                  ? "text-[var(--color-success-text)]"
                  : "text-[var(--color-error-text)]",
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default StatCard;
