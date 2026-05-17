"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { quotationService, landingContentService } from "@/lib/api/services";
import { formatDate } from "@/lib/utils/formatters";
import type { Quotation } from "@/types";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  RotateCw,
  FileText,
} from "lucide-react";
import { useParams } from "next/navigation";

type QuotationStatus =
  | "all"
  | "SENT"
  | "VIEWED"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED";

export default function SentQuotationsPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations("sentQuotations");
  const [activeTab, setActiveTab] = useState<QuotationStatus>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  useEffect(() => {
    const fetchQuotations = async () => {
      try {
        setLoading(true);
        const response = await quotationService.getOwnerSentQuotations({
          status: activeTab !== "all" ? activeTab : undefined,
        });
        setQuotations(response.quotations || []);
      } catch {
        setQuotations([]);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized) {
      fetchQuotations();
    }
  }, [isAuthorized, activeTab]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        setVehicleTypeOptions(response.options.vehicleTypes || []);
      } catch {
        // non-critical — filter will show without vehicle type options
      }
    };

    fetchConfig();
  }, []);

  const filteredQuotations = quotations.filter((quot) => {
    const matchesTab =
      activeTab === "all" || (quot.status as string) === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      `${quot.customer?.firstName || ""} ${quot.customer?.lastName || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      quot.quotationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quot.pickupLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quot.dropoffLocation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const tabCounts: Record<QuotationStatus, number> = {
    all: quotations.length,
    SENT: quotations.filter((q) => (q.status as string) === "SENT").length,
    VIEWED: quotations.filter((q) => (q.status as string) === "VIEWED").length,
    ACCEPTED: quotations.filter((q) => (q.status as string) === "ACCEPTED").length,
    REJECTED: quotations.filter((q) => (q.status as string) === "REJECTED").length,
    EXPIRED: quotations.filter((q) => (q.status as string) === "EXPIRED").length,
  };

  const getStatusBadge = (status: QuotationStatus) => {
    const styles: Record<QuotationStatus, string> = {
      SENT: "bg-primary/10 text-primary",
      VIEWED: "bg-primary/15 text-primary",
      ACCEPTED: "bg-[var(--color-success-bg)] text-success-foreground",
      REJECTED: "bg-[var(--color-error-bg)] text-error-foreground",
      EXPIRED: "bg-muted text-muted-foreground",
      all: "bg-muted text-muted-foreground",
    };

    const icons: Record<QuotationStatus, React.JSX.Element> = {
      SENT: <FileText className="h-3 w-3" />,
      VIEWED: <Eye className="h-3 w-3" />,
      ACCEPTED: <CheckCircle className="h-3 w-3" />,
      REJECTED: <XCircle className="h-3 w-3" />,
      EXPIRED: <Clock className="h-3 w-3" />,
      all: <FileText className="h-3 w-3" />,
    };

    const statusKey = status === "all" ? "all" : status;

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-medium ${styles[statusKey]}`}
      >
        {icons[statusKey]}
        {t(`status.${statusKey}`)}
      </span>
    );
  };

  if (guardLoading || !isAuthorized || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToDashboard")}
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {t("title")}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("quotationCount", { count: filteredQuotations.length })}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-6 py-8 lg:px-8">
          {/* Filters & Tabs */}
          <div className="mb-8 rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "all" as QuotationStatus },
                    { id: "SENT" as QuotationStatus },
                    { id: "VIEWED" as QuotationStatus },
                    { id: "ACCEPTED" as QuotationStatus },
                    { id: "REJECTED" as QuotationStatus },
                    { id: "EXPIRED" as QuotationStatus },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      activeTab === tab.id
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t(`tabs.${tab.id}`)} ({tabCounts[tab.id]})
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex h-11 items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Filter className="h-4 w-4" />
                {t("filters")}
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-card py-2 pl-10 pr-3 text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("filterPanel.dateRange")}
                  </label>
                  <select className="h-11 w-full appearance-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option>{t("filterPanel.allTime")}</option>
                    <option>{t("filterPanel.last7Days")}</option>
                    <option>{t("filterPanel.last30Days")}</option>
                    <option>{t("filterPanel.last3Months")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("filterPanel.vehicleType")}
                  </label>
                  <select className="h-11 w-full appearance-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option>{t("filterPanel.allTypes")}</option>
                    {vehicleTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("filterPanel.sortBy")}
                  </label>
                  <select className="h-11 w-full appearance-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option>{t("filterPanel.newestFirst")}</option>
                    <option>{t("filterPanel.oldestFirst")}</option>
                    <option>{t("filterPanel.amountHighLow")}</option>
                    <option>{t("filterPanel.amountLowHigh")}</option>
                    <option>{t("filterPanel.expiringSoon")}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Quotation Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredQuotations.length > 0 ? (
            <div className="space-y-4">
              {filteredQuotations.map((quotation) => {
                const customerName =
                  `${quotation.customer?.firstName || ""} ${quotation.customer?.lastName || ""}`.trim() ||
                  t("card.unknownCustomer");
                const sentDate = quotation.sentAt
                  ? formatDate(quotation.sentAt, "short")
                  : t("card.notSent");
                const startDate = formatDate(quotation.startDate, "short");

                let daysRemaining = 0;
                if (quotation.sentAt && quotation.validityDays) {
                  const sentTime = new Date(quotation.sentAt).getTime();
                  const validUntil =
                    sentTime + quotation.validityDays * 24 * 60 * 60 * 1000;
                  const now = Date.now();
                  daysRemaining = Math.ceil(
                    (validUntil - now) / (24 * 60 * 60 * 1000),
                  );
                }

                const isExpiredOrUrgent = daysRemaining <= 2;

                return (
                  <div
                    key={quotation.id}
                    className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/30"
                  >
                    <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                          <h3 className="font-semibold text-foreground">
                            {customerName}
                          </h3>
                          {getStatusBadge(quotation.status as QuotationStatus)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {quotation.quotationId}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("card.timestamps.sent")}: {sentDate}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">
                          LKR {(quotation.totalAmount || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {quotation.vehicleType}
                        </div>
                      </div>
                    </div>

                    {/* Trip Summary */}
                    <div className="mb-4 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
                        <div>
                          <div className="text-xs text-muted-foreground">{t("card.route")}</div>
                          <div className="font-medium text-foreground">
                            {quotation.pickupLocation} →{" "}
                            {quotation.dropoffLocation}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
                        <div>
                          <div className="text-xs text-muted-foreground">{t("card.tripDate")}</div>
                          <div className="font-medium text-foreground">
                            {startDate}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Clock className="mt-0.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
                        <div>
                          <div className="text-xs text-muted-foreground">{t("card.validity")}</div>
                          <div
                            className={`font-medium ${
                              isExpiredOrUrgent
                                ? "text-error-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {daysRemaining < 0
                              ? t("card.expired")
                              : daysRemaining === 0
                                ? t("card.expiresToday")
                                : t("card.daysLeft", { days: daysRemaining })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dates Timeline */}
                    <div className="mb-4 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                      {quotation.sentAt && (
                        <div>
                          <span className="font-medium">{t("card.timestamps.sent")}:</span>{" "}
                          {new Date(quotation.sentAt).toLocaleString()}
                        </div>
                      )}
                      {quotation.viewedAt && (
                        <div>
                          <span className="font-medium">{t("card.timestamps.viewed")}:</span>{" "}
                          {new Date(quotation.viewedAt).toLocaleString()}
                        </div>
                      )}
                      {quotation.respondedAt && (
                        <div>
                          <span className="font-medium">{t("card.timestamps.responded")}:</span>{" "}
                          {formatDate(quotation.respondedAt, "full")}
                        </div>
                      )}
                      {quotation.validityDays && quotation.sentAt && (
                        <div>
                          <span className="font-medium">{t("card.timestamps.expires")}:</span>{" "}
                          {formatDate(
                            new Date(
                              new Date(quotation.sentAt).getTime() +
                                quotation.validityDays * 24 * 60 * 60 * 1000,
                            ),
                            "short",
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/${locale}/owner/quotations/sent/${quotation.id}`}
                        className="flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t("card.viewDetails")}
                      </Link>

                      {quotation.status === "EXPIRED" && (
                        <Link
                          href={`/${locale}/owner/quotations`}
                          className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <RotateCw className="h-3 w-3" />
                          {t("card.resend")}
                        </Link>
                      )}

                      {(quotation.status as string) === "ACCEPTED" && (
                        <span className="inline-flex h-9 items-center rounded-sm bg-[var(--color-success-bg)] px-3 text-sm font-medium text-success-foreground">
                          {t("card.bookingCreated")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <div className="mx-auto max-w-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">
                  {activeTab === "all"
                    ? t("empty.allTitle")
                    : t("empty.title", { status: activeTab })}
                </h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  {activeTab === "all"
                    ? t("empty.description")
                    : t("empty.filteredDescription", { status: activeTab })}
                </p>
                <Link
                  href={`/${locale}/owner/quotations`}
                  className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("empty.viewRequests")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
