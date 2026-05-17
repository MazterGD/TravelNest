import { cn } from "@/lib/utils/cn";
import { Card } from "./Card";
import type { ReactNode, ElementType, ReactElement } from "react";

interface StepCardProps {
  /** Step number (1-based) */
  stepNumber: number;
  /** Title of the step */
  title: string;
  /** Description of the step */
  description: string;
  /** Icon element (ReactNode) or React Icon component (ElementType) */
  icon: ReactNode | ElementType;
  /** Visual variant */
  variant?: "primary" | "secondary";
  /** Whether to show the connector line to the next step */
  showConnector?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * StepCard Component
 *
 * A card component for displaying numbered process steps with an icon, title, and description.
 * Used in "How It Works" sections and onboarding flows.
 *
 * @example Basic usage
 * ```tsx
 * <StepCard
 *   stepNumber={1}
 *   title="Search"
 *   description="Find vehicles that match your needs"
 *   icon={<FaSearch />}
 * />
 * ```
 *
 * @example With React Icons
 * ```tsx
 * import { FaSearch } from "react-icons/fa";
 *
 * <StepCard
 *   stepNumber={1}
 *   title="Search"
 *   description="Find vehicles"
 *   icon={FaSearch}
 *   variant="secondary"
 *   showConnector
 * />
 * ```
 */
export function StepCard({
  stepNumber,
  title,
  description,
  icon,
  variant = "primary",
  showConnector = false,
  className,
}: StepCardProps) {
  const numberStyles = {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  };

  // Determine if icon is a component (function) or already a ReactNode
  const isIconComponent = typeof icon === "function";
  const IconComponent = isIconComponent ? (icon as ElementType) : null;

  return (
    <div className={cn("relative", className)}>
      {/* Connector Line */}
      {showConnector && (
        <div className="hidden lg:block absolute top-8 left-1/2 w-full h-0.5 bg-border" />
      )}

      <Card className="relative text-center p-6 h-full">
        {/* Step Number */}
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold mx-auto mb-4",
            numberStyles[variant]
          )}
        >
          {stepNumber}
        </div>

        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/30 mx-auto mb-4">
          {IconComponent ? (
            <IconComponent className="h-6 w-6 text-primary" />
          ) : (
            <span className="text-primary">{icon as ReactNode}</span>
          )}
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </Card>
    </div>
  );
}

interface StepCardGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * StepCardGrid Component
 *
 * A grid container for StepCard components with responsive layout.
 *
 * @example
 * ```tsx
 * <StepCardGrid columns={4}>
 *   <StepCard stepNumber={1} ... />
 *   <StepCard stepNumber={2} ... />
 *   <StepCard stepNumber={3} ... />
 *   <StepCard stepNumber={4} ... />
 * </StepCardGrid>
 * ```
 */
export function StepCardGrid({
  children,
  columns = 4,
  className,
}: StepCardGridProps) {
  const columnStyles = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div
      className={cn("grid grid-cols-1 gap-6", columnStyles[columns], className)}
    >
      {children}
    </div>
  );
}

export default StepCard;
