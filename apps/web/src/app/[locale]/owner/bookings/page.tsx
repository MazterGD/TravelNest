"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { ArrowLeft, Calendar, MapPin, Users, Bus, Eye, Phone, Mail, Upload } from "lucide-react";
import { bookingService, ApiError } from "@/lib/api";

type BookingStatus = "upcoming" | "in-progress" | "completed" | "cancelled";
type PaymentStatus = "pending" | "partial" | "paid" | "refunded";
type DbBookingStatus = "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED";

interface Booking {
  id: string;
  bookingRef: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    organization?: string;
  };
  vehicle: {
    registration: string;
    type: string;
  };
  trip: {
    startDate: string;
    endDate: string;
    route: string;
    passengers: number;
  };
  payment: {
    total: number;
    status: PaymentStatus;
  };
  status: DbBookingStatus;
  createdAt: string;
}

function mapDbStatusToUi(dbStatus: DbBookingStatus): BookingStatus {
  switch (dbStatus) {
    case "PENDING":
    case "CONFIRMED":
      return "upcoming";
    case "ONGOING":
      return "in-progress";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "upcoming";
  }
}

function getStatusClasses(status: DbBookingStatus): string {
  switch (mapDbStatusToUi(status)) {
    case "upcoming":
      return "bg-primary/10 text-primary";
    case "in-progress":
      return "bg-[var(--color-success-bg)] text-success-foreground";
    case "completed":
      return "bg-muted text-muted-foreground";
    case "cancelled":
      return "bg-[var(--color-error-bg)] text-error-foreground";
  }
}

function getPaymentStatusClasses(status: PaymentStatus): string {
  switch (status) {
    case "paid":
      return "bg-[var(--color-success-bg)] text-success-foreground";
    case "partial":
      return "bg-primary/10 text-primary";
    case "pending":
    case "refunded":
      return "bg-muted text-muted-foreground";
  }
}

export default function BookingsManagementPage() {
  const t = useTranslations("bookingsManagement");
  const { user } = useAuthStore();
  const params = useParams();
  const locale = params.locale as string;
  const [activeTab, setActiveTab] = useState<BookingStatus>("upcoming");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user || !isAuthorized) return;
      setIsLoading(true);
      try {
        const response = await bookingService.getOwnerBookings();
        const data = response as any;
        setBookings(Array.isArray(data.bookings) ? (data.bookings as unknown as Booking[]) : []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t("errorLoad"));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user, isAuthorized]);

  const filteredBookings = bookings.filter((booking) => {
    const matchesTab = mapDbStatusToUi(booking.status) === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      booking.bookingRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.vehicle.registration.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const tabCounts = {
    upcoming: bookings.filter((b) => mapDbStatusToUi(b.status) === "upcoming").length,
    "in-progress": bookings.filter((b) => mapDbStatusToUi(b.status) === "in-progress").length,
    completed: bookings.filter((b) => mapDbStatusToUi(b.status) === "completed").length,
    cancelled: bookings.filter((b) => mapDbStatusToUi(b.status) === "cancelled").length,
  };

  const tabs = [
    { id: "upcoming" as const, label: t("tabUpcoming") },
    { id: "in-progress" as const, label: t("tabInProgress") },
    { id: "completed" as const, label: t("tabCompleted") },
    { id: "cancelled" as const, label: t("tabCancelled") },
  ];

  if (guardLoading || !isAuthorized || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToDashboard")}
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {filteredBookings.length}{" "}
                  {filteredBookings.length === 1 ? t("bookingSingular") : t("bookingPlural")}
                </p>
              </div>
              <button
                aria-label={t("exportBtn")}
                className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                {t("exportBtn")}
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="mb-8 rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.label} ({tabCounts[tab.id]})
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("viewList")}
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "calendar"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("viewCalendar")}
                </button>
              </div>
            </div>
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-all placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {viewMode === "list" && (
            <>
              {isLoading ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <LoadingSpinner size="lg" />
                </div>
              ) : error ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <p className="text-sm text-error-foreground">{error}</p>
                </div>
              ) : filteredBookings.length > 0 ? (
                <div className="space-y-4">
                  {filteredBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/30"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <h3 className="font-semibold text-foreground">{booking.bookingRef}</h3>
                            <span
                              className={`rounded-sm px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusClasses(booking.status)}`}
                            >
                              {mapDbStatusToUi(booking.status).replace("-", " ")}
                            </span>
                            <span
                              className={`rounded-sm px-2.5 py-0.5 text-xs font-medium capitalize ${getPaymentStatusClasses(booking.payment.status)}`}
                            >
                              {t("paymentLabel")} {booking.payment.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t("bookedOn")} {new Date(booking.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="mb-1 text-sm text-muted-foreground">{t("totalAmount")}</div>
                          <div className="text-lg font-semibold text-foreground">
                            {t("currency")} {booking.payment.total.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="mb-5 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-start gap-2">
                          <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-text-tertiary)]" />
                          <div>
                            <div className="mb-1 font-medium text-foreground">
                              {booking.customer.name}
                            </div>
                            {booking.customer.organization && (
                              <div className="text-xs text-muted-foreground">
                                {booking.customer.organization}
                              </div>
                            )}
                            <div className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--color-text-tertiary)]">
                              <span>{booking.customer.phone}</span>
                              <span>{booking.customer.email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Bus className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-text-tertiary)]" />
                          <div>
                            <div className="text-xs text-muted-foreground">{t("vehicleLabel")}</div>
                            <div className="font-medium text-foreground">
                              {booking.vehicle.registration}
                            </div>
                            <div className="text-xs text-muted-foreground">{booking.vehicle.type}</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-text-tertiary)]" />
                          <div>
                            <div className="text-xs text-muted-foreground">{t("tripDatesLabel")}</div>
                            <div className="font-medium text-foreground">
                              {new Date(booking.trip.startDate).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("to")} {new Date(booking.trip.endDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-text-tertiary)]" />
                          <div>
                            <div className="text-xs text-muted-foreground">{t("routeLabel")}</div>
                            <div className="font-medium text-foreground">{booking.trip.route}</div>
                            <div className="text-xs text-muted-foreground">
                              {booking.trip.passengers} {t("passengers")}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/${locale}/owner/bookings/${booking.id}`}
                          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <Eye className="h-4 w-4" />
                          {t("viewDetails")}
                        </Link>
                        <a
                          href={`tel:${booking.customer.phone}`}
                          className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                        >
                          <Phone className="h-4 w-4" />
                          {t("call")}
                        </a>
                        <a
                          href={`mailto:${booking.customer.email}`}
                          className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                        >
                          <Mail className="h-4 w-4" />
                          {t("emailBtn")}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <div className="mx-auto max-w-sm">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Calendar className="h-8 w-8 text-[var(--color-text-tertiary)]" />
                    </div>
                    <h3 className="mb-2 font-semibold text-foreground">
                      {activeTab === "upcoming"
                        ? t("emptyUpcomingTitle")
                        : t("emptyTitle", { status: activeTab.replace("-", " ") })}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {activeTab === "upcoming"
                        ? t("emptyUpcomingDesc")
                        : t("emptyDesc", { status: activeTab.replace("-", " ") })}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {viewMode === "calendar" && (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <div className="mx-auto max-w-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Calendar className="h-8 w-8 text-[var(--color-text-tertiary)]" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">{t("calendarTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("calendarComingSoon")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
