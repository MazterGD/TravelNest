"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminVehicleVerificationDetails,
  type AdminVehicleVerificationQuery,
  type AdminVehicleVerificationResponse,
  type AdminVerificationDocumentStatus,
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
  approveVehicle: (vehicleId: string, note?: string) => Promise<void>;
  rejectVehicle: (vehicleId: string, reason: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminVehicleVerificationQuery = {
  page: 1,
  limit: 20,
  search: "",
};

export const useVehicleVerifications = (): UseVehicleVerificationsResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] =
    useState<AdminVehicleVerificationQuery>(DEFAULT_FILTERS);
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
  }, [debouncedSearch, filters.documentStatus, filters.limit, filters.page]);

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
          : next.search !== undefined || next.documentStatus !== undefined
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
    async (operation: () => Promise<void>, vehicleId?: string) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchQueue();

        if (vehicleId && selectedVehicle?.id === vehicleId) {
          await loadVehicleDetails(vehicleId);
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
    [fetchQueue, loadVehicleDetails, selectedVehicle?.id],
  );

  const approveVehicle = useCallback<UseVehicleVerificationsResult["approveVehicle"]>(
    async (vehicleId, note) => {
      await withMutation(async () => {
        await adminService.approveVehicleVerification(vehicleId, note);
      }, vehicleId);
    },
    [withMutation],
  );

  const rejectVehicle = useCallback<UseVehicleVerificationsResult["rejectVehicle"]>(
    async (vehicleId, reason) => {
      await withMutation(async () => {
        await adminService.rejectVehicleVerification(vehicleId, reason);
      }, vehicleId);
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
    approveVehicle,
    rejectVehicle,
    refetch: fetchQueue,
  };
};
