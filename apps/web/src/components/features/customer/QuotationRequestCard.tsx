"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, Button } from "@/components/ui";
import type { QuotationRequest } from "@/store";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/formatters";

interface QuotationRequestCardProps {
  request: QuotationRequest;
  onCancel?: () => void;
  locale: string;
}

export function QuotationRequestCard({
  request,
  onCancel,
  locale,
}: QuotationRequestCardProps) {
  const t = useTranslations("quotation");

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const getStatusColor = (status: QuotationRequest["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "active":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded-full",
                  getStatusColor(request.status),
                )}
              >
                {t(request.status)}
              </span>
              {request.isRoundTrip && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                  {t("roundTrip")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("requestedOn")} {formatDate(request.createdAt, "medium")}
            </p>
          </div>
          {request.quotationsCount > 0 && (
            <div className="text-right">
              <p className="text-lg font-bold text-primary">
                {request.quotationsCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("quotationsReceived")}
              </p>
            </div>
          )}
        </div>

        {/* Route Info */}
        <div className="space-y-3 mb-4">
          {/* Pickup */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {request.pickupLocation.address}
              </p>
              <p className="text-xs text-muted-foreground">
                {request.pickupLocation.city}, {request.pickupLocation.district}
              </p>
            </div>
          </div>

          {/* Connection Line */}
          <div className="flex items-center gap-3">
            <div className="w-8 flex justify-center">
              <div className="w-0.5 h-4 bg-border" />
            </div>
          </div>

          {/* Dropoff */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {request.dropoffLocation.address}
              </p>
              <p className="text-xs text-muted-foreground">
                {request.dropoffLocation.city},{" "}
                {request.dropoffLocation.district}
              </p>
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="flex flex-wrap gap-4 text-sm mb-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{formatDate(request.pickupDate, "medium")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{formatTime(request.pickupTime)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>
              {request.passengerCount} {t("passengers")}
            </span>
          </div>
          {request.needsAC && (
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span>{t("withAC")}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {request.status === "pending" && onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="flex-1 text-destructive hover:bg-destructive/10"
              >
                Cancel Request
              </Button>
            )}
            {request.quotationsCount > 0 && (
              <Link
                href={`/${locale}/dashboard/quotations/${request.id}`}
                className="flex-1"
              >
                <Button size="sm" className="w-full">
                  View Quotations ({request.quotationsCount})
                </Button>
              </Link>
            )}
            {request.quotationsCount === 0 && request.status === "pending" && (
              <div className="flex-1 text-center py-2 text-sm text-muted-foreground">
                Waiting for quotations
              </div>
            )}
          </div>
          {request.quotationsCount >= 2 && (
            <Link
              href={`/${locale}/dashboard/quotations/compare?requestId=${request.id}`}
              className="w-full"
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full border-[#20B0E9] text-[#20B0E9] hover:bg-blue-50"
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Compare Quotations
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
