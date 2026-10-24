/**
 * Admin analytics page: skeleton while loading, KPI band, metrics,
 * trends/distributions/geography, partial-failure tolerance, date presets
 * and CSV export.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getUsersAnalytics: vi.fn(),
    getBookingsAnalytics: vi.fn(),
    getFinancialAnalytics: vi.fn(),
    getOperationalAnalytics: vi.fn(),
    getGeographicAnalytics: vi.fn(),
    exportAnalyticsCsv: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminAnalyticsPage from "@/app/[locale]/admin/analytics/page";

const svc = adminService as any;
const ALL = [
  "getUsersAnalytics",
  "getBookingsAnalytics",
  "getFinancialAnalytics",
  "getOperationalAnalytics",
  "getGeographicAnalytics",
];

const fillData = () => {
  svc.getUsersAnalytics.mockResolvedValue({
    totalUsers: 1234,
    newUsersInRange: 56,
    growthSeries: Array.from({ length: 12 }, (_, i) => ({ date: `U-${i}`, value: i })),
    roleDistribution: [
      { role: "CUSTOMER", count: 75 },
      { role: "VEHICLE_OWNER", count: 25 },
    ],
  });
  svc.getBookingsAnalytics.mockResolvedValue({
    totalBookingsInRange: 80,
    completionRate: 62.5,
    cancellationRate: 7.25,
    grossBookingValue: 500000,
    averageBookingValue: 6250,
    bookingTrend: [{ date: "B-1", value: 4 }],
    statusDistribution: [
      { status: "COMPLETED", count: 0 },
      { status: "CANCELLED", count: 0 },
    ],
  });
  svc.getFinancialAnalytics.mockResolvedValue({
    grossRevenue: 400000,
    completedRevenue: 350000,
    netRevenue: 300000,
    refundedAmount: 10000,
    estimatedCommission: 35000,
    completedTrend: [{ date: "F-1", value: 12000 }],
  });
  svc.getOperationalAnalytics.mockResolvedValue({
    pendingVerificationItems: 9,
    pendingOwnerVerifications: 4,
    pendingOwnerDocuments: 3,
    pendingVehicleDocuments: 5,
    auditEventsInRange: 321,
    averagePaymentResolutionHours: 2.345,
  });
  svc.getGeographicAnalytics.mockResolvedValue({
    bookingsByPickupCity: [{ city: "Colombo", bookingCount: 40, totalAmount: 200000 }],
    topRoutes: [{ route: "Colombo → Kandy", count: 12 }],
  });
};

describe("AdminAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fillData();
    svc.exportAnalyticsCsv.mockResolvedValue(undefined);
  });

  it("shows a skeleton then the full analytics dashboard", async () => {
    render(<AdminAnalyticsPage />);
    expect(screen.queryByText("Analytics")).toBeNull();
    expect(await screen.findByText("Analytics")).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("+56 new this period")).toBeTruthy();
    expect(screen.getByText("62.5% completion rate")).toBeTruthy();
    expect(screen.getByText("7.3%")).toBeTruthy();
    expect(screen.getByText("4 owner · 5 vehicle")).toBeTruthy();
    expect(screen.getByText("2.3 hrs")).toBeTruthy();
    // trend keeps only the last 10 points
    expect(screen.queryByText("U-1")).toBeNull();
    expect(screen.getByText("U-11")).toBeTruthy();
    expect(screen.getByText("(75%)")).toBeTruthy();
    expect(screen.getByText("Colombo")).toBeTruthy();
    expect(screen.getByText("Colombo → Kandy")).toBeTruthy();
    expect(screen.getByText("12 bookings")).toBeTruthy();
    // zero-total distribution renders counts without percentages
    expect(screen.queryByText("(0%)")).toBeNull();
  });

  it("renders placeholders when every endpoint fails and retries", async () => {
    for (const fn of ALL) svc[fn].mockRejectedValue(new Error("down"));
    render(<AdminAnalyticsPage />);
    expect(
      await screen.findByText("Failed to load analytics data. Please refresh and try again."),
    ).toBeTruthy();
    expect(screen.getAllByText("—").length).toBe(4);
    expect(screen.getAllByText("No data available for this period.").length).toBe(3);
    expect(screen.getByText("No booking data available for this period.")).toBeTruthy();
    expect(screen.getByText("No user distribution data available.")).toBeTruthy();
    expect(screen.getByText("No geographic data available for this period.")).toBeTruthy();
    expect(screen.getByText("No route data available for this period.")).toBeTruthy();
    expect(screen.getByText("0.0 hrs")).toBeTruthy();

    fillData();
    await act(async () => fireEvent.click(screen.getByLabelText("Retry loading analytics")));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByText("1,234")).toBeTruthy();
  });

  it("keeps partial data when some endpoints fail", async () => {
    svc.getFinancialAnalytics.mockRejectedValue(new Error("x"));
    svc.getOperationalAnalytics.mockResolvedValue({
      pendingVerificationItems: 0,
      pendingOwnerVerifications: 0,
      pendingOwnerDocuments: 0,
      pendingVehicleDocuments: 0,
      auditEventsInRange: 0,
      averagePaymentResolutionHours: 0,
    });
    svc.getUsersAnalytics.mockResolvedValue({
      totalUsers: 5,
      newUsersInRange: 0,
      growthSeries: [],
      roleDistribution: [],
    });
    render(<AdminAnalyticsPage />);
    expect(await screen.findByText("5")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/new this period/)).toBeNull();
    expect(screen.getByText("Completed Revenue", { selector: "p" })).toBeTruthy();
  });

  it("refetches when dates change and when presets are applied", async () => {
    render(<AdminAnalyticsPage />);
    await screen.findByText("Analytics");
    expect(svc.getUsersAnalytics).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-01-01" } });
    await waitFor(() =>
      expect(svc.getUsersAnalytics).toHaveBeenLastCalledWith(
        expect.objectContaining({ startDate: "2026-01-01" }),
      ),
    );
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-01-31" } });
    await waitFor(() =>
      expect(svc.getUsersAnalytics).toHaveBeenLastCalledWith({ startDate: "2026-01-01", endDate: "2026-01-31" }),
    );

    const presets = within(screen.getByRole("group", { name: "Date range presets" }));
    const today = new Date().toISOString().slice(0, 10);
    for (const label of ["Last 7 days", "Last 90 days", "Last year", "Last 30 days"]) {
      const before = svc.getUsersAnalytics.mock.calls.length;
      fireEvent.click(presets.getByText(label));
      await waitFor(() => expect(svc.getUsersAnalytics.mock.calls.length).toBeGreaterThan(before));
      expect(svc.getUsersAnalytics.mock.calls.at(-1)[0].endDate).toBe(today);
    }

    await act(async () => fireEvent.click(screen.getByLabelText("Refresh analytics data")));
    expect(svc.getGeographicAnalytics.mock.calls.length).toBeGreaterThan(5);
  });

  it("exports CSV for the current range and reports failures", async () => {
    render(<AdminAnalyticsPage />);
    await screen.findByText("Analytics");
    await act(async () => fireEvent.click(screen.getByLabelText("Export analytics data as CSV")));
    expect(svc.exportAnalyticsCsv).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }),
    );
    svc.exportAnalyticsCsv.mockRejectedValueOnce(new Error("x"));
    await act(async () => fireEvent.click(screen.getByLabelText("Export analytics data as CSV")));
    expect(await screen.findByText("CSV export failed. Please try again.")).toBeTruthy();
  });
});
