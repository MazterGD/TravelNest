"use client";

import {
  AlertTriangle,
  BarChart3,
  Coins,
  Download,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Button,
  Card,
  DatePicker,
  SkeletonDashboard,
  StatCard,
} from "@/components/ui";
import { useAnalyticsData } from "./hooks/useAnalyticsData";

// ─── Formatters ───────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const pctFormatter = (value: number) => `${value.toFixed(1)}%`;

// ─── Quick date presets ───────────────────────────────────────────────────────

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

const DATE_PRESETS = [
  {
    label: "Last 7 days",
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
    },
  },
  {
    label: "Last 30 days",
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
    },
  },
  {
    label: "Last 90 days",
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
    },
  },
  {
    label: "Last year",
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
    },
  },
];

// ─── TrendBars ────────────────────────────────────────────────────────────────

interface TrendBarsProps {
  title: string;
  data: Array<{ label: string; value: number }>;
  valueFormatter?: (value: number) => string;
}

function TrendBars({ title, data, valueFormatter }: TrendBarsProps) {
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <Card className="h-full bg-[var(--color-bg-base)]">
      <figure>
        <figcaption className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </figcaption>
        {data.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            No data available for this period.
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
                    {valueFormatter
                      ? valueFormatter(item.value)
                      : numberFormatter.format(item.value)}
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

// ─── MetricRow ────────────────────────────────────────────────────────────────

interface MetricRowProps {
  label: string;
  value: string;
  accent?: boolean;
}

function MetricRow({ label, value, accent = false }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border-default)] py-2.5 last:border-0">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span
        className={cn(
          "tabular-nums text-sm font-semibold",
          accent
            ? "text-[var(--color-action-primary)]"
            : "text-[var(--color-text-primary)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── DistributionList ─────────────────────────────────────────────────────────

interface DistributionItem {
  label: string;
  count: number;
}

interface DistributionListProps {
  items: DistributionItem[];
  total: number;
}

function DistributionList({ items, total }: DistributionListProps) {
  const maxCount = Math.max(1, ...items.map((i) => i.count));

  return (
    <ul className="space-y-3" role="list">
      {items.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--color-text-secondary)]">
              {item.label}
            </span>
            <span className="tabular-nums text-[var(--color-text-primary)]">
              {numberFormatter.format(item.count)}
              {total > 0 && (
                <span className="ml-1 text-[var(--color-text-tertiary)]">
                  ({Math.round((item.count / total) * 100)}%)
                </span>
              )}
            </span>
          </div>
          {/* aria-hidden: counts are already communicated as text above */}
          <div
            className="h-1.5 rounded-full bg-[var(--color-bg-surface)]"
            aria-hidden="true"
          >
            <div
              className="h-1.5 rounded-full bg-[var(--color-action-primary)] opacity-70"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const {
    isLoading,
    isFetching,
    isMutating,
    error,
    dateRange,
    usersAnalytics,
    bookingsAnalytics,
    financialAnalytics,
    operationalAnalytics,
    geographicAnalytics,
    setDateRange,
    exportCsv,
    refetch,
  } = useAnalyticsData();

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  // Prepare trend series — last 10 data points
  const userGrowthTrend = (usersAnalytics?.growthSeries ?? [])
    .slice(-10)
    .map((p) => ({ label: p.date, value: p.value }));

  const bookingVolumeTrend = (bookingsAnalytics?.bookingTrend ?? [])
    .slice(-10)
    .map((p) => ({ label: p.date, value: p.value }));

  const paymentRevenueTrend = (financialAnalytics?.completedTrend ?? [])
    .slice(-10)
    .map((p) => ({ label: p.date, value: p.value }));

  // Prepare distribution data
  const bookingStatusItems = (bookingsAnalytics?.statusDistribution ?? []).map(
    (item) => ({ label: item.status, count: item.count }),
  );
  const bookingStatusTotal = bookingStatusItems.reduce(
    (sum, i) => sum + i.count,
    0,
  );

  const userRoleItems = (usersAnalytics?.roleDistribution ?? []).map((item) => ({
    label: item.role,
    count: item.count,
  }));
  const userRoleTotal = userRoleItems.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="space-y-8">
      {/* Screen-reader live region for background refresh */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isFetching ? "Refreshing analytics data…" : ""}
      </div>

      {/* ── 1. Page header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Platform performance metrics and trends.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Refresh analytics data"
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => void exportCsv()}
            disabled={isMutating}
            aria-label="Export analytics data as CSV"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── 2. Date range filter ──────────────────────────────────────────── */}
      <Card className="bg-[var(--color-bg-base)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full sm:w-[200px]">
              <DatePicker
                id="analytics-start-date"
                label="Start date"
                value={dateRange.startDate ?? ""}
                onChange={(e) => setDateRange({ startDate: e.target.value })}
                max={dateRange.endDate}
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <DatePicker
                id="analytics-end-date"
                label="End date"
                value={dateRange.endDate ?? ""}
                onChange={(e) => setDateRange({ endDate: e.target.value })}
                min={dateRange.startDate}
              />
            </div>
          </div>
          {/* Quick preset chips */}
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Date range presets"
          >
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDateRange(preset.getDates())}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]",
                  "text-[var(--color-text-secondary)]",
                  "hover:border-[var(--color-action-primary)]/50 hover:text-[var(--color-action-primary)]",
                  "focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── 3. Error banner ───────────────────────────────────────────────── */}
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
                aria-label="Retry loading analytics"
              >
                Retry
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── 4. KPI band ───────────────────────────────────────────────────── */}
      <section aria-label="Key performance indicators">
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
          Platform Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            value={
              usersAnalytics
                ? numberFormatter.format(usersAnalytics.totalUsers)
                : "—"
            }
            label="Total Users"
            icon={<Users className="h-5 w-5" />}
            variant="primary"
            subStat={
              usersAnalytics?.newUsersInRange
                ? `+${numberFormatter.format(usersAnalytics.newUsersInRange)} new this period`
                : undefined
            }
          />
          <StatCard
            value={
              bookingsAnalytics
                ? numberFormatter.format(
                    bookingsAnalytics.totalBookingsInRange,
                  )
                : "—"
            }
            label="Bookings This Period"
            icon={<BarChart3 className="h-5 w-5" />}
            variant="info"
            subStat={
              bookingsAnalytics
                ? `${pctFormatter(bookingsAnalytics.completionRate)} completion rate`
                : undefined
            }
          />
          <StatCard
            value={
              financialAnalytics
                ? currencyFormatter.format(financialAnalytics.completedRevenue)
                : "—"
            }
            label="Completed Revenue"
            icon={<Coins className="h-5 w-5" />}
            variant="success"
            subStat={
              financialAnalytics
                ? `Net: ${currencyFormatter.format(financialAnalytics.netRevenue)}`
                : undefined
            }
          />
          <StatCard
            value={
              operationalAnalytics
                ? numberFormatter.format(
                    operationalAnalytics.pendingVerificationItems,
                  )
                : "—"
            }
            label="Pending Verifications"
            icon={<ShieldAlert className="h-5 w-5" />}
            variant={
              (operationalAnalytics?.pendingVerificationItems ?? 0) > 0
                ? "warning"
                : "success"
            }
            subStat={
              operationalAnalytics
                ? `${numberFormatter.format(operationalAnalytics.pendingOwnerVerifications)} owner · ${numberFormatter.format(operationalAnalytics.pendingVehicleDocuments)} vehicle`
                : undefined
            }
          />
        </div>
      </section>

      {/* ── 5. Revenue & booking metrics detail ──────────────────────────── */}
      <section aria-label="Revenue and booking metrics detail">
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
          Metrics Detail
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Revenue breakdown */}
          <Card className="bg-[var(--color-bg-base)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Revenue Breakdown
            </h3>
            <div className="mt-4">
              <MetricRow
                label="Gross Revenue"
                value={currencyFormatter.format(
                  financialAnalytics?.grossRevenue ?? 0,
                )}
              />
              <MetricRow
                label="Completed Revenue"
                value={currencyFormatter.format(
                  financialAnalytics?.completedRevenue ?? 0,
                )}
                accent
              />
              <MetricRow
                label="Net Revenue"
                value={currencyFormatter.format(
                  financialAnalytics?.netRevenue ?? 0,
                )}
              />
              <MetricRow
                label="Refunded Amount"
                value={currencyFormatter.format(
                  financialAnalytics?.refundedAmount ?? 0,
                )}
              />
              <MetricRow
                label="Est. Commission"
                value={currencyFormatter.format(
                  financialAnalytics?.estimatedCommission ?? 0,
                )}
              />
            </div>
          </Card>

          {/* Booking funnel */}
          <Card className="bg-[var(--color-bg-base)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Booking Metrics
            </h3>
            <div className="mt-4">
              <MetricRow
                label="Total Bookings"
                value={numberFormatter.format(
                  bookingsAnalytics?.totalBookingsInRange ?? 0,
                )}
                accent
              />
              <MetricRow
                label="Gross Booking Value"
                value={currencyFormatter.format(
                  bookingsAnalytics?.grossBookingValue ?? 0,
                )}
              />
              <MetricRow
                label="Average Booking Value"
                value={currencyFormatter.format(
                  bookingsAnalytics?.averageBookingValue ?? 0,
                )}
              />
              <MetricRow
                label="Completion Rate"
                value={pctFormatter(
                  bookingsAnalytics?.completionRate ?? 0,
                )}
              />
              <MetricRow
                label="Cancellation Rate"
                value={pctFormatter(
                  bookingsAnalytics?.cancellationRate ?? 0,
                )}
              />
            </div>
          </Card>
        </div>
      </section>

      {/* ── 6. Trend charts ───────────────────────────────────────────────── */}
      <section aria-label="Growth and activity trends">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Trends
          </h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Last 10 data points in selected period
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <TrendBars title="User Growth" data={userGrowthTrend} />
          <TrendBars title="Booking Volume" data={bookingVolumeTrend} />
          <TrendBars
            title="Completed Payments"
            data={paymentRevenueTrend}
            valueFormatter={(v) => currencyFormatter.format(v)}
          />
        </div>
      </section>

      {/* ── 7. Distribution snapshots ─────────────────────────────────────── */}
      <section aria-label="Distribution snapshots">
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
          Distributions
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-[var(--color-bg-base)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Bookings by Status
            </h3>
            <div className="mt-4">
              {bookingStatusItems.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No booking data available for this period.
                </p>
              ) : (
                <DistributionList
                  items={bookingStatusItems}
                  total={bookingStatusTotal}
                />
              )}
            </div>
          </Card>

          <Card className="bg-[var(--color-bg-base)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Users by Role
            </h3>
            <div className="mt-4">
              {userRoleItems.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No user distribution data available.
                </p>
              ) : (
                <DistributionList
                  items={userRoleItems}
                  total={userRoleTotal}
                />
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* ── 8. Geographic insights ────────────────────────────────────────── */}
      <section aria-label="Geographic insights">
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
          Geographic Insights
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-[var(--color-bg-base)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Top Pickup Cities
            </h3>
            {(geographicAnalytics?.bookingsByPickupCity ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                No geographic data available for this period.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list">
                {(geographicAnalytics?.bookingsByPickupCity ?? [])
                  .slice(0, 8)
                  .map((item) => (
                    <li
                      key={item.city}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <MapPin
                          className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-tertiary)]"
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium text-[var(--color-text-primary)]">
                          {item.city}
                        </span>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="tabular-nums text-[var(--color-text-secondary)]">
                          {numberFormatter.format(item.bookingCount)} bookings
                        </span>
                        <span className="ml-2 tabular-nums text-[var(--color-text-tertiary)]">
                          {currencyFormatter.format(item.totalAmount)}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card className="bg-[var(--color-bg-base)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Top Routes
            </h3>
            {(geographicAnalytics?.topRoutes ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                No route data available for this period.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list">
                {(geographicAnalytics?.topRoutes ?? [])
                  .slice(0, 8)
                  .map((item, index) => (
                    <li
                      key={item.route}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-surface)] text-xs font-semibold text-[var(--color-text-tertiary)]"
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <span className="truncate font-medium text-[var(--color-text-primary)]">
                          {item.route}
                        </span>
                      </div>
                      <span className="flex-shrink-0 tabular-nums text-[var(--color-text-secondary)]">
                        {numberFormatter.format(item.count)} bookings
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {/* ── 9. Operational health ─────────────────────────────────────────── */}
      <section aria-label="Operational health">
        <Card className="bg-[var(--color-bg-base)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Operational Health
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Verification Queue
              </p>
              <MetricRow
                label="Pending owner verifications"
                value={numberFormatter.format(
                  operationalAnalytics?.pendingOwnerVerifications ?? 0,
                )}
              />
              <MetricRow
                label="Pending owner documents"
                value={numberFormatter.format(
                  operationalAnalytics?.pendingOwnerDocuments ?? 0,
                )}
              />
              <MetricRow
                label="Pending vehicle documents"
                value={numberFormatter.format(
                  operationalAnalytics?.pendingVehicleDocuments ?? 0,
                )}
              />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Platform Activity
              </p>
              <MetricRow
                label="Audit events this period"
                value={numberFormatter.format(
                  operationalAnalytics?.auditEventsInRange ?? 0,
                )}
              />
              <MetricRow
                label="Avg. payment resolution"
                value={`${(operationalAnalytics?.averagePaymentResolutionHours ?? 0).toFixed(1)} hrs`}
              />
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
