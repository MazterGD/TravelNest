import { cn } from "@/lib/utils/cn";
import type { ReactNode, ElementType } from "react";

interface FeatureCardProps {
  /** Title of the feature */
  title: string;
  /** Description of the feature */
  description: string;
  /** Icon element (ReactNode) or React Icon component (ElementType) */
  icon: ReactNode | ElementType;
  /** Visual variant */
  variant?: "default" | "bordered" | "elevated";
  /** Additional className */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * FeatureCard Component
 *
 * A card component for displaying features with an icon, title, and description.
 * Used in feature lists, benefits sections, and landing pages.
 *
 * @example Basic usage
 * ```tsx
 * <FeatureCard
 *   title="Transparent Pricing"
 *   description="No hidden fees or surprises"
 *   icon={<FaMoneyBillWave />}
 * />
 * ```
 *
 * @example With React Icons
 * ```tsx
 * import { FaShieldAlt } from "react-icons/fa";
 *
 * <FeatureCard
 *   title="Verified Owners"
 *   description="All vehicle owners are verified"
 *   icon={FaShieldAlt}
 *   variant="elevated"
 * />
 * ```
 */
export function FeatureCard({
  title,
  description,
  icon,
  variant = "bordered",
  className,
  onClick,
}: FeatureCardProps) {
  // Determine if icon is a component (function) or already a ReactNode
  const isIconComponent = typeof icon === "function";
  const IconComponent = isIconComponent ? (icon as ElementType) : null;

  const variantStyles = {
    default: "bg-card",
    bordered: "bg-card border border-border hover:shadow-lg transition-shadow",
    elevated: "bg-card shadow-md hover:shadow-xl transition-shadow",
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center text-center p-6 rounded-lg",
        variantStyles[variant],
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        {IconComponent ? (
          <IconComponent className="h-6 w-6 text-primary" />
        ) : (
          <span className="text-primary">{icon as ReactNode}</span>
        )}
      </div>

      {/* Content */}
      <h3 className="mt-4 text-lg font-semibold text-card-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

interface FeatureCardGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * FeatureCardGrid Component
 *
 * A grid container for FeatureCard components with responsive layout.
 *
 * @example
 * ```tsx
 * <FeatureCardGrid columns={4}>
 *   <FeatureCard title="Feature 1" ... />
 *   <FeatureCard title="Feature 2" ... />
 *   <FeatureCard title="Feature 3" ... />
 *   <FeatureCard title="Feature 4" ... />
 * </FeatureCardGrid>
 * ```
 */
export function FeatureCardGrid({
  children,
  columns = 4,
  className,
}: FeatureCardGridProps) {
  const columnStyles = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div
      className={cn("grid grid-cols-1 gap-6", columnStyles[columns], className)}
    >
      {children}
    </div>
  );
}

export default FeatureCard;
