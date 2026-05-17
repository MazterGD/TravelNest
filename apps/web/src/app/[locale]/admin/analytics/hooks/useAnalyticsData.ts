"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminService,
  type AdminAnalyticsDateQuery,
  type AdminBookingsAnalytics,
  type AdminFinancialAnalytics,
  type AdminGeographicAnalytics,
  type AdminOperationalAnalytics,
  type AdminUsersAnalytics,
} from "@/lib/api";

interface UseAnalyticsDataResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  usersAnalytics: AdminUsersAnalytics | null;
  bookingsAnalytics: AdminBookingsAnalytics | null;
  financialAnalytics: AdminFinancialAnalytics | null;
  operationalAnalytics: AdminOperationalAnalytics | null;
  geographicAnalytics: AdminGeographicAnalytics | null;
  setDateRange: (next: Partial<{ startDate: string; endDate: string }>) => void;
  exportCsv: () => Promise<void>;
  refetch: () => Promise<void>;
}

const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
};

export const useAnalyticsData = (): UseAnalyticsDataResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRangeState] =
    useState<UseAnalyticsDataResult["dateRange"]>(getDefaultDateRange);

  const [usersAnalytics, setUsersAnalytics] =
    useState<AdminUsersAnalytics | null>(null);
  const [bookingsAnalytics, setBookingsAnalytics] =
    useState<AdminBookingsAnalytics | null>(null);
  const [financialAnalytics, setFinancialAnalytics] =
    useState<AdminFinancialAnalytics | null>(null);
  const [operationalAnalytics, setOperationalAnalytics] =
    useState<AdminOperationalAnalytics | null>(null);
  const [geographicAnalytics, setGeographicAnalytics] =
    useState<AdminGeographicAnalytics | null>(null);

  const query = useMemo<AdminAnalyticsDateQuery>(
    () => ({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    [dateRange.endDate, dateRange.startDate],
  );

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [users, bookings, financial, operational, geographic] =
        await Promise.all([
          adminService.getUsersAnalytics(query),
          adminService.getBookingsAnalytics(query),
          adminService.getFinancialAnalytics(query),
          adminService.getOperationalAnalytics(query),
          adminService.getGeographicAnalytics(query),
        ]);

      setUsersAnalytics(users);
      setBookingsAnalytics(bookings);
      setFinancialAnalytics(financial);
      setOperationalAnalytics(operational);
      setGeographicAnalytics(geographic);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load analytics data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const setDateRange = useCallback(
    (next: Partial<{ startDate: string; endDate: string }>) => {
      setDateRangeState((previous) => ({
        ...previous,
        ...next,
      }));
    },
    [],
  );

  const exportCsv = useCallback(async () => {
    setIsMutating(true);
    setError(null);

    try {
      await adminService.exportAnalyticsCsv(query);
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "Failed to export analytics CSV";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, [query]);

  return {
    isLoading,
    isMutating,
    error,
    dateRange,
    usersAnalytics,
    bookingsAnalytics,
    financialAnalytics,
    operationalAnalytics,
    geographicAnalytics,
    setDateRange,
    exportCsv,
    refetch: fetchAnalytics,
  };
};
