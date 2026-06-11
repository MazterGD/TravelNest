"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/store";

const InteractiveMap = dynamic(
  () => import("@/components/ui/InteractiveMap"),
  { ssr: false, loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-lg flex items-center justify-center"><Map className="h-8 w-8 text-muted-foreground" /></div> }
);
import { useOwnerGuard } from "@/hooks";
import { quotationService } from "@/lib/api/services";
import { formatDate } from "@/lib/utils/formatters";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Map,
} from "lucide-react";

interface QuotationDetail {
  id: string;
  quotationId: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  trip: {
    pickupLocation: string;
    dropoffLocation: string;
    startDate: string;
    endDate: string;
    startTime: string;
    estimatedDistance: string;
    estimatedDuration: string;
    itineraryStops?: any[];
    itineraryRoute?: any;
  };
  passengers: number;
  vehicle: {
    name: string;
    type: string;
    capacity: number;
  };
  pricing: {
    vehicleRentalCost: number;
    driverCost: number;
    fuelCost: number;
    tollCharges: number;
    permitFees: number;
    customItems: Array<{ description: string; amount: number }>;
    subtotal: number;
    tax: number;
    total: number;
  };
  status: "sent" | "viewed" | "accepted" | "rejected" | "expired";
  sentDate: string;
  viewedDate?: string;
  respondedDate?: string;
  validUntil: string;
  daysRemaining: number;
  additionalNotes?: string;
  rejectionReason?: string;
}

export default function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = use(params);
  const { user } = useAuthStore();
  const t = useTranslations("sentQuotations");
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);

  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  useEffect(() => {
    const fetchQuotation = async () => {
      try {
        const response = await quotationService.getById(id);
        const data = response.quotation;

        const validUntil = data.validUntil ? new Date(data.validUntil) : null;
        const today = new Date();
        const daysRemaining = validUntil
          ? Math.max(
              0,
              Math.ceil(
                (validUntil.getTime() - today.getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0;

        setQuotation({
          id: data.id,
          quotationId: data.quotationId,
          customer: {
            name: `${data.customer?.firstName || ""} ${data.customer?.lastName || ""}`.trim(),
            email: data.customer?.email || "",
            phone: data.customer?.phone || "",
          },
          trip: {
            pickupLocation: data.pickupLocation,
            dropoffLocation: data.dropoffLocation,
            startDate: new Date(data.startDate).toISOString().split("T")[0],
            endDate: new Date(data.endDate).toISOString().split("T")[0],
            startTime: data.startTime || "",
            estimatedDistance: data.estimatedDistance || "",
            estimatedDuration: data.estimatedDuration || "",
            itineraryStops: data.itineraryStops,
            itineraryRoute: data.itineraryRoute,
          },
          passengers: data.passengerCount,
          vehicle: {
            name: data.vehicle?.licensePlate || data.vehicleType,
            type: data.vehicleType,
            capacity: 0,
          },
          pricing: {
            vehicleRentalCost: data.vehicleRentalCost || 0,
            driverCost: data.driverCost || 0,
            fuelCost: data.fuelCost || 0,
            tollCharges: data.tollCharges || 0,
            permitFees: data.permitFees || 0,
            customItems: data.customItems || [],
            subtotal: data.subtotal || 0,
            tax: data.tax || 0,
            total: data.totalAmount || 0,
          },
          status: data.status.toLowerCase() as
            | "sent"
            | "viewed"
            | "accepted"
            | "rejected"
            | "expired",
          sentDate: (data.sentAt || data.createdAt).toString(),
          viewedDate: data.viewedAt?.toString(),
          respondedDate: data.respondedAt?.toString(),
          validUntil: data.validUntil
            ? new Date(data.validUntil).toISOString().split("T")[0]
            : "",
          daysRemaining,
          additionalNotes: data.additionalNotes,
          rejectionReason: data.rejectionReason,
        });
      } catch {
        setQuotation(null);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized && id) {
      fetchQuotation();
    }
  }, [id, isAuthorized]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      sent: "bg-primary/10 text-primary",
      viewed: "bg-primary/15 text-primary",
      accepted: "bg-[var(--color-success-bg)] text-success-foreground",
      rejected: "bg-[var(--color-error-bg)] text-error-foreground",
      expired: "bg-muted text-muted-foreground",
    };

    const icons: Record<string, React.JSX.Element> = {
      sent: <FileText className="h-4 w-4" />,
      viewed: <Eye className="h-4 w-4" />,
      accepted: <CheckCircle className="h-4 w-4" />,
      rejected: <XCircle className="h-4 w-4" />,
      expired: <Clock className="h-4 w-4" />,
    };

    const labelKeys: Record<string, string> = {
      sent: "status.SENT",
      viewed: "status.VIEWED",
      accepted: "status.ACCEPTED",
      rejected: "status.REJECTED",
      expired: "status.EXPIRED",
    };

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-sm px-3 py-1 text-sm font-medium ${styles[status] ?? styles.sent}`}
      >
        {icons[status] ?? icons.sent}
        {t(labelKeys[status] ?? labelKeys.sent)}
      </span>
    );
  };

  if (guardLoading || !isAuthorized || !user || loading) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  if (!quotation) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("detail.notFound.title")}
            </h3>
            <Link
              href={`/${locale}/owner/quotations/sent`}
              className="mt-4 inline-block text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("detail.notFound.back")}
            </Link>
          </div>
        </div>
    );
  }

  const isExpiredOrUrgent = quotation.daysRemaining <= 2;

  return (
      <div className="min-h-screen bg-muted">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/quotations/sent`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("detail.backToSent")}
            </Link>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {quotation.quotationId}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("detail.quotationFor", { name: quotation.customer.name })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {getStatusBadge(quotation.status)}
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column */}
            <div className="space-y-6 lg:col-span-2">
              {/* Status Timeline */}
              <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {t("detail.timeline.title")}
                </h2>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="h-full w-0.5 bg-border" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="mb-1 font-medium text-foreground">
                        {t("detail.timeline.sent")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(quotation.sentDate).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {quotation.viewedDate && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
                          <Eye className="h-4 w-4 text-primary" />
                        </div>
                        {quotation.respondedDate && (
                          <div className="h-full w-0.5 bg-border" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="mb-1 font-medium text-foreground">
                          {t("detail.timeline.viewedByCustomer")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(quotation.viewedDate).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {quotation.respondedDate && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            quotation.status === "accepted"
                              ? "bg-[var(--color-success-bg)]"
                              : "bg-[var(--color-error-bg)]"
                          }`}
                        >
                          {quotation.status === "accepted" ? (
                            <CheckCircle className="h-4 w-4 text-success-foreground" />
                          ) : (
                            <XCircle className="h-4 w-4 text-error-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="mb-1 font-medium text-foreground">
                          {quotation.status === "accepted"
                            ? t("detail.timeline.acceptedByCustomer")
                            : t("detail.timeline.rejectedByCustomer")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(quotation.respondedDate).toLocaleString()}
                        </div>
                        {quotation.rejectionReason && (
                          <div className="mt-2 rounded-md border border-error bg-[var(--color-error-bg)] p-3 text-sm text-error-foreground">
                            <span className="font-medium">{t("detail.timeline.reason")}:</span>{" "}
                            {quotation.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Information */}
              <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {t("detail.customer.title")}
                </h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">{t("detail.customer.name")}</div>
                    <div className="font-medium text-foreground">
                      {quotation.customer.name}
                    </div>
                  </div>
                  {quotation.customer.email && (
                    <div>
                      <div className="text-sm text-muted-foreground">{t("detail.customer.email")}</div>
                      <a
                        href={`mailto:${quotation.customer.email}`}
                        className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {quotation.customer.email}
                      </a>
                    </div>
                  )}
                  {quotation.customer.phone && (
                    <div>
                      <div className="text-sm text-muted-foreground">{t("detail.customer.phone")}</div>
                      <a
                        href={`tel:${quotation.customer.phone}`}
                        className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {quotation.customer.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Trip Details */}
              <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {t("detail.trip.title")}
                </h2>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 text-[var(--color-text-tertiary)]" />
                      <div>
                        <div className="text-sm text-muted-foreground">{t("detail.trip.route")}</div>
                        <div className="font-medium text-foreground">
                          {quotation.trip.pickupLocation}
                        </div>
                        <div className="text-sm text-muted-foreground">→</div>
                        <div className="font-medium text-foreground">
                          {quotation.trip.dropoffLocation}
                        </div>
                        {(quotation.trip.estimatedDistance || quotation.trip.estimatedDuration) && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {quotation.trip.estimatedDistance}
                            {quotation.trip.estimatedDistance && quotation.trip.estimatedDuration ? " • " : ""}
                            {quotation.trip.estimatedDuration}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-5 w-5 text-[var(--color-text-tertiary)]" />
                      <div>
                        <div className="text-sm text-muted-foreground">{t("detail.trip.dateTime")}</div>
                        <div className="font-medium text-foreground">
                          {formatDate(quotation.trip.startDate, "medium")}
                        </div>
                        {quotation.trip.startTime && (
                          <div className="text-sm text-muted-foreground">
                            {quotation.trip.startTime}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 h-5 w-5 text-[var(--color-text-tertiary)]" />
                      <div>
                        <div className="text-sm text-muted-foreground">{t("detail.trip.passengersLabel")}</div>
                        <div className="font-medium text-foreground">
                          {t("detail.trip.passengers", { count: quotation.passengers })}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground">{t("detail.trip.vehicle")}</div>
                      <div className="font-medium text-foreground">
                        {quotation.vehicle.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("detail.trip.vehicleSeats", {
                          type: quotation.vehicle.type,
                          capacity: quotation.vehicle.capacity,
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Map Integration */}
                  <div className="mt-6 rounded-lg overflow-hidden h-[300px]">
                    <InteractiveMap
                      readOnly={true}
                      initialWaypoints={quotation.trip.itineraryStops?.map((stop: any) => ({
                        lat: stop.coordinates?.[1] || stop.lat,
                        lng: stop.coordinates?.[0] || stop.lng,
                        name: stop.locationName,
                      })) || []}
                      initialRouteGeometry={quotation.trip.itineraryRoute?.coordinates?.map(
                        ([lng, lat]: [number, number]) => [lat, lng]
                      ) || []}
                    />
                  </div>

                  {quotation.additionalNotes && (
                    <div className="rounded-md border border-border bg-muted p-4">
                      <h3 className="mb-2 text-sm font-semibold text-foreground">
                        {t("detail.trip.additionalNotes")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {quotation.additionalNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {t("detail.pricing.title")}
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("detail.pricing.vehicleRental")}</span>
                    <span className="font-medium text-foreground">
                      LKR {quotation.pricing.vehicleRentalCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("detail.pricing.driverCost")}</span>
                    <span className="font-medium text-foreground">
                      LKR {quotation.pricing.driverCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("detail.pricing.fuelCost")}</span>
                    <span className="font-medium text-foreground">
                      LKR {quotation.pricing.fuelCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("detail.pricing.tollCharges")}</span>
                    <span className="font-medium text-foreground">
                      LKR {quotation.pricing.tollCharges.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("detail.pricing.permitFees")}</span>
                    <span className="font-medium text-foreground">
                      LKR {quotation.pricing.permitFees.toLocaleString()}
                    </span>
                  </div>

                  {quotation.pricing.customItems.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-muted-foreground">{item.description}</span>
                      <span className="font-medium text-foreground">
                        LKR {item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("detail.pricing.subtotal")}</span>
                      <span className="font-medium text-foreground">
                        LKR {quotation.pricing.subtotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("detail.pricing.tax")}</span>
                    <span className="font-medium text-foreground">
                      LKR {quotation.pricing.tax.toLocaleString()}
                    </span>
                  </div>

                  <div className="border-t-2 border-foreground pt-3">
                    <div className="flex justify-between">
                      <span className="text-lg font-semibold text-foreground">
                        {t("detail.pricing.grandTotal")}
                      </span>
                      <span className="text-xl font-bold text-foreground">
                        LKR {quotation.pricing.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                {/* Validity Card */}
                <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {t("detail.validity.title")}
                  </h2>
                  <div
                    className={`rounded-md p-4 ${
                      isExpiredOrUrgent
                        ? "border border-error bg-[var(--color-error-bg)]"
                        : "border border-border bg-muted"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Clock
                        className={`mt-0.5 h-5 w-5 ${
                          isExpiredOrUrgent ? "text-error-foreground" : "text-[var(--color-text-tertiary)]"
                        }`}
                      />
                      <div>
                        <div
                          className={`mb-1 font-semibold ${
                            isExpiredOrUrgent ? "text-error-foreground" : "text-foreground"
                          }`}
                        >
                          {quotation.daysRemaining <= 0
                            ? t("detail.validity.expired")
                            : t("detail.validity.daysRemaining", {
                                days: quotation.daysRemaining,
                              })}
                        </div>
                        {quotation.validUntil && (
                          <div
                            className={`text-sm ${
                              isExpiredOrUrgent
                                ? "text-error-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {t("detail.validity.validUntil", {
                              date: formatDate(quotation.validUntil, "short"),
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Accepted state */}
                {quotation.status === "accepted" && (
                  <div className="rounded-lg border border-success bg-[var(--color-success-bg)] p-6">
                    <h3 className="mb-3 font-semibold text-success-foreground">
                      {t("detail.accepted.title")}
                    </h3>
                    <p className="mb-4 text-sm text-success-foreground">
                      {t("detail.accepted.description")}
                    </p>
                    <Link
                      href={`/${locale}/owner/bookings/create?quotation=${quotation.id}`}
                      className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t("detail.accepted.createBooking")}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
