"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner, Skeleton } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import {
  vehicleService,
  quotationService,
  bookingService,
  ownerService,
  ApiError,
} from "@/lib/api";
import {
  DollarSign,
  Calendar,
  FileText,
  Star,
  Bus,
  Plus,
  ClipboardList,
  ArrowRight,
  MapPin,
  Users,
  Clock,
  MessageSquareText,
  BarChart3,
  Wallet,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

interface DashboardMetrics {
  totalRevenue: number;
  activeBookings: number;
  pendingQuotes: number;
  averageRating: number;
}

interface FleetStats {
  active: number;
  inactive: number;
  pendingReview: number;
  utilization: number;
}

interface QuotationRequest {
  id: string;
  customer: string;
  route: string;
  date: string;
  passengers: number;
  expiresIn: string;
}

interface UpcomingBooking {
  id: string;
  customer: string;
  route: string;
  date: string;
  vehicle: string;
}

interface RevenuePoint {
  month: string;
  revenue: number;
}

interface RecentReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  vehicleName: string;
  customerName: string;
  ownerResponse: string | null;
}

function VerificationBanner({
  status,
  isVerified,
}: {
  status: string;
  isVerified: boolean;
}) {
  const t = useTranslations();

  if (isVerified && status === "ACTIVE") return null;

  const isRejected = status === "PENDING_VERIFICATION" && false;

  if (status === "REJECTED" || (status === "PENDING_VERIFICATION" && isRejected)) {
    return (
      <div
        role="alert"
        className="mb-6 flex items-start gap-3 rounded-lg border border-[--color-error-border] bg-[--color-error-bg] p-4"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[--color-error-text]" />
        <div>
          <p className="font-semibold text-[--color-error-text]">
            {t("ownerDashboard.verificationRejected", {
              defaultValue: "Verification Not Approved",
            })}
          </p>
          <p className="mt-0.5 text-sm text-[--color-error-text]">
            {t("ownerDashboard.verificationRejectedDesc", {
              defaultValue:
                "Your documents were not approved. Please resubmit from your Profile page.",
            })}
          </p>
        </div>
        <Link
          href={`../owner/profile`}
          className="ml-auto shrink-0 rounded-md bg-[--color-error-border] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
        >
          {t("ownerDashboard.resubmit", { defaultValue: "Resubmit" })}
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-lg border border-[--color-border-default] bg-[--color-bg-surface] p-4"
    >
      <Loader className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[--color-text-secondary]" />
      <div>
        <p className="font-semibold text-[--color-text-primary]">
          {t("ownerDashboard.pendingVerification", {
            defaultValue: "Account Pending Verification",
          })}
        </p>
        <p className="mt-0.5 text-sm text-[--color-text-secondary]">
          {t("ownerDashboard.pendingVerificationDesc", {
            defaultValue:
              "Our team is reviewing your documents. You will be notified once approved — this usually takes 1–2 business days.",
          })}
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[--color-border-default] bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          )}
        </div>
        <div className="rounded-full bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  );
}

function DashboardRevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[--color-border-default] bg-card px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        LKR {Number(payload[0].value).toLocaleString()}
      </p>
    </div>
  );
}

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const t = useTranslations();
  const hasData = data.some((d) => d.revenue > 0);

  return (
    <div className="rounded-lg border border-[--color-border-default] bg-card p-6">
      <h2 className="mb-4 text-base font-semibold text-foreground">
        {t("ownerDashboard.revenueChart", {
          defaultValue: "Revenue (Last 6 Months)",
        })}
      </h2>
      {hasData ? (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="dashRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#20B0E9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#20B0E9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-default)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
                width={42}
              />
              <RechartsTooltip content={<DashboardRevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#20B0E9"
                strokeWidth={2}
                fill="url(#dashRevenueGrad)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#20B0E9",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-40 flex-col items-center justify-center text-center">
          <BarChart3 className="mb-2 h-8 w-8 text-[--color-text-tertiary]" />
          <p className="text-sm text-muted-foreground">
            {t("ownerDashboard.noRevenueData", {
              defaultValue: "Revenue data will appear here once you have completed bookings.",
            })}
          </p>
        </div>
      )}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= rating
              ? "fill-current text-primary"
              : "text-[--color-text-tertiary]"
          }`}
        />
      ))}
    </div>
  );
}

export default function OwnerDashboardPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const { user } = useAuthStore();
  const [quotationFilter, setQuotationFilter] = useState<
    "all" | "new" | "pending"
  >("all");

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    activeBookings: 0,
    pendingQuotes: 0,
    averageRating: 0,
  });
  const [fleetStats, setFleetStats] = useState<FleetStats>({
    active: 0,
    inactive: 0,
    pendingReview: 0,
    utilization: 0,
  });
  const [quotationRequests, setQuotationRequests] = useState<
    QuotationRequest[]
  >([]);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>(
    [],
  );
  const [revenueChart, setRevenueChart] = useState<RevenuePoint[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);

  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  useEffect(() => {
    const calculateExpiresIn = (quotation: {
      createdAt?: string;
      sentAt?: string | null;
      validityDays?: number | null;
    }): string => {
      const baseDate = quotation.sentAt || quotation.createdAt;
      if (!baseDate || !quotation.validityDays) return "N/A";
      const expiresAt =
        new Date(baseDate).getTime() +
        quotation.validityDays * 24 * 60 * 60 * 1000;
      const daysRemaining = Math.ceil(
        (expiresAt - Date.now()) / (24 * 60 * 60 * 1000),
      );
      if (daysRemaining < 0) return "Expired";
      if (daysRemaining === 0) return "Today";
      if (daysRemaining === 1) return "1 day";
      return `${daysRemaining} days`;
    };

    const fetchDashboardData = async () => {
      if (!user) return;
      setIsLoadingData(true);

      try {
        const [dashboardData, vehicleRes, revenueData, reviewsData] =
          await Promise.all([
            ownerService.getDashboardStats(),
            vehicleService.getMyVehicles(),
            ownerService.getRevenueChart(),
            ownerService.getRecentReviews(),
          ]);

        const stats = (dashboardData as any) || {};
        setMetrics({
          totalRevenue: stats.totalRevenue ?? 0,
          activeBookings: stats.activeBookings ?? 0,
          pendingQuotes: stats.pendingQuotes ?? 0,
          averageRating: stats.averageRating ?? 0,
        });

        const vehicleList = ((vehicleRes as any)?.vehicles || []) as Array<{
          isActive: boolean;
          isAvailable: boolean;
        }>;
        const activeV = vehicleList.filter(
          (v) => v.isActive && v.isAvailable,
        ).length;
        const inactiveV = vehicleList.filter(
          (v) => v.isActive && !v.isAvailable,
        ).length;
        const pendingV = vehicleList.filter((v) => !v.isActive).length;
        setFleetStats({
          active: activeV,
          inactive: inactiveV,
          pendingReview: pendingV,
          utilization:
            vehicleList.length > 0
              ? Math.round((activeV / vehicleList.length) * 100)
              : 0,
        });

        setRevenueChart(Array.isArray(revenueData) ? revenueData : []);
        setRecentReviews(Array.isArray(reviewsData) ? reviewsData : []);
      } catch {
        // Dashboard data fetch errors are non-fatal; partial data is acceptable
      }

      // Quotation requests and bookings fetched separately so partial failure
      // doesn't block the whole dashboard
      try {
        const res = await quotationService.getOwnerRequests({ status: "pending" });
        const quotes = (res as any)?.quotations ?? [];
        setQuotationRequests(
          quotes.map((q: any) => ({
            id: q.id,
            customer:
              `${q.customer?.firstName ?? ""} ${q.customer?.lastName ?? ""}`.trim() ||
              "Unknown",
            route:
              q.pickupLocation && q.dropoffLocation
                ? `${q.pickupLocation} → ${q.dropoffLocation}`
                : "N/A",
            date: q.startDate ?? "",
            passengers: q.passengerCount ?? 0,
            expiresIn: calculateExpiresIn(q),
          })),
        );
      } catch {
        // Quotation endpoint may not have requests yet
      }

      try {
        const res = await bookingService.getOwnerBookings();
        const bookings = (res as any)?.bookings ?? [];
        setUpcomingBookings(
          bookings
            .filter(
              (b: any) =>
                b.status === "CONFIRMED" || b.status === "ONGOING",
            )
            .slice(0, 5)
            .map((b: any) => ({
              id: b.id,
              customer: b.customer?.name ?? "Unknown",
              route: b.trip?.route ?? "N/A",
              date: b.trip?.startDate ?? "",
              vehicle: b.vehicle?.registration ?? "N/A",
            })),
        );
      } catch {
        // Booking endpoint may have no upcoming bookings
      }

      setIsLoadingData(false);
    };

    if (user && isAuthorized) {
      fetchDashboardData();
    }
  }, [user, isAuthorized]);

  if (guardLoading || !isAuthorized || !user) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-muted">
        {/* Header */}
        <header className="border-b border-[--color-border-default] bg-card">
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {t("ownerDashboard.title", {
                    defaultValue: "Owner Dashboard",
                  })}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("ownerDashboard.welcome", {
                    defaultValue: "Welcome back",
                  })}
                  , {user.firstName}!
                </p>
              </div>
              <Link
                href={`/${locale}/owner/fleet/add`}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-action-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("ownerDashboard.addVehicle", { defaultValue: "Add Vehicle" })}
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          {/* Verification Banner — only shown for non-active owners */}
          {(!user.isVerified || user.status !== "ACTIVE") && (
            <VerificationBanner
              status={(user as any).status ?? "PENDING_VERIFICATION"}
              isVerified={user.isVerified ?? false}
            />
          )}

          {/* Metrics Grid */}
          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label={t("ownerDashboard.totalRevenue", {
                defaultValue: "Total Revenue",
              })}
              value={`LKR ${metrics.totalRevenue.toLocaleString()}`}
              icon={DollarSign}
              isLoading={isLoadingData}
            />
            <MetricCard
              label={t("ownerDashboard.activeBookings", {
                defaultValue: "Active Bookings",
              })}
              value={String(metrics.activeBookings)}
              icon={Calendar}
              isLoading={isLoadingData}
            />
            <MetricCard
              label={t("ownerDashboard.pendingQuotes", {
                defaultValue: "Pending Quotes",
              })}
              value={String(metrics.pendingQuotes)}
              icon={FileText}
              isLoading={isLoadingData}
            />
            <MetricCard
              label={t("ownerDashboard.averageRating", {
                defaultValue: "Average Rating",
              })}
              value={
                metrics.averageRating > 0
                  ? `${metrics.averageRating}/5.0`
                  : "N/A"
              }
              icon={Star}
              isLoading={isLoadingData}
            />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              {t("ownerDashboard.quickActions", {
                defaultValue: "Quick Actions",
              })}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href={`/${locale}/owner/fleet/add`}
                className="flex items-center gap-4 rounded-lg border-2 border-dashed border-[--color-border-default] bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
              >
                <div className="rounded-full bg-primary/10 p-3">
                  <Plus className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {t("ownerDashboard.addVehicle", {
                      defaultValue: "Add Vehicle",
                    })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("ownerDashboard.addVehicleDesc", {
                      defaultValue: "List a new vehicle",
                    })}
                  </p>
                </div>
              </Link>

              <Link
                href={`/${locale}/owner/fleet`}
                className="flex items-center gap-4 rounded-lg border border-[--color-border-default] bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
              >
                <div className="rounded-full bg-primary/10 p-3">
                  <Bus className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {t("ownerDashboard.manageFleet", {
                      defaultValue: "Manage Fleet",
                    })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("ownerDashboard.manageFleetDesc", {
                      defaultValue: "View all vehicles",
                    })}
                  </p>
                </div>
              </Link>

              <Link
                href={`/${locale}/owner/quotations`}
                className="flex items-center gap-4 rounded-lg border border-[--color-border-default] bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
              >
                <div className="rounded-full bg-primary/10 p-3">
                  <ClipboardList
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {t("ownerDashboard.viewAllQuotes", {
                      defaultValue: "View All Quotes",
                    })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("ownerDashboard.viewAllQuotesDesc", {
                      defaultValue: "Manage quotations",
                    })}
                  </p>
                </div>
              </Link>

              <Link
                href={`/${locale}/owner/packages`}
                className="flex items-center gap-4 rounded-lg border border-[--color-border-default] bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
              >
                <div className="rounded-full bg-primary/10 p-3">
                  <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {t("ownerDashboard.tripPackages", {
                      defaultValue: "Trip Packages",
                    })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("ownerDashboard.tripPackagesDesc", {
                      defaultValue: "Create fixed routes",
                    })}
                  </p>
                </div>
              </Link>

              <Link
                href={`/${locale}/owner/reviews`}
                className="flex items-center gap-4 rounded-lg border border-[--color-border-default] bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
              >
                <div className="rounded-full bg-primary/10 p-3">
                  <MessageSquareText
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {t("ownerDashboard.reviews", { defaultValue: "Reviews" })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("ownerDashboard.reviewsDesc", {
                      defaultValue: "Read & respond",
                    })}
                  </p>
                </div>
              </Link>

              <Link
                href={`/${locale}/owner/analytics`}
                className="flex items-center gap-4 rounded-lg border border-[--color-border-default] bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
              >
                <div className="rounded-full bg-primary/10 p-3">
                  <BarChart3
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {t("ownerDashboard.analytics", {
                      defaultValue: "Analytics",
                    })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("ownerDashboard.analyticsDesc", {
                      defaultValue: "Reports & Insights",
                    })}
                  </p>
                </div>
              </Link>

              <Link
                href={`/${locale}/owner/earnings`}
                className="flex items-center gap-4 rounded-lg border border-[--color-border-default] bg-card p-6 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
              >
                <div className="rounded-full bg-primary/10 p-3">
                  <Wallet
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {t("ownerDashboard.earnings", {
                      defaultValue: "Earnings & Payments",
                    })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("ownerDashboard.earningsDesc", {
                      defaultValue: "Settlements & payouts",
                    })}
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Revenue Chart + Recent Reviews */}
          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {isLoadingData ? (
                <div className="flex h-48 items-center justify-center rounded-lg border border-[--color-border-default] bg-card">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <RevenueChart data={revenueChart} />
              )}
            </div>

            {/* Recent Reviews */}
            <div className="rounded-lg border border-[--color-border-default] bg-card">
              <div className="flex items-center justify-between border-b border-[--color-border-default] p-6">
                <h2 className="text-base font-semibold text-foreground">
                  {t("ownerDashboard.recentReviews", {
                    defaultValue: "Recent Reviews",
                  })}
                </h2>
                <Link
                  href={`/${locale}/owner/reviews`}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:text-[--color-action-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus] rounded"
                >
                  {t("ownerDashboard.viewAll", { defaultValue: "View All" })}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="p-4">
                {isLoadingData ? (
                  <div className="flex h-32 items-center justify-center">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : recentReviews.length > 0 ? (
                  <div className="space-y-3">
                    {recentReviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-md border border-[--color-border-default] p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {review.customerName}
                          </span>
                          <StarRating rating={review.rating} />
                        </div>
                        <p className="mb-1 truncate text-xs text-muted-foreground">
                          {review.vehicleName}
                        </p>
                        {review.comment && (
                          <p className="line-clamp-2 text-xs text-[--color-text-tertiary]">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Star className="mb-2 h-8 w-8 text-[--color-text-tertiary]" />
                    <p className="text-sm text-muted-foreground">
                      {t("ownerDashboard.noReviews", {
                        defaultValue: "No reviews yet",
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quotation Requests */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-[--color-border-default] bg-card">
                <div className="flex items-center justify-between border-b border-[--color-border-default] p-6">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {t("ownerDashboard.quotationRequests", {
                        defaultValue: "Quotation Requests",
                      })}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("ownerDashboard.quotationRequestsDesc", {
                        defaultValue: "Respond to customer inquiries",
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/owner/quotations`}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:text-[--color-action-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus] rounded"
                  >
                    {t("ownerDashboard.viewAll", { defaultValue: "View All" })}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                {/* Filter Tabs */}
                <div className="border-b border-[--color-border-default] px-6">
                  <div className="flex gap-4">
                    {[
                      {
                        id: "all",
                        label: t("ownerDashboard.filterAll", {
                          defaultValue: "All",
                        }),
                      },
                      {
                        id: "new",
                        label: t("ownerDashboard.filterNew", {
                          defaultValue: "New",
                        }),
                      },
                      {
                        id: "pending",
                        label: t("ownerDashboard.filterPending", {
                          defaultValue: "Pending Response",
                        }),
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() =>
                          setQuotationFilter(tab.id as typeof quotationFilter)
                        }
                        className={`border-b-2 py-3 text-sm font-medium transition-colors focus-visible:outline-none ${
                          quotationFilter === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Request List */}
                <div className="p-6">
                  {isLoadingData ? (
                    <div className="space-y-4">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="rounded-md border border-[--color-border-default] p-4"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-5 w-12" />
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : quotationRequests.length > 0 ? (
                    <div className="space-y-4">
                      {quotationRequests.map((request) => (
                        <div
                          key={request.id}
                          className="rounded-md border border-[--color-border-default] p-4 transition-colors hover:bg-muted"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div>
                              <h3 className="font-medium text-foreground">
                                {request.customer}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {request.id}
                              </p>
                            </div>
                            <span className="rounded-sm bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                              {t("ownerDashboard.statusNew", {
                                defaultValue: "New",
                              })}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                            <div className="flex items-center gap-1.5">
                              <MapPin
                                className="h-4 w-4 text-[--color-text-tertiary]"
                                aria-hidden="true"
                              />
                              <span className="text-muted-foreground">
                                {request.route}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar
                                className="h-4 w-4 text-[--color-text-tertiary]"
                                aria-hidden="true"
                              />
                              <span className="text-muted-foreground">
                                {request.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Users
                                className="h-4 w-4 text-[--color-text-tertiary]"
                                aria-hidden="true"
                              />
                              <span className="text-muted-foreground">
                                {request.passengers}{" "}
                                {t("ownerDashboard.passengers", {
                                  defaultValue: "passengers",
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock
                                className="h-4 w-4 text-[--color-text-tertiary]"
                                aria-hidden="true"
                              />
                              <span className="text-muted-foreground">
                                {request.expiresIn}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <FileText
                          className="h-8 w-8 text-[--color-text-tertiary]"
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="mb-2 font-semibold text-foreground">
                        {t("ownerDashboard.noQuotationRequests", {
                          defaultValue: "No Quotation Requests",
                        })}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("ownerDashboard.noQuotationRequestsDesc", {
                          defaultValue:
                            "New quotation requests from customers will appear here.",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Upcoming Bookings */}
              <div className="rounded-lg border border-[--color-border-default] bg-card">
                <div className="flex items-center justify-between border-b border-[--color-border-default] p-6">
                  <h2 className="text-base font-semibold text-foreground">
                    {t("ownerDashboard.upcomingBookings", {
                      defaultValue: "Upcoming Bookings",
                    })}
                  </h2>
                  <Link
                    href={`/${locale}/owner/bookings`}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:text-[--color-action-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus] rounded"
                  >
                    {t("ownerDashboard.viewAll", { defaultValue: "View All" })}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className="p-6">
                  {isLoadingData ? (
                    <div className="space-y-4">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="space-y-2 border-b border-[--color-border-default] pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : upcomingBookings.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="border-b border-[--color-border-default] pb-4 last:border-0 last:pb-0"
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-foreground">
                              {booking.customer}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {booking.date}
                            </span>
                          </div>
                          <p className="mb-1 text-sm text-muted-foreground">
                            {booking.route}
                          </p>
                          <p className="text-xs text-[--color-text-tertiary]">
                            {booking.vehicle}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Calendar
                        className="mx-auto mb-3 h-8 w-8 text-[--color-text-tertiary]"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-muted-foreground">
                        {t("ownerDashboard.noUpcomingBookings", {
                          defaultValue: "No upcoming bookings",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fleet Overview */}
              <div className="rounded-lg border border-[--color-border-default] bg-card">
                <div className="flex items-center justify-between border-b border-[--color-border-default] p-6">
                  <h2 className="text-base font-semibold text-foreground">
                    {t("ownerDashboard.fleetOverview", {
                      defaultValue: "Fleet Overview",
                    })}
                  </h2>
                  <Link
                    href={`/${locale}/owner/fleet`}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:text-[--color-action-primary-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus] rounded"
                  >
                    {t("ownerDashboard.manage", { defaultValue: "Manage" })}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className="p-6">
                  <div className="mb-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full bg-[--color-success-border]"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-muted-foreground">
                          {t("ownerDashboard.fleetActive", {
                            defaultValue: "Active",
                          })}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {fleetStats.active}{" "}
                        {t("ownerDashboard.vehicles", {
                          defaultValue: "vehicles",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full bg-[--color-text-tertiary]"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-muted-foreground">
                          {t("ownerDashboard.fleetInactive", {
                            defaultValue: "Inactive",
                          })}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {fleetStats.inactive}{" "}
                        {t("ownerDashboard.vehicles", {
                          defaultValue: "vehicles",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full bg-[--color-action-primary]"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-muted-foreground">
                          {t("ownerDashboard.fleetPendingReview", {
                            defaultValue: "Pending Review",
                          })}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {fleetStats.pendingReview}{" "}
                        {t("ownerDashboard.vehicles", {
                          defaultValue: "vehicles",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Fleet Utilization */}
                  <div className="rounded-md bg-muted p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t("ownerDashboard.fleetUtilization", {
                          defaultValue: "Fleet Utilization",
                        })}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {fleetStats.utilization}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={fleetStats.utilization}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Fleet utilization: ${fleetStats.utilization}%`}
                      className="h-2 overflow-hidden rounded-full bg-[--color-border-default]"
                    >
                      <div
                        className="h-full rounded-full bg-[--color-success-border] transition-all"
                        style={{ width: `${fleetStats.utilization}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
