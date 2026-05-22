"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import {
  ArrowLeft,
  Calendar,
  Users,
  Clock,
  Bus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Map,
  MessageSquare,
  FileText,
} from "lucide-react";
import { bookingService, ApiError } from "@/lib/api";

export default function BookingDetailsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const t = useTranslations("bookingDetails");
  const tMsg = useTranslations("messages");
  const { user } = useAuthStore();
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();
  const [selectedDriver, setSelectedDriver] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { id, locale } = use(params);

  const [booking, setBooking] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await bookingService.getById(id);
        const data = (response as any)?.booking || response;
        setBooking(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t("errorLoad"));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  if (guardLoading || !isAuthorized || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center text-error-foreground">{error}</div>
        </div>
      </MainLayout>
    );
  }

  if (!booking) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center text-muted-foreground">{t("notFound")}</div>
        </div>
      </MainLayout>
    );
  }

  const customerName =
    booking.customer?.name ||
    `${booking.customer?.firstName || ""} ${booking.customer?.lastName || ""}`.trim() ||
    t("na");
  const trip = booking.trip || {};
  const payment = booking.payment || {};
  const commissionRateLabel =
    typeof payment.commissionRate === "number"
      ? `${(payment.commissionRate * 100).toFixed(1)}%`
      : null;

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/bookings`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToBookings")}
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {booking.bookingRef}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("createdOn")} {new Date(booking.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                {["upcoming", "confirmed", "ongoing"].includes(booking.status?.toLowerCase()) && (
                  <>
                    <button className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                      <CheckCircle className="h-4 w-4" />
                      {t("startTrip")}
                    </button>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="flex items-center gap-2 rounded-md border border-error px-4 py-2 text-sm font-medium text-error-foreground transition-colors hover:bg-[var(--color-error-bg)]"
                    >
                      <XCircle className="h-4 w-4" />
                      {t("cancelTrip")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Customer Information */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">{t("sectionCustomer")}</h2>
                  <Link
                    href={`/${locale}/owner/messages?booking=${id}`}
                    aria-label={tMsg("messageCustomer")}
                    className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {tMsg("messageCustomer")}
                  </Link>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">{t("nameLabel")}</div>
                    <div className="font-medium text-foreground">{customerName}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">{t("phoneLabel")}</div>
                    <a
                      href={`tel:${booking.customer?.phone || ""}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {booking.customer?.phone || t("na")}
                    </a>
                  </div>
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">{t("emailLabel")}</div>
                    <a
                      href={`mailto:${booking.customer?.email || ""}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {booking.customer?.email || t("na")}
                    </a>
                  </div>
                </div>
              </div>

              {/* Trip Details */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">{t("sectionTrip")}</h2>
                <div className="mb-5 grid gap-4 text-sm md:grid-cols-3">
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">{t("tripDatesLabel")}</div>
                      <div className="font-medium text-foreground">
                        {trip.startDate || booking.startDate
                          ? new Date(trip.startDate || booking.startDate).toLocaleDateString()
                          : t("na")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("to")}{" "}
                        {booking.endDate || trip.endDate
                          ? new Date(trip.endDate || booking.endDate).toLocaleDateString()
                          : t("na")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">{t("durationLabel")}</div>
                      <div className="font-medium text-foreground">
                        {trip.estimatedDuration || booking.estimatedDuration || t("na")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">{t("passengersLabel")}</div>
                      <div className="font-medium text-foreground">
                        {trip.passengers || booking.totalPassengers || t("na")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 rounded-lg bg-muted p-8 text-center">
                  <Map className="mx-auto mb-2 h-8 w-8 text-[var(--color-text-tertiary)]" />
                  <p className="text-sm text-muted-foreground">{t("routeMapTitle")}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {booking.pickupLocation && booking.dropoffLocation
                      ? `${booking.pickupLocation} → ${booking.dropoffLocation}`
                      : t("routeUnavailable")}
                  </p>
                </div>

                <div>
                  <h3 className="mb-3 font-medium text-foreground">{t("itineraryTitle")}</h3>
                  <div className="space-y-3">
                    {booking.itinerary && booking.itinerary.length > 0 ? (
                      booking.itinerary.map((stop: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 rounded-lg border border-border p-4"
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center justify-between">
                              <div className="font-medium text-foreground">
                                {stop.location || stop.name || t("na")}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {stop.time || stop.arrivalTime || t("na")}
                              </div>
                            </div>
                            {stop.notes && (
                              <div className="text-sm text-muted-foreground">{stop.notes}</div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
                        {t("noItinerary")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle & Driver */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {t("sectionVehicleDriver")}
                </h2>
                <div className="mb-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Bus className="h-4 w-4" />
                      {t("assignedVehicle")}
                    </div>
                    <div className="mb-1 font-medium text-foreground">
                      {booking.vehicle?.licensePlate || booking.vehicle?.name || t("na")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {booking.vehicle?.type || t("na")}
                    </div>
                    <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                      {t("capacityLabel")}:{" "}
                      {booking.vehicle?.capacity ?? booking.vehicle?.seats ?? t("na")}{" "}
                      {t("seats")}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      {t("driverAssignment")}
                    </div>
                    {booking.driverName ? (
                      <div>
                        <div className="mb-1 font-medium text-foreground">{booking.driverName}</div>
                        <div className="text-sm text-muted-foreground">
                          {booking.driverPhone || t("na")}
                        </div>
                        {booking.driverLicense && (
                          <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                            {t("licenseLabel")}: {booking.driverLicense}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">{t("noDriver")}</div>
                    )}
                  </div>
                </div>

                {booking.gpsTracking && (
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Map className="h-4 w-4" />
                      {t("gpsEnabled")}
                    </div>
                    <p className="mt-1 text-xs text-primary/80">{t("gpsDesc")}</p>
                    <button className="mt-2 text-xs font-medium text-primary hover:underline">
                      {t("viewLocation")}
                    </button>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">{t("sectionMessages")}</h2>
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("noMessages")}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Payment Information */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">{t("sectionPayment")}</h3>
                <div className="mb-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("basePrice")}</span>
                    <span className="font-medium text-foreground">
                      {t("currency")} {payment.breakdown?.basePrice?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("driverAllowance")}</span>
                    <span className="font-medium text-foreground">
                      {t("currency")} {payment.breakdown?.driverAllowance?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("additionalCharges")}</span>
                    <span className="font-medium text-foreground">
                      {t("currency")} {payment.breakdown?.additionalCharges?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-foreground">{t("totalAmount")}</span>
                      <span className="font-semibold text-foreground">
                        {t("currency")} {(payment.total || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-error-foreground">
                    <span>
                      {t("platformCommission")}
                      {commissionRateLabel ? ` (${commissionRateLabel})` : ""}
                    </span>
                    <span>
                      -{t("currency")} {payment.platformCommission?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-[var(--color-success-bg)] p-3">
                    <div className="flex justify-between font-semibold text-success-foreground">
                      <span>{t("yourNetAmount")}</span>
                      <span>
                        {t("currency")} {payment.netAmount?.toLocaleString() || "0"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-sm bg-[var(--color-success-bg)] px-3 py-1 text-center text-sm font-medium text-success-foreground">
                  {t("paymentLabel")} {payment.status || "pending"}
                </div>
              </div>

              {/* Booking Timeline */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">{t("sectionTimeline")}</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                      </div>
                      <div className="h-full w-0.5 bg-border" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="mb-1 font-medium text-foreground">{t("bookingCreated")}</div>
                      <div className="mb-1 text-xs text-muted-foreground">
                        {new Date(booking.createdAt).toLocaleDateString()} •{" "}
                        {new Date(booking.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="text-sm text-muted-foreground">{t("bookingCreatedDesc")}</div>
                    </div>
                  </div>
                  {booking.payment?.status === "completed" && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="mb-1 font-medium text-foreground">{t("paymentReceived")}</div>
                        <div className="mb-1 text-xs text-muted-foreground">
                          {t("paymentReceivedDesc")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {booking.payment.method}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold text-foreground">{t("sectionActions")}</h3>
                <div className="space-y-2">
                  <button className="flex w-full items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
                    <FileText className="h-4 w-4" />
                    {t("generateInvoice")}
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
                    <AlertTriangle className="h-4 w-4" />
                    {t("reportIssue")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-card p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                {t("cancelModal.title")}
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">{t("cancelModal.desc")}</p>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t("cancelModal.reasonRequired")}
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder={t("cancelModal.reasonPlaceholder")}
                  className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-[var(--color-text-tertiary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  {t("cancelModal.keepBooking")}
                </button>
                <button
                  disabled={!cancelReason}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-error px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-error/90 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  {t("cancelModal.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
