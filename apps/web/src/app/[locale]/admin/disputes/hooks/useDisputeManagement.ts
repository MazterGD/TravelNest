"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminDisputeDetails,
  type AdminDisputePriority,
  type AdminDisputeQuery,
  type AdminDisputeQueueResponse,
  type AdminDisputeStatus,
} from "@/lib/api";
import { useDebounce } from "@/hooks";

interface UseDisputeManagementResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminDisputeQuery;
  queueData: AdminDisputeQueueResponse | null;
  selectedDispute: AdminDisputeDetails | null;
  setFilters: (next: Partial<AdminDisputeQuery>) => void;
  loadDisputeDetails: (disputeId: string) => Promise<void>;
  assignDispute: (disputeId: string, assignedTo: string, note?: string) => Promise<void>;
  updatePriority: (
    disputeId: string,
    priority: AdminDisputePriority,
    note?: string,
  ) => Promise<void>;
  updateStatus: (
    disputeId: string,
    status: AdminDisputeStatus,
    note?: string,
  ) => Promise<void>;
  addMessage: (
    disputeId: string,
    message: string,
    isInternalNote?: boolean,
  ) => Promise<void>;
  resolveDispute: (
    disputeId: string,
    resolution: string,
    resolutionType?: string,
    resolutionAmount?: number,
  ) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminDisputeQuery = {
  page: 1,
  limit: 20,
  search: "",
};

export const useDisputeManagement = (): UseDisputeManagementResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] = useState<AdminDisputeQuery>(DEFAULT_FILTERS);
  const [queueData, setQueueData] = useState<AdminDisputeQueueResponse | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<AdminDisputeDetails | null>(null);
  const debouncedSearch = useDebounce(filters.search?.trim() || "", 300);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getDisputes({
        ...filters,
        search: debouncedSearch || undefined,
      });

      setQueueData(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load disputes";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedSearch,
    filters.assignedTo,
    filters.limit,
    filters.page,
    filters.priority,
    filters.status,
    filters.type,
  ]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const setFilters = useCallback((next: Partial<AdminDisputeQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.status !== undefined ||
              next.priority !== undefined ||
              next.type !== undefined ||
              next.assignedTo !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const loadDisputeDetails = useCallback(async (disputeId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const dispute = await adminService.getDisputeById(disputeId);
      setSelectedDispute(dispute);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load dispute details";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<void>, disputeId?: string) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchQueue();

        if (disputeId && selectedDispute?.id === disputeId) {
          await loadDisputeDetails(disputeId);
        }
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Dispute action failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQueue, loadDisputeDetails, selectedDispute?.id],
  );

  const assignDispute = useCallback<UseDisputeManagementResult["assignDispute"]>(
    async (disputeId, assignedTo, note) => {
      await withMutation(async () => {
        await adminService.assignDispute(disputeId, assignedTo, note);
      }, disputeId);
    },
    [withMutation],
  );

  const updatePriority = useCallback<UseDisputeManagementResult["updatePriority"]>(
    async (disputeId, priority, note) => {
      await withMutation(async () => {
        await adminService.updateDisputePriority(disputeId, priority, note);
      }, disputeId);
    },
    [withMutation],
  );

  const updateStatus = useCallback<UseDisputeManagementResult["updateStatus"]>(
    async (disputeId, status, note) => {
      await withMutation(async () => {
        await adminService.updateDisputeStatus(disputeId, status, note);
      }, disputeId);
    },
    [withMutation],
  );

  const addMessage = useCallback<UseDisputeManagementResult["addMessage"]>(
    async (disputeId, message, isInternalNote = true) => {
      await withMutation(async () => {
        await adminService.addDisputeMessage(disputeId, message, isInternalNote);
      }, disputeId);
    },
    [withMutation],
  );

  const resolveDispute = useCallback<UseDisputeManagementResult["resolveDispute"]>(
    async (disputeId, resolution, resolutionType, resolutionAmount) => {
      await withMutation(async () => {
        await adminService.resolveDispute(
          disputeId,
          resolution,
          resolutionType,
          resolutionAmount,
        );
      }, disputeId);
    },
    [withMutation],
  );

  return {
    isLoading,
    isMutating,
    error,
    filters,
    queueData,
    selectedDispute,
    setFilters,
    loadDisputeDetails,
    assignDispute,
    updatePriority,
    updateStatus,
    addMessage,
    resolveDispute,
    refetch: fetchQueue,
  };
};
