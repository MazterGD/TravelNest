"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  Badge,
  StatusBadge,
  Avatar,
  Button,
  StarRating,
} from "@/components/ui";
import { QuotationStatus } from "@/types";
import type { ReceivedQuotation } from "@/store";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

interface QuotationCardProps {
  quotation: ReceivedQuotation;
  onAccept?: () => void;
  onDecline?: () => void;
  onViewDetails?: () => void;
  isSelected?: boolean;
  showActions?: boolean;
  isCompact?: boolean;
}

export function QuotationCard({
  quotation,
  onAccept,
  onDecline,
  onViewDetails,
  isSelected = false,
  showActions = true,
  isCompact = false,
}: QuotationCardProps) {
  const t = useTranslations("quotation");

  // Use price alias if available, otherwise use totalAmount from base type
  const displayPrice = quotation.price ?? quotation.totalAmount;
  const displayValidUntil = quotation.validUntil ?? quotation.expiryDate;

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        isSelected && "ring-2 ring-primary border-primary",
        isCompact ? "p-3" : "p-0",
        onViewDetails && "cursor-pointer",
      )}
      onClick={onViewDetails}
    >
      <CardContent className={cn(isCompact ? "p-0" : "p-4")}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar name={quotation.ownerName} size="md" />
            <div>
              <h3 className="font-semibold text-foreground">
                {quotation.ownerName}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <StarRating rating={quotation.rating} size="xs" showValue />
                <span>•</span>
                <span>
                  {quotation.totalTrips} {t("trips")}
                </span>
              </div>
            </div>
          </div>
          <StatusBadge status={quotation.status} />
        </div>

        {/* Vehicle Info */}
        <div className="flex gap-4 mb-4">
          {quotation.vehicleImage && (
            <img
              src={quotation.vehicleImage}
              alt={quotation.vehicleName}
              className="w-24 h-16 object-cover rounded-lg"
            />
          )}
          <div className="flex-1">
            <h4 className="font-medium text-foreground">
              {quotation.vehicleName}
            </h4>
            {quotation.message && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {quotation.message}
              </p>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-end justify-between mb-4 p-3 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">{t("quotedPrice")}</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(displayPrice)}
            </p>
          </div>
          {displayValidUntil && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t("validUntil")}</p>
              <p className="text-sm font-medium">
                {formatDate(displayValidUntil)}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && quotation.status === "pending" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDecline?.();
              }}
              className="flex-1"
            >
              {t("decline")}
            </Button>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAccept?.();
              }}
              className="flex-1"
            >
              {t("accept")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Comparison view for multiple quotations
interface QuotationComparisonProps {
  quotations: ReceivedQuotation[];
  selectedId?: string;
  onSelect: (quotation: ReceivedQuotation) => void;
  onAccept: (quotation: ReceivedQuotation) => void;
}

export function QuotationComparison({
  quotations,
  selectedId,
  onSelect,
  onAccept,
}: QuotationComparisonProps) {
  const t = useTranslations("quotation");

  if (quotations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("noQuotationsReceived")}
      </div>
    );
  }

  const getPrice = (q: ReceivedQuotation) => q.price ?? q.totalAmount;
  const sortedQuotations = [...quotations].sort(
    (a, b) => getPrice(a) - getPrice(b),
  );
  const lowestPrice = getPrice(sortedQuotations[0]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {t("receivedQuotations")} ({quotations.length})
        </h3>
        <div className="flex gap-2">
          <Badge variant="info">{t("sortedByPrice")}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedQuotations.map((quotation) => (
          <div key={quotation.id} className="relative">
            {getPrice(quotation) === lowestPrice && (
              <Badge
                variant="success"
                className="absolute -top-2 -right-2 z-10"
              >
                {t("lowestPrice")}
              </Badge>
            )}
            <QuotationCard
              quotation={quotation}
              isSelected={selectedId === quotation.id}
              onViewDetails={() => onSelect(quotation)}
              onAccept={() => onAccept(quotation)}
              showActions={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
