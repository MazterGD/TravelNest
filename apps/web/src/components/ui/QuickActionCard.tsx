import { cn } from "@/lib/utils/cn";
import type { ReactNode, ElementType } from "react";

interface QuickActionCardProps {
  /** Label for the action */
  label: string;
  /** Icon element (ReactNode) or React Icon component (ElementType) */
  icon: ReactNode | ElementType;
  /** Color variant for the icon background */
  variant?: "primary" | "success" | "warning" | "info";
  /** Click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;
  /** Whether the action is disabled */
  disabled?: boolean;
}

const variantStyles = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
  },
  success: {
    bg: "bg-green-100",
    text: "text-green-600",
  },
  warning: {
    bg: "bg-yellow-100",
    text: "text-yellow-600",
  },
  info: {
    bg: "bg-blue-100",
    text: "text-blue-600",
  },
};

/**
 * QuickActionCard Component
 *
 * A clickable card for quick action buttons with an icon and label.
 * Used in dashboards and action grids.
 *
 * @example Basic usage
 * ```tsx
 * <QuickActionCard
 *   label="New Request"
 *   icon={<PlusIcon className="w-6 h-6" />}
 *   variant="primary"
 *   onClick={() => {}}
 * />
 * ```
 *
 * @example With a Lucide icon
 * ```tsx
 * import { Plus } from "lucide-react";
 *
 * <QuickActionCard
 *   label="Add Vehicle"
 *   icon={Plus}
 *   variant="success"
 *   onClick={handleAdd}
 * />
 * ```
 */
export function QuickActionCard({
  label,
  icon,
  variant = "primary",
  onClick,
  className,
  disabled = false,
}: QuickActionCardProps) {
  const styles = variantStyles[variant];

  // Determine if icon is a component (function) or already a ReactNode
  const isIconComponent = typeof icon === "function";
  const IconComponent = isIconComponent ? (icon as ElementType) : null;

  return (
    <div
      className={cn(
        "p-4 border border-border rounded-lg text-center transition-colors",
        !disabled && "hover:bg-muted/50 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3",
          styles.bg
        )}
      >
        {IconComponent ? (
          <IconComponent className={cn("w-6 h-6", styles.text)} />
        ) : (
          <span className={styles.text}>{icon as ReactNode}</span>
        )}
      </div>
      <p className="font-medium text-foreground">{label}</p>
    </div>
  );
}

interface QuickActionGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * QuickActionGrid Component
 *
 * A grid container for QuickActionCard components with responsive layout.
 *
 * @example
 * ```tsx
 * <QuickActionGrid columns={4}>
 *   <QuickActionCard label="Action 1" ... />
 *   <QuickActionCard label="Action 2" ... />
 *   <QuickActionCard label="Action 3" ... />
 *   <QuickActionCard label="Action 4" ... />
 * </QuickActionGrid>
 * ```
 */
export function QuickActionGrid({
  children,
  columns = 4,
  className,
}: QuickActionGridProps) {
  const columnStyles = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", columnStyles[columns], className)}>
      {children}
    </div>
  );
}

export default QuickActionCard;
