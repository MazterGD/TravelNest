"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminOwnerVerificationDetails,
  type AdminOwnerVerificationQuery,
  type AdminOwnerVerificationResponse,
  type AdminOwnerVerificationStatus,
  type AdminVerificationDocumentStatus,
  type AdminVerificationHistoryResponse,
} from "@/lib/api";
import { useDebounce } from "@/hooks";

interface UseOwnerVerificationsResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminOwnerVerificationQuery;
  queueData: AdminOwnerVerificationResponse | null;
  selectedOwner: AdminOwnerVerificationDetails | null;
  selectedHistory: AdminVerificationHistoryResponse | null;
  setFilters: (next: Partial<AdminOwnerVerificationQuery>) => void;
  loadOwnerDetails: (ownerId: string) => Promise<void>;
  approveOwner: (ownerId: string, note?: string) => Promise<void>;
  rejectOwner: (ownerId: string, reason: string) => Promise<void>;
  requestResubmission: (ownerId: string, reason: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminOwnerVerificationQuery = {
  page: 1,
  limit: 20,
  search: "",
};

export const useOwnerVerifications = (): UseOwnerVerificationsResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] =
    useState<AdminOwnerVerificationQuery>(DEFAULT_FILTERS);
  const [queueData, setQueueData] =
    useState<AdminOwnerVerificationResponse | null>(null);
  const [selectedOwner, setSelectedOwner] =
    useState<AdminOwnerVerificationDetails | null>(null);
  const [selectedHistory, setSelectedHistory] =
    useState<AdminVerificationHistoryResponse | null>(null);
  const debouncedSearch = useDebounce(filters.search?.trim() || "", 300);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getOwnerVerifications({
        ...filters,
        search: debouncedSearch || undefined,
      });

      setQueueData(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load owner verification queue";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedSearch,
    filters.documentStatus,
    filters.limit,
    filters.page,
    filters.status,
  ]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const setFilters = useCallback((next: Partial<AdminOwnerVerificationQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.status !== undefined ||
              next.documentStatus !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const loadOwnerDetails = useCallback(async (ownerId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const [owner, history] = await Promise.all([
        adminService.getOwnerVerificationById(ownerId),
        adminService.getVerificationHistory(ownerId, { page: 1, limit: 20 }),
      ]);

      setSelectedOwner(owner);
      setSelectedHistory(history);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load owner verification details";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<void>, ownerId?: string) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchQueue();

        if (ownerId && selectedOwner?.id === ownerId) {
          await loadOwnerDetails(ownerId);
        }
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Verification action failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQueue, loadOwnerDetails, selectedOwner?.id],
  );

  const approveOwner = useCallback<UseOwnerVerificationsResult["approveOwner"]>(
    async (ownerId, note) => {
      await withMutation(async () => {
        await adminService.approveOwnerVerification(ownerId, note);
      }, ownerId);
    },
    [withMutation],
  );

  const rejectOwner = useCallback<UseOwnerVerificationsResult["rejectOwner"]>(
    async (ownerId, reason) => {
      await withMutation(async () => {
        await adminService.rejectOwnerVerification(ownerId, reason);
      }, ownerId);
    },
    [withMutation],
  );

  const requestResubmission = useCallback<
    UseOwnerVerificationsResult["requestResubmission"]
  >(
    async (ownerId, reason) => {
      await withMutation(async () => {
        await adminService.requestOwnerResubmission(ownerId, reason);
      }, ownerId);
    },
    [withMutation],
  );

  return {
    isLoading,
    isMutating,
    error,
    filters,
    queueData,
    selectedOwner,
    selectedHistory,
    setFilters,
    loadOwnerDetails,
    approveOwner,
    rejectOwner,
    requestResubmission,
    refetch: fetchQueue,
  };
};
