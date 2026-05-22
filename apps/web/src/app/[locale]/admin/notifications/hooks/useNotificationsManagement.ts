"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminPlatformNotificationAnalyticsResponse,
  type AdminPlatformNotificationCreateInput,
  type AdminPlatformNotificationCreateResponse,
  type AdminPlatformNotificationQuery,
  type AdminPlatformNotificationResendInput,
  type AdminPlatformNotificationResponse,
} from "@/lib/api";

interface UseNotificationsManagementResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminPlatformNotificationQuery;
  notificationsData: AdminPlatformNotificationResponse | null;
  selectedAnalytics: AdminPlatformNotificationAnalyticsResponse | null;
  setFilters: (next: Partial<AdminPlatformNotificationQuery>) => void;
  loadAnalytics: (notificationId: string) => Promise<void>;
  createNotification: (
    payload: AdminPlatformNotificationCreateInput,
  ) => Promise<AdminPlatformNotificationCreateResponse | null>;
  resendNotification: (
    notificationId: string,
    payload: AdminPlatformNotificationResendInput,
  ) => Promise<AdminPlatformNotificationCreateResponse | null>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminPlatformNotificationQuery = {
  page: 1,
  limit: 20,
  search: "",
};

export const useNotificationsManagement = (): UseNotificationsManagementResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilterState] =
    useState<AdminPlatformNotificationQuery>(DEFAULT_FILTERS);
  const [notificationsData, setNotificationsData] =
    useState<AdminPlatformNotificationResponse | null>(null);
  const [selectedAnalytics, setSelectedAnalytics] =
    useState<AdminPlatformNotificationAnalyticsResponse | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getPlatformNotifications({
        ...filters,
        search: filters.search?.trim() || undefined,
      });

      setNotificationsData(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load notifications";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const setFilters = useCallback((next: Partial<AdminPlatformNotificationQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.status !== undefined ||
              next.channel !== undefined ||
              next.targetRole !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const loadAnalytics = useCallback(async (notificationId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const analytics = await adminService.getPlatformNotificationAnalytics(notificationId);
      setSelectedAnalytics(analytics);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load notification analytics";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const createNotification = useCallback<
    UseNotificationsManagementResult["createNotification"]
  >(
    async (payload) => {
      setIsMutating(true);
      setError(null);

      try {
        const created = await adminService.createPlatformNotification(payload);
        await fetchNotifications();
        return created;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Failed to create notification";
        setError(message);
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchNotifications],
  );

  const resendNotification = useCallback<
    UseNotificationsManagementResult["resendNotification"]
  >(
    async (notificationId, payload) => {
      setIsMutating(true);
      setError(null);

      try {
        const resent = await adminService.resendPlatformNotification(
          notificationId,
          payload,
        );
        await fetchNotifications();

        if (selectedAnalytics?.notification.id === notificationId) {
          const analytics = await adminService.getPlatformNotificationAnalytics(notificationId);
          setSelectedAnalytics(analytics);
        }

        return resent;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Failed to resend notification";
        setError(message);
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchNotifications, selectedAnalytics?.notification.id],
  );

  return {
    isLoading,
    isMutating,
    error,
    filters,
    notificationsData,
    selectedAnalytics,
    setFilters,
    loadAnalytics,
    createNotification,
    resendNotification,
    refetch: fetchNotifications,
  };
};
