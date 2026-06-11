"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminService,
  type AdminCommissionRule,
  type AdminCommissionRuleInput,
  type AdminSettlementDetails,
  type AdminSettlementQuery,
  type AdminSettlementResponse,
  type AdminSettlementStatus,
} from "@/lib/api";
import { useDebounce } from "@/hooks";

interface UseFinancialManagementResult {
  isLoading: boolean;
  isDetailLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminSettlementQuery;
  settlementsData: AdminSettlementResponse | null;
  historyData: AdminSettlementResponse | null;
  selectedSettlement: AdminSettlementDetails | null;
  commissionRules: AdminCommissionRule[];
  includeInactiveRules: boolean;
  setFilters: (next: Partial<AdminSettlementQuery>) => void;
  setIncludeInactiveRules: (value: boolean) => void;
  clearSelectedSettlement: () => void;
  loadSettlementDetails: (settlementId: string) => Promise<void>;
  processSettlement: (
    settlementId: string,
    status?: "COMPLETED" | "FAILED" | "CANCELLED",
    notes?: string,
  ) => Promise<void>;
  createCommissionRule: (payload: AdminCommissionRuleInput) => Promise<void>;
  updateCommissionRule: (
    ruleId: string,
    payload: Partial<AdminCommissionRuleInput>,
  ) => Promise<void>;
  archiveCommissionRule: (ruleId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const VALID_SETTLEMENT_STATUSES: AdminSettlementStatus[] = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export const useFinancialManagement = (): UseFinancialManagementResult => {
  // Seed from URL params so dashboard deep-links arrive pre-filtered.
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");

  const initialStatus = VALID_SETTLEMENT_STATUSES.includes(rawStatus as AdminSettlementStatus)
    ? (rawStatus as AdminSettlementStatus)
    : undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilterState] = useState<AdminSettlementQuery>({
    page: 1,
    limit: 20,
    search: "",
    status: initialStatus,
  });
  const [settlementsData, setSettlementsData] = useState<AdminSettlementResponse | null>(null);
  const [historyData, setHistoryData] = useState<AdminSettlementResponse | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<AdminSettlementDetails | null>(null);
  const [commissionRules, setCommissionRules] = useState<AdminCommissionRule[]>([]);
  const [includeInactiveRules, setIncludeInactiveRules] = useState(false);

  const debouncedSearch = useDebounce(filters.search?.trim() || "", 300);

  // silent=true skips the isLoading flag so mutation-triggered refetches
  // don't flash the skeleton table while the user is looking at the page.
  const fetchFinancialData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const [queue, history, rules] = await Promise.all([
        adminService.getSettlements({
          ...filters,
          search: debouncedSearch || undefined,
        }),
        adminService.getSettlementHistory({
          page: 1,
          limit: 6,
          search: debouncedSearch || undefined,
          period: filters.period,
          ownerId: filters.ownerId,
        }),
        adminService.getCommissionRules(includeInactiveRules),
      ]);

      setSettlementsData(queue);
      setHistoryData(history);
      setCommissionRules(rules);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load financial management data";
      setError(message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [
    debouncedSearch,
    filters.limit,
    filters.ownerId,
    filters.page,
    filters.period,
    filters.status,
    includeInactiveRules,
  ]);

  useEffect(() => {
    void fetchFinancialData();
  }, [fetchFinancialData]);

  const setFilters = useCallback((next: Partial<AdminSettlementQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.status !== undefined ||
              next.period !== undefined ||
              next.ownerId !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const clearSelectedSettlement = useCallback(() => {
    setSelectedSettlement(null);
  }, []);

  // Separate loading flag so that viewing a settlement detail does not
  // disable all action buttons in the table via isMutating.
  const loadSettlementDetails = useCallback(async (settlementId: string) => {
    setIsDetailLoading(true);
    setError(null);

    try {
      const details = await adminService.getSettlementById(settlementId);
      setSelectedSettlement(details);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load settlement details";
      setError(message);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<void>, settlementId?: string) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchFinancialData(true);

        if (settlementId && selectedSettlement?.id === settlementId) {
          await loadSettlementDetails(settlementId);
        }
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Financial operation failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchFinancialData, loadSettlementDetails, selectedSettlement?.id],
  );

  const processSettlement = useCallback<UseFinancialManagementResult["processSettlement"]>(
    async (settlementId, status, notes) => {
      await withMutation(async () => {
        await adminService.processSettlement(settlementId, status, notes);
      }, settlementId);
    },
    [withMutation],
  );

  const createCommissionRule = useCallback<UseFinancialManagementResult["createCommissionRule"]>(
    async (payload) => {
      await withMutation(async () => {
        await adminService.createCommissionRule(payload);
      });
    },
    [withMutation],
  );

  const updateCommissionRule = useCallback<UseFinancialManagementResult["updateCommissionRule"]>(
    async (ruleId, payload) => {
      await withMutation(async () => {
        await adminService.updateCommissionRule(ruleId, payload);
      });
    },
    [withMutation],
  );

  const archiveCommissionRule = useCallback<UseFinancialManagementResult["archiveCommissionRule"]>(
    async (ruleId) => {
      await withMutation(async () => {
        await adminService.deleteCommissionRule(ruleId);
      });
    },
    [withMutation],
  );

  return {
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
    refetch: fetchFinancialData,
  };
};
