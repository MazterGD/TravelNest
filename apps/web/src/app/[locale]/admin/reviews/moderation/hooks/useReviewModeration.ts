"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminService,
  type AdminReviewModerationDetails,
  type AdminReviewModerationQuery,
  type AdminReviewModerationResponse,
  type AdminReviewModerationStatus,
  type AdminReviewReportResolutionStatus,
} from "@/lib/api";

interface UseReviewModerationResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminReviewModerationQuery;
  queueData: AdminReviewModerationResponse | null;
  selectedReview: AdminReviewModerationDetails | null;
  setFilters: (next: Partial<AdminReviewModerationQuery>) => void;
  loadReviewDetails: (reviewId: string) => Promise<void>;
  updateModerationStatus: (
    reviewId: string,
    status: AdminReviewModerationStatus,
    reason?: string,
  ) => Promise<void>;
  resolveReport: (
    reviewId: string,
    status: AdminReviewReportResolutionStatus,
    resolution: string,
  ) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminReviewModerationQuery = {
  page: 1,
  limit: 20,
  search: "",
  flaggedOnly: true,
};

export const useReviewModeration = (): UseReviewModerationResult => {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const rawFlaggedOnly = searchParams.get("flaggedOnly");
  const initialFlaggedOnly = rawFlaggedOnly !== null ? rawFlaggedOnly !== "false" : DEFAULT_FILTERS.flaggedOnly;

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] = useState<AdminReviewModerationQuery>({
    ...DEFAULT_FILTERS,
    search: initialSearch,
    flaggedOnly: initialFlaggedOnly,
  });
  const [queueData, setQueueData] =
    useState<AdminReviewModerationResponse | null>(null);
  const [selectedReview, setSelectedReview] =
    useState<AdminReviewModerationDetails | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getReviewModerationQueue({
        ...filters,
        search: filters.search?.trim() || undefined,
      });

      setQueueData(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load review moderation queue";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const setFilters = useCallback((next: Partial<AdminReviewModerationQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.status !== undefined ||
              next.flaggedOnly !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const loadReviewDetails = useCallback(async (reviewId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const review = await adminService.getReviewModerationById(reviewId);
      setSelectedReview(review);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load review details";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<void>, reviewId?: string) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchQueue();

        if (reviewId && selectedReview?.id === reviewId) {
          await loadReviewDetails(reviewId);
        }
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Moderation action failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQueue, loadReviewDetails, selectedReview?.id],
  );

  const updateModerationStatus = useCallback<
    UseReviewModerationResult["updateModerationStatus"]
  >(
    async (reviewId, status, reason) => {
      await withMutation(async () => {
        await adminService.updateReviewModerationStatus(reviewId, status, reason);
      }, reviewId);
    },
    [withMutation],
  );

  const resolveReport = useCallback<UseReviewModerationResult["resolveReport"]>(
    async (reviewId, status, resolution) => {
      await withMutation(async () => {
        await adminService.resolveReviewReport(reviewId, status, resolution);
      }, reviewId);
    },
    [withMutation],
  );

  return {
    isLoading,
    isMutating,
    error,
    filters,
    queueData,
    selectedReview,
    setFilters,
    loadReviewDetails,
    updateModerationStatus,
    resolveReport,
    refetch: fetchQueue,
  };
};
