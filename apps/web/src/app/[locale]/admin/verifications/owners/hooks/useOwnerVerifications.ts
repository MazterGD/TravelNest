"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminService,
  type AdminOwnerVerificationDetails,
  type AdminOwnerVerificationQuery,
  type AdminOwnerVerificationResponse,
  type AdminOwnerVerificationStatus,
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
  approveDocument: (documentId: string) => Promise<void>;
  rejectDocument: (documentId: string, reason: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const VALID_OWNER_STATUSES: AdminOwnerVerificationStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
];

export const useOwnerVerifications = (): UseOwnerVerificationsResult => {
  // Seed from URL params so dashboard deep-links arrive pre-filtered.
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");

  const initialStatus = VALID_OWNER_STATUSES.includes(rawStatus as AdminOwnerVerificationStatus)
    ? (rawStatus as AdminOwnerVerificationStatus)
    : "PENDING_VERIFICATION";

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] = useState<AdminOwnerVerificationQuery>({
    page: 1,
    limit: 20,
    search: "",
    status: initialStatus,
  });
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
  }, [debouncedSearch, filters.limit, filters.page, filters.status]);

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
          : next.search !== undefined || next.status !== undefined
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
    async (operation: () => Promise<void>) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();

        // Refresh both the queue and the open detail panel
        await fetchQueue();

        if (selectedOwner) {
          await loadOwnerDetails(selectedOwner.id);
        }
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Document action failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQueue, loadOwnerDetails, selectedOwner],
  );

  const approveDocument = useCallback(
    async (documentId: string) => {
      if (!selectedOwner) return;
      await withMutation(() =>
        adminService.approveOwnerDocument(selectedOwner.id, documentId),
      );
    },
    [withMutation, selectedOwner],
  );

  const rejectDocument = useCallback(
    async (documentId: string, reason: string) => {
      if (!selectedOwner) return;
      await withMutation(() =>
        adminService.rejectOwnerDocument(selectedOwner.id, documentId, reason),
      );
    },
    [withMutation, selectedOwner],
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
    approveDocument,
    rejectDocument,
    refetch: fetchQueue,
  };
};
