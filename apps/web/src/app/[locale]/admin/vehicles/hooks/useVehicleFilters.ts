"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminService,
  type AdminVehicleRecord,
  type AdminVehiclesQuery,
  type AdminVehiclesResponse,
} from "@/lib/api";

interface UseVehicleFiltersResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  vehiclesData: AdminVehiclesResponse | null;
  filters: AdminVehiclesQuery;
  selectedVehicle: AdminVehicleRecord | null;
  setFilters: (next: Partial<AdminVehiclesQuery>) => void;
  selectVehicle: (vehicle: AdminVehicleRecord) => void;
  clearSelectedVehicle: () => void;
  suspendVehicle: (vehicleId: string) => Promise<void>;
  activateVehicle: (vehicleId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminVehiclesQuery = {
  page: 1,
  limit: 10,
  search: "",
};

export const useVehicleFilters = (): UseVehicleFiltersResult => {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] = useState<AdminVehiclesQuery>({
    ...DEFAULT_FILTERS,
    search: initialSearch,
  });
  const [vehiclesData, setVehiclesData] = useState<AdminVehiclesResponse | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<AdminVehicleRecord | null>(null);

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getAdminVehicles({
        ...filters,
        search: filters.search?.trim() || undefined,
      });
      setVehiclesData(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load vehicles";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchVehicles();
  }, [fetchVehicles]);

  const setFilters = useCallback((next: Partial<AdminVehiclesQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.type !== undefined ||
              next.isActive !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<void>) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchVehicles();
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Operation failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchVehicles],
  );

  const suspendVehicle = useCallback(
    async (vehicleId: string) => {
      await withMutation(async () => {
        await adminService.suspendVehicle(vehicleId);
        // Update selected vehicle in-place if it's the one being suspended
        setSelectedVehicle((prev) =>
          prev?.id === vehicleId ? { ...prev, isActive: false } : prev,
        );
      });
    },
    [withMutation],
  );

  const activateVehicle = useCallback(
    async (vehicleId: string) => {
      await withMutation(async () => {
        await adminService.activateVehicle(vehicleId);
        setSelectedVehicle((prev) =>
          prev?.id === vehicleId ? { ...prev, isActive: true } : prev,
        );
      });
    },
    [withMutation],
  );

  return {
    isLoading,
    isMutating,
    error,
    vehiclesData,
    filters,
    selectedVehicle,
    setFilters,
    selectVehicle: setSelectedVehicle,
    clearSelectedVehicle: () => setSelectedVehicle(null),
    suspendVehicle,
    activateVehicle,
    refetch: fetchVehicles,
  };
};
