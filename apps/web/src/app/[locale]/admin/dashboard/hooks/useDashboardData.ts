"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminService,
  type AdminActivityEvent,
  type AdminBookingTrendPoint,
  type AdminDashboardOverview,
  type AdminPendingAction,
  type AdminRevenueChartPoint,
  type AdminUserGrowthChartPoint,
} from "@/lib/api";

interface UseDashboardDataResult {
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  overview: AdminDashboardOverview | null;
  revenueChart: AdminRevenueChartPoint[];
  userGrowthChart: AdminUserGrowthChartPoint[];
  bookingTrendsChart: AdminBookingTrendPoint[];
  activityFeed: AdminActivityEvent[];
  pendingActions: AdminPendingAction[];
  refetch: () => Promise<void>;
}

export const useDashboardData = (months = 6): UseDashboardDataResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [revenueChart, setRevenueChart] = useState<AdminRevenueChartPoint[]>([]);
  const [userGrowthChart, setUserGrowthChart] = useState<AdminUserGrowthChartPoint[]>([]);
  const [bookingTrendsChart, setBookingTrendsChart] = useState<AdminBookingTrendPoint[]>([]);
  const [activityFeed, setActivityFeed] = useState<AdminActivityEvent[]>([]);
  const [pendingActions, setPendingActions] = useState<AdminPendingAction[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const hasFetchedOnce = useRef(false);

  const fetchDashboardData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isInitialLoad = !hasFetchedOnce.current;
    if (isInitialLoad) setIsLoading(true);
    setIsFetching(true);
    setError(null);

    try {
      const [
        overviewData,
        revenueData,
        usersData,
        bookingsData,
        activityData,
        pendingData,
      ] = await Promise.all([
        adminService.getDashboardOverview(),
        adminService.getRevenueChart(months),
        adminService.getUserGrowthChart(months),
        adminService.getBookingTrendsChart(months),
        adminService.getActivityFeed(15),
        adminService.getPendingActions(),
      ]);

      if (controller.signal.aborted) return;

      setOverview(overviewData);
      setRevenueChart(revenueData);
      setUserGrowthChart(usersData);
      setBookingTrendsChart(bookingsData);
      setActivityFeed(activityData);
      setPendingActions(pendingData);
      hasFetchedOnce.current = true;
    } catch (fetchError) {
      if (controller.signal.aborted) return;
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load dashboard data",
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [months]);

  useEffect(() => {
    void fetchDashboardData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchDashboardData]);

  return {
    isLoading,
    isFetching,
    error,
    overview,
    revenueChart,
    userGrowthChart,
    bookingTrendsChart,
    activityFeed,
    pendingActions,
    refetch: fetchDashboardData,
  };
};
