"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner, Badge } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useProtectedRoute } from "@/hooks";
import {
  bookingService,
  quotationService,
  notificationService,
  ApiError,
} from "@/lib/api";
import {
  Bus,
  ClipboardList,
  CheckCircle,
  DollarSign,
  Search,
  Eye,
  Bell,
  MapPin,
  Calendar,
  Users,
  Phone,
  ArrowRight,
  Clock,
} from "lucide-react";

interface DashboardMetrics {
  totalBookings: number;
  completedTrips: number;
  pendingQuotations: number;
  totalSpent: string;
}

interface UpcomingBooking {
  id: string;
  bookingReference: string;
  date: string;
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
  quotationsCount: number;
  status: string;
}

interface Notification {
  id: string;
  type: "booking" | "quotation" | "payment" | "general";
  title: string;
  message: string;
  time: string;
  isRead: boolean;
}

interface DashboardPageProps {
  locale: string;
}

export function DashboardContent({ locale }: DashboardPageProps) {
  const t = useTranslations("dashboard");
  const { user } = useAuthStore();
  const params = useParams();
  const currentLocale = (params.locale as string) || locale;

  // State for API data
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalBookings: 0,
    completedTrips: 0,
    pendingQuotations: 0,
    totalSpent: "LKR 0",
  });
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>(
    [],
  );
  const [recentQuotations, setRecentQuotations] = useState<RecentQuotation[]>(
    [],
  );
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  // Protect this route
  const { isLoading: guardLoading, isAuthorized } = useProtectedRoute();

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      setIsLoadingData(true);

      try {
        // Fetch bookings
        try {
          const response = await bookingService.getMyBookings();
          const data = response as any;
          const bookings = data.bookings || [];

          // Calculate metrics
          const completedBookings = bookings.filter(
            (b: any) => b.status === "COMPLETED",
          );
          const upcomingBookings = bookings
            .filter(
              (b: any) => b.status === "CONFIRMED" || b.status === "ONGOING",
            )
            .slice(0, 3)
            .map((b: any) => ({
              id: b.id,
              bookingReference: b.bookingReference || "N/A",
              date: b.startDate || "",
              route: `${b.pickupLocation?.city || "N/A"} → ${b.dropoffLocation?.city || "N/A"}`,
              vehicleName: b.vehicle?.name || "N/A",
              vehicleType: b.vehicle?.type || "Bus",
              status: b.status,
              ownerName: b.owner?.firstName || "N/A",
              ownerPhone: b.owner?.phone || "N/A",
            }));

          setMetrics((prev) => ({
            ...prev,
            totalBookings: bookings.length,
            completedTrips: completedBookings.length,
          }));

          setUpcomingBookings(upcomingBookings);
        } catch (err) {
          console.error("Failed to fetch bookings:", err);
        }

        // Fetch quotations
        try {
          const response = await quotationService.getMyRequests();
          const data = response as any;
          const quotationsList = data.data?.data || data.data || [];

          const pendingQuotes = quotationsList.filter(
            (q: any) => q.status === "PENDING",
          );

          const recentQuotes = quotationsList.slice(0, 5).map((q: any) => ({
            id: q.id,
            route: `${q.pickupLocation?.city || "N/A"} → ${q.dropoffLocation?.city || "N/A"}`,
            date: q.pickupDate || "",
            quotationsCount: q.quotations?.length || 0,
            status: q.status,
          }));

          setMetrics((prev) => ({
            ...prev,
            pendingQuotations: pendingQuotes.length,
          }));

          setRecentQuotations(recentQuotes);
        } catch (err) {
          console.error("Failed to fetch quotations:", err);
        }

        // Fetch notifications
        try {
          const notificationList = await notificationService.getAll({
            limit: 5,
          });
          const normalizedNotifications = (notificationList || []).map(
            (notification) => {
              const normalizedType = notification.type.includes("quotation")
                ? "quotation"
                : notification.type.includes("booking")
                  ? "booking"
                  : notification.type.includes("payment")
                    ? "payment"
                    : "general";

              return {
                id: notification.id,
                type: normalizedType as Notification["type"],
                title: notification.title,
                message: notification.message,
                time: formatRelativeTime(notification.createdAt),
                isRead: notification.isRead,
              };
            },
          );

          setNotifications(normalizedNotifications);
        } catch (notificationError) {
          console.error("Failed to fetch notifications:", notificationError);
          setNotifications([]);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (user && isAuthorized) {
      fetchDashboardData();
    }
  }, [user, isAuthorized]);

  // Show loading while checking auth state
  if (guardLoading || !isAuthorized || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONFIRMED":
        return "success";
      case "ONGOING":
        return "info";
      case "PENDING":
        return "warning";
      case "COMPLETED":
        return "success";
      default:
        return "default";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "booking":
        return <Calendar className="h-4 w-4" />;
      case "quotation":
        return <ClipboardList className="h-4 w-4" />;
      case "payment":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const formatStatusLabel = (status: string) =>
    t(`status.${status.toLowerCase()}`, { defaultValue: status });

  return (
    <>
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {t("customerDashboard")}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t("welcomeUser", { name: user.firstName })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Quick Actions Widget */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("quickActions")}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href={`/${currentLocale}/search`}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-[#20B0E9] hover:bg-gray-50"
            >
              <div className="rounded-full bg-blue-100 p-3">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {t("actions.searchBuses")}
                </h3>
                <p className="text-sm text-gray-500">
                  {t("actions.searchBusesHint")}
                </p>
              </div>
            </Link>

            <Link
              href={`/${currentLocale}/dashboard/quotations`}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-[#20B0E9] hover:bg-gray-50"
            >
              <div className="rounded-full bg-yellow-100 p-3">
                <ClipboardList className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {t("actions.viewQuotations")}
                </h3>
                <p className="text-sm text-gray-500">
                  {t("pendingCount", {
                    count: metrics.pendingQuotations,
                  })}
                </p>
              </div>
            </Link>

            <Link
              href={`/${currentLocale}/dashboard/bookings`}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-[#20B0E9] hover:bg-gray-50"
            >
              <div className="rounded-full bg-green-100 p-3">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {t("actions.trackBooking")}
                </h3>
                <p className="text-sm text-gray-500">
                  {t("actions.trackBookingHint")}
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Bookings */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {t("metrics.totalBookings")}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {metrics.totalBookings}
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <Bus className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Completed Trips */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {t("metrics.completedTrips")}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {metrics.completedTrips}
                </p>
              </div>
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Pending Quotations */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {t("metrics.pendingQuotations")}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {metrics.pendingQuotations}
                </p>
              </div>
              <div className="rounded-full bg-yellow-100 p-3">
                <ClipboardList className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Total Spent */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {t("metrics.totalSpent")}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {metrics.totalSpent}
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-3">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Upcoming Bookings - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("upcomingBookings.title")}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t("upcomingBookings.subtitle", {
                      count: upcomingBookings.length,
                    })}
                  </p>
                </div>
                <Link
                  href={`/${currentLocale}/dashboard/bookings`}
                  className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  {t("actions.viewAll")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="p-6">
                {upcomingBookings.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {booking.bookingReference}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {booking.vehicleName} • {booking.vehicleType}
                            </p>
                          </div>
                          <Badge
                            variant={getStatusBadgeColor(booking.status) as any}
                          >
                            {formatStatusLabel(booking.status)}
                          </Badge>
                        </div>

                        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {new Date(booking.date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {booking.route}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Link
                            href={`/${currentLocale}/dashboard/bookings/${booking.id}`}
                            className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-gray-800"
                          >
                            {t("actions.viewDetails")}
                          </Link>
                          <button className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                            <Phone className="mx-auto h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                      <Bus className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="mb-2 font-semibold text-gray-900">
                      {t("upcomingBookings.emptyTitle")}
                    </h3>
                    <p className="mb-4 text-sm text-gray-600">
                      {t("upcomingBookings.emptySubtitle")}
                    </p>
                    <Link
                      href={`/${currentLocale}/search`}
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                    >
                      <Search className="h-4 w-4" />
                      {t("actions.searchBuses")}
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Quotations Section */}
            <div className="mt-8 rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("recentQuotations.title")}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t("recentQuotations.subtitle")}
                  </p>
                </div>
                <Link
                  href={`/${currentLocale}/dashboard/quotations`}
                  className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  {t("actions.viewAll")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="p-6">
                {recentQuotations.length > 0 ? (
                  <div className="space-y-3">
                    {recentQuotations.map((quotation) => (
                      <Link
                        key={quotation.id}
                        href={`/${currentLocale}/dashboard/quotations/${quotation.id}`}
                        className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">
                              {quotation.route}
                            </h3>
                            {quotation.quotationsCount > 0 && (
                              <span className="rounded-full bg-[#20B0E9] px-2 py-0.5 text-xs font-medium text-white">
                                {t("recentQuotations.quotesCount", {
                                  count: quotation.quotationsCount,
                                })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(quotation.date).toLocaleDateString()}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <ClipboardList className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-500">
                      {t("recentQuotations.empty")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Notifications */}
          <div className="space-y-8">
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("notifications.title")}
                </h2>
                <span className="rounded-full bg-[#20B0E9] px-2 py-0.5 text-xs font-medium text-white">
                  {notifications.filter((n) => !n.isRead).length}
                </span>
              </div>

              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 transition-colors hover:bg-gray-50 ${
                      !notification.isRead ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`mt-0.5 rounded-full p-2 ${
                          notification.type === "quotation"
                            ? "bg-yellow-100"
                            : notification.type === "booking"
                              ? "bg-blue-100"
                              : notification.type === "payment"
                                ? "bg-green-100"
                                : "bg-gray-100"
                        }`}
                      >
                        <span
                          className={`${
                            notification.type === "quotation"
                              ? "text-yellow-600"
                              : notification.type === "booking"
                                ? "text-blue-600"
                                : notification.type === "payment"
                                  ? "text-green-600"
                                  : "text-gray-600"
                          }`}
                        >
                          {getNotificationIcon(notification.type)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-start justify-between">
                          <h3 className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </h3>
                          {!notification.isRead && (
                            <span className="h-2 w-2 rounded-full bg-[#20B0E9]" />
                          )}
                        </div>
                        <p className="mb-1 text-sm text-gray-600">
                          {notification.message}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 p-4">
                <Link
                  href={`/${currentLocale}/dashboard/notifications`}
                  className="flex items-center justify-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  {t("notifications.viewAll")}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
