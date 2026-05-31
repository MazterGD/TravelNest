"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminService,
  type AdminAnalyticsDateQuery,
  type AdminBookingsAnalytics,
  type AdminFinancialAnalytics,
  type AdminGeographicAnalytics,
  type AdminOperationalAnalytics,
  type AdminUsersAnalytics,
} from "@/lib/api";

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

const defaultRange = (): AdminAnalyticsDateQuery => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

export interface UseAnalyticsDataResult {
  isLoading: boolean;
  isFetching: boolean;
  isMutating: boolean;
  error: string | null;
  dateRange: AdminAnalyticsDateQuery;
  usersAnalytics: AdminUsersAnalytics | null;
  bookingsAnalytics: AdminBookingsAnalytics | null;
  financialAnalytics: AdminFinancialAnalytics | null;
  operationalAnalytics: AdminOperationalAnalytics | null;
  geographicAnalytics: AdminGeographicAnalytics | null;
  setDateRange: (patch: Partial<AdminAnalyticsDateQuery>) => void;
  exportCsv: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useAnalyticsData = (): UseAnalyticsDataResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRangeState] =
    useState<AdminAnalyticsDateQuery>(defaultRange);

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

  // Promise.allSettled so a single failing endpoint never wipes all data
  const fetchAll = useCallback(async (range: AdminAnalyticsDateQuery) => {
    setError(null);
    const [users, bookings, financial, operational, geographic] =
      await Promise.allSettled([
        adminService.getUsersAnalytics(range),
        adminService.getBookingsAnalytics(range),
        adminService.getFinancialAnalytics(range),
        adminService.getOperationalAnalytics(range),
        adminService.getGeographicAnalytics(range),
      ]);

    if (users.status === "fulfilled") setUsersAnalytics(users.value);
    if (bookings.status === "fulfilled") setBookingsAnalytics(bookings.value);
    if (financial.status === "fulfilled") setFinancialAnalytics(financial.value);
    if (operational.status === "fulfilled")
      setOperationalAnalytics(operational.value);
    if (geographic.status === "fulfilled")
      setGeographicAnalytics(geographic.value);

    if (
      [users, bookings, financial, operational, geographic].every(
        (r) => r.status === "rejected",
      )
    ) {
      setError("Failed to load analytics data. Please refresh and try again.");
    }
  }, []);

  // Initial load — full skeleton
  useEffect(() => {
    setIsLoading(true);
    void fetchAll(dateRange).finally(() => setIsLoading(false));
    // fetchAll is stable; we intentionally capture the mount-time dateRange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Date range changes after mount — background refresh, keep existing data visible
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    setIsFetching(true);
    void fetchAll(dateRange).finally(() => setIsFetching(false));
  }, [dateRange.startDate, dateRange.endDate, fetchAll]);

  const refetch = useCallback(async () => {
    setIsFetching(true);
    try {
      await fetchAll(dateRange);
    } finally {
      setIsFetching(false);
    }
  }, [fetchAll, dateRange]);

  const setDateRange = useCallback(
    (patch: Partial<AdminAnalyticsDateQuery>) => {
      setDateRangeState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const exportCsv = useCallback(async () => {
    setIsMutating(true);
    try {
      await adminService.exportAnalyticsCsv(dateRange);
    } catch {
      setError("CSV export failed. Please try again.");
    } finally {
      setIsMutating(false);
    }
  }, [dateRange]);

  return {
    isLoading,
    isFetching,
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
    refetch,
  };
};
