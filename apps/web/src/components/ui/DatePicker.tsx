"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          type="date"
          id={id}
          className={cn(
            "w-full px-3 py-2.5 bg-background border border-input rounded-lg",
            "text-sm text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          {...props}
        />

        {helperText && !error && (
          <p className="mt-1.5 text-sm text-muted-foreground">{helperText}</p>
        )}

        {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";

interface TimePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          type="time"
          id={id}
          className={cn(
            "w-full px-3 py-2.5 bg-background border border-input rounded-lg",
            "text-sm text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          {...props}
        />

        {helperText && !error && (
          <p className="mt-1.5 text-sm text-muted-foreground">{helperText}</p>
        )}

        {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

TimePicker.displayName = "TimePicker";

interface DateTimePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const DateTimePicker = forwardRef<HTMLInputElement, DateTimePickerProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          type="datetime-local"
          id={id}
          className={cn(
            "w-full px-3 py-2.5 bg-background border border-input rounded-lg",
            "text-sm text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          {...props}
        />

        {helperText && !error && (
          <p className="mt-1.5 text-sm text-muted-foreground">{helperText}</p>
        )}

        {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

DateTimePicker.displayName = "DateTimePicker";
