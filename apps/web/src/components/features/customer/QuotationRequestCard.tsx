"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  MapPin,
  CalendarDays,
  Clock,
  Users,
  Snowflake,
  ArrowLeftRight,
} from "lucide-react";
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

  const getStatusClasses = (status: QuotationRequest["status"]) => {
    switch (status) {
      case "pending":
        // Neutral — awaiting owner responses
        return "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]";
      case "quoted":
        // Brand accent — responses have arrived
        return "bg-primary/10 text-primary";
      case "expired":
        return "bg-[var(--color-error-bg)] text-[var(--color-error-text)]";
      case "cancelled":
        return "bg-[var(--color-error-bg)] text-[var(--color-error-text)]";
      default:
        return "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]";
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
                  "px-2 py-0.5 text-xs font-medium rounded-lg",
                  getStatusClasses(request.status),
                )}
              >
                {t(request.status)}
              </span>
              {request.isRoundTrip && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-lg bg-primary/10 text-primary">
                  {t("roundTrip")}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("requestedOn")} {formatDate(request.createdAt, "medium")}
            </p>
          </div>
          {request.quotationsCount > 0 && (
            <div className="text-right">
              <p className="text-lg font-bold text-primary">
                {request.quotationsCount}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("quotationsReceived")}
              </p>
            </div>
          )}
        </div>

        {/* Route Info */}
        <div className="space-y-3 mb-4">
          {/* Pickup */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-success-bg)] flex items-center justify-center flex-shrink-0">
              <MapPin
                size={16}
                className="text-[var(--color-success-text)]"
                aria-hidden="true"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {request.pickupLocation.address}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {[request.pickupLocation.city, request.pickupLocation.district]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          </div>

          {/* Connection Line */}
          <div className="flex items-center gap-3">
            <div className="w-8 flex justify-center">
              <div className="w-0.5 h-4 bg-[var(--color-border-default)]" />
            </div>
          </div>

          {/* Dropoff */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-error-bg)] flex items-center justify-center flex-shrink-0">
              <MapPin
                size={16}
                className="text-[var(--color-error-text)]"
                aria-hidden="true"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {request.dropoffLocation.address}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {[
                  request.dropoffLocation.city,
                  request.dropoffLocation.district,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="flex flex-wrap gap-4 text-sm mb-4 p-3 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-default)]">
          <div className="flex items-center gap-1.5">
            <CalendarDays
              size={16}
              className="text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
            <span className="text-[var(--color-text-primary)]">
              {formatDate(request.pickupDate, "medium")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock
              size={16}
              className="text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
            <span className="text-[var(--color-text-primary)]">
              {request.pickupTime}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users
              size={16}
              className="text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
            <span className="text-[var(--color-text-primary)]">
              {request.passengerCount} {t("passengers")}
            </span>
          </div>
          {request.needsAC && (
            <div className="flex items-center gap-1.5">
              <Snowflake
                size={16}
                className="text-[var(--color-action-primary)]"
                aria-hidden="true"
              />
              <span className="text-[var(--color-text-primary)]">
                {t("withAC")}
              </span>
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
                className="flex-1 text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)] border-[var(--color-error-border)]"
              >
                {t("cancelRequest")}
              </Button>
            )}
            {request.quotationsCount > 0 && (
              <Link
                href={`/${locale}/dashboard/quotations/${request.id}`}
                className="flex-1"
              >
                <Button size="sm" className="w-full">
                  {t("viewQuotations", { count: request.quotationsCount })}
                </Button>
              </Link>
            )}
            {request.quotationsCount === 0 && request.status === "pending" && (
              <div className="flex-1 text-center py-2 text-sm text-[var(--color-text-secondary)]">
                {t("waitingForQuotations")}
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
                className="w-full border-[var(--color-action-primary)] text-[var(--color-action-primary)] hover:bg-[var(--color-bg-surface)]"
              >
                <ArrowLeftRight
                  size={16}
                  className="mr-2"
                  aria-hidden="true"
                />
                {t("compareQuotations")}
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
