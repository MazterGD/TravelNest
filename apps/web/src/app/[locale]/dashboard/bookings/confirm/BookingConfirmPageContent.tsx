"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner, Button, Card } from "@/components/ui";
import { useProtectedRoute } from "@/hooks";
import { quotationService } from "@/lib/api/services";
import { ArrowLeft, Calendar, MapPin, Users, Clock, Phone, Mail, Snowflake, CheckCircle } from "lucide-react";

interface BookingConfirmPageContentProps {
  locale: string;
}

interface QuotationDetails {
  id: string;
  quotationId: string;
  vehicleId: string;
  vehicleType: string;
  customerId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  pickupLocation: string;
  dropoffLocation: string;
  passengerCount: number;
  estimatedDistance: string;
  estimatedDuration: string;
  specialRequests?: string;
  status: string;
  vehicleRentalCost: number;
  driverCost: number;
  fuelCost: number;
  tollCharges: number;
  subtotal: number;
  tax: number;
  totalAmount: number;
  additionalNotes?: string;
  validUntil: string;
  createdAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  vehicle: {
    id: string;
    licensePlate: string;
    year: number;
    pricePerDay: number;
    ownerId: string;
    owner: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
  };
}

export default function BookingConfirmPageContent({
  locale,
}: BookingConfirmPageContentProps) {
  const t = useTranslations("bookingConfirm");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: guardLoading } = useProtectedRoute();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [quotation, setQuotation] = useState<QuotationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quotationId = searchParams.get("quotationId");

  useEffect(() => {
    if (!guardLoading) {
      fetchQuotationDetails();
    }
  }, [guardLoading, quotationId]);

  const fetchQuotationDetails = async () => {
    if (!quotationId) {
      setError(t("errors.noQuotation"));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await quotationService.getById(quotationId);
      const data = response as any;
      const quotationData = data.data?.quotation || data.quotation || data;
      setQuotation(quotationData);
    } catch (err: any) {
      console.error("Error fetching quotation:", err);
      setError(err.message || t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!quotationId) return;

    try {
      setCreating(true);
      setError(null);

      // Accepting the quotation is what creates the (PENDING) booking — the
      // exact same backend path as the quotation detail page. The customer then
      // pays from the booking detail page to confirm it.
      const response = await quotationService.respondToQuotation(quotationId, {
        status: "ACCEPTED",
      });
      const data = response as any;
      const bookingId = data.quotation?.booking?.id ?? data.booking?.id;

      // Redirect to booking details page (or the list if the id is unavailable)
      router.push(
        bookingId
          ? `/${locale}/dashboard/bookings/${bookingId}`
          : `/${locale}/dashboard/bookings`,
      );
    } catch (err: any) {
      console.error("Error creating booking:", err);
      setError(err.message || t("errors.create"));
      setCreating(false);
    }
  };

  if (guardLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <p role="alert" className="text-[var(--color-error-text)] mb-4">
            {error || t("errors.notFound")}
          </p>
          <Button onClick={() => router.back()}>{t("goBack")}</Button>
        </Card>
      </div>
    );
  }

  const calculateDays = () => {
    if (!quotation?.startDate || !quotation?.endDate) return 1;
    const start = new Date(quotation.startDate);
    const end = new Date(quotation.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const days = calculateDays();
  const typeLabel = ["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"].includes(quotation.vehicleType)
    ? t(`vehicleTypes.${quotation.vehicleType}`)
    : quotation.vehicleType.replace(/_/g, " ");
  const money = (amount: number) => t("amount", { amount: amount.toLocaleString() });
  const label = "text-sm text-[var(--color-text-secondary)]";
  const value = "font-medium text-[var(--color-text-primary)]";
  const heading = "text-xl font-semibold text-[var(--color-text-primary)] mb-4";
  const icon = "h-5 w-5 shrink-0 text-[var(--color-action-primary)] mt-1";

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mb-4"
        >
          <ArrowLeft className="mr-2" aria-hidden="true" />
          {t("back")}
        </Button>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className={heading}>{t("vehicleDetails")}</h2>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {t("busType", { type: typeLabel })}
            </h3>
            <p className={label}>{t("licensePlate", { plate: quotation.vehicle.licensePlate })}</p>
            <p className={label}>{t("year", { year: quotation.vehicle.year })}</p>
            <div className="flex flex-wrap gap-3 mt-3">
              <div className={`flex items-center ${label}`}>
                <Users className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t("passengerCount", { count: quotation.passengerCount })}
              </div>
              <div className={`flex items-center ${label}`}>
                <Snowflake className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {typeLabel}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className={heading}>{t("tripDetails")}</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className={icon} aria-hidden="true" />
                <div>
                  <p className={label}>{t("pickup")}</p>
                  <p className={value}>{quotation.pickupLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className={icon} aria-hidden="true" />
                <div>
                  <p className={label}>{t("dropoff")}</p>
                  <p className={value}>{quotation.dropoffLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className={icon} aria-hidden="true" />
                <div>
                  <p className={label}>{t("duration")}</p>
                  <p className={value}>
                    {new Date(quotation.startDate).toLocaleDateString(locale)}
                    {" - "}
                    {new Date(quotation.endDate).toLocaleDateString(locale)}
                    <span className={`${label} ml-2`}>({t("days", { count: days })})</span>
                  </p>
                  <p className={`${label} mt-1`}>{t("startTime", { time: quotation.startTime })}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className={icon} aria-hidden="true" />
                <div>
                  <p className={label}>{t("passengers")}</p>
                  <p className={value}>{t("passengerCount", { count: quotation.passengerCount })}</p>
                </div>
              </div>
              {quotation.specialRequests && (
                <div className="flex items-start gap-3">
                  <Clock className={icon} aria-hidden="true" />
                  <div>
                    <p className={label}>{t("specialRequests")}</p>
                    <p className={value}>{quotation.specialRequests}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className={heading}>{t("owner")}</h2>
            <div className="space-y-3">
              <p className={value}>
                {quotation.vehicle.owner.firstName}{" "}
                {quotation.vehicle.owner.lastName}
              </p>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <Mail className="h-4 w-4 text-[var(--color-action-primary)]" aria-hidden="true" />
                <span className="text-sm">{quotation.vehicle.owner.email}</span>
              </div>
              {quotation.vehicle.owner.phone && (
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <Phone className="h-4 w-4 text-[var(--color-action-primary)]" aria-hidden="true" />
                  <span className="text-sm">{quotation.vehicle.owner.phone}</span>
                </div>
              )}
            </div>
          </Card>

          {quotation.additionalNotes && (
            <Card className="p-6">
              <h2 className={heading}>{t("notes")}</h2>
              <p className="text-[var(--color-text-secondary)]">{quotation.additionalNotes}</p>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-24">
            <h2 className={heading}>{t("priceSummary")}</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{t("vehicleRental")}</span>
                <span className="font-medium">{money(quotation.vehicleRentalCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{t("driverCost")}</span>
                <span className="font-medium">{money(quotation.driverCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{t("fuelCost")}</span>
                <span className="font-medium">{money(quotation.fuelCost)}</span>
              </div>
              {quotation.tollCharges > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{t("tolls")}</span>
                  <span className="font-medium">{money(quotation.tollCharges)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{t("tax")}</span>
                <span className="font-medium">{money(quotation.tax)}</span>
              </div>
              <div className="border-t border-[var(--color-border-default)] pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-[var(--color-text-primary)]">{t("total")}</span>
                  <span className="font-bold text-[var(--color-text-primary)] text-xl">
                    {money(quotation.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                onClick={handleConfirmBooking}
                disabled={creating}
                className="w-full"
              >
                {creating ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    {t("creating")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2" aria-hidden="true" />
                    {t("confirm")}
                  </>
                )}
              </Button>
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="w-full"
                disabled={creating}
              >
                {t("cancel")}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
