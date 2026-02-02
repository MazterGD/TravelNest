"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  PageHeader,
  Button,
  Tabs,
  EmptyState,
  EmptyBoxIcon,
  SkeletonList,
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

      // Group quotations by trip details and count responses
      const tripMap = new Map<string, any[]>();

      requestsList.forEach((req: any) => {
        const tripKey = `${req.pickupLocation}|${req.dropoffLocation}|${req.startDate?.split("T")[0] || req.pickupDate}`;
        if (!tripMap.has(tripKey)) {
          tripMap.set(tripKey, []);
        }
        tripMap.get(tripKey)!.push(req);
      });

      // Transform to QuotationRequest format
      // For each trip, use the PENDING request as the main request
      // and count SENT/VIEWED/ACCEPTED quotations with vehicles as responses
      const transformedRequests: QuotationRequest[] = [];

      tripMap.forEach((quotations) => {
        // Find the base request (PENDING status, no vehicle assigned)
        const baseRequest =
          quotations.find(
            (q: any) => q.status?.toUpperCase() === "PENDING" && !q.vehicleId,
          ) || quotations[0]; // Fallback to first quotation if no PENDING found

        // Count owner responses (quotations with vehicles assigned and sent status)
        const responsesCount = quotations.filter(
          (q: any) =>
            q.vehicleId &&
            ["SENT", "VIEWED", "ACCEPTED"].includes(q.status?.toUpperCase()),
        ).length;

        transformedRequests.push({
          id: baseRequest.id,
          customerId: baseRequest.customerId,
          pickupLocation:
            typeof baseRequest.pickupLocation === "string"
              ? {
                  address: baseRequest.pickupLocation,
                  city: baseRequest.pickupLocation.split(",")[0]?.trim() || "",
                }
              : baseRequest.pickupLocation,
          dropoffLocation:
            typeof baseRequest.dropoffLocation === "string"
              ? {
                  address: baseRequest.dropoffLocation,
                  city: baseRequest.dropoffLocation.split(",")[0]?.trim() || "",
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
          luggageCount: baseRequest.luggageCount,
          needsAC: baseRequest.needsAC ?? true,
          status: baseRequest.status?.toLowerCase() || "pending",
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
        setError("Failed to fetch quotation requests");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      id: "active",
      label: t("active"),
      badge: requests.filter((r) => r.status === "active").length,
    },
    {
      id: "completed",
      label: t("completed"),
      badge: requests.filter((r) => r.status === "completed").length,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("myQuotationRequests")}
        description={t("quotationRequestsDescription")}
        action={
          <Link href={`/${locale}/dashboard/quotations/new`}>
            <Button>
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("newRequest")}
            </Button>
          </Link>
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <Button variant="link" onClick={fetchRequests} className="ml-2">
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <SkeletonList count={3} />
      ) : filteredRequests.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
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
            <Link href={`/${locale}/dashboard/quotations/new`}>
              <Button>{t("createFirstRequest")}</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
