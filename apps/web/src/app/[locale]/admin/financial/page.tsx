"use client";

import { useMemo, useState } from "react";
import { Eye, Landmark, Plus, RefreshCw, ReceiptText, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select } from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useFinancialManagement } from "./hooks/useFinancialManagement";
import type { AdminCommissionType } from "@/lib/api";

const settlementStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const commissionTypeOptions = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED", label: "Fixed amount" },
  { value: "TIERED", label: "Tiered" },
];

const settlementStatusVariant = (status: string) => {
  if (status === "COMPLETED") return "success" as const;
  if (status === "FAILED" || status === "CANCELLED") return "danger" as const;
  if (status === "PENDING" || status === "PROCESSING") return "warning" as const;
  return "secondary" as const;
};

const currency = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

export default function AdminFinancialPage() {
  const { prompt, dialogs } = useDialogPrompts();

  const {
    isLoading,
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
    loadSettlementDetails,
    processSettlement,
    createCommissionRule,
    updateCommissionRule,
    archiveCommissionRule,
    refetch,
  } = useFinancialManagement();

  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<AdminCommissionType>("PERCENTAGE");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleMin, setRuleMin] = useState("");
  const [ruleMax, setRuleMax] = useState("");

  const settlements = settlementsData?.items || [];
  const canGoPrev = (settlementsData?.page || 1) > 1;
  const canGoNext = settlementsData ? settlementsData.page < settlementsData.totalPages : false;

  const settlementSummary = useMemo(() => {
    if (!settlementsData) return "";
    const start = (settlementsData.page - 1) * settlementsData.limit + 1;
    const end = Math.min(settlementsData.total, settlementsData.page * settlementsData.limit);
    return `${start}-${end} of ${settlementsData.total}`;
  }, [settlementsData]);

  const createRule = async () => {
    if (ruleName.trim().length < 2) {
      return;
    }

    const payload: {
      name: string;
      type: AdminCommissionType;
      percentage?: number;
      fixedAmount?: number;
      minAmount?: number;
      maxAmount?: number;
      tiers?: Array<{ min: number; max: number; rate: number }>;
      isActive?: boolean;
    } = {
      name: ruleName.trim(),
      type: ruleType,
      isActive: true,
    };

    if (ruleType === "PERCENTAGE") {
      const percentage = Number(ruleValue);
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        return;
      }
      payload.percentage = percentage;
    }

    if (ruleType === "FIXED") {
      const fixedAmount = Number(ruleValue);
      if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) {
        return;
      }
      payload.fixedAmount = fixedAmount;
    }

    if (ruleType === "TIERED") {
      const tiersRaw = await prompt({
        title: "Tiered Commission",
        message: "Provide tiers as JSON array (min/max/rate)",
        defaultValue: '[{"min":0,"max":50000,"rate":8},{"min":50000,"max":150000,"rate":6}]',
        minLength: 2,
        confirmText: "Apply Tiers",
      });

      if (!tiersRaw) {
        return;
      }

      try {
        const parsed = JSON.parse(tiersRaw) as Array<{ min: number; max: number; rate: number }>;
        if (!Array.isArray(parsed) || parsed.length === 0) {
          return;
        }
        payload.tiers = parsed;
      } catch {
        return;
      }
    }

    if (ruleMin.trim().length > 0) {
      const minAmount = Number(ruleMin);
      if (Number.isFinite(minAmount) && minAmount >= 0) {
        payload.minAmount = minAmount;
      }
    }

    if (ruleMax.trim().length > 0) {
      const maxAmount = Number(ruleMax);
      if (Number.isFinite(maxAmount) && maxAmount > 0) {
        payload.maxAmount = maxAmount;
      }
    }

    await createCommissionRule(payload);
    setRuleName("");
    setRuleValue("");
    setRuleMin("");
    setRuleMax("");
    setRuleType("PERCENTAGE");
  };

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Input
              label="Search settlements"
              placeholder="Code, period, owner"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div>
            <Select
              label="Status"
              options={settlementStatusOptions}
              value={filters.status || ""}
              onChange={(value) =>
                setFilters({
                  status: (value || undefined) as
                    | "PENDING"
                    | "PROCESSING"
                    | "COMPLETED"
                    | "FAILED"
                    | "CANCELLED"
                    | undefined,
                })
              }
            />
          </div>
          <div>
            <Input
              label="Period (YYYY-MM)"
              placeholder="2026-03"
              value={filters.period || ""}
              onChange={(event) => setFilters({ period: event.target.value || undefined })}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="secondary" onClick={() => void refetch()}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Settlement queue</h2>
            {settlementsData && <p className="text-sm text-muted-foreground">{settlementSummary}</p>}
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : settlements.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No settlements found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[940px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Settlement</th>
                    <th className="py-3">Owner</th>
                    <th className="py-3">Totals</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((settlement) => (
                    <tr key={settlement.id} className="border-b border-border/70 align-top">
                      <td className="py-3">
                        <p className="font-medium text-foreground">{settlement.settlementCode}</p>
                        <p className="text-xs text-muted-foreground">{settlement.period}</p>
                        <p className="text-xs text-muted-foreground">
                          {settlement.totalBookings} booking(s)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(settlement.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">
                          {settlement.owner.firstName} {settlement.owner.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{settlement.owner.email}</p>
                        <p className="text-xs text-muted-foreground">{settlement.owner.phone || "No phone"}</p>
                      </td>
                      <td className="py-3">
                        <p className="text-foreground">Gross: {currency.format(settlement.grossAmount)}</p>
                        <p className="text-foreground">
                          Commission: {currency.format(settlement.commissionAmount)}
                        </p>
                        <p className="font-medium text-foreground">
                          Net: {currency.format(settlement.netAmount)}
                        </p>
                      </td>
                      <td className="py-3">
                        <Badge variant={settlementStatusVariant(settlement.status)}>
                          {settlement.status}
                        </Badge>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {settlement.processedAt
                            ? `Processed ${new Date(settlement.processedAt).toLocaleString()}`
                            : "Not processed yet"}
                        </p>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadSettlementDetails(settlement.id)}
                            disabled={isMutating}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              void processSettlement(
                                settlement.id,
                                "COMPLETED",
                                "Settlement completed by finance admin",
                              )
                            }
                            disabled={isMutating || settlement.status === "COMPLETED"}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Complete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {settlementsData && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                disabled={!canGoPrev || isMutating}
                onClick={() => setFilters({ page: (settlementsData.page || 1) - 1 })}
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {settlementsData.page} of {settlementsData.totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={!canGoNext || isMutating}
                onClick={() => setFilters({ page: (settlementsData.page || 1) + 1 })}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Settlement detail</h3>
          {selectedSettlement ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-medium text-foreground">{selectedSettlement.settlementCode}</p>
                <p className="text-muted-foreground">{selectedSettlement.period}</p>
                <div className="mt-2 flex gap-2">
                  <Badge variant={settlementStatusVariant(selectedSettlement.status)}>
                    {selectedSettlement.status}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
                <p className="mt-1 text-foreground">
                  {selectedSettlement.owner.firstName} {selectedSettlement.owner.lastName}
                </p>
                <p className="text-muted-foreground">{selectedSettlement.owner.email}</p>
                <p className="text-muted-foreground">Status: {selectedSettlement.owner.status}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Breakdown</p>
                <p className="mt-1 text-foreground">
                  Gross: {currency.format(selectedSettlement.grossAmount)}
                </p>
                <p className="text-foreground">
                  Commission: {currency.format(selectedSettlement.commissionAmount)}
                </p>
                <p className="font-medium text-foreground">
                  Net: {currency.format(selectedSettlement.netAmount)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Included bookings</p>
                <div className="mt-2 max-h-[220px] space-y-2 overflow-y-auto">
                  {selectedSettlement.bookings.slice(0, 20).map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-background p-2">
                      <p className="text-xs font-semibold text-foreground">{item.booking.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.booking.vehicle.name} ({item.booking.vehicle.licensePlate})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Net {currency.format(item.net)} | Comm. {currency.format(item.commission)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    void processSettlement(
                      selectedSettlement.id,
                      "FAILED",
                      "Settlement failed during payment processing",
                    )
                  }
                  disabled={isMutating}
                >
                  Mark Failed
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void processSettlement(
                      selectedSettlement.id,
                      "CANCELLED",
                      "Settlement cancelled by finance admin",
                    )
                  }
                  disabled={isMutating}
                >
                  Cancel Settlement
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Select a settlement to inspect booking-level payouts and processing controls.
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Commission rules</h2>
            <Button
              variant={includeInactiveRules ? "outline" : "secondary"}
              onClick={() => setIncludeInactiveRules(!includeInactiveRules)}
            >
              {includeInactiveRules ? "Hide inactive" : "Include inactive"}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <Input
                label="Rule name"
                placeholder="Owner default commission"
                value={ruleName}
                onChange={(event) => setRuleName(event.target.value)}
              />
            </div>
            <div>
              <Select
                label="Type"
                options={commissionTypeOptions}
                value={ruleType}
                onChange={(value) => setRuleType((value || "PERCENTAGE") as AdminCommissionType)}
              />
            </div>
            <div>
              <Input
                label={ruleType === "FIXED" ? "Fixed amount" : "Value"}
                placeholder={ruleType === "PERCENTAGE" ? "10" : "5000"}
                value={ruleValue}
                onChange={(event) => setRuleValue(event.target.value)}
              />
            </div>
            <div>
              <Input
                label="Min amount"
                placeholder="0"
                value={ruleMin}
                onChange={(event) => setRuleMin(event.target.value)}
              />
            </div>
            <div>
              <Input
                label="Max amount"
                placeholder="100000"
                value={ruleMax}
                onChange={(event) => setRuleMax(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={() => void createRule()}
              disabled={isMutating || ruleName.trim().length < 2}
            >
              <Plus className="h-4 w-4" />
              Create Rule
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {commissionRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No commission rules configured.</p>
            ) : (
              commissionRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-border bg-muted/60 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">{rule.type}</p>
                    </div>
                    <Badge variant={rule.isActive ? "success" : "secondary"}>
                      {rule.isActive ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {rule.type === "PERCENTAGE" && `Rate: ${rule.percentage || 0}%`}
                    {rule.type === "FIXED" && `Fixed: ${currency.format(rule.fixedAmount || 0)}`}
                    {rule.type === "TIERED" && `${rule.tiers?.length || 0} tier(s) configured`}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void updateCommissionRule(rule.id, {
                          isActive: !rule.isActive,
                        })
                      }
                      disabled={isMutating}
                    >
                      {rule.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    {rule.type === "PERCENTAGE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const nextRate = Number((rule.percentage || 0) + 1);
                          void updateCommissionRule(rule.id, {
                            percentage: nextRate,
                          });
                        }}
                        disabled={isMutating}
                      >
                        +1% Rate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void archiveCommissionRule(rule.id)}
                      disabled={isMutating}
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="bg-background">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Recent settlement history</h2>
          </div>
          <div className="mt-4 space-y-3">
            {!historyData || historyData.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No historical settlements yet.</p>
            ) : (
              historyData.items.map((settlement) => (
                <div
                  key={settlement.id}
                  className="rounded-xl border border-border bg-muted/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {settlement.settlementCode}
                    </p>
                    <Badge variant={settlementStatusVariant(settlement.status)}>
                      {settlement.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {settlement.owner.firstName} {settlement.owner.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {settlement.period} • Net {currency.format(settlement.netAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {settlement.processedAt
                      ? new Date(settlement.processedAt).toLocaleString()
                      : "Processing date unavailable"}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Landmark className="h-4 w-4" />
            History preview shows latest processed records from finance operations.
          </div>
        </Card>
      </div>

      {dialogs}
    </div>
  );
}
