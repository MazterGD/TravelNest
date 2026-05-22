"use client";

import { forwardRef, useState, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { useClickOutside } from "@/hooks";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  options: SelectOption[];
  label?: string;
  error?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      label,
      error,
      placeholder = "Select an option",
      className,
      value,
      onChange,
      disabled,
      id,
      // Strip `required` so the browser's HTML5 validation never fires on the
      // visually-hidden native select — validation is handled in JS (handleSubmit).
      required: _required,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    // For uncontrolled usage only - tracks internal state when value prop is not provided
    const [internalValue, setInternalValue] = useState("");

    // Use controlled value when provided, otherwise use internal state
    const selectedValue = value !== undefined ? String(value) : internalValue;

    const containerRef = useClickOutside<HTMLDivElement>(() =>
      setIsOpen(false)
    );

    const selectedOption = options.find((opt) => opt.value === selectedValue);

    const handleSelect = (optionValue: string) => {
      // Update internal state for uncontrolled usage
      if (value === undefined) {
        setInternalValue(optionValue);
      }
      onChange?.(optionValue);
      setIsOpen(false);
    };

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

        <div ref={containerRef} className="relative">
          {/* Hidden native select for form submission */}
          <select
            ref={ref}
            id={id}
            value={selectedValue}
            onChange={(e) => handleSelect(e.target.value)}
            className="sr-only"
            disabled={disabled}
            {...props}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* Custom select button */}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5",
              "bg-background border border-input rounded-lg",
              "text-left text-sm",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
              "transition-colors duration-200",
              disabled && "opacity-50 cursor-not-allowed bg-muted",
              error && "border-destructive focus:ring-destructive",
              className
            )}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span
              className={cn(
                selectedOption ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {selectedOption?.label || placeholder}
            </span>
            <svg
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown options */}
          {isOpen && (
            <div
              className={cn(
                "absolute z-50 w-full mt-1",
                "bg-background border border-border rounded-lg shadow-lg",
                "max-h-60 overflow-auto",
                "animate-in fade-in-0 zoom-in-95 duration-150"
              )}
              role="listbox"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm",
                    "hover:bg-muted transition-colors",
                    option.value === selectedValue &&
                      "bg-primary/10 text-primary",
                    option.disabled && "opacity-50 cursor-not-allowed"
                  )}
                  role="option"
                  aria-selected={option.value === selectedValue}
                  disabled={option.disabled}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
