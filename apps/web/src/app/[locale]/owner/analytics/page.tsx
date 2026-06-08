"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Car,
  Star,
  BarChart3,
  CheckCircle,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react";
import { useOwnerGuard } from "@/hooks";
import { ownerService } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

type OverviewData = {
  totalRevenue: number;
  thisMonthRevenue: number;
  revenueGrowth: number;
  totalBookings: number;
  completedBookings: number;
  completionRate: number;
  totalVehicles: number;
  activeVehicles: number;
  fleetUtilization: number;
  averageRating: number;
};

type RevenuePoint = { month: string; revenue: number; bookings: number };

type VehicleRow = {
  id: string;
  name: string;
  isActive: boolean;
  totalBookings: number;
  completedBookings: number;
  revenue: number;
  averageRating: number;
  reviewCount: number;
};

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${cls} ${
            star <= Math.round(rating)
              ? "fill-current text-primary"
              : "text-[var(--color-text-tertiary)]"
          }`}
        />
      ))}
    </div>
  );
}

type BookingRow = {
  id: string;
  date: string;
  amount: number;
  status: "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED";
};

const STATUS_STYLES: Record<BookingRow["status"], string> = {
  COMPLETED: "bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
  CONFIRMED: "bg-primary/10 text-primary",
  ONGOING: "bg-primary/10 text-primary",
  PENDING: "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]",
  CANCELLED: "bg-[var(--color-error-bg)] text-[var(--color-error-text)]",
};

function VehicleAnalyticsModal({
  vehicle,
  locale,
  onClose,
}: {
  vehicle: VehicleRow;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("ownerAnalytics");
  const prefersReducedMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const completionRate =
    vehicle.totalBookings > 0
      ? Math.round((vehicle.completedBookings / vehicle.totalBookings) * 100)
      : 0;

  useEffect(() => {
    closeRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    ownerService.getAnalyticsVehicleBookings(vehicle.id).then((data) => {
      if (!cancelled) {
        setBookings(data);
        setBookingsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setBookingsLoading(false);
    });
    return () => { cancelled = true; };
  }, [vehicle.id]);

  const panelVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, y: 24, scale: 0.97 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
        exit: { opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.15 } },
      };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("vehicleModal.title")}
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel — full-height sheet on mobile, constrained dialog on sm+ */}
      <motion.div
        className="relative z-10 flex w-full max-w-lg flex-col rounded-t-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] shadow-xl sm:rounded-[20px]"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* ── Sticky header ── */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border-default)] px-6 py-4">
          <div className="min-w-0">
            <p className="text-caption font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              {t("vehicleModal.title")}
            </p>
            <h2 className="mt-0.5 truncate text-body-lg font-semibold text-[var(--color-text-primary)]">
              {vehicle.name}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {vehicle.isActive ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-success-text)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                {t("vehicleTable.active")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-bg-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-tertiary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-tertiary)]" />
                {t("vehicleTable.inactive")}
              </span>
            )}
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label={t("vehicleModal.close")}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 p-6">
            {/* Total Revenue */}
            <div className="col-span-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-[var(--color-text-secondary)]">
                  {t("vehicleModal.totalRevenue")}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <p className="mt-1 text-heading-md font-bold text-[var(--color-text-primary)]">
                LKR {vehicle.revenue.toLocaleString()}
              </p>
            </div>

            {/* Total Bookings */}
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-[var(--color-text-secondary)]">
                  {t("vehicleModal.totalBookings")}
                </p>
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
                {vehicle.totalBookings}
              </p>
            </div>

            {/* Completed */}
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-[var(--color-text-secondary)]">
                  {t("vehicleModal.completedBookings")}
                </p>
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
                {vehicle.completedBookings}
              </p>
            </div>

            {/* Completion Rate */}
            <div className="col-span-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-caption text-[var(--color-text-secondary)]">
                  {t("vehicleModal.completionRate")}
                </p>
                <p className="text-caption font-semibold text-[var(--color-text-primary)]">
                  {completionRate}%
                </p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-default)]">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 350, damping: 45, delay: 0.1 }
                  }
                />
              </div>
            </div>

            {/* Avg Rating */}
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <p className="text-caption text-[var(--color-text-secondary)]">
                {t("vehicleModal.averageRating")}
              </p>
              {vehicle.reviewCount > 0 ? (
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xl font-bold text-[var(--color-text-primary)]">
                    {vehicle.averageRating.toFixed(1)}
                  </p>
                  <StarRating rating={vehicle.averageRating} size="md" />
                </div>
              ) : (
                <p className="mt-1 text-body text-[var(--color-text-tertiary)]">
                  {t("vehicleModal.noReviews")}
                </p>
              )}
            </div>

            {/* Review count */}
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-[var(--color-text-secondary)]">
                  {t("vehicleModal.reviews")}
                </p>
                <Star className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
                {vehicle.reviewCount}
              </p>
            </div>
          </div>

          {/* ── Booking History ── */}
          <div className="border-t border-[var(--color-border-default)]">
            <div className="px-6 py-4">
              <h3 className="text-body font-semibold text-[var(--color-text-primary)]">
                {t("vehicleModal.bookingHistory")}
              </h3>
            </div>

            {bookingsLoading ? (
              <div className="flex items-center justify-center py-10">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-caption text-[var(--color-text-secondary)]">
                  {t("vehicleModal.loadingBookings")}
                </span>
              </div>
            ) : bookings.length === 0 ? (
              <p className="px-6 pb-8 text-caption text-[var(--color-text-tertiary)]">
                {t("vehicleModal.noBookings")}
              </p>
            ) : (
              <div className="overflow-x-auto pb-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                        {t("vehicleModal.colBookingId")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                        {t("vehicleModal.colDate")}
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                        {t("vehicleModal.colAmount")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                        {t("vehicleModal.colStatus")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-default)]">
                    {bookings.map((b) => (
                      <tr
                        key={b.id}
                        className="transition-colors hover:bg-[var(--color-bg-surface)]"
                      >
                        <td className="px-6 py-3">
                          <Link
                            href={`/${locale}/owner/bookings/${b.id}`}
                            className="inline-flex items-center gap-1 font-mono text-xs font-medium text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                          >
                            #{b.id.slice(-8).toUpperCase()}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                          {new Date(b.date).toLocaleDateString("en-LK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-primary)]">
                          LKR {b.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-lg px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[b.status]}`}
                          >
                            {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-[var(--color-border-default)] px-6 py-4">
          <Link
            href={`/${locale}/owner/fleet/${vehicle.id}`}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t("vehicleModal.viewFleetProfile")}
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function OwnerAnalyticsPage() {
  const t = useTranslations("ownerAnalytics");
  const params = useParams();
  const locale = params.locale as string;
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRow | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewRes, revenueRes, vehiclesRes] = await Promise.all([
        ownerService.getAnalyticsOverview(),
        ownerService.getAnalyticsRevenue(),
        ownerService.getAnalyticsVehicles(),
      ]);
      setOverview(overviewRes);
      setRevenueData(revenueRes);
      setVehicles(vehiclesRes);
    } catch {
      setError(t("error.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAuthorized) loadData();
  }, [isAuthorized, loadData]);

  if (guardLoading || (!isAuthorized && !error)) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  const hasRevenueData = revenueData.some((d) => d.revenue > 0);

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/${locale}/owner/dashboard`}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToDashboard")}
          </Link>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-error bg-[var(--color-error-bg)] p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error-foreground" />
            <div className="flex-1">
              <p className="text-sm text-error-foreground">{error}</p>
            </div>
            <button
              onClick={loadData}
              className="shrink-0 rounded-md bg-error px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("error.tryAgain")}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* KPI Overview Cards */}
            {overview && (
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {/* Total Revenue */}
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {t("overview.totalRevenue")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                        LKR {overview.totalRevenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-primary/10 p-2.5">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>

                {/* This Month */}
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {t("overview.thisMonth")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                        LKR {overview.thisMonthRevenue.toLocaleString()}
                      </p>
                      {overview.revenueGrowth !== 0 && (
                        <p
                          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                            overview.revenueGrowth > 0
                              ? "text-success-foreground"
                              : "text-error-foreground"
                          }`}
                        >
                          {overview.revenueGrowth > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {Math.abs(overview.revenueGrowth)}% {t("overview.growth")}
                        </p>
                      )}
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-primary/10 p-2.5">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>

                {/* Total Bookings + Completion Rate */}
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {t("overview.totalBookings")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                        {overview.totalBookings}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        {overview.completionRate}% {t("overview.completionRate")}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-primary/10 p-2.5">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>

                {/* Fleet + Rating */}
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {t("overview.averageRating")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                        {overview.averageRating > 0
                          ? `${overview.averageRating}/5.0`
                          : "—"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        {overview.activeVehicles}/{overview.totalVehicles}{" "}
                        {t("overview.fleetUtilization")}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 rounded-full bg-primary/10 p-2.5">
                      <Star className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Row */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Revenue Trend Chart */}
              <div className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
                <div className="mb-1 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">
                    {t("revenueChart.title")}
                  </h2>
                </div>

                {hasRevenueData ? (
                  <div className="mt-4 h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={revenueData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="analyticsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
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
                        <RechartsTooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="rounded-lg border border-[--color-border-default] bg-card px-3 py-2 shadow-md">
                                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                <p className="text-sm font-semibold text-foreground">
                                  {t("revenueChart.tooltip")} {Number(payload[0].value).toLocaleString()}
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#20B0E9"
                          strokeWidth={2}
                          fill="url(#analyticsRevenueGrad)"
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
                  <div className="flex h-48 flex-col items-center justify-center text-center">
                    <BarChart3 className="mb-2 h-8 w-8 text-[var(--color-text-tertiary)]" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("revenueChart.noData")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {t("revenueChart.noDataDesc")}
                    </p>
                  </div>
                )}
              </div>

              {/* Bookings per Month Chart */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-1 flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">
                    {t("bookingsChart.title")}
                  </h2>
                </div>

                {revenueData.some((d) => d.bookings > 0) ? (
                  <div className="mt-4 h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={revenueData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
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
                          allowDecimals={false}
                          width={28}
                        />
                        <RechartsTooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="rounded-lg border border-[--color-border-default] bg-card px-3 py-2 shadow-md">
                                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                <p className="text-sm font-semibold text-foreground">
                                  {payload[0].value} {t("bookingsChart.tooltipLabel", { defaultValue: "bookings" })}
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="bookings"
                          fill="#20B0E9"
                          radius={[4, 4, 0, 0]}
                          fillOpacity={0.75}
                          activeBar={{ fillOpacity: 1 }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center text-center">
                    <Car className="mb-2 h-8 w-8 text-[var(--color-text-tertiary)]" />
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      {t("revenueChart.noData")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle Performance Table */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">
                  {t("vehicleTable.title")}
                </h2>
                {vehicles.length > 0 && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("vehicleModal.clickRow")}
                  </p>
                )}
              </div>

              {vehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <Car className="mb-3 h-10 w-10 text-[var(--color-text-tertiary)]" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("vehicleTable.noVehicles")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {t("vehicleTable.noVehiclesDesc")}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                          {t("vehicleTable.vehicle")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                          {t("vehicleTable.status")}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                          {t("vehicleTable.bookings")}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                          {t("vehicleTable.completed")}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                          {t("vehicleTable.revenue")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                          {t("vehicleTable.rating")}
                        </th>
                        <th className="w-8 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {vehicles.map((v) => (
                        <tr
                          key={v.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${v.name} — ${t("vehicleModal.title")}`}
                          onClick={() => setSelectedVehicle(v)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedVehicle(v);
                            }
                          }}
                          className="cursor-pointer transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <td className="px-6 py-4">
                            <span className="font-medium text-foreground">
                              {v.name}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {v.isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--color-success-bg)] px-2 py-0.5 text-xs font-medium text-success-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                {t("vehicleTable.active")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-[var(--color-text-tertiary)]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-tertiary)]" />
                                {t("vehicleTable.inactive")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-foreground">
                            {v.totalBookings}
                          </td>
                          <td className="px-4 py-4 text-right text-muted-foreground">
                            {v.completedBookings}
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-foreground">
                            LKR {v.revenue.toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            {v.reviewCount > 0 ? (
                              <div className="flex items-center gap-2">
                                <StarRating rating={v.averageRating} />
                                <span className="text-xs text-[var(--color-text-tertiary)]">
                                  {v.averageRating.toFixed(1)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--color-text-tertiary)]">
                                {t("vehicleTable.noRating")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <ArrowRight className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedVehicle && (
          <VehicleAnalyticsModal
            key={selectedVehicle.id}
            vehicle={selectedVehicle}
            locale={locale}
            onClose={() => setSelectedVehicle(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
