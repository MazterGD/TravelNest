"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminService,
  type AdminVehicleVerificationDetails,
  type AdminVehicleVerificationQuery,
  type AdminVehicleVerificationResponse,
  type AdminVerificationHistoryResponse,
} from "@/lib/api";
import { useDebounce } from "@/hooks";

interface UseVehicleVerificationsResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminVehicleVerificationQuery;
  queueData: AdminVehicleVerificationResponse | null;
  selectedVehicle: AdminVehicleVerificationDetails | null;
  selectedHistory: AdminVerificationHistoryResponse | null;
  setFilters: (next: Partial<AdminVehicleVerificationQuery>) => void;
  loadVehicleDetails: (vehicleId: string) => Promise<void>;
  approveDocument: (documentId: string) => Promise<void>;
  rejectDocument: (documentId: string, reason: string) => Promise<void>;
  approveVehicle: (vehicleId: string, note?: string) => Promise<void>;
  rejectVehicle: (vehicleId: string, reason: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const VALID_VERIFICATION_STATES = ["PENDING", "MISSING_DOCUMENTS"] as const;

export const useVehicleVerifications = (): UseVehicleVerificationsResult => {
  // Seed from URL params so dashboard deep-links arrive pre-filtered.
  const searchParams = useSearchParams();
  const rawState = searchParams.get("verificationState");
  const initialState = VALID_VERIFICATION_STATES.includes(
    rawState as (typeof VALID_VERIFICATION_STATES)[number],
  )
    ? (rawState as "PENDING" | "MISSING_DOCUMENTS")
    : undefined;
  const initialSearch = searchParams.get("search") ?? "";

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] = useState<AdminVehicleVerificationQuery>({
    page: 1,
    limit: 10,
    search: initialSearch,
    verificationState: initialState,
  });
  const [queueData, setQueueData] =
    useState<AdminVehicleVerificationResponse | null>(null);
  const [selectedVehicle, setSelectedVehicle] =
    useState<AdminVehicleVerificationDetails | null>(null);
  const [selectedHistory, setSelectedHistory] =
    useState<AdminVerificationHistoryResponse | null>(null);
  const debouncedSearch = useDebounce(filters.search?.trim() || "", 300);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getVehicleVerifications({
        ...filters,
        search: debouncedSearch || undefined,
      });

      setQueueData(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load vehicle verification queue";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filters.limit, filters.page, filters.verificationState]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const setFilters = useCallback((next: Partial<AdminVehicleVerificationQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined || next.verificationState !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const loadVehicleDetails = useCallback(async (vehicleId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const [vehicle, history] = await Promise.all([
        adminService.getVehicleVerificationById(vehicleId),
        adminService.getVerificationHistory(vehicleId, { page: 1, limit: 20 }),
      ]);

      setSelectedVehicle(vehicle);
      setSelectedHistory(history);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load vehicle verification details";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<unknown>) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();

        // Refresh both the queue and the open detail panel
        await fetchQueue();

        if (selectedVehicle) {
          await loadVehicleDetails(selectedVehicle.id);
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
    [fetchQueue, loadVehicleDetails, selectedVehicle],
  );

  const approveDocument = useCallback(
    async (documentId: string) => {
      if (!selectedVehicle) return;
      await withMutation(() =>
        adminService.approveVehicleDocument(selectedVehicle.id, documentId),
      );
    },
    [withMutation, selectedVehicle],
  );

  const rejectDocument = useCallback(
    async (documentId: string, reason: string) => {
      if (!selectedVehicle) return;
      await withMutation(() =>
        adminService.rejectVehicleDocument(selectedVehicle.id, documentId, reason),
      );
    },
    [withMutation, selectedVehicle],
  );

  // Approve a vehicle's activation request or initial verification
  const approveVehicle = useCallback(
    async (vehicleId: string, note?: string) => {
      await withMutation(() =>
        adminService.approveVehicleVerification(vehicleId, note) as Promise<void>,
      );
    },
    [withMutation],
  );

  // Reject a vehicle's activation request or initial verification
  const rejectVehicle = useCallback(
    async (vehicleId: string, reason: string) => {
      await withMutation(() =>
        adminService.rejectVehicleVerification(vehicleId, reason) as Promise<void>,
      );
    },
    [withMutation],
  );

  return {
    isLoading,
    isMutating,
    error,
    filters,
    queueData,
    selectedVehicle,
    selectedHistory,
    setFilters,
    loadVehicleDetails,
    approveDocument,
    rejectDocument,
    approveVehicle,
    rejectVehicle,
    refetch: fetchQueue,
  };
};
