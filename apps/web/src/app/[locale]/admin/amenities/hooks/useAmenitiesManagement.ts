"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminAmenity,
  type AdminAmenityInput,
  type AdminAmenityQuery,
  type AdminAmenityResponse,
} from "@/lib/api";

interface UseAmenitiesManagementResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminAmenityQuery;
  amenitiesData: AdminAmenityResponse | null;
  selectedAmenity: AdminAmenity | null;
  setFilters: (next: Partial<AdminAmenityQuery>) => void;
  selectAmenity: (amenity: AdminAmenity | null) => void;
  createAmenity: (payload: AdminAmenityInput) => Promise<void>;
  updateAmenity: (amenityId: string, payload: Partial<AdminAmenityInput>) => Promise<void>;
  archiveAmenity: (amenityId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminAmenityQuery = {
  page: 1,
  limit: 20,
  search: "",
};

export const useAmenitiesManagement = (): UseAmenitiesManagementResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilterState] = useState<AdminAmenityQuery>(DEFAULT_FILTERS);
  const [amenitiesData, setAmenitiesData] = useState<AdminAmenityResponse | null>(null);
  const [selectedAmenity, setSelectedAmenity] = useState<AdminAmenity | null>(null);

  const fetchAmenities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getAmenities({
        ...filters,
        search: filters.search?.trim() || undefined,
      });

      setAmenitiesData(data);

      if (selectedAmenity) {
        const refreshed = data.items.find((item) => item.id === selectedAmenity.id) || null;
        setSelectedAmenity(refreshed);
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load amenities";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, selectedAmenity]);

  useEffect(() => {
    void fetchAmenities();
  }, [fetchAmenities]);

  const setFilters = useCallback((next: Partial<AdminAmenityQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined || next.includeInactive !== undefined
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
        await fetchAmenities();
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Amenity action failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchAmenities],
  );

  const createAmenity = useCallback<UseAmenitiesManagementResult["createAmenity"]>(
    async (payload) => {
      await withMutation(async () => {
        await adminService.createAmenity(payload);
      });
    },
    [withMutation],
  );

  const updateAmenity = useCallback<UseAmenitiesManagementResult["updateAmenity"]>(
    async (amenityId, payload) => {
      await withMutation(async () => {
        await adminService.updateAmenity(amenityId, payload);
      });
    },
    [withMutation],
  );

  const archiveAmenity = useCallback<UseAmenitiesManagementResult["archiveAmenity"]>(
    async (amenityId) => {
      await withMutation(async () => {
        await adminService.deleteAmenity(amenityId);
      });
    },
    [withMutation],
  );

  return {
    isLoading,
    isMutating,
    error,
    filters,
    amenitiesData,
    selectedAmenity,
    setFilters,
    selectAmenity: setSelectedAmenity,
    createAmenity,
    updateAmenity,
    archiveAmenity,
    refetch: fetchAmenities,
  };
};
