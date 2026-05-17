"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [revenueChart, setRevenueChart] = useState<AdminRevenueChartPoint[]>([]);
  const [userGrowthChart, setUserGrowthChart] = useState<AdminUserGrowthChartPoint[]>([]);
  const [bookingTrendsChart, setBookingTrendsChart] = useState<AdminBookingTrendPoint[]>([]);
  const [activityFeed, setActivityFeed] = useState<AdminActivityEvent[]>([]);
  const [pendingActions, setPendingActions] = useState<AdminPendingAction[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
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

      setOverview(overviewData);
      setRevenueChart(revenueData);
      setUserGrowthChart(usersData);
      setBookingTrendsChart(bookingsData);
      setActivityFeed(activityData);
      setPendingActions(pendingData);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load dashboard data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [months]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    isLoading,
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
