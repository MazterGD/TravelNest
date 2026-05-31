"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, CTAButton, Input, LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { landingContentService, quotationService } from "@/lib/api/services";
import type { Quotation, QuotationStatus } from "@/types";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Filter,
  MapPin,
  Search,
  Users,
} from "lucide-react";

type PassengerRangeValue =
  | "all"
  | "16-20"
  | "21-30"
  | "31-40"
  | "41-50"
  | "50-plus";

type SortValue =
  | "newest"
  | "oldest"
  | "tripDate"
  | "passengersHigh"
  | "passengersLow";

const passengerRanges: Array<{
  value: PassengerRangeValue;
  min?: number;
  max?: number;
  labelKey: string;
}> = [
  { value: "all", labelKey: "ownerQuotations.filters.passengerRanges.all" },
  {
    value: "16-20",
    min: 16,
    max: 20,
    labelKey: "ownerQuotations.filters.passengerRanges.range16_20",
  },
  {
    value: "21-30",
    min: 21,
    max: 30,
    labelKey: "ownerQuotations.filters.passengerRanges.range21_30",
  },
  {
    value: "31-40",
    min: 31,
    max: 40,
    labelKey: "ownerQuotations.filters.passengerRanges.range31_40",
  },
  {
    value: "41-50",
    min: 41,
    max: 50,
    labelKey: "ownerQuotations.filters.passengerRanges.range41_50",
  },
  {
    value: "50-plus",
    min: 50,
    labelKey: "ownerQuotations.filters.passengerRanges.range50_plus",
  },
];

const sortOptions: Array<{ value: SortValue; labelKey: string }> = [
  { value: "newest", labelKey: "ownerQuotations.filters.sortOptions.newest" },
  { value: "oldest", labelKey: "ownerQuotations.filters.sortOptions.oldest" },
  {
    value: "tripDate",
    labelKey: "ownerQuotations.filters.sortOptions.tripDate",
  },
  {
    value: "passengersHigh",
    labelKey: "ownerQuotations.filters.sortOptions.passengersHigh",
  },
  {
    value: "passengersLow",
    labelKey: "ownerQuotations.filters.sortOptions.passengersLow",
  },
];

const getStatusStyles = (status: QuotationStatus) => {
  if (status === "ACCEPTED") {
    return "border border-success bg-[var(--color-success-bg)] text-success-foreground";
  }

  if (status === "REJECTED" || status === "EXPIRED") {
    return "border border-error bg-[var(--color-error-bg)] text-error-foreground";
  }

  return "border border-border bg-muted text-muted-foreground";
};

export default function QuotationRequestsPage() {
  const t = useTranslations();
  const { user } = useAuthStore();
  const params = useParams();
  const locale = params.locale as string;
  const [activeTab, setActiveTab] = useState<"PENDING" | "all">("PENDING");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [requests, setRequests] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [passengerRange, setPassengerRange] =
    useState<PassengerRangeValue>("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("newest");

  // Protect this route - only vehicle owners can access
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const passengerRangeOption = useMemo(
    () => passengerRanges.find((range) => range.value === passengerRange),
    [passengerRange],
  );

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const response = await quotationService.getOwnerRequests({
          status: activeTab === "PENDING" ? "PENDING" : undefined,
          vehicleType:
            vehicleTypeFilter === "all" ? undefined : vehicleTypeFilter,
          passengerMin: passengerRangeOption?.min,
          passengerMax: passengerRangeOption?.max,
          startDate: startDateFilter || undefined,
          endDate: endDateFilter || undefined,
          sortBy,
        });
        setRequests(response.quotations || []);
      } catch (error) {
        console.error("Failed to fetch quotation requests:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized) {
      fetchRequests();
    }
  }, [
    isAuthorized,
    activeTab,
    vehicleTypeFilter,
    passengerRangeOption?.min,
    passengerRangeOption?.max,
    startDateFilter,
    endDateFilter,
    sortBy,
  ]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        setVehicleTypeOptions(response.options.vehicleTypes || []);
      } catch (configError) {
        console.error(
          "Failed to fetch quotation request filters config:",
          configError,
        );
      }
    };

    fetchConfig();
  }, []);

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;

    const query = searchQuery.toLowerCase();
    return requests.filter((request) => {
      const customerName = `${request.customer?.firstName || ""} ${
        request.customer?.lastName || ""
      }`
        .trim()
        .toLowerCase();
      const pickup = request.pickupLocation?.toLowerCase() || "";
      const dropoff = request.dropoffLocation?.toLowerCase() || "";
      const quotationId = request.quotationId?.toLowerCase() || "";

      return (
        customerName.includes(query) ||
        pickup.includes(query) ||
        dropoff.includes(query) ||
        quotationId.includes(query)
      );
    });
  }, [requests, searchQuery]);

  const tabCounts = {
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    all: requests.length,
  };

  const formatDate = (value: Date | string, withYear = true) => {
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return "";

    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: withYear ? "numeric" : undefined,
    }).format(dateValue);
  };

  const getExpiryBadge = (validUntil?: Date) => {
    if (!validUntil) return null;

    const daysRemaining = Math.ceil(
      (new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (daysRemaining < 0) {
      return {
        label: t("ownerQuotations.badges.expired"),
        className:
          "border border-error bg-[var(--color-error-bg)] text-error-foreground",
      };
    }

    if (daysRemaining === 0) {
      return {
        label: t("ownerQuotations.badges.expiresToday"),
        className: "border border-border bg-muted text-muted-foreground",
      };
    }

    return {
      label: t("ownerQuotations.badges.expiresIn", { days: daysRemaining }),
      className: "border border-border bg-muted text-muted-foreground",
    };
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setVehicleTypeFilter("all");
    setPassengerRange("all");
    setStartDateFilter("");
    setEndDateFilter("");
    setSortBy("newest");
  };

  // Show loading while checking auth state
  if (guardLoading || !isAuthorized || !user) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background">
          <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-3 flex items-center gap-2 rounded-md text-caption font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-5 w-5" />
              {t("ownerQuotations.backToDashboard")}
            </Link>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-heading-lg font-bold text-foreground">
                  {t("ownerQuotations.title")}
                </h1>
                <p className="mt-1 text-body text-muted-foreground">
                  {t("ownerQuotations.requestCount", {
                    count: filteredRequests.length,
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CTAButton
                  href={`/${locale}/owner/quotations/sent`}
                  variant="secondary"
                  size="sm"
                  leftIcon={<FileText className="h-5 w-5" />}
                >
                  {t("ownerQuotations.actions.sentQuotations")}
                </CTAButton>
                {tabCounts.PENDING > 0 && (
                  <span className="rounded-lg border border-border bg-muted px-2.5 py-1 text-caption font-medium text-muted-foreground">
                    {t("ownerQuotations.newBadge", {
                      count: tabCounts.PENDING,
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-[20px] border border-border bg-muted p-6">
            <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("PENDING")}
                  className={`flex items-center gap-2 border-b-2 px-1 pb-2 text-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeTab === "PENDING"
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("ownerQuotations.tabs.pending")}
                  <span className="text-caption text-[var(--color-text-tertiary)]">
                    ({tabCounts.PENDING})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`flex items-center gap-2 border-b-2 px-1 pb-2 text-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeTab === "all"
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("ownerQuotations.tabs.all")}
                  <span className="text-caption text-[var(--color-text-tertiary)]">
                    ({tabCounts.all})
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFilters((value) => !value)}
                >
                  <Filter className="h-5 w-5" />
                  {t("ownerQuotations.filters.toggle")}
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <Input
                type="text"
                placeholder={t("ownerQuotations.filters.searchPlaceholder")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                icon={<Search className="h-5 w-5" />}
                aria-label={t("ownerQuotations.filters.searchPlaceholder")}
                className="text-body"
              />
            </div>

            {showFilters && (
              <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="mb-2 block text-caption font-medium text-muted-foreground">
                    {t("ownerQuotations.filters.vehicleType")}
                  </label>
                  <select
                    value={vehicleTypeFilter}
                    onChange={(event) =>
                      setVehicleTypeFilter(event.target.value)
                    }
                    className="w-full min-h-11 appearance-none rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <option value="all">
                      {t("ownerQuotations.filters.allTypes")}
                    </option>
                    {vehicleTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-caption font-medium text-muted-foreground">
                    {t("ownerQuotations.filters.passengerCount")}
                  </label>
                  <select
                    value={passengerRange}
                    onChange={(event) =>
                      setPassengerRange(
                        event.target.value as PassengerRangeValue,
                      )
                    }
                    className="w-full min-h-11 appearance-none rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {passengerRanges.map((range) => (
                      <option key={range.value} value={range.value}>
                        {t(range.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-caption font-medium text-muted-foreground">
                    {t("ownerQuotations.filters.dateFrom")}
                  </label>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(event) => setStartDateFilter(event.target.value)}
                    className="w-full min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-caption font-medium text-muted-foreground">
                    {t("ownerQuotations.filters.dateTo")}
                  </label>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(event) => setEndDateFilter(event.target.value)}
                    className="w-full min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-caption font-medium text-muted-foreground">
                    {t("ownerQuotations.filters.sortBy")}
                  </label>
                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as SortValue)
                    }
                    className="w-full min-h-11 appearance-none rounded-xl border border-border bg-background px-3 py-2 text-body text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    {t("ownerQuotations.filters.clearFilters")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((request) => {
                const customerName =
                  `${request.customer?.firstName || ""} ${
                    request.customer?.lastName || ""
                  }`.trim() || t("ownerQuotations.unknownCustomer");
                const requestDate = formatDate(request.createdAt, false);
                const tripDate = formatDate(request.startDate);
                const statusLabel = t(
                  `ownerQuotations.status.${request.status}`,
                  {
                    defaultValue: request.status,
                  },
                );
                const expiryBadge = request.validUntil
                  ? getExpiryBadge(request.validUntil)
                  : null;

                return (
                  <div
                    key={request.id}
                    className="rounded-[20px] border border-border bg-card p-6"
                  >
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="text-body-lg font-semibold text-foreground">
                            {customerName}
                          </h3>
                          <span
                            className={`rounded-lg px-2.5 py-1 text-caption font-medium ${getStatusStyles(
                              request.status,
                            )}`}
                          >
                            {statusLabel}
                          </span>
                          {expiryBadge && (
                            <span
                              className={`rounded-lg px-2.5 py-1 text-caption font-medium ${expiryBadge.className}`}
                            >
                              {expiryBadge.label}
                            </span>
                          )}
                        </div>
                        <p className="text-caption text-muted-foreground">
                          {request.quotationId}
                        </p>
                      </div>
                      <div className="text-caption text-[var(--color-text-tertiary)]">
                        {t("ownerQuotations.labels.requestedOn", {
                          date: requestDate,
                        })}
                      </div>
                    </div>

                    <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-1 h-5 w-5 text-[var(--color-text-tertiary)]" />
                        <div>
                          <div className="text-caption text-[var(--color-text-tertiary)]">
                            {t("ownerQuotations.labels.route")}
                          </div>
                          <div className="text-body font-medium text-foreground">
                            {request.pickupLocation} →
                            {request.dropoffLocation ||
                              t("ownerQuotations.labels.dropoffPending")}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Calendar className="mt-1 h-5 w-5 text-[var(--color-text-tertiary)]" />
                        <div>
                          <div className="text-caption text-[var(--color-text-tertiary)]">
                            {t("ownerQuotations.labels.date")}
                          </div>
                          <div className="text-body font-medium text-foreground">
                            {tripDate}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Users className="mt-1 h-5 w-5 text-[var(--color-text-tertiary)]" />
                        <div>
                          <div className="text-caption text-[var(--color-text-tertiary)]">
                            {t("ownerQuotations.labels.passengers")}
                          </div>
                          <div className="text-body font-medium text-foreground">
                            {request.passengerCount || "—"}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-caption text-[var(--color-text-tertiary)]">
                          {t("ownerQuotations.labels.vehicleType")}
                        </div>
                        <div className="text-body font-medium text-foreground">
                          {request.vehicleType || "—"}
                        </div>
                      </div>
                    </div>

                    {request.status === "PENDING" && (
                      <CTAButton
                        href={`/${locale}/owner/quotations/send/${request.id}`}
                        fullWidth
                        size="md"
                      >
                        {t("ownerQuotations.actions.sendQuotation")}
                      </CTAButton>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[20px] border border-border bg-muted p-12 text-center">
              <div className="mx-auto flex max-w-sm flex-col items-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background">
                  <Clock className="h-8 w-8 text-[var(--color-text-tertiary)]" />
                </div>
                <h3 className="text-body-lg font-semibold text-foreground">
                  {activeTab === "PENDING"
                    ? t("ownerQuotations.empty.pendingTitle")
                    : t("ownerQuotations.empty.allTitle")}
                </h3>
                <p className="mt-2 text-body text-muted-foreground">
                  {activeTab === "PENDING"
                    ? t("ownerQuotations.empty.pendingDescription")
                    : t("ownerQuotations.empty.allDescription")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
