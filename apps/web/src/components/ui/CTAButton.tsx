import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CTAButtonVariant = "primary" | "secondary";
type CTAButtonSize = "sm" | "md" | "lg";

interface CTAButtonBaseProps {
  children?: ReactNode;
  variant?: CTAButtonVariant;
  size?: CTAButtonSize;
  className?: string;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  ringOffsetClassName?: string;
}

interface CTAButtonLinkProps extends CTAButtonBaseProps {
  href: string;
}

interface CTAButtonNativeProps
  extends CTAButtonBaseProps, React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: undefined;
}

type CTAButtonProps = CTAButtonLinkProps | CTAButtonNativeProps;

const variantClasses: Record<CTAButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-action-primary-hover shadow-[0_4px_12px_-4px_rgba(32,176,233,0.35)] motion-safe:hover:shadow-[0_10px_24px_-6px_rgba(32,176,233,0.45)]",
  secondary:
    "border border-border bg-white text-foreground hover:bg-muted shadow-none",
};

const sizeClasses: Record<CTAButtonSize, string> = {
  sm: "min-h-11 px-4 py-2 text-sm",
  md: "min-h-11 px-5 py-2 text-sm",
  lg: "min-h-[52px] px-6 text-base",
};

export function CTAButton({
  children,
  variant = "primary",
  size = "md",
  className,
  fullWidth = false,
  leftIcon,
  rightIcon,
  ringOffsetClassName = "focus-visible:ring-offset-background",
  ...props
}: CTAButtonProps) {
  const classes = cn(
    "group inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[transform,box-shadow,background-color,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:hover:scale-[1.02] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    ringOffsetClassName,
    fullWidth && "w-full",
    className,
  );

  const content = (
    <>
      {leftIcon}
      <span>{children}</span>
      {rightIcon ? (
        <span className="transition-transform duration-200 motion-safe:group-hover:translate-x-1">
          {rightIcon}
        </span>
      ) : null}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" {...props} className={classes}>
      {content}
    </button>
  );
}
