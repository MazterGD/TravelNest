"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Car,
  Coins,
  ExternalLink,
  RefreshCw,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Badge,
  Button,
  Card,
  SkeletonDashboard,
  StatCard,
} from "@/components/ui";
import { useDashboardData } from "./hooks/useDashboardData";
import type { AdminPendingAction } from "@/lib/api";

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const relativeTime = (timestamp: string) => {
  const now = Date.now();
  const target = new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.floor((now - target) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const severityVariant = (severity: "low" | "medium" | "high") => {
  if (severity === "high") return "danger" as const;
  if (severity === "medium") return "warning" as const;
  return "secondary" as const;
};

const activityVariant = (type: "booking" | "user" | "audit") => {
  if (type === "booking") return "info" as const;
  if (type === "user") return "success" as const;
  return "secondary" as const;
};

// Maps each pending action ID (as returned by the backend) to the query string
// that pre-filters the destination page to show only the actionable subset.
const PENDING_ACTION_QUERY: Record<string, string> = {
  "owner-approvals":     "status=PENDING_VERIFICATION",
  "vehicle-approvals":   "documentStatus=PENDING",
  "pending-bookings":    "status=PENDING",
  "failed-payments":     "status=FAILED",
  "open-disputes":       "status=OPEN",
  "pending-settlements": "status=PENDING",
};

// ─── Pending action card ────────────────────────────────────────────────────

interface PendingActionCardProps {
  action: AdminPendingAction;
  locale: string;
  countLabel: string;
}

function PendingActionCard({
  action,
  locale,
  countLabel,
}: PendingActionCardProps) {
  const isHigh = action.severity === "high";
  const isMedium = action.severity === "medium";

  const query = PENDING_ACTION_QUERY[action.id];
  const href = query
    ? `/${locale}${action.href}?${query}`
    : `/${locale}${action.href}`;

  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-[20px] border p-6 transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2",
        isHigh &&
          "border-[var(--color-error-border)] bg-[var(--color-error-bg)] hover:shadow-md",
        isMedium &&
          "border-[var(--color-action-primary)]/30 bg-[var(--color-bg-base)] hover:shadow-md",
        !isHigh &&
          !isMedium &&
          "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant={severityVariant(action.severity)} size="sm">
          {action.severity}
        </Badge>
        <ArrowUpRight
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-colors",
            isHigh
              ? "text-[var(--color-error-text)] group-hover:text-[var(--color-error-text)]"
              : "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-action-primary)]",
          )}
          aria-hidden="true"
        />
      </div>

      <div className="mt-4">
        <p
          className={cn(
            "text-4xl font-bold tabular-nums leading-none",
            isHigh
              ? "text-[var(--color-error-text)]"
              : "text-[var(--color-text-primary)]",
          )}
        >
          {action.count}
        </p>
        <p
          className={cn(
            "mt-2 text-sm font-semibold",
            isHigh
              ? "text-[var(--color-error-text)]"
              : "text-[var(--color-text-primary)]",
          )}
        >
          {action.title}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
          {countLabel}
        </p>
      </div>
    </Link>
  );
}

// ─── Trend bars ─────────────────────────────────────────────────────────────

interface TrendBarsProps {
  title: string;
  data: Array<{ label: string; value: number }>;
  valueFormatter?: (value: number) => string;
  emptyLabel: string;
}

function TrendBars({
  title,
  data,
  valueFormatter,
  emptyLabel,
}: TrendBarsProps) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <Card className="h-full bg-[var(--color-bg-base)]">
      <figure>
        <figcaption className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </figcaption>
        {data.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            {emptyLabel}
          </p>
        ) : (
          <ul className="mt-4 space-y-3" role="list">
            {data.map((item) => (
              <li key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    {item.label}
                  </span>
                  <span className="tabular-nums font-semibold text-[var(--color-text-primary)]">
                    {valueFormatter ? valueFormatter(item.value) : item.value}
                  </span>
                </div>
                {/* aria-hidden: value already communicated by the text above */}
                <div
                  className="h-2 rounded-full bg-[var(--color-bg-surface)]"
                  aria-hidden="true"
                >
                  <div
                    className="h-2 rounded-full bg-[var(--color-action-primary)] transition-all duration-500"
                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </figure>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

const ACTIVITY_VISIBLE_COUNT = 5;

export default function AdminDashboardPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("adminDashboard");

  const {
    isLoading,
    isFetching,
    error,
    overview,
    revenueChart,
    userGrowthChart,
    bookingTrendsChart,
    activityFeed,
    pendingActions,
    refetch,
  } = useDashboardData(6);

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  if (!overview) {
    return (
      <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)]">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-[var(--color-error-text)]">
            {error ?? t("loadFailed")}
          </p>
        </div>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => void refetch()}
          aria-label={t("ariaRefresh")}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("retry")}
        </Button>
      </Card>
    );
  }

  const visibleActivity = activityFeed.slice(0, ACTIVITY_VISIBLE_COUNT);
  const hasMoreActivity = activityFeed.length > ACTIVITY_VISIBLE_COUNT;

  return (
    <div className="space-y-8">
      {/* Screen-reader live region for background refetch state */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isFetching ? t("refreshing") : ""}
      </div>

      {/* Soft error banner — refetch failed but stale data is still visible */}
      {error && (
        <div role="alert" aria-live="polite">
          <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)]">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className="h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
                aria-hidden="true"
              />
              <p className="flex-1 text-sm font-medium text-[var(--color-error-text)]">
                {error}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refetch()}
                aria-label={t("ariaRefresh")}
              >
                {t("retry")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Critical financial alert */}
      {/* {overview.finance.failedPaymentCount > 0 && (
        <div role="alert">
          <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)]">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className="h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
                aria-hidden="true"
              />
              <p className="flex-1 text-sm font-medium text-[var(--color-error-text)]">
                {t("alerts.failedPayments", {
                  count: overview.finance.failedPaymentCount,
                })}
              </p>
              <Link
                href={`/${locale}/admin/financial`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-error-text)] underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
              >
                {t("alerts.viewFinancial")}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </div>
      )} */}

      {/* ── 1. PENDING ACTIONS ─ highest priority; at the top ────────────── */}
      <section aria-label={t("sections.pending")}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("sections.pending")}
            </h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            aria-label={t("ariaRefresh")}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            {t("refresh")}
          </Button>
        </div>

        {pendingActions.length === 0 ? (
          <Card className="bg-[var(--color-bg-base)]">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("sections.pendingEmpty")}
            </p>
          </Card>
        ) : (
          <ul
            role="list"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {pendingActions.map((action) => (
              <li key={action.id}>
                <PendingActionCard
                  action={action}
                  locale={locale}
                  countLabel={t("sections.pendingCount", {
                    count: action.count,
                  })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 2. KPI BAND ─ platform health at a glance ────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">
          Platform Overview
        </h2>
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label={t("kpiLabel")}
        >
          <StatCard
            value={overview.users.total}
            label={t("kpi.users")}
            icon={<Users className="h-5 w-5" />}
            variant="primary"
            subStat={t("kpi.subStat.verifiedOwners", {
              verified: overview.users.verifiedOwners,
              total: overview.users.owners,
            })}
          />
          <StatCard
            value={overview.vehicles.total}
            label={t("kpi.vehicles")}
            icon={<Car className="h-5 w-5" />}
            variant="info"
            subStat={t("kpi.subStat.activeVehicles", {
              count: overview.vehicles.active,
            })}
          />
          <StatCard
            value={overview.bookings.total}
            label={t("kpi.bookings")}
            icon={<BarChart3 className="h-5 w-5" />}
            variant="success"
            trend={{
              value: overview.bookings.completionRate,
              isPositive: true,
            }}
            subStat={
              overview.bookings.pending > 0
                ? t("kpi.subStat.pendingBookings", {
                    count: overview.bookings.pending,
                  })
                : undefined
            }
          />
          <StatCard
            value={currencyFormatter.format(overview.finance.totalRevenue)}
            label={t("kpi.revenue")}
            icon={<Coins className="h-5 w-5" />}
            variant="success"
            subStat={t("kpi.subStat.payments", {
              count: overview.finance.successfulPaymentCount,
            })}
          />
        </section>
      </div>

      {/* ── 3. RECENT ACTIVITY ─ what's been happening ───────────────────── */}
      <section aria-label={t("sections.activity")}>
        <Card className="bg-[var(--color-bg-base)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("sections.activity")}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                {t("sections.activityHint")}
              </p>
            </div>
            <Activity
              className="h-4 w-4 text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            />
          </div>

          <div className="mt-4">
            {visibleActivity.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("sections.activityEmpty")}
              </p>
            ) : (
              <ul role="list" className="space-y-3">
                {visibleActivity.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {event.title}
                          </p>
                          <Badge
                            size="sm"
                            variant={activityVariant(event.type)}
                          >
                            {event.type}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {event.description}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-[var(--color-text-tertiary)]">
                        {relativeTime(event.timestamp)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hasMoreActivity && (
            <div className="mt-4 border-t border-[var(--color-border-default)] pt-4">
              <Link
                href={`/${locale}/admin/audit-logs`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
              >
                {t("viewAllActivity")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </Card>
      </section>

      {/* ── 4. TRENDS ─ historical view; informational only ───────────────── */}
      <section aria-label={t("trendsLabel")}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("sections.trends")}
          </h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t("sections.trendsHint")}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <TrendBars
            title={t("charts.revenue")}
            data={revenueChart.map((p) => ({
              label: p.month,
              value: p.revenue,
            }))}
            valueFormatter={(v) => currencyFormatter.format(v)}
            emptyLabel={t("charts.empty")}
          />
          <TrendBars
            title={t("charts.userGrowth")}
            data={userGrowthChart.map((p) => ({
              label: p.month,
              value: p.total,
            }))}
            emptyLabel={t("charts.empty")}
          />
          <TrendBars
            title={t("charts.bookingVolume")}
            data={bookingTrendsChart.map((p) => ({
              label: p.month,
              value: p.total,
            }))}
            emptyLabel={t("charts.empty")}
          />
        </div>
      </section>
    </div>
  );
}
