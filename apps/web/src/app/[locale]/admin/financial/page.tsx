"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Eye,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptySearchIcon,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonTable,
  StatCard,
} from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useFinancialManagement } from "./hooks/useFinancialManagement";
import type { AdminCommissionRuleInput, AdminCommissionType } from "@/lib/api";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_QUICK_FILTERS = [
  { label: "All", value: undefined as string | undefined },
  { label: "Pending", value: "PENDING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const COMMISSION_TYPE_OPTIONS = [
  { value: "PERCENTAGE", label: "Percentage (%)" },
  { value: "FIXED", label: "Fixed amount (LKR)" },
  { value: "TIERED", label: "Tiered" },
];

const DEFAULT_RULE_FORM = {
  name: "",
  type: "PERCENTAGE" as AdminCommissionType,
  value: "",
  min: "",
  max: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const settlementStatusVariant = (status: string) => {
  if (status === "COMPLETED") return "success" as const;
  if (status === "FAILED" || status === "CANCELLED") return "danger" as const;
  if (status === "PENDING" || status === "PROCESSING") return "warning" as const;
  return "secondary" as const;
};

const ownerStatusVariant = (status: string) => {
  if (status === "ACTIVE") return "success" as const;
  if (status === "SUSPENDED") return "danger" as const;
  return "secondary" as const;
};

const formatStatus = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

const currency = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFinancialPage() {
  const { prompt, confirm, dialogs } = useDialogPrompts();

  const {
    isLoading,
    isDetailLoading,
    isMutating,
    error,
    filters,
    settlementsData,
    historyData,
    selectedSettlement,
    commissionRules,
    includeInactiveRules,
    setFilters,
    setIncludeInactiveRules,
    clearSelectedSettlement,
    loadSettlementDetails,
    processSettlement,
    createCommissionRule,
    updateCommissionRule,
    archiveCommissionRule,
    refetch,
  } = useFinancialManagement();

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState(DEFAULT_RULE_FORM);
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);

  // ── Derived state ────────────────────────────────────────────────────────────

  const settlements = settlementsData?.items ?? [];
  const canGoPrev = (settlementsData?.page ?? 1) > 1;
  const canGoNext = settlementsData ? settlementsData.page < settlementsData.totalPages : false;

  const paginationSummary = useMemo(() => {
    if (!settlementsData) return "";
    const start = (settlementsData.page - 1) * settlementsData.limit + 1;
    const end = Math.min(settlementsData.total, settlementsData.page * settlementsData.limit);
    return `${start}–${end} of ${settlementsData.total.toLocaleString()}`;
  }, [settlementsData]);

  const pageStats = useMemo(() => {
    const pending = settlements.filter((s) => s.status === "PENDING");
    const processing = settlements.filter((s) => s.status === "PROCESSING");
    const failed = settlements.filter(
      (s) => s.status === "FAILED" || s.status === "CANCELLED",
    );
    return {
      pendingCount: pending.length,
      pendingNetTotal: pending.reduce((acc, s) => acc + s.netAmount, 0),
      processingCount: processing.length,
      failedCount: failed.length,
    };
  }, [settlements]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleViewSettlement = async (settlementId: string) => {
    clearSelectedSettlement();
    setIsDetailOpen(true);
    await loadSettlementDetails(settlementId);
  };

  const closeDetailModal = () => {
    setIsDetailOpen(false);
    clearSelectedSettlement();
  };

  const handleComplete = async (settlementId: string) => {
    const notes = await prompt({
      title: "Complete Settlement",
      message: "Add processing notes for this settlement.",
      placeholder: "e.g. Transferred via bank on 2026-05-30",
      defaultValue: "Settlement completed by finance admin",
      confirmText: "Mark as Completed",
    });
    if (notes !== null) {
      await processSettlement(
        settlementId,
        "COMPLETED",
        notes || "Settlement completed by finance admin",
      );
    }
  };

  const handleMarkFailed = async (settlementId: string) => {
    const reason = await prompt({
      title: "Mark Settlement Failed",
      message: "Provide a reason. This will be recorded in the settlement audit trail.",
      placeholder: "e.g. Bank transfer rejected — insufficient funds",
      confirmText: "Mark as Failed",
      variant: "danger",
      minLength: 3,
    });
    if (reason) {
      await processSettlement(settlementId, "FAILED", reason);
    }
  };

  const handleCancelSettlement = async (settlementId: string) => {
    const approved = await confirm({
      title: "Cancel Settlement",
      message:
        "This will cancel the settlement and the owner will not receive this payout. This action cannot be easily reversed.",
      confirmText: "Cancel Settlement",
      variant: "danger",
    });
    if (approved) {
      await processSettlement(
        settlementId,
        "CANCELLED",
        "Settlement cancelled by finance admin",
      );
    }
  };

  const handleUpdateRate = async (ruleId: string, currentRate: number) => {
    const newRateStr = await prompt({
      title: "Update Commission Rate",
      message: "Enter the new percentage rate (1–100).",
      placeholder: String(currentRate),
      defaultValue: String(currentRate),
      confirmText: "Update Rate",
      minLength: 1,
    });
    if (newRateStr === null) return;
    const newRate = Number(newRateStr);
    if (!Number.isFinite(newRate) || newRate <= 0 || newRate > 100) return;
    await updateCommissionRule(ruleId, { percentage: newRate });
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleFormError(null);

    if (ruleForm.name.trim().length < 2) {
      setRuleFormError("Rule name must be at least 2 characters.");
      return;
    }

    const payload: AdminCommissionRuleInput = {
      name: ruleForm.name.trim(),
      type: ruleForm.type,
      isActive: true,
    };

    if (ruleForm.type === "PERCENTAGE") {
      const pct = Number(ruleForm.value);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        setRuleFormError("Enter a percentage between 1 and 100.");
        return;
      }
      payload.percentage = pct;
    } else if (ruleForm.type === "FIXED") {
      const amt = Number(ruleForm.value);
      if (!Number.isFinite(amt) || amt <= 0) {
        setRuleFormError("Enter a fixed amount greater than 0.");
        return;
      }
      payload.fixedAmount = amt;
    } else {
      const tiersRaw = await prompt({
        title: "Tiered Commission",
        message: "Provide tiers as a JSON array with min, max, and rate fields.",
        defaultValue:
          '[{"min":0,"max":50000,"rate":8},{"min":50000,"max":150000,"rate":6}]',
        minLength: 2,
        confirmText: "Apply Tiers",
      });
      if (!tiersRaw) return;
      try {
        const parsed = JSON.parse(tiersRaw) as Array<{
          min: number;
          max: number;
          rate: number;
        }>;
        if (!Array.isArray(parsed) || parsed.length === 0) {
          setRuleFormError("Tiers array cannot be empty.");
          return;
        }
        payload.tiers = parsed;
      } catch {
        setRuleFormError("Invalid JSON — check the tier format and try again.");
        return;
      }
    }

    if (ruleForm.min.trim()) {
      const min = Number(ruleForm.min);
      if (Number.isFinite(min) && min >= 0) payload.minAmount = min;
    }
    if (ruleForm.max.trim()) {
      const max = Number(ruleForm.max);
      if (Number.isFinite(max) && max > 0) payload.maxAmount = max;
    }

    await createCommissionRule(payload);
    setRuleForm(DEFAULT_RULE_FORM);
    setIsCreateRuleOpen(false);
  };

  const closeCreateRule = () => {
    setIsCreateRuleOpen(false);
    setRuleForm(DEFAULT_RULE_FORM);
    setRuleFormError(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Financial Management
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Review and process owner settlements, and manage platform commission rules.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading || isMutating}
          aria-label="Refresh financial data"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--color-error-text)]">
                Failed to load financial data.
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
                {error} — Try refreshing the page or check your connection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI stat cards ───────────────────────────────────────────────── */}
      {!isLoading && settlementsData && (
        <section
          aria-label="Settlement statistics for the current page"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            value={settlementsData.total.toLocaleString()}
            label="Settlements in queue"
            icon={<ReceiptText className="h-5 w-5" />}
            variant="primary"
            subStat={filters.status ? `Filtered: ${formatStatus(filters.status)}` : "All statuses"}
          />
          <StatCard
            value={pageStats.pendingCount}
            label="Pending on this page"
            icon={<Clock className="h-5 w-5" />}
            variant="warning"
            subStat={
              pageStats.pendingCount > 0
                ? `Net: ${currency.format(pageStats.pendingNetTotal)}`
                : "None pending"
            }
          />
          <StatCard
            value={pageStats.processingCount}
            label="Processing on this page"
            icon={<Loader2 className="h-5 w-5" />}
            variant="info"
            subStat={pageStats.processingCount > 0 ? "In progress" : "None processing"}
          />
          <StatCard
            value={pageStats.failedCount}
            label="Failed / Cancelled"
            icon={<XCircle className="h-5 w-5" />}
            variant={pageStats.failedCount > 0 ? "error" : "primary"}
            subStat={pageStats.failedCount > 0 ? "Requires attention" : "None on this page"}
          />
        </section>
      )}

      {/* ── Settlement queue ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden bg-[var(--color-bg-base)] p-0">

        {/* Card header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Settlement Queue
          </h2>
          {settlementsData && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {paginationSummary}
            </span>
          )}
        </div>

        {/* Filter bar */}
        <div className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Input
                label="Search"
                placeholder="Settlement code, period, or owner"
                value={filters.search ?? ""}
                onChange={(e) => setFilters({ search: e.target.value })}
              />
            </div>
            <div className="w-full sm:w-[160px]">
              <Input
                label="Period (YYYY-MM)"
                placeholder="2026-05"
                value={filters.period ?? ""}
                onChange={(e) => setFilters({ period: e.target.value || undefined })}
              />
            </div>
          </div>

          {/* Status quick-filter pills */}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {STATUS_QUICK_FILTERS.map((sf) => {
              const isActive = filters.status === sf.value;
              return (
                <button
                  key={sf.label}
                  type="button"
                  onClick={() =>
                    setFilters({
                      status: sf.value as
                        | "PENDING"
                        | "PROCESSING"
                        | "COMPLETED"
                        | "FAILED"
                        | "CANCELLED"
                        | undefined,
                    })
                  }
                  aria-pressed={isActive}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2",
                    "focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2",
                    isActive
                      ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-white"
                      : "border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:border-[var(--color-action-primary)]/60 hover:text-[var(--color-text-primary)]",
                  ].join(" ")}
                >
                  {sf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table body */}
        {isLoading ? (
          <div className="px-6 pb-6 pt-4">
            <SkeletonTable rows={10} cols={5} />
          </div>
        ) : settlements.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No settlements found"
            description="Try adjusting your search terms or removing a status filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-auto text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Settlement
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Owner
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Breakdown
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {settlements.map((settlement) => (
                  <tr
                    key={settlement.id}
                    className="transition-colors hover:bg-[var(--color-bg-surface)]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {settlement.settlementCode}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {settlement.period}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {settlement.totalBookings} booking
                        {settlement.totalBookings !== 1 ? "s" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {settlement.owner.firstName} {settlement.owner.lastName}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {settlement.owner.email}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Gross:{" "}
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {currency.format(settlement.grossAmount)}
                        </span>
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Comm.:{" "}
                        <span className="text-[var(--color-text-secondary)]">
                          {currency.format(settlement.commissionAmount)}
                        </span>
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Net:{" "}
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {currency.format(settlement.netAmount)}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={settlementStatusVariant(settlement.status)} dot>
                        {formatStatus(settlement.status)}
                      </Badge>
                      {settlement.processedAt && (
                        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                          {new Date(settlement.processedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleViewSettlement(settlement.id)}
                          aria-label={`View details for settlement ${settlement.settlementCode}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleComplete(settlement.id)}
                          disabled={
                            isMutating ||
                            settlement.status === "COMPLETED" ||
                            settlement.status === "CANCELLED"
                          }
                          aria-label={`Mark ${settlement.settlementCode} as completed`}
                          className="text-[var(--color-text-secondary)]"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination — only when there is more than one page */}
        {settlementsData && settlementsData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isMutating}
              onClick={() => setFilters({ page: (settlementsData.page ?? 1) - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page {settlementsData.page} of {settlementsData.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={!canGoNext || isMutating}
              onClick={() => setFilters({ page: (settlementsData.page ?? 1) + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Commission rules + History ───────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">

        {/* Commission Rules */}
        <Card className="bg-[var(--color-bg-base)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Commission Rules
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIncludeInactiveRules(!includeInactiveRules)}
              >
                {includeInactiveRules ? "Hide inactive" : "Show inactive"}
              </Button>
              <Button size="sm" onClick={() => setIsCreateRuleOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Rule
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {commissionRules.length === 0 ? (
              <EmptyState
                icon={<EmptySearchIcon />}
                title="No commission rules"
                description="Create a rule to start earning platform revenue from bookings."
              />
            ) : (
              commissionRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {rule.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                        {rule.type === "PERCENTAGE" &&
                          `${rule.percentage ?? 0}% of booking value`}
                        {rule.type === "FIXED" &&
                          `Fixed ${currency.format(rule.fixedAmount ?? 0)} per booking`}
                        {rule.type === "TIERED" &&
                          `${rule.tiers?.length ?? 0} tier(s) configured`}
                      </p>
                    </div>
                    <Badge variant={rule.isActive ? "success" : "secondary"} dot>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void updateCommissionRule(rule.id, { isActive: !rule.isActive })
                      }
                      disabled={isMutating}
                    >
                      {rule.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    {rule.type === "PERCENTAGE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleUpdateRate(rule.id, rule.percentage ?? 0)}
                        disabled={isMutating}
                        aria-label={`Edit commission rate for ${rule.name}`}
                      >
                        Edit Rate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void archiveCommissionRule(rule.id)}
                      disabled={isMutating}
                      aria-label={`Archive commission rule ${rule.name}`}
                      className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Settlement History */}
        <Card className="bg-[var(--color-bg-base)]">
          <div className="flex items-center gap-2">
            <Landmark
              className="h-4 w-4 text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Recent History
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
            Latest processed records from finance operations.
          </p>

          <div className="mt-4 space-y-3">
            {!historyData || historyData.items.length === 0 ? (
              <EmptyState
                icon={<EmptySearchIcon />}
                title="No history yet"
                description="Processed settlements will appear here."
              />
            ) : (
              historyData.items.map((settlement) => (
                <div
                  key={settlement.id}
                  className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {settlement.settlementCode}
                    </p>
                    <Badge variant={settlementStatusVariant(settlement.status)} dot>
                      {formatStatus(settlement.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {settlement.owner.firstName} {settlement.owner.lastName}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {settlement.period} · Net {currency.format(settlement.netAmount)}
                  </p>
                  {settlement.processedAt && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {new Date(settlement.processedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ── Settlement Detail Modal ───────────────────────────────────────── */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        title={
          selectedSettlement
            ? `Settlement · ${selectedSettlement.settlementCode}`
            : "Settlement Details"
        }
        size="md"
      >
        {isDetailLoading || !selectedSettlement ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-text-tertiary)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading settlement details…
          </div>
        ) : (
          <div className="max-h-[calc(90vh-10rem)] space-y-4 overflow-y-auto text-sm">

            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Period</p>
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {selectedSettlement.period}
                </p>
              </div>
              <Badge variant={settlementStatusVariant(selectedSettlement.status)} dot>
                {formatStatus(selectedSettlement.status)}
              </Badge>
            </div>

            {/* Owner */}
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Owner
              </p>
              <p className="mt-2 font-medium text-[var(--color-text-primary)]">
                {selectedSettlement.owner.firstName} {selectedSettlement.owner.lastName}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {selectedSettlement.owner.email}
              </p>
              <div className="mt-2">
                <Badge variant={ownerStatusVariant(selectedSettlement.owner.status)} dot>
                  {formatStatus(selectedSettlement.owner.status)}
                </Badge>
              </div>
            </div>

            {/* Financial breakdown */}
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Breakdown
              </p>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-tertiary)]">Gross amount</dt>
                  <dd className="tabular-nums text-[var(--color-text-primary)]">
                    {currency.format(selectedSettlement.grossAmount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1 text-[var(--color-text-tertiary)]">
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                    Commission
                  </dt>
                  <dd className="tabular-nums text-[var(--color-text-secondary)]">
                    − {currency.format(selectedSettlement.commissionAmount)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-[var(--color-border-default)] pt-2">
                  <dt className="font-semibold text-[var(--color-text-primary)]">
                    Net payout
                  </dt>
                  <dd className="font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {currency.format(selectedSettlement.netAmount)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Included bookings */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Included Bookings ({selectedSettlement.bookings.length})
              </p>
              <div className="mt-2 max-h-[200px] space-y-2 overflow-y-auto">
                {selectedSettlement.bookings.slice(0, 20).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-3"
                  >
                    <p className="text-xs font-medium text-[var(--color-text-primary)]">
                      {item.booking.vehicle.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {item.booking.vehicle.licensePlate}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      Net {currency.format(item.net)} · Comm.{" "}
                      {currency.format(item.commission)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t border-[var(--color-border-default)] pt-4">
              <Button
                size="sm"
                onClick={() => void handleComplete(selectedSettlement.id)}
                disabled={
                  isMutating ||
                  selectedSettlement.status === "COMPLETED" ||
                  selectedSettlement.status === "CANCELLED"
                }
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Mark Completed
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleMarkFailed(selectedSettlement.id)}
                disabled={isMutating || selectedSettlement.status === "FAILED"}
              >
                Mark Failed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleCancelSettlement(selectedSettlement.id)}
                disabled={isMutating || selectedSettlement.status === "CANCELLED"}
                className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Commission Rule Modal ──────────────────────────────────── */}
      <Modal
        isOpen={isCreateRuleOpen}
        onClose={closeCreateRule}
        title="Create Commission Rule"
        size="md"
      >
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Commission rules define the platform fee deducted from each booking payout.
        </p>
        <form onSubmit={(e) => void handleCreateRule(e)} className="space-y-4">
          <Input
            label="Rule name"
            placeholder="e.g. Standard owner commission"
            value={ruleForm.name}
            onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <Select
            label="Commission type"
            options={COMMISSION_TYPE_OPTIONS}
            value={ruleForm.type}
            onChange={(v) =>
              setRuleForm((p) => ({
                ...p,
                type: (v || "PERCENTAGE") as AdminCommissionType,
                value: "",
              }))
            }
          />
          {ruleForm.type !== "TIERED" && (
            <Input
              label={
                ruleForm.type === "FIXED" ? "Fixed amount (LKR)" : "Percentage rate (%)"
              }
              placeholder={ruleForm.type === "FIXED" ? "5000" : "10"}
              value={ruleForm.value}
              onChange={(e) => setRuleForm((p) => ({ ...p, value: e.target.value }))}
              required
            />
          )}
          {ruleForm.type === "TIERED" && (
            <p className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
              Tiers are entered as JSON in the next step after clicking Create Rule.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min booking amount (optional)"
              placeholder="0"
              value={ruleForm.min}
              onChange={(e) => setRuleForm((p) => ({ ...p, min: e.target.value }))}
            />
            <Input
              label="Max booking amount (optional)"
              placeholder="100000"
              value={ruleForm.max}
              onChange={(e) => setRuleForm((p) => ({ ...p, max: e.target.value }))}
            />
          </div>

          {ruleFormError && (
            <p role="alert" className="text-xs text-[var(--color-error-text)]">
              {ruleFormError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeCreateRule}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isMutating} disabled={isMutating}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Rule
            </Button>
          </div>
        </form>
      </Modal>

      {dialogs}
    </div>
  );
}
