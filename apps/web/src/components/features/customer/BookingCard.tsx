"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import {
  Card,
  CardContent,
  StatusBadge,
  Avatar,
  Button,
  CalendarIcon,
  MapPinIcon,
  UserIcon,
  PhoneIcon,
  StarIcon,
} from "@/components/ui";
import { BookingStatus } from "@/types";
import type { BookingWithDetails } from "@/store";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/formatters";

interface BookingCardProps {
  booking: BookingWithDetails;
  onViewDetails?: () => void;
  onCancel?: () => void;
  onReview?: () => void;
  onContact?: () => void;
  showActions?: boolean;
  variant?: "default" | "compact" | "detailed";
}

export function BookingCard({
  booking,
  onViewDetails,
  onCancel,
  onReview,
  onContact,
  showActions = true,
  variant = "default",
}: BookingCardProps) {
  const t = useTranslations("booking");
  const tMsg = useTranslations("messages");
  const locale = useLocale();
  const router = useRouter();

  const isUpcoming = new Date(booking.startDate) > new Date();
  // A booking can be cancelled before it starts whether or not it has been paid
  // yet, so PENDING (unpaid) bookings are cancellable too — not just CONFIRMED.
  const canCancel =
    (booking.status === BookingStatus.PENDING ||
      booking.status === BookingStatus.CONFIRMED) &&
    isUpcoming;
  const canReview =
    booking.status === BookingStatus.COMPLETED && !booking.hasReview;

  if (variant === "compact") {
    return (
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={onViewDetails}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {booking.vehicleImage && (
              <div className="relative w-16 h-12 shrink-0">
                <Image
                  src={booking.vehicleImage}
                  alt={booking.vehicleName}
                  fill
                  sizes="64px"
                  className="object-cover rounded-xl"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[var(--color-text-primary)] truncate">
                {booking.vehicleName}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {formatDate(booking.startDate, "medium")}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "hover:shadow-md transition-shadow",
        onViewDetails && "cursor-pointer",
      )}
      onClick={onViewDetails}
    >
      <CardContent className="p-0">
        {/* Vehicle image header */}
        {booking.vehicleImage && (
          <div className="relative h-40">
            <Image
              src={booking.vehicleImage}
              alt={booking.vehicleName}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover rounded-t-[20px]"
            />
            <div className="absolute top-3 right-3">
              <StatusBadge status={booking.status} />
            </div>
          </div>
        )}
        {!booking.vehicleImage && (
          <div className="absolute top-3 right-3">
            <StatusBadge status={booking.status} />
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {/* Vehicle & Owner Info */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg text-[var(--color-text-primary)]">
                {booking.vehicleName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Avatar name={booking.ownerName} size="xs" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {booking.ownerName}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--color-action-primary)]">
                {formatCurrency(booking.totalAmount)}
              </p>
              <StatusBadge status={booking.paymentStatus} />
            </div>
          </div>

          {/* Trip Details */}
          <div className="space-y-3 mb-4">
            {/* Dates */}
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] flex items-center justify-center shrink-0">
                <CalendarIcon className="w-4 h-4 text-[var(--color-action-primary)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {formatDate(booking.startDate, "medium")}
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  {formatTime(booking.startDate)} -{" "}
                  {formatTime(booking.endDate)}
                </p>
              </div>
            </div>

            {/* Pickup Location */}
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-success-bg)] flex items-center justify-center shrink-0">
                <MapPinIcon className="w-4 h-4 text-[var(--color-success-text)]" />
              </div>
              <div>
                <p className="text-[var(--color-text-secondary)]">
                  {t("pickup")}
                </p>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {booking.pickupLocation?.address}
                </p>
              </div>
            </div>

            {/* Dropoff Location */}
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-error-bg)] flex items-center justify-center shrink-0">
                <MapPinIcon className="w-4 h-4 text-[var(--color-error-text)]" />
              </div>
              <div>
                <p className="text-[var(--color-text-secondary)]">
                  {t("dropoff")}
                </p>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {booking.dropoffLocation?.address}
                </p>
              </div>
            </div>

            {/* Driver Info (if assigned) */}
            {booking.driverName && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                </div>
                <div>
                  <p className="text-[var(--color-text-secondary)]">
                    {t("driver")}
                  </p>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {booking.driverName}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--color-border-default)]">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(
                    `/${locale}/dashboard/messages?booking=${booking.id}`,
                  );
                }}
                className="flex-1 focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {tMsg("messageOwner")}
              </Button>
              {onContact && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onContact();
                  }}
                  className="flex-1 focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                >
                  <PhoneIcon className="w-4 h-4 mr-2" />
                  {t("contact")}
                </Button>
              )}
              {canCancel && onCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="flex-1 text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-error-border)] focus-visible:ring-offset-2"
                >
                  {t("cancel")}
                </Button>
              )}
              {canReview && onReview && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReview();
                  }}
                  className="flex-1 focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                >
                  <StarIcon className="w-4 h-4 mr-2" />
                  {t("leaveReview")}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
