"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, BarChart3, Car, Coins, RefreshCw, Users } from "lucide-react";
import { Badge, Button, Card, LoadingSpinner, StatCard } from "@/components/ui";
import { useDashboardData } from "./hooks/useDashboardData";

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const relativeTime = (timestamp: string) => {
  const now = Date.now();
  const target = new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.floor((now - target) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
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

const TrendBars = ({
  title,
  data,
  valueFormatter,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  valueFormatter?: (value: number) => string;
}) => {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <Card className="h-full bg-background">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-4 space-y-3">
        {data.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{item.label}</span>
              <span>{valueFormatter ? valueFormatter(item.value) : item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default function AdminDashboardPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";

  const {
    isLoading,
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
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!overview) {
    return (
      <Card className="border-error-border bg-error-bg">
        <p className="text-sm font-medium text-error-text">
          {error || "Unable to load dashboard summary."}
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          value={overview.users.total}
          label="Total users"
          icon={<Users className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          value={overview.vehicles.total}
          label="Registered vehicles"
          icon={<Car className="h-5 w-5" />}
          variant="info"
        />
        <StatCard
          value={overview.bookings.total}
          label="All bookings"
          icon={<BarChart3 className="h-5 w-5" />}
          variant="success"
          trend={{ value: overview.bookings.completionRate, isPositive: true }}
        />
        <StatCard
          value={currencyFormatter.format(overview.finance.totalRevenue)}
          label="Completed revenue"
          icon={<Coins className="h-5 w-5" />}
          variant="warning"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <TrendBars
          title="Revenue by month"
          data={revenueChart.map((point) => ({
            label: point.month,
            value: point.revenue,
          }))}
          valueFormatter={(value) => currencyFormatter.format(value)}
        />

        <TrendBars
          title="User growth"
          data={userGrowthChart.map((point) => ({
            label: point.month,
            value: point.total,
          }))}
        />

        <TrendBars
          title="Booking volume"
          data={bookingTrendsChart.map((point) => ({
            label: point.month,
            value: point.total,
          }))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="mt-4 space-y-3">
            {activityFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity available.</p>
            ) : (
              activityFeed.map((event) => (
                <div key={event.id} className="rounded-xl border border-border bg-muted/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{event.title}</p>
                        <Badge size="sm" variant={activityVariant(event.type)}>
                          {event.type}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {relativeTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Pending actions</h2>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {pendingActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending actions right now.</p>
            ) : (
              pendingActions.map((action) => (
                <Link
                  key={action.id}
                  href={`/${locale}${action.href}`}
                  className="block rounded-xl border border-border bg-muted/70 p-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.count} item(s)</p>
                    </div>
                    <Badge variant={severityVariant(action.severity)}>{action.severity}</Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
