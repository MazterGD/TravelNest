"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: "default" | "pills" | "underline";
  className?: string;
  tabsClassName?: string;
  contentClassName?: string;
}

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  variant = "default",
  className,
  tabsClassName,
  contentClassName,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  const baseTabClasses =
    "inline-flex min-h-11 items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

  const variantClasses = {
    default: {
      container: "border-b border-border",
      tab: cn(
        baseTabClasses,
        "px-4 py-2.5 -mb-px border-b-2 border-transparent",
        "hover:text-foreground hover:border-muted",
        "data-[active=true]:border-primary data-[active=true]:text-primary",
      ),
    },
    pills: {
      container: "rounded-[20px] bg-muted p-1",
      tab: cn(
        baseTabClasses,
        "rounded-xl px-4 py-2",
        "hover:bg-muted-foreground/10",
        "data-[active=true]:bg-background data-[active=true]:shadow-sm",
      ),
    },
    underline: {
      container: "",
      tab: cn(
        baseTabClasses,
        "px-1 py-2 mr-6 border-b-2 border-transparent",
        "hover:border-muted-foreground",
        "data-[active=true]:border-primary data-[active=true]:text-primary",
      ),
    },
  };

  return (
    <div className={className}>
      {/* Tab buttons */}
      <div
        className={cn("flex", variantClasses[variant].container, tabsClassName)}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            data-active={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              variantClasses[variant].tab,
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "ml-1 px-2 py-0.5 text-xs rounded-full",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={activeTab}
        className={cn("mt-4", contentClassName)}
      >
        {activeContent}
      </div>
    </div>
  );
}

// Controlled tabs for more control
interface ControlledTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    badge?: string | number;
    disabled?: boolean;
  }>;
  variant?: "default" | "pills" | "underline";
  className?: string;
}

export function TabsList({
  activeTab,
  onTabChange,
  tabs,
  variant = "default",
  className,
}: ControlledTabsProps) {
  const baseTabClasses =
    "inline-flex min-h-11 items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

  const variantClasses = {
    default: {
      container: "border-b border-border",
      tab: cn(
        baseTabClasses,
        "px-4 py-2.5 -mb-px border-b-2 border-transparent",
        "hover:text-foreground hover:border-muted",
      ),
      active: "border-primary text-primary",
    },
    pills: {
      container: "rounded-[20px] bg-muted p-1",
      tab: cn(
        baseTabClasses,
        "rounded-xl px-4 py-2",
        "hover:bg-muted-foreground/10",
      ),
      active: "bg-background shadow-sm",
    },
    underline: {
      container: "",
      tab: cn(
        baseTabClasses,
        "px-1 py-2 mr-6 border-b-2 border-transparent",
        "hover:border-muted-foreground",
      ),
      active: "border-primary text-primary",
    },
  };

  return (
    <div
      className={cn("flex", variantClasses[variant].container, className)}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          disabled={tab.disabled}
          className={cn(
            variantClasses[variant].tab,
            activeTab === tab.id
              ? variantClasses[variant].active
              : "text-muted-foreground",
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.badge !== undefined && (
            <span
              className={cn(
                "ml-1 px-2 py-0.5 text-xs rounded-full",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
