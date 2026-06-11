"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Calendar,
  ClipboardList,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import {
  Badge,
  CTAButton,
  EmptyState,
  EmptyBoxIcon,
  PageHeader,
  SkeletonList,
  Tabs,
} from "@/components/ui";
import { ApiError, tripService, type TripDTO } from "@/lib/api";
import { useProtectedRoute } from "@/hooks";

interface TripsPageContentProps {
  locale: string;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

const ACTIVE_STATUSES: TripDTO["status"][] = ["PLANNING", "AWAITING_QUOTES"];

type TabId =
  | "all"
  | "active"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "expired";

const statusToTab = (status: TripDTO["status"]): TabId => {
  if (status === "PLANNING" || status === "AWAITING_QUOTES") return "active";
  if (status === "CONFIRMED") return "confirmed";
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  return "expired";
};

const badgeVariantForStatus = (
  status: TripDTO["status"],
): "info" | "success" | "warning" | "danger" | "secondary" => {
  switch (status) {
    case "AWAITING_QUOTES":
      return "info";
    case "PLANNING":
      return "warning";
    case "CONFIRMED":
      return "success";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
    case "EXPIRED":
    default:
      return "secondary";
  }
};

export function TripsPageContent({ locale }: TripsPageContentProps) {
  const t = useTranslations("trip");
  const { isLoading: guardLoading, isAuthorized } = useProtectedRoute();

  const [trips, setTrips] = useState<TripDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("all");

  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tripService.list({ limit: 50 });
      const raw = (response as any)?.data ?? response;
      const list = (raw?.trips ?? []) as TripDTO[];
      setTrips(list);
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
    if (!isAuthorized) return;
    fetchTrips();
  }, [fetchTrips, isAuthorized]);

  const counts = useMemo(() => {
    const result: Record<TabId, number> = {
      all: trips.length,
      active: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      expired: 0,
    };
    for (const trip of trips) {
      result[statusToTab(trip.status)] += 1;
    }
    return result;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    if (activeTab === "all") return trips;
    return trips.filter((trip) => statusToTab(trip.status) === activeTab);
  }, [trips, activeTab]);

  if (guardLoading || !isAuthorized) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8 space-y-8">
      <PageHeader
        title={t("listTitle")}
        description={t("listDescription")}
        action={
          <CTAButton
            href={`/${locale}/dashboard/trips/new`}
            leftIcon={<Plus size={16} />}
          >
            {t("planNewTrip")}
          </CTAButton>
        }
      />

      <Tabs
        tabs={[
          { id: "all", label: t("tabs.all"), badge: counts.all, content: null },
          {
            id: "active",
            label: t("tabs.active"),
            badge: counts.active,
            content: null,
          },
          {
            id: "confirmed",
            label: t("tabs.confirmed"),
            badge: counts.confirmed,
            content: null,
          },
          {
            id: "completed",
            label: t("tabs.completed"),
            badge: counts.completed,
            content: null,
          },
          {
            id: "cancelled",
            label: t("tabs.cancelled"),
            badge: counts.cancelled,
            content: null,
          },
          {
            id: "expired",
            label: t("tabs.expired"),
            badge: counts.expired,
            content: null,
          },
        ]}
        defaultTab="all"
        onChange={(id) => setActiveTab(id as TabId)}
        variant="pills"
      />

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-[var(--color-error-text)]"
        >
          <span className="text-sm">{error}</span>
          <button
            onClick={fetchTrips}
            className={`ml-4 rounded text-sm font-medium underline underline-offset-2 ${focusRing}`}
          >
            {t("retry")}
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <SkeletonList count={3} />
      ) : filteredTrips.length === 0 ? (
        <EmptyState
          icon={<EmptyBoxIcon />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <CTAButton
              href={`/${locale}/dashboard/trips/new`}
              leftIcon={<Plus size={16} />}
            >
              {t("planFirstTrip")}
            </CTAButton>
          }
        />
      ) : (
        <ul className="grid gap-6 md:grid-cols-2" role="list">
          {filteredTrips.map((trip) => (
            <TripListCard key={trip.id} trip={trip} locale={locale} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TripListCard({
  trip,
  locale,
  t,
}: {
  trip: TripDTO;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const startLabel = new Date(trip.startDate).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const quoteCount = trip.quotations?.length ?? trip._count?.quotations ?? 0;
  const isActive = ACTIVE_STATUSES.includes(trip.status);

  // Highlight the user's active trip with a primary-blue accent border so it
  // stands out among completed/cancelled rows.
  const accent = isActive
    ? "border-[var(--color-action-primary)]/60 shadow-[0_8px_24px_-12px_rgba(32,176,233,0.32)]"
    : "border-[var(--color-border-default)]";

  return (
    <li>
      <Link
        href={`/${locale}/dashboard/trips/${trip.id}`}
        className={`group block rounded-[20px] border ${accent} bg-[var(--color-bg-base)] p-5 transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
              {trip.tripCode}
            </p>
            <h3 className="mt-0.5 truncate text-lg font-semibold text-[var(--color-text-primary)]">
              {trip.title ||
                `${trip.pickupCity || trip.pickupLocation.split(",")[0]} → ${
                  trip.dropoffCity ||
                  trip.dropoffLocation?.split(",")[0] ||
                  t("noDestination")
                }`}
            </h3>
          </div>
          <Badge variant={badgeVariantForStatus(trip.status)}>
            {t(`status.${trip.status.toLowerCase()}`)}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Calendar
              className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            />
            <span className="truncate">{startLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users
              className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            />
            <span className="truncate">
              {t("passengerCount", { count: trip.passengerCount })}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <MapPin
              className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            />
            <span className="truncate">
              {trip.pickupCity || trip.pickupLocation.split(",")[0] || "—"}
              {" "}
              <span aria-hidden="true">→</span>
              {" "}
              {trip.dropoffCity ||
                trip.dropoffLocation?.split(",")[0] ||
                t("noDestination")}
            </span>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-default)] pt-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <ClipboardList
              className="h-4 w-4 text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            />
            {t("quotesAttached", { count: quoteCount })}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-action-primary)] transition-transform group-hover:translate-x-1">
            {t("viewTrip")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </li>
  );
}
