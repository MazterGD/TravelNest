"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, LoadingSpinner } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store";
import { useProtectedRoute } from "@/hooks";
import {
  bookingService,
  notificationService,
  quotationService,
  tripService,
  userService,
  type TripDTO,
} from "@/lib/api";
import {
  ArrowRight,
  Bell,
  Bus,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Compass,
  DollarSign,
  MapPin,
  Phone,
  Route as RouteIcon,
  Search,
  Users,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardMetrics {
  totalBookings: number;
  completedTrips: number;
  pendingQuotations: number;
  totalSpent: number;
}

interface UpcomingBooking {
  id: string;
  bookingReference: string;
  startDate: string;
  route: string;
  vehicleName: string;
  vehicleType: string;
  status: string;
  ownerName: string;
  ownerPhone: string;
}

interface RecentQuotation {
  id: string;
  route: string;
  date: string;
  quotesCount: number;
  status: string;
}

type NotificationCategory = "booking" | "quotation" | "payment" | "general";

interface DashboardNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

interface DashboardPageProps {
  locale: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, locale: string) =>
  new Intl.NumberFormat(
    locale === "si" || locale === "ta" ? "en-LK" : "en-US",
    { maximumFractionDigits: 0 },
  ).format(Math.max(0, Math.round(amount)));

const categorizeNotification = (
  type: string | undefined,
  title: string | undefined,
): NotificationCategory => {
  const haystack = `${type ?? ""} ${title ?? ""}`.toLowerCase();
  if (haystack.includes("quotation") || haystack.includes("quote")) return "quotation";
  if (
    haystack.includes("payment") ||
    haystack.includes("refund") ||
    haystack.includes("invoice")
  )
    return "payment";
  if (
    haystack.includes("booking") ||
    haystack.includes("trip") ||
    haystack.includes("reservation")
  )
    return "booking";
  return "general";
};

const tripKey = (pickup?: string | null, dropoff?: string | null, date?: string | null) =>
  `${pickup ?? ""}|${dropoff ?? ""}|${date?.slice(0, 10) ?? ""}`;

const isResponseQuotation = (status?: string) => {
  const upper = (status ?? "").toUpperCase();
  return (
    upper === "SENT" || upper === "VIEWED" || upper === "ACCEPTED" || upper === "REJECTED"
  );
};

// ── Shared class constants ────────────────────────────────────────────────────

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

const cardSurface =
  "rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)]";

const innerCard =
  "rounded-xl border border-[var(--color-border-default)]";

const iconBadge =
  "rounded-xl bg-[var(--color-bg-surface)] p-3 text-[var(--color-action-primary)]";

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardContent({ locale }: DashboardPageProps) {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("navigation");
  const { user } = useAuthStore();
  const params = useParams();
  const currentLocale = (params.locale as string) || locale;

  const { isLoading: guardLoading, isAuthorized } = useProtectedRoute();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalBookings: 0,
    completedTrips: 0,
    pendingQuotations: 0,
    totalSpent: 0,
  });
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [recentQuotations, setRecentQuotations] = useState<RecentQuotation[]>([]);
  const [activeTrips, setActiveTrips] = useState<TripDTO[]>([]);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 1) return t("notifications.time.justNow");
    if (diffMinutes < 60)
      return t("notifications.time.minutesAgo", { count: diffMinutes });
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24)
      return t("notifications.time.hoursAgo", { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7)
      return t("notifications.time.daysAgo", { count: diffDays });
    return date.toLocaleDateString(currentLocale);
  };

  useEffect(() => {
    if (!user || !isAuthorized) return;
    const controller = new AbortController();
    const vehicleFallback = t("vehicleFallback");
    const ownerFallback = t("ownerFallback");

    const fetchDashboardData = async () => {
      setIsLoadingData(true);

      await Promise.allSettled([
        userService
          .getDashboardStats()
          .then((stats) => {
            if (controller.signal.aborted) return;
            setMetrics({
              totalBookings: stats?.totalBookings ?? 0,
              completedTrips: stats?.completedBookings ?? 0,
              pendingQuotations: stats?.pendingQuotations ?? 0,
              totalSpent: stats?.totalSpent ?? 0,
            });
          })
          .catch(() => {}),

        bookingService
          .getMyBookings({ limit: 20 })
          .then((response) => {
            if (controller.signal.aborted) return;
            const bookings = (
              (response as { bookings?: unknown[] })?.bookings ?? []
            ) as Array<Record<string, unknown>>;
            const upcoming = bookings
              .filter((b) => {
                const status = String(b.status ?? "").toUpperCase();
                return status === "CONFIRMED" || status === "ONGOING";
              })
              .slice(0, 3)
              .map<UpcomingBooking>((b) => {
                const pickup = b.pickupLocation as
                  | { city?: string }
                  | string
                  | undefined;
                const dropoff = b.dropoffLocation as
                  | { city?: string }
                  | string
                  | undefined;
                const pickupCity =
                  typeof pickup === "string" ? pickup : pickup?.city ?? "";
                const dropoffCity =
                  typeof dropoff === "string" ? dropoff : dropoff?.city ?? "";
                return {
                  id: String(b.id ?? ""),
                  bookingReference: String(
                    b.bookingReference ??
                      `BK-${String(b.id ?? "").slice(0, 8).toUpperCase()}`,
                  ),
                  startDate: String(b.startDate ?? ""),
                  route: `${pickupCity || "—"} → ${dropoffCity || "—"}`,
                  vehicleName: String(b.vehicleName ?? vehicleFallback),
                  vehicleType: String(b.vehicleType ?? vehicleFallback),
                  status: String(b.status ?? "pending").toUpperCase(),
                  ownerName: String(b.ownerName ?? ownerFallback),
                  ownerPhone: String(b.ownerPhone ?? ""),
                };
              });
            setUpcomingBookings(upcoming);
          })
          .catch(() => {
            setUpcomingBookings([]);
          }),

        quotationService
          .getMyRequests()
          .then((response) => {
            if (controller.signal.aborted) return;
            const rows = (
              (response as { quotations?: unknown[] })?.quotations ?? []
            ) as Array<Record<string, unknown>>;
            const groups = new Map<string, RecentQuotation>();
            for (const row of rows) {
              const pickup = String(row.pickupLocation ?? "");
              const dropoff = String(row.dropoffLocation ?? "");
              const startDate = String(row.startDate ?? "");
              const key = tripKey(pickup, dropoff, startDate);
              const status = String(row.status ?? "PENDING").toUpperCase();
              const existing = groups.get(key);
              const responses = isResponseQuotation(status) ? 1 : 0;
              if (existing) {
                existing.quotesCount += responses;
                if (status === "ACCEPTED") existing.status = "ACCEPTED";
                else if (existing.status !== "ACCEPTED" && isResponseQuotation(status))
                  existing.status = "SENT";
              } else {
                groups.set(key, {
                  id: String(row.id ?? ""),
                  route: `${pickup.split(",")[0]?.trim() || "—"} → ${dropoff.split(",")[0]?.trim() || "—"}`,
                  date: startDate,
                  quotesCount: responses,
                  status,
                });
              }
            }
            setRecentQuotations(Array.from(groups.values()).slice(0, 5));
          })
          .catch(() => {
            setRecentQuotations([]);
          }),

        tripService
          .getActive()
          .then((response) => {
            if (controller.signal.aborted) return;
            const trips = ((response as any)?.data?.trips ?? []) as TripDTO[];
            setActiveTrips(trips);
          })
          .catch(() => {
            setActiveTrips([]);
          }),

        notificationService
          .getAll({ limit: 5 })
          .then((response) => {
            if (controller.signal.aborted) return;
            const list =
              (Array.isArray(response)
                ? response
                : (response as { notifications?: unknown[] })?.notifications) ?? [];
            const normalized = (list as Array<Record<string, unknown>>).map<DashboardNotification>(
              (n) => ({
                id: String(n.id ?? ""),
                category: categorizeNotification(
                  typeof n.type === "string" ? n.type : undefined,
                  typeof n.title === "string" ? n.title : undefined,
                ),
                title: String(n.title ?? ""),
                message: String(n.message ?? ""),
                createdAt: String(n.createdAt ?? ""),
                isRead: Boolean(n.isRead),
              }),
            );
            setNotifications(normalized);
          })
          .catch(() => {
            setNotifications([]);
          }),

        notificationService
          .getUnreadCount()
          .then((response) => {
            if (controller.signal.aborted) return;
            const raw = response as
              | { unreadCount?: number; count?: number }
              | undefined;
            setUnreadCount(raw?.unreadCount ?? raw?.count ?? 0);
          })
          .catch(() => {
            setUnreadCount(0);
          }),
      ]);

      if (!controller.signal.aborted) setIsLoadingData(false);
    };

    fetchDashboardData();
    return () => controller.abort();
  }, [user, isAuthorized, t]);

  if (guardLoading || !isAuthorized || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getStatusBadgeVariant = (
    status: string,
  ): "success" | "info" | "warning" | "danger" | "secondary" | "default" => {
    switch (status.toUpperCase()) {
      case "CONFIRMED":
      case "COMPLETED":
      case "ACCEPTED":
        return "success";
      case "ONGOING":
      case "SENT":
      case "VIEWED":
        return "info";
      case "PENDING":
        return "warning";
      case "CANCELLED":
      case "REJECTED":
        return "danger";
      case "EXPIRED":
        return "secondary";
      default:
        return "default";
    }
  };

  const formatStatusLabel = (status: string) =>
    t(`status.${status.toLowerCase()}`, { defaultValue: status });

  const getNotificationIcon = (category: NotificationCategory) => {
    switch (category) {
      case "booking":
        return <Calendar className="h-4 w-4" aria-hidden="true" />;
      case "quotation":
        return <ClipboardList className="h-4 w-4" aria-hidden="true" />;
      case "payment":
        return <DollarSign className="h-4 w-4" aria-hidden="true" />;
      default:
        return <Bell className="h-4 w-4" aria-hidden="true" />;
    }
  };

  const nextTrip = upcomingBookings[0] ?? null;
  // Highlight a single in-flight trip (PLANNING / AWAITING_QUOTES) so the
  // customer's focus snaps to the work they haven't finished yet.
  const activeTrip = activeTrips[0] ?? null;
  const activeTripRoute = activeTrip
    ? `${activeTrip.pickupCity || activeTrip.pickupLocation.split(",")[0]} → ${
        activeTrip.dropoffCity ||
        activeTrip.dropoffLocation?.split(",")[0] ||
        "—"
      }`
    : null;

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8 space-y-8">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t("welcomeUser", { name: user.firstName })}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t("dashboardSubtitle", { defaultValue: "Here's what's happening with your journeys." })}
        </p>
      </div>

      {/* ── Quick actions — only shown on mobile where the bottom nav renders,
           since the desktop sidebar already exposes these nav items ── */}
      <div className="grid grid-cols-2 gap-4 md:hidden">
        <Link
          href={`/${currentLocale}/dashboard/search`}
          className={`${cardSurface} flex min-h-[44px] items-center gap-3 p-4 transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]">
            <Search className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 text-sm font-semibold text-[var(--color-text-primary)]">
            {tNav("searchBuses")}
          </span>
        </Link>
        <Link
          href={`/${currentLocale}/dashboard/packages`}
          className={`${cardSurface} flex min-h-[44px] items-center gap-3 p-4 transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {tNav("packages")}
          </span>
        </Link>
      </div>

      {/* ── Next Journey hero ─────────────────────────────────────────────── */}
      {isLoadingData ? (
        <div className="rounded-[20px] overflow-hidden">
          <Skeleton className="h-48 w-full" variant="rectangular" />
        </div>
      ) : nextTrip ? (
        <section
          aria-labelledby="next-journey-heading"
          className="relative overflow-hidden rounded-[20px] bg-[var(--color-text-primary)] p-6 md:p-8"
        >
          {/* Decorative route arc — purely visual, hidden from screen readers */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full border border-white/5"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-96 w-96 translate-x-1/3 -translate-y-1/3 rounded-full border border-white/[0.03]"
          />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            {/* Left: trip details */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-action-primary)]">
                  {t("nextJourney.label", { defaultValue: "Next Journey" })}
                </p>
                <h2
                  id="next-journey-heading"
                  className="mt-2 text-2xl font-bold text-white md:text-3xl"
                >
                  {nextTrip.route}
                </h2>
              </div>

              {/* Route timeline */}
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-action-primary)]" />
                <div className="h-px flex-1 bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full border-2 border-white/40 bg-transparent" />
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {nextTrip.startDate
                    ? new Date(nextTrip.startDate).toLocaleDateString(currentLocale, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Bus className="h-4 w-4" aria-hidden="true" />
                  {nextTrip.vehicleName}
                </span>
                <span className="rounded-lg border border-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
                  {nextTrip.vehicleType}
                </span>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex shrink-0 flex-wrap gap-3">
              {nextTrip.ownerPhone && (
                <a
                  href={`tel:${nextTrip.ownerPhone}`}
                  aria-label={t("actions.callOwner", { name: nextTrip.ownerName })}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20 ${focusRing} focus-visible:ring-offset-[var(--color-text-primary)]`}
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {t("actions.callOwner", { name: "", defaultValue: "Call owner" })}
                </a>
              )}
              <Link
                href={`/${currentLocale}/dashboard/bookings/${nextTrip.id}`}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing} focus-visible:ring-offset-[var(--color-text-primary)]`}
              >
                {t("actions.viewDetails")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      ) : activeTrip ? (
        /* Customer has an in-flight trip but no booking yet — surface it as
            the primary call-to-action so they don't lose track of work in
            progress. Bordered with the primary blue to draw focus. */
        <section
          aria-labelledby="active-trip-heading"
          className={`relative overflow-hidden rounded-[20px] border-2 border-[var(--color-action-primary)] bg-[var(--color-bg-base)] p-6 md:p-8`}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[var(--color-action-primary)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  {t("activeTrip.label")}
                </span>
                <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                  {activeTrip.tripCode}
                </span>
              </div>
              <h2
                id="active-trip-heading"
                className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl"
              >
                {activeTrip.title || activeTripRoute}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {new Date(activeTrip.startDate).toLocaleDateString(
                    currentLocale,
                    { weekday: "short", month: "short", day: "numeric" },
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {t("activeTrip.passengers", {
                    count: activeTrip.passengerCount,
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  {t("activeTrip.quotesAttached", {
                    count: activeTrip._count?.quotations ?? 0,
                  })}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href={`/${currentLocale}/dashboard/search?tripId=${activeTrip.id}`}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {t("activeTrip.addVehicles")}
              </Link>
              <Link
                href={`/${currentLocale}/dashboard/trips/${activeTrip.id}`}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing}`}
              >
                {t("activeTrip.viewTrip")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      ) : (
        /* No bookings and no active trips — invite the customer to plan
            their first one. Primary blue CTA makes the next step obvious. */
        <section
          aria-labelledby="plan-trip-heading"
          className={`${cardSurface} flex flex-col items-center gap-4 p-8 text-center md:flex-row md:text-left`}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]">
            <Compass className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2
              id="plan-trip-heading"
              className="font-semibold text-[var(--color-text-primary)]"
            >
              {t("planTrip.emptyTitle")}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("planTrip.emptySubtitle")}
            </p>
          </div>
          <Link
            href={`/${currentLocale}/dashboard/trips/new`}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing}`}
          >
            <RouteIcon className="h-4 w-4" aria-hidden="true" />
            {t("planTrip.cta")}
          </Link>
        </section>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <section aria-label={t("overview")}>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={t("metrics.totalBookings")}
            value={metrics.totalBookings}
            icon={<Bus className="h-5 w-5" aria-hidden="true" />}
            loading={isLoadingData}
          />
          <MetricCard
            label={t("metrics.completedTrips")}
            value={metrics.completedTrips}
            icon={<CheckCircle className="h-5 w-5" aria-hidden="true" />}
            loading={isLoadingData}
          />
          <MetricCard
            label={t("metrics.pendingQuotations")}
            value={metrics.pendingQuotations}
            icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
            loading={isLoadingData}
          />
          <MetricCard
            label={t("metrics.totalSpent")}
            value={t("metrics.currency", {
              amount: formatCurrency(metrics.totalSpent, currentLocale),
            })}
            icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
            loading={isLoadingData}
          />
        </div>
      </section>

      {/* ── Main bento grid ───────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left column: upcoming bookings + recent quotations */}
        <div className="min-w-0 space-y-6 lg:col-span-2">

          {/* Upcoming bookings */}
          <section className={cardSurface} aria-labelledby="upcoming-heading">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
              <div>
                <h2
                  id="upcoming-heading"
                  className="font-semibold text-[var(--color-text-primary)]"
                >
                  {t("upcomingBookings.title")}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {t("upcomingBookings.subtitle", { count: upcomingBookings.length })}
                </p>
              </div>
              <Link
                href={`/${currentLocale}/dashboard/bookings`}
                className={`flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${focusRing}`}
              >
                {t("actions.viewAll")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="p-4">
              {isLoadingData ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`${innerCard} p-4`}>
                      <div className="mb-3 flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-20" variant="rectangular" />
                      </div>
                      <Skeleton className="mb-2 h-3 w-3/4" />
                      <Skeleton className="h-9 w-full" variant="rectangular" />
                    </div>
                  ))}
                </div>
              ) : upcomingBookings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => (
                    <article
                      key={booking.id}
                      className={`${innerCard} p-4 transition-colors hover:bg-[var(--color-bg-surface)]`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {booking.bookingReference}
                          </h3>
                          <p className="truncate text-xs text-[var(--color-text-secondary)]">
                            {booking.vehicleName} · {booking.vehicleType}
                          </p>
                        </div>
                        <span className="shrink-0">
                          <Badge variant={getStatusBadgeVariant(booking.status)}>
                            {formatStatusLabel(booking.status)}
                          </Badge>
                        </span>
                      </div>

                      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--color-text-secondary)]">
                        <span className="flex shrink-0 items-center gap-1.5">
                          <Calendar
                            className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
                            aria-hidden="true"
                          />
                          {booking.startDate
                            ? new Date(booking.startDate).toLocaleDateString(
                                currentLocale,
                              )
                            : "—"}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <MapPin
                            className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
                            aria-hidden="true"
                          />
                          <span className="truncate">{booking.route}</span>
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/${currentLocale}/dashboard/bookings/${booking.id}`}
                          className={`flex-1 rounded-xl bg-[var(--color-text-primary)] px-4 py-2 text-center text-xs font-medium text-white transition-colors hover:bg-[var(--color-text-primary)]/90 ${focusRing}`}
                        >
                          {t("actions.viewDetails")}
                        </Link>
                        {booking.ownerPhone ? (
                          <a
                            href={`tel:${booking.ownerPhone}`}
                            aria-label={t("actions.callOwner", {
                              name: booking.ownerName,
                            })}
                            className={`flex min-h-[36px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--color-border-default)] px-3 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
                          >
                            <Phone className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-surface)]">
                    <Bus
                      className="h-6 w-6 text-[var(--color-text-tertiary)]"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">
                    {t("upcomingBookings.emptyTitle")}
                  </p>
                  <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
                    {t("upcomingBookings.emptySubtitle")}
                  </p>
                  <Link
                    href={`/${currentLocale}/search`}
                    className={`inline-flex items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing}`}
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    {t("actions.searchBuses")}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Recent quotation replies */}
          <section className={cardSurface} aria-labelledby="recent-quotations-heading">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
              <div>
                <h2
                  id="recent-quotations-heading"
                  className="font-semibold text-[var(--color-text-primary)]"
                >
                  {t("recentQuotations.title")}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {t("recentQuotations.subtitle")}
                </p>
              </div>
              <Link
                href={`/${currentLocale}/dashboard/trips`}
                className={`flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${focusRing}`}
              >
                {t("actions.viewAll")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="p-4">
              {isLoadingData ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`${innerCard} p-4`}>
                      <Skeleton className="mb-1.5 h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  ))}
                </div>
              ) : recentQuotations.length > 0 ? (
                <div className="space-y-2">
                  {recentQuotations.map((quotation) => (
                    <Link
                      key={quotation.id}
                      href={`/${currentLocale}/dashboard/quotations/${quotation.id}`}
                      className={`flex items-center justify-between ${innerCard} p-4 transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="min-w-0 max-w-full truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {quotation.route}
                          </h3>
                          {quotation.quotesCount > 0 ? (
                            <Badge variant="info">
                              {t("recentQuotations.quotesCount", {
                                count: quotation.quotesCount,
                              })}
                            </Badge>
                          ) : null}
                          <Badge variant={getStatusBadgeVariant(quotation.status)}>
                            {formatStatusLabel(quotation.status)}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                          {quotation.date
                            ? new Date(quotation.date).toLocaleDateString(currentLocale)
                            : "—"}
                        </p>
                      </div>
                      <ArrowRight
                        className="ml-3 h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <ClipboardList
                    className="mx-auto mb-2 h-8 w-8 text-[var(--color-text-tertiary)]"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("recentQuotations.empty")}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column: notifications */}
        <aside className="min-w-0">
          <section className={cardSurface} aria-labelledby="notifications-heading">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
              <h2
                id="notifications-heading"
                className="font-semibold text-[var(--color-text-primary)]"
              >
                {t("notifications.title")}
              </h2>
              {unreadCount > 0 ? (
                <span className="rounded-lg bg-[var(--color-action-primary)] px-2 py-0.5 text-xs font-medium text-white">
                  {unreadCount}
                </span>
              ) : null}
            </div>

            <div className="divide-y divide-[var(--color-border-default)]">
              {isLoadingData ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-4">
                    <Skeleton variant="circular" className="h-8 w-8 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))
              ) : notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 transition-colors hover:bg-[var(--color-bg-surface)] ${
                      !notification.isRead ? "bg-[var(--color-bg-surface)]" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0 rounded-xl bg-[var(--color-bg-surface)] p-2 text-[var(--color-action-primary)]">
                        {getNotificationIcon(notification.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {notification.title}
                          </h3>
                          {!notification.isRead ? (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-action-primary)]"
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>
                        <p className="mb-1 text-xs text-[var(--color-text-secondary)] line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-10 text-center text-sm text-[var(--color-text-secondary)]">
                  {t("notifications.empty")}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--color-border-default)] p-4">
              <Link
                href={`/${currentLocale}/dashboard/notifications`}
                className={`flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${focusRing}`}
              >
                {t("notifications.viewAll")}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  loading: boolean;
}

function MetricCard({ label, value, icon, loading }: MetricCardProps) {
  return (
    <div className={`${cardSurface} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1.5 text-md font-bold text-[var(--color-text-primary)] break-words sm:text-2xl">
              {value}
            </p>
          )}
        </div>
        <div className={iconBadge}>{icon}</div>
      </div>
    </div>
  );
}
