"use client";

import { Download, RefreshCw, TrendingUp } from "lucide-react";
import { Button, Card, Input, LoadingSpinner, StatCard } from "@/components/ui";
import { useAnalyticsData } from "./hooks/useAnalyticsData";

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const MiniChart = ({
  title,
  data,
}: {
  title: string;
  data: Array<{ date: string; value: number }>;
}) => {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <Card className="bg-background">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-4 space-y-2">
        {data.slice(-10).map((item) => (
          <div key={item.date} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{item.date}</span>
              <span>{numberFormatter.format(item.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default function AdminAnalyticsPage() {
  const {
    isLoading,
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
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-[220px]">
            <Input
              label="Start date"
              type="date"
              value={dateRange.startDate}
              onChange={(event) => setDateRange({ startDate: event.target.value })}
            />
          </div>
          <div className="w-full sm:w-[220px]">
            <Input
              label="End date"
              type="date"
              value={dateRange.endDate}
              onChange={(event) => setDateRange({ endDate: event.target.value })}
            />
          </div>
          <Button variant="secondary" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void exportCsv()} disabled={isMutating}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          value={usersAnalytics ? numberFormatter.format(usersAnalytics.totalUsers) : "0"}
          label="Total users"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          value={
            bookingsAnalytics
              ? numberFormatter.format(bookingsAnalytics.totalBookingsInRange)
              : "0"
          }
          label="Bookings in range"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="info"
        />
        <StatCard
          value={
            financialAnalytics
              ? currencyFormatter.format(financialAnalytics.completedRevenue)
              : currencyFormatter.format(0)
          }
          label="Completed revenue"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="success"
        />
        <StatCard
          value={
            operationalAnalytics
              ? numberFormatter.format(operationalAnalytics.pendingVerificationItems)
              : "0"
          }
          label="Pending verification items"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="warning"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <MiniChart
          title="User growth trend"
          data={usersAnalytics?.growthSeries || []}
        />
        <MiniChart
          title="Booking creation trend"
          data={bookingsAnalytics?.bookingTrend || []}
        />
        <MiniChart
          title="Completed payment trend"
          data={financialAnalytics?.completedTrend || []}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Distribution snapshots</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                User roles
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {usersAnalytics?.roleDistribution.map((item) => (
                  <li key={item.role} className="flex items-center justify-between">
                    <span className="text-foreground">{item.role}</span>
                    <span className="text-muted-foreground">
                      {numberFormatter.format(item.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Booking statuses
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {bookingsAnalytics?.statusDistribution.map((item) => (
                  <li key={item.status} className="flex items-center justify-between">
                    <span className="text-foreground">{item.status}</span>
                    <span className="text-muted-foreground">
                      {numberFormatter.format(item.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Operational snapshot</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Pending owner verifications</span>
              <span className="text-muted-foreground">
                {numberFormatter.format(
                  operationalAnalytics?.pendingOwnerVerifications || 0,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Pending owner documents</span>
              <span className="text-muted-foreground">
                {numberFormatter.format(operationalAnalytics?.pendingOwnerDocuments || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Pending vehicle documents</span>
              <span className="text-muted-foreground">
                {numberFormatter.format(operationalAnalytics?.pendingVehicleDocuments || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Audit events in range</span>
              <span className="text-muted-foreground">
                {numberFormatter.format(operationalAnalytics?.auditEventsInRange || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Avg payment resolution (hrs)</span>
              <span className="text-muted-foreground">
                {(operationalAnalytics?.averagePaymentResolutionHours || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Top pickup cities</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {(geographicAnalytics?.bookingsByPickupCity || []).slice(0, 8).map((item) => (
              <li key={item.city} className="flex items-center justify-between">
                <span className="text-foreground">{item.city}</span>
                <span className="text-muted-foreground">
                  {item.bookingCount} bookings · {currencyFormatter.format(item.totalAmount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Top routes</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {(geographicAnalytics?.topRoutes || []).slice(0, 8).map((item) => (
              <li key={item.route} className="flex items-center justify-between">
                <span className="text-foreground">{item.route}</span>
                <span className="text-muted-foreground">{item.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
