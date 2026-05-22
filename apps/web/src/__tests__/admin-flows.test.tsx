import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  adminService: {
    getDashboardOverview: vi.fn(),
    getRevenueChart: vi.fn(),
    getUserGrowthChart: vi.fn(),
    getBookingTrendsChart: vi.fn(),
    getActivityFeed: vi.fn(),
    getPendingActions: vi.fn(),
    getUsers: vi.fn(),
    getUserById: vi.fn(),
    getUserActivity: vi.fn(),
    updateUserStatus: vi.fn(),
    resetUserPassword: vi.fn(),
    deleteUser: vi.fn(),
    createAdmin: vi.fn(),
    exportUsersCsv: vi.fn(),
    getBookings: vi.fn(),
    getBookingById: vi.fn(),
    updateBookingStatus: vi.fn(),
    cancelBookingWithRefund: vi.fn(),
    exportBookingsCsv: vi.fn(),
    getUsersAnalytics: vi.fn(),
    getBookingsAnalytics: vi.fn(),
    getFinancialAnalytics: vi.fn(),
    getOperationalAnalytics: vi.fn(),
    getGeographicAnalytics: vi.fn(),
    exportAnalyticsCsv: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import { useDashboardData } from "@/app/[locale]/admin/dashboard/hooks/useDashboardData";
import { useUserFilters } from "@/app/[locale]/admin/users/hooks/useUserFilters";
import { useBookingManagement } from "@/app/[locale]/admin/bookings/hooks/useBookingManagement";
import { useAnalyticsData } from "@/app/[locale]/admin/analytics/hooks/useAnalyticsData";

const setupAdminServiceMocks = () => {
  vi.clearAllMocks();

  (adminService.getUsers as any).mockResolvedValue({
    users: [
      {
        id: "user-1",
        firstName: "Test",
        lastName: "User",
        email: "user@example.com",
        phone: "+94770000000",
        role: "CUSTOMER",
        status: "ACTIVE",
        adminRole: null,
        isVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: {
          bookings: 2,
          reviews: 1,
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.getUserById as any).mockResolvedValue({
    id: "user-1",
    firstName: "Test",
    lastName: "User",
    email: "user@example.com",
    phone: "+94770000000",
    role: "CUSTOMER",
    status: "ACTIVE",
    adminRole: null,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    address: null,
    city: null,
    district: "Colombo",
    postalCode: null,
    baseLocation: null,
    avatar: null,
    _count: {
      bookings: 2,
      reviews: 1,
      notifications: 0,
    },
  });

  (adminService.getUserActivity as any).mockResolvedValue({
    logs: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  (adminService.updateUserStatus as any).mockResolvedValue({
    id: "user-1",
    status: "SUSPENDED",
  });
  (adminService.resetUserPassword as any).mockResolvedValue({ success: true });
  (adminService.deleteUser as any).mockResolvedValue({ id: "user-1", deleted: true });
  (adminService.createAdmin as any).mockResolvedValue({ id: "admin-2" });
  (adminService.exportUsersCsv as any).mockResolvedValue(undefined);

  (adminService.getBookings as any).mockResolvedValue({
    bookings: [
      {
        id: "booking-1",
        customerId: "customer-1",
        vehicleId: "vehicle-1",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pickupLocation: "Colombo, Sri Lanka",
        dropoffLocation: "Kandy, Sri Lanka",
        totalPassengers: 20,
        totalAmount: 45000,
        status: "PENDING",
        cancelReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: {
          id: "customer-1",
          firstName: "Customer",
          lastName: "One",
          email: "customer@example.com",
          phone: null,
        },
        vehicle: {
          id: "vehicle-1",
          name: "Coach",
          licensePlate: "ABC-1234",
          type: "ORDINARY",
          owner: {
            id: "owner-1",
            firstName: "Owner",
            lastName: "One",
            email: "owner@example.com",
          },
        },
        payment: {
          id: "payment-1",
          amount: 45000,
          status: "COMPLETED",
          method: "BANK_TRANSFER",
          refundAmount: null,
          createdAt: new Date().toISOString(),
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.getBookingById as any).mockResolvedValue({
    id: "booking-1",
    customer: { firstName: "Customer", lastName: "One" },
    pickupLocation: "Colombo, Sri Lanka",
    dropoffLocation: "Kandy, Sri Lanka",
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    totalAmount: 45000,
    payment: {
      status: "COMPLETED",
      amount: 45000,
    },
  });

  (adminService.updateBookingStatus as any).mockResolvedValue({ id: "booking-1" });
  (adminService.cancelBookingWithRefund as any).mockResolvedValue({
    booking: { id: "booking-1", status: "CANCELLED" },
  });
  (adminService.exportBookingsCsv as any).mockResolvedValue(undefined);

  (adminService.getUsersAnalytics as any).mockResolvedValue({
    dateRange: { startDate: "2025-01-01", endDate: "2025-01-31" },
    totalUsers: 10,
    newUsersInRange: 3,
    roleDistribution: [{ role: "CUSTOMER", count: 8 }],
    statusDistribution: [{ status: "ACTIVE", count: 10 }],
    growthSeries: [{ date: "2025-01-01", value: 1 }],
  });

  (adminService.getBookingsAnalytics as any).mockResolvedValue({
    dateRange: { startDate: "2025-01-01", endDate: "2025-01-31" },
    totalBookingsInRange: 5,
    completionRate: 80,
    cancellationRate: 20,
    averageBookingValue: 20000,
    grossBookingValue: 100000,
    statusDistribution: [{ status: "COMPLETED", count: 4 }],
    bookingTrend: [{ date: "2025-01-01", value: 1 }],
    completedTrend: [{ date: "2025-01-01", value: 1 }],
  });

  (adminService.getFinancialAnalytics as any).mockResolvedValue({
    dateRange: { startDate: "2025-01-01", endDate: "2025-01-31" },
    grossRevenue: 100000,
    completedRevenue: 90000,
    netRevenue: 85000,
    refundedAmount: 5000,
    estimatedCommission: 9000,
    paymentStatusDistribution: [],
    completedTrend: [{ date: "2025-01-01", value: 1 }],
    refundedTrend: [{ date: "2025-01-01", value: 0 }],
  });

  (adminService.getOperationalAnalytics as any).mockResolvedValue({
    dateRange: { startDate: "2025-01-01", endDate: "2025-01-31" },
    pendingOwnerVerifications: 2,
    pendingOwnerDocuments: 1,
    pendingVehicleDocuments: 1,
    pendingVerificationItems: 2,
    auditEventsInRange: 4,
    averagePaymentResolutionHours: 5,
  });

  (adminService.getGeographicAnalytics as any).mockResolvedValue({
    dateRange: { startDate: "2025-01-01", endDate: "2025-01-31" },
    bookingsByPickupCity: [{ city: "Colombo", bookingCount: 3, totalAmount: 60000 }],
    usersByDistrict: [{ district: "Colombo", count: 4 }],
    topRoutes: [{ route: "Colombo -> Kandy", count: 2 }],
  });

  (adminService.exportAnalyticsCsv as any).mockResolvedValue(undefined);

  (adminService.getDashboardOverview as any).mockResolvedValue({
    users: {
      total: 10,
      active: 9,
      owners: 3,
      verifiedOwners: 2,
      ownerVerificationRate: 66.67,
    },
    vehicles: {
      total: 8,
      active: 7,
    },
    bookings: {
      total: 12,
      pending: 2,
      completed: 9,
      completionRate: 75,
    },
    finance: {
      totalRevenue: 250000,
      successfulPaymentCount: 9,
      failedPaymentCount: 1,
    },
  });

  (adminService.getRevenueChart as any).mockResolvedValue([
    { month: "Jan 2025", key: "2025-01", revenue: 100000, bookings: 4 },
  ]);
  (adminService.getUserGrowthChart as any).mockResolvedValue([
    { month: "Jan 2025", key: "2025-01", total: 4, customers: 3, owners: 1, admins: 0 },
  ]);
  (adminService.getBookingTrendsChart as any).mockResolvedValue([
    {
      month: "Jan 2025",
      key: "2025-01",
      total: 5,
      pending: 1,
      confirmed: 1,
      ongoing: 1,
      completed: 2,
      cancelled: 0,
    },
  ]);
  (adminService.getActivityFeed as any).mockResolvedValue([
    {
      id: "event-1",
      type: "booking",
      title: "Booking created",
      description: "A booking was created",
      timestamp: new Date().toISOString(),
    },
  ]);
  (adminService.getPendingActions as any).mockResolvedValue([
    {
      id: "pending-1",
      title: "Owner verification approvals",
      count: 3,
      href: "/admin/verifications/owners",
      severity: "medium",
    },
  ]);
};

describe("Admin frontend flow hooks", () => {
  beforeEach(() => {
    setupAdminServiceMocks();
  });

  it("loads and mutates user management data", async () => {
    const { result } = renderHook(() => useUserFilters());

    await waitFor(() => {
      expect(result.current.usersData?.users[0]?.id).toBe("user-1");
    });

    await act(async () => {
      await result.current.loadUserDetails("user-1");
    });

    expect(adminService.getUserById).toHaveBeenCalledWith("user-1");
    expect(adminService.getUserActivity).toHaveBeenCalledWith("user-1", {
      page: 1,
      limit: 10,
    });

    await act(async () => {
      await result.current.updateUserStatus("user-1", "SUSPENDED", "Policy breach");
    });

    expect(adminService.updateUserStatus).toHaveBeenCalledWith(
      "user-1",
      "SUSPENDED",
      "Policy breach",
    );
    expect((adminService.getUsers as any).mock.calls.length).toBeGreaterThan(1);

    act(() => {
      result.current.setFilters({ page: 3 });
    });
    expect(result.current.filters.page).toBe(3);

    act(() => {
      result.current.setFilters({ search: "new search" });
    });
    expect(result.current.filters.page).toBe(1);

    await act(async () => {
      await result.current.exportUsersCsv();
    });
    expect(adminService.exportUsersCsv).toHaveBeenCalled();
  });

  it("loads bookings and executes booking actions", async () => {
    const { result } = renderHook(() => useBookingManagement());

    await waitFor(() => {
      expect(result.current.bookingsData?.bookings[0]?.id).toBe("booking-1");
    });

    await act(async () => {
      await result.current.loadBookingDetails("booking-1");
    });
    expect(adminService.getBookingById).toHaveBeenCalledWith("booking-1");

    await act(async () => {
      await result.current.updateBookingStatus("booking-1", "CONFIRMED", "Checked");
    });
    expect(adminService.updateBookingStatus).toHaveBeenCalledWith(
      "booking-1",
      "CONFIRMED",
      "Checked",
    );

    await act(async () => {
      await result.current.cancelWithRefund("booking-1", "Customer request", 20000);
    });
    expect(adminService.cancelBookingWithRefund).toHaveBeenCalledWith(
      "booking-1",
      "Customer request",
      20000,
    );

    await act(async () => {
      await result.current.exportBookingsCsv();
    });
    expect(adminService.exportBookingsCsv).toHaveBeenCalled();
  });

  it("loads analytics data, supports date changes, and exports", async () => {
    const { result } = renderHook(() => useAnalyticsData());

    await waitFor(() => {
      expect(adminService.getUsersAnalytics).toHaveBeenCalledTimes(1);
      expect(adminService.getBookingsAnalytics).toHaveBeenCalledTimes(1);
      expect(adminService.getFinancialAnalytics).toHaveBeenCalledTimes(1);
      expect(adminService.getOperationalAnalytics).toHaveBeenCalledTimes(1);
      expect(adminService.getGeographicAnalytics).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setDateRange({
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });
    });

    await waitFor(() => {
      expect(adminService.getUsersAnalytics).toHaveBeenCalledWith({
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });
    });

    await act(async () => {
      await result.current.exportCsv();
    });

    expect(adminService.exportAnalyticsCsv).toHaveBeenCalledWith({
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    });
  });

  it("loads dashboard flow data with the configured month window", async () => {
    const { result } = renderHook(() => useDashboardData(4));

    await waitFor(() => {
      expect(adminService.getDashboardOverview).toHaveBeenCalledTimes(1);
    });

    expect(adminService.getRevenueChart).toHaveBeenCalledWith(4);
    expect(adminService.getUserGrowthChart).toHaveBeenCalledWith(4);
    expect(adminService.getBookingTrendsChart).toHaveBeenCalledWith(4);
    expect(adminService.getActivityFeed).toHaveBeenCalledWith(15);
    expect(adminService.getPendingActions).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.overview?.users.total).toBe(10);
      expect(result.current.activityFeed.length).toBe(1);
      expect(result.current.pendingActions.length).toBe(1);
    });
  });
});
