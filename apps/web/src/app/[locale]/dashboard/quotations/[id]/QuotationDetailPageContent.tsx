"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  EmptyState,
  EmptyBoxIcon,
} from "@/components/ui";
import { quotationService, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils/cn";

interface QuotationDetailPageContentProps {
  locale: string;
  requestId: string;
}

interface QuotationResponse {
  id: string;
  requestId: string;
  vehicleId: string;
  ownerId: string;
  vehicle: {
    name: string;
    brand: string;
    model: string;
    year: number;
    seats: number;
    images: string[];
    owner: {
      firstName: string;
      lastName: string;
      phone: string;
    };
  };
  status: string;
  totalAmount: number;
  vehicleRentalCost: number;
  driverCost: number;
  fuelCost: number;
  tollCharges?: number;
  permitFees?: number;
  tax?: number;
  validUntil: string;
  additionalNotes?: string;
  sentAt?: string;
  createdAt: string;
}

interface QuotationRequest {
  id: string;
  pickupLocation: { address: string; city: string };
  dropoffLocation: { address: string; city: string };
  pickupDate: string;
  pickupTime: string;
  returnDate?: string;
  isRoundTrip: boolean;
  passengerCount: number;
  vehicleType: string;
  status: string;
}

export function QuotationDetailPageContent({
  locale,
  requestId,
}: QuotationDetailPageContentProps) {
  const t = useTranslations("quotation");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<QuotationRequest | null>(null);
  const [quotations, setQuotations] = useState<QuotationResponse[]>([]);
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    fetchData();
  }, [requestId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch the request details
      const requestResponse = await quotationService.getById(requestId);
      const requestData = requestResponse as any;
      const baseQuotation =
        requestData.data?.quotation || requestData.quotation;

      const requestDetails: QuotationRequest = {
        id: baseQuotation.id,
        pickupLocation:
          typeof baseQuotation.pickupLocation === "string"
            ? {
                address: baseQuotation.pickupLocation,
                city: baseQuotation.pickupLocation.split(",")[0]?.trim() || "",
              }
            : baseQuotation.pickupLocation,
        dropoffLocation:
          typeof baseQuotation.dropoffLocation === "string"
            ? {
                address: baseQuotation.dropoffLocation,
                city: baseQuotation.dropoffLocation.split(",")[0]?.trim() || "",
              }
            : baseQuotation.dropoffLocation,
        pickupDate: baseQuotation.startDate?.split("T")[0] || "",
        pickupTime: baseQuotation.startTime || "",
        returnDate: baseQuotation.endDate?.split("T")[0],
        isRoundTrip: baseQuotation.isRoundTrip || false,
        passengerCount: baseQuotation.passengerCount || 0,
        vehicleType: baseQuotation.vehicleType || "",
        status: baseQuotation.status?.toLowerCase() || "pending",
      };

      setRequest(requestDetails);

      // Fetch all customer quotations and filter for matching trip
      const allQuotationsResponse = await quotationService.getMyRequests();
      const allData = allQuotationsResponse as any;
      const allQuotations =
        allData.data?.quotations || allData.quotations || [];

      // Filter quotations that match the same trip (pickup, dropoff, date)
      // and have owner responses (SENT, VIEWED, ACCEPTED status with vehicle assigned)
      const baseStartDate = baseQuotation.startDate?.split("T")[0];
      const matchingQuotations = allQuotations.filter((q: any) => {
        const qStartDate = q.startDate?.split("T")[0];
        return (
          q.id !== requestId && // Exclude the base request itself
          q.pickupLocation === baseQuotation.pickupLocation &&
          q.dropoffLocation === baseQuotation.dropoffLocation &&
          qStartDate === baseStartDate &&
          ["sent", "viewed", "accepted"].includes(q.status?.toLowerCase()) &&
          q.vehicleId != null // Has a vehicle assigned (owner response)
        );
      });

      if (matchingQuotations.length > 0) {
        const quotationsList: QuotationResponse[] = matchingQuotations.map(
          (q: any) => ({
            id: q.id,
            requestId: requestId,
            vehicleId: q.vehicleId,
            ownerId: q.vehicle?.owner?.id || q.vehicle?.ownerId || "",
            vehicle: {
              name:
                q.vehicle?.name ||
                `${q.vehicle?.brand} ${q.vehicle?.model}` ||
                "Vehicle",
              brand: q.vehicle?.brand || "",
              model: q.vehicle?.model || "",
              year: q.vehicle?.year || 2020,
              seats: q.vehicle?.seats || 0,
              images: q.vehicle?.images || [],
              owner: {
                firstName: q.vehicle?.owner?.firstName || "",
                lastName: q.vehicle?.owner?.lastName || "",
                phone: q.vehicle?.owner?.phone || "",
              },
            },
            status: q.status?.toLowerCase() || "pending",
            totalAmount: q.totalAmount || 0,
            vehicleRentalCost: q.vehicleRentalCost || 0,
            driverCost: q.driverCost || 0,
            fuelCost: q.fuelCost || 0,
            tollCharges: q.tollCharges,
            permitFees: q.permitFees,
            tax: q.tax,
            validUntil: q.validUntil,
            additionalNotes: q.additionalNotes,
            sentAt: q.sentAt,
            createdAt: q.createdAt,
          }),
        );

        setQuotations(quotationsList);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to fetch quotation details");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectQuotation = (quotationId: string) => {
    const newSelection = new Set(selectedQuotations);
    if (newSelection.has(quotationId)) {
      newSelection.delete(quotationId);
    } else {
      newSelection.add(quotationId);
    }
    setSelectedQuotations(newSelection);
  };

  const handleCompareSelected = () => {
    if (selectedQuotations.size < 2) {
      return;
    }
    const ids = Array.from(selectedQuotations).join(",");
    router.push(`/${locale}/dashboard/quotations/compare?ids=${ids}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-LK", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          href={`/${locale}/dashboard/quotations`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("back")}
        </Link>
        <PageHeader
          title={t("quotationDetails")}
          description={t("viewQuotationsDescription")}
        />
        <div className="animate-pulse bg-muted rounded-xl space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        <Link
          href={`/${locale}/dashboard/quotations`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("back")}
        </Link>
        <PageHeader
          title={t("quotationDetails")}
          description={t("viewQuotationsDescription")}
        />
        <Card>
          <CardContent className="p-8">
            <EmptyState
              icon={<EmptyBoxIcon />}
              title={t("errorLoadingQuotations")}
              description={error || t("quotationNotFound")}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/dashboard/quotations`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("back")}
      </Link>
      <PageHeader
        title={t("quotationDetails")}
        description={t("viewQuotationsDescription")}
      />

      {/* Request Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("tripDetails")}</h3>
              <span
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-full",
                  request.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : request.status === "active"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800",
                )}
              >
                {t(request.status)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("from")}
                </p>
                <p className="font-medium">{request.pickupLocation.address}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("to")}</p>
                <p className="font-medium">{request.dropoffLocation.address}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("pickupDate")}
                </p>
                <p className="font-medium">
                  {formatDate(request.pickupDate)} at {request.pickupTime}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("passengers")}
                </p>
                <p className="font-medium">{request.passengerCount}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quotations Received */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">
            {t("quotationsReceived")} ({quotations.length})
          </h3>
          {selectedQuotations.size >= 2 && (
            <Button onClick={handleCompareSelected}>
              {t("compareSelected")} ({selectedQuotations.size})
            </Button>
          )}
        </div>

        {quotations.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <EmptyState
                icon={<EmptyBoxIcon />}
                title={t("noQuotationsYet")}
                description={t("waitingForOwnerResponses")}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {quotations.map((quotation) => (
              <Card
                key={quotation.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedQuotations.has(quotation.id) && "ring-2 ring-primary",
                )}
                onClick={() => handleSelectQuotation(quotation.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedQuotations.has(quotation.id)}
                      onChange={() => handleSelectQuotation(quotation.id)}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mt-1"
                    />

                    <div className="flex-1 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">
                            {quotation.vehicle.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {quotation.vehicle.brand} {quotation.vehicle.model}{" "}
                            ({quotation.vehicle.year})
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            By {quotation.vehicle.owner.firstName}{" "}
                            {quotation.vehicle.owner.lastName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(quotation.totalAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("validUntil")} {formatDate(quotation.validUntil)}
                          </p>
                        </div>
                      </div>

                      {/* Vehicle Image */}
                      {quotation.vehicle.images?.[0] && (
                        <div className="w-full h-48 relative rounded-lg overflow-hidden">
                          <img
                            src={quotation.vehicle.images[0]}
                            alt={quotation.vehicle.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Price Breakdown */}
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        <h5 className="font-medium text-sm mb-3">
                          {t("priceBreakdown")}
                        </h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t("vehicleRental")}</span>
                            <span>
                              {formatCurrency(quotation.vehicleRentalCost)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t("driverCost")}</span>
                            <span>{formatCurrency(quotation.driverCost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t("fuelCost")}</span>
                            <span>{formatCurrency(quotation.fuelCost)}</span>
                          </div>
                          {quotation.tollCharges ? (
                            <div className="flex justify-between">
                              <span>{t("tollCharges")}</span>
                              <span>
                                {formatCurrency(quotation.tollCharges)}
                              </span>
                            </div>
                          ) : null}
                          {quotation.permitFees ? (
                            <div className="flex justify-between">
                              <span>{t("permitFees")}</span>
                              <span>
                                {formatCurrency(quotation.permitFees)}
                              </span>
                            </div>
                          ) : null}
                          {quotation.tax ? (
                            <div className="flex justify-between">
                              <span>{t("tax")}</span>
                              <span>{formatCurrency(quotation.tax)}</span>
                            </div>
                          ) : null}
                          <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold">
                            <span>{t("total")}</span>
                            <span>{formatCurrency(quotation.totalAmount)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Additional Notes */}
                      {quotation.additionalNotes && (
                        <div>
                          <h5 className="font-medium text-sm mb-2">
                            {t("additionalNotes")}
                          </h5>
                          <p className="text-sm text-muted-foreground">
                            {quotation.additionalNotes}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `tel:${quotation.vehicle.owner.phone}`,
                              "_blank",
                            );
                          }}
                        >
                          {t("contact")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement accept quotation
                          }}
                        >
                          {t("acceptQuotation")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
