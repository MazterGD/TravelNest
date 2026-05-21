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
  userService,
} from "@/lib/api";
import {
  ArrowRight,
  Bell,
  Bus,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  Eye,
  MapPin,
  Phone,
  Search,
} from "lucide-react";

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

const formatCurrency = (amount: number, locale: string) =>
  new Intl.NumberFormat(locale === "si" || locale === "ta" ? "en-LK" : "en-US", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount)));

const categorizeNotification = (
  type: string | undefined,
  title: string | undefined,
): NotificationCategory => {
  const haystack = `${type ?? ""} ${title ?? ""}`.toLowerCase();
  if (haystack.includes("quotation") || haystack.includes("quote")) {
    return "quotation";
  }
  if (haystack.includes("payment") || haystack.includes("refund") || haystack.includes("invoice")) {
    return "payment";
  }
  if (haystack.includes("booking") || haystack.includes("trip") || haystack.includes("reservation")) {
    return "booking";
  }
  return "general";
};

const tripKey = (pickup?: string | null, dropoff?: string | null, date?: string | null) =>
  `${pickup ?? ""}|${dropoff ?? ""}|${date?.slice(0, 10) ?? ""}`;

const isResponseQuotation = (status?: string) => {
  const upper = (status ?? "").toUpperCase();
  return upper === "SENT" || upper === "VIEWED" || upper === "ACCEPTED" || upper === "REJECTED";
};

export function DashboardContent({ locale }: DashboardPageProps) {
  const t = useTranslations("dashboard");
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
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);

    if (diffMinutes < 1) return t("notifications.time.justNow");
    if (diffMinutes < 60) return t("notifications.time.minutesAgo", { count: diffMinutes });

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return t("notifications.time.hoursAgo", { count: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t("notifications.time.daysAgo", { count: diffDays });

    return date.toLocaleDateString(currentLocale);
  };

  useEffect(() => {
    if (!user || !isAuthorized) return;

    const controller = new AbortController();

    const fetchDashboardData = async () => {
      setIsLoadingData(true);

      const vehicleFallback = t("vehicleFallback");
      const ownerFallback = t("ownerFallback");

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
            const bookings = ((response as { bookings?: unknown[] })?.bookings ?? []) as Array<
              Record<string, unknown>
            >;
            const upcoming = bookings
              .filter((b) => {
                const status = String(b.status ?? "").toUpperCase();
                return status === "CONFIRMED" || status === "ONGOING";
              })
              .slice(0, 3)
              .map<UpcomingBooking>((b) => {
                const pickup = (b.pickupLocation as { city?: string } | string | undefined);
                const dropoff = (b.dropoffLocation as { city?: string } | string | undefined);
                const pickupCity =
                  typeof pickup === "string" ? pickup : pickup?.city ?? "";
                const dropoffCity =
                  typeof dropoff === "string" ? dropoff : dropoff?.city ?? "";
                return {
                  id: String(b.id ?? ""),
                  bookingReference: String(b.bookingReference ?? `BK-${String(b.id ?? "").slice(0, 8).toUpperCase()}`),
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
            const rows = ((response as { quotations?: unknown[] })?.quotations ?? []) as Array<
              Record<string, unknown>
            >;
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
                else if (existing.status !== "ACCEPTED" && isResponseQuotation(status)) {
                  existing.status = "SENT";
                }
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
            const raw = response as { unreadCount?: number; count?: number } | undefined;
            setUnreadCount(raw?.unreadCount ?? raw?.count ?? 0);
          })
          .catch(() => {
            setUnreadCount(0);
          }),
      ]);

      if (!controller.signal.aborted) {
        setIsLoadingData(false);
      }
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

  const cardSurface =
    "rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)]";
  const innerCardSurface =
    "rounded-xl border border-[var(--color-border-default)]";
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";
  const quickActionLink = `flex items-center gap-4 p-6 transition-colors hover:border-[var(--color-action-primary)] hover:bg-[var(--color-bg-surface)] ${cardSurface} ${focusRing}`;
  const iconBadge =
    "rounded-xl bg-[var(--color-bg-surface)] p-3 text-[var(--color-action-primary)]";

  return (
    <>
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {t("customerDashboard")}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("welcomeUser", { name: user.firstName })}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <section className="mb-8" aria-labelledby="quick-actions-heading">
          <h2
            id="quick-actions-heading"
            className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]"
          >
            {t("quickActions")}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href={`/${currentLocale}/search`} className={quickActionLink}>
              <div className={iconBadge}>
                <Search className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">
                  {t("actions.searchBuses")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("actions.searchBusesHint")}
                </p>
              </div>
            </Link>

            <Link
              href={`/${currentLocale}/dashboard/quotations`}
              className={quickActionLink}
            >
              <div className={iconBadge}>
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">
                  {t("actions.viewQuotations")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("pendingCount", { count: metrics.pendingQuotations })}
                </p>
              </div>
            </Link>

            <Link
              href={`/${currentLocale}/dashboard/bookings`}
              className={quickActionLink}
            >
              <div className={iconBadge}>
                <Eye className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">
                  {t("actions.trackBooking")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("actions.trackBookingHint")}
                </p>
              </div>
            </Link>
          </div>
        </section>

        <section className="mb-8" aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">
            {t("overview")}
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label={t("metrics.totalBookings")}
              value={metrics.totalBookings}
              icon={<Bus className="h-6 w-6" aria-hidden="true" />}
              loading={isLoadingData}
              iconClassName={iconBadge}
              cardClassName={`${cardSurface} p-6`}
            />
            <MetricCard
              label={t("metrics.completedTrips")}
              value={metrics.completedTrips}
              icon={<CheckCircle className="h-6 w-6" aria-hidden="true" />}
              loading={isLoadingData}
              iconClassName={iconBadge}
              cardClassName={`${cardSurface} p-6`}
            />
            <MetricCard
              label={t("metrics.pendingQuotations")}
              value={metrics.pendingQuotations}
              icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
              loading={isLoadingData}
              iconClassName={iconBadge}
              cardClassName={`${cardSurface} p-6`}
            />
            <MetricCard
              label={t("metrics.totalSpent")}
              value={t("metrics.currency", {
                amount: formatCurrency(metrics.totalSpent, currentLocale),
              })}
              icon={<DollarSign className="h-6 w-6" aria-hidden="true" />}
              loading={isLoadingData}
              iconClassName={iconBadge}
              cardClassName={`${cardSurface} p-6`}
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <section className={cardSurface} aria-labelledby="upcoming-heading">
              <div className="flex items-center justify-between border-b border-[var(--color-border-default)] p-6">
                <div>
                  <h2
                    id="upcoming-heading"
                    className="text-lg font-semibold text-[var(--color-text-primary)]"
                  >
                    {t("upcomingBookings.title")}
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("upcomingBookings.subtitle", {
                      count: upcomingBookings.length,
                    })}
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

              <div className="p-6">
                {isLoadingData ? (
                  <div className="space-y-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={`${innerCardSurface} p-4`}>
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
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <article
                        key={booking.id}
                        className={`${innerCardSurface} p-4 transition-colors hover:bg-[var(--color-bg-surface)]`}
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-[var(--color-text-primary)]">
                              {booking.bookingReference}
                            </h3>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {booking.vehicleName} · {booking.vehicleType}
                            </p>
                          </div>
                          <Badge variant={getStatusBadgeVariant(booking.status)}>
                            {formatStatusLabel(booking.status)}
                          </Badge>
                        </div>

                        <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                            <Calendar
                              className="h-4 w-4 text-[var(--color-text-tertiary)]"
                              aria-hidden="true"
                            />
                            <span>
                              {booking.startDate
                                ? new Date(booking.startDate).toLocaleDateString(currentLocale)
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                            <MapPin
                              className="h-4 w-4 text-[var(--color-text-tertiary)]"
                              aria-hidden="true"
                            />
                            <span>{booking.route}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Link
                            href={`/${currentLocale}/dashboard/bookings/${booking.id}`}
                            className={`flex-1 rounded-xl bg-[var(--color-text-primary)] px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-[var(--color-text-primary)]/90 ${focusRing}`}
                          >
                            {t("actions.viewDetails")}
                          </Link>
                          {booking.ownerPhone ? (
                            <a
                              href={`tel:${booking.ownerPhone}`}
                              aria-label={t("actions.callOwner", { name: booking.ownerName })}
                              className={`flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-xl border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
                            >
                              <Phone className="h-4 w-4" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-surface)]">
                      <Bus
                        className="h-8 w-8 text-[var(--color-text-tertiary)]"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="mb-2 font-semibold text-[var(--color-text-primary)]">
                      {t("upcomingBookings.emptyTitle")}
                    </h3>
                    <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                      {t("upcomingBookings.emptySubtitle")}
                    </p>
                    <Link
                      href={`/${currentLocale}/search`}
                      className={`inline-flex items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing}`}
                    >
                      <Search className="h-4 w-4" aria-hidden="true" />
                      {t("actions.searchBuses")}
                    </Link>
                  </div>
                )}
              </div>
            </section>

            <section className={cardSurface} aria-labelledby="recent-quotations-heading">
              <div className="flex items-center justify-between border-b border-[var(--color-border-default)] p-6">
                <div>
                  <h2
                    id="recent-quotations-heading"
                    className="text-lg font-semibold text-[var(--color-text-primary)]"
                  >
                    {t("recentQuotations.title")}
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("recentQuotations.subtitle")}
                  </p>
                </div>
                <Link
                  href={`/${currentLocale}/dashboard/quotations`}
                  className={`flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${focusRing}`}
                >
                  {t("actions.viewAll")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="p-6">
                {isLoadingData ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={`${innerCardSurface} p-4`}>
                        <Skeleton className="mb-2 h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : recentQuotations.length > 0 ? (
                  <div className="space-y-3">
                    {recentQuotations.map((quotation) => (
                      <Link
                        key={quotation.id}
                        href={`/${currentLocale}/dashboard/quotations/${quotation.id}`}
                        className={`flex items-center justify-between ${innerCardSurface} p-4 transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-[var(--color-text-primary)]">
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
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {quotation.date
                              ? new Date(quotation.date).toLocaleDateString(currentLocale)
                              : "—"}
                          </p>
                        </div>
                        <ArrowRight
                          className="h-4 w-4 text-[var(--color-text-tertiary)]"
                          aria-hidden="true"
                        />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <ClipboardList
                      className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-tertiary)]"
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

          <aside className="space-y-8">
            <section className={cardSurface} aria-labelledby="notifications-heading">
              <div className="flex items-center justify-between border-b border-[var(--color-border-default)] p-6">
                <h2
                  id="notifications-heading"
                  className="text-lg font-semibold text-[var(--color-text-primary)]"
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
                      <Skeleton variant="circular" className="h-8 w-8" />
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
                        <div className="mt-0.5 rounded-xl bg-[var(--color-bg-surface)] p-2 text-[var(--color-action-primary)]">
                          {getNotificationIcon(notification.category)}
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                              {notification.title}
                            </h3>
                            {!notification.isRead ? (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-action-primary)]"
                                aria-hidden="true"
                              />
                            ) : null}
                          </div>
                          <p className="mb-1 text-sm text-[var(--color-text-secondary)]">
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
                  <div className="px-6 py-8 text-center text-sm text-[var(--color-text-secondary)]">
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
    </>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  loading: boolean;
  cardClassName: string;
  iconClassName: string;
}

function MetricCard({
  label,
  value,
  icon,
  loading,
  cardClassName,
  iconClassName,
}: MetricCardProps) {
  return (
    <div className={cardClassName}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1 truncate text-2xl font-bold text-[var(--color-text-primary)]">
              {value}
            </p>
          )}
        </div>
        <div className={iconClassName}>{icon}</div>
      </div>
    </div>
  );
}
