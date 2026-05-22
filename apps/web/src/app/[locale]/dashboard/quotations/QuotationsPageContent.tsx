"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  PageHeader,
  Tabs,
  EmptyState,
  EmptyBoxIcon,
  SkeletonList,
  CTAButton,
} from "@/components/ui";
import { QuotationRequestCard } from "@/components/features/customer";
import { quotationService, ApiError } from "@/lib/api";
import type { QuotationRequest } from "@/store";

interface QuotationsPageContentProps {
  locale: string;
}

export function QuotationsPageContent({ locale }: QuotationsPageContentProps) {
  const t = useTranslations("quotation");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<QuotationRequest[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await quotationService.getMyRequests();
      const data = response as any;
      const requestsList = data.data?.quotations || data.quotations || [];

      // Group quotations by trip details and count owner responses per trip.
      // The single `quotations` table holds both customer requests (status=PENDING,
      // no pricing columns) and owner responses (status=SENT/VIEWED/ACCEPTED,
      // with vehicleId and pricing columns).
      const tripMap = new Map<string, any[]>();

      requestsList.forEach((req: any) => {
        const tripKey = `${req.pickupLocation}|${req.dropoffLocation}|${req.startDate?.split("T")[0] || req.pickupDate}`;
        if (!tripMap.has(tripKey)) {
          tripMap.set(tripKey, []);
        }
        tripMap.get(tripKey)!.push(req);
      });

      const transformedRequests: QuotationRequest[] = [];

      tripMap.forEach((quotations) => {
        // Prefer a PENDING entry without a vehicleId as the base (customer request).
        // Fall back to the first entry if no such entry exists.
        const baseRequest =
          quotations.find(
            (q: any) => q.status?.toUpperCase() === "PENDING" && !q.vehicleId,
          ) || quotations[0];

        // Count owner responses: entries that have a vehicle assigned and have been sent.
        const responsesCount = quotations.filter(
          (q: any) =>
            q.vehicleId &&
            ["SENT", "VIEWED", "ACCEPTED"].includes(q.status?.toUpperCase()),
        ).length;

        // Derive the canonical customer-facing status from the quotation_requests enum:
        // pending | quoted | expired | cancelled
        const baseStatusUpper = baseRequest.status?.toUpperCase();
        let derivedStatus: QuotationRequest["status"];
        if (baseStatusUpper === "EXPIRED") {
          derivedStatus = "expired";
        } else if (
          baseStatusUpper === "CANCELLED" ||
          baseStatusUpper === "REJECTED"
        ) {
          derivedStatus = "cancelled";
        } else if (responsesCount > 0) {
          // At least one owner has sent a price → request is now "quoted"
          derivedStatus = "quoted";
        } else {
          derivedStatus = "pending";
        }

        transformedRequests.push({
          id: baseRequest.id,
          customerId: baseRequest.customerId,
          pickupLocation:
            typeof baseRequest.pickupLocation === "string"
              ? {
                  address: baseRequest.pickupLocation,
                  city: baseRequest.pickupLocation.split(",")[0]?.trim() || "",
                  district: "",
                }
              : baseRequest.pickupLocation,
          dropoffLocation:
            typeof baseRequest.dropoffLocation === "string"
              ? {
                  address: baseRequest.dropoffLocation,
                  city:
                    baseRequest.dropoffLocation.split(",")[0]?.trim() || "",
                  district: "",
                }
              : baseRequest.dropoffLocation,
          pickupDate: baseRequest.pickupDate || baseRequest.startDate,
          pickupTime: baseRequest.pickupTime || baseRequest.startTime,
          returnDate: baseRequest.returnDate,
          returnTime: baseRequest.returnTime,
          isRoundTrip: baseRequest.isRoundTrip || false,
          passengerCount: baseRequest.passengerCount,
          vehicleType:
            baseRequest.vehicleType || baseRequest.preferredVehicleType,
          luggageCount: baseRequest.luggageCount || 0,
          needsAC: baseRequest.needsAC ?? true,
          status: derivedStatus,
          quotationsCount: responsesCount,
          createdAt: baseRequest.createdAt,
          updatedAt: baseRequest.updatedAt,
        });
      });

      setRequests(transformedRequests);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("fetchError"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = requests.filter((req) => {
    if (activeTab === "all") return true;
    return req.status === activeTab;
  });

  const tabs = [
    { id: "all", label: t("all"), badge: requests.length },
    {
      id: "pending",
      label: t("pending"),
      badge: requests.filter((r) => r.status === "pending").length,
    },
    {
      id: "quoted",
      label: t("quoted"),
      badge: requests.filter((r) => r.status === "quoted").length,
    },
    {
      id: "expired",
      label: t("expired"),
      badge: requests.filter((r) => r.status === "expired").length,
    },
    {
      id: "cancelled",
      label: t("cancelled"),
      badge: requests.filter((r) => r.status === "cancelled").length,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("myQuotationRequests")}
        description={t("quotationRequestsDescription")}
        action={
          <CTAButton
            href={`/${locale}/dashboard/quotations/new`}
            leftIcon={<Plus size={16} />}
          >
            {t("newRequest")}
          </CTAButton>
        }
      />

      <Tabs
        tabs={tabs.map((tab) => ({
          ...tab,
          content: null,
        }))}
        defaultTab="all"
        onChange={setActiveTab}
        variant="pills"
      />

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between p-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl text-[var(--color-error-text)]"
        >
          <span className="text-sm">{error}</span>
          <button
            onClick={fetchRequests}
            className="ml-4 text-sm font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2 rounded"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {isLoading ? (
        <SkeletonList count={3} />
      ) : filteredRequests.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredRequests.map((request) => (
            <QuotationRequestCard
              key={request.id}
              request={request}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<EmptyBoxIcon />}
          title={t("noRequests")}
          description={t("noRequestsDescription")}
          action={
            <CTAButton href={`/${locale}/dashboard/quotations/new`}>
              {t("createFirstRequest")}
            </CTAButton>
          }
        />
      )}
    </div>
  );
}
