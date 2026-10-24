/**
 * Admin dashboard: skeleton, hard error with retry, pending action deep
 * links, KPI band, activity feed overflow link and trend bars.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => "en",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getDashboardOverview: vi.fn(),
    getRevenueChart: vi.fn(),
    getUserGrowthChart: vi.fn(),
    getBookingTrendsChart: vi.fn(),
    getActivityFeed: vi.fn(),
    getPendingActions: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminDashboardPage from "@/app/[locale]/admin/dashboard/page";

const svc = adminService as any;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

const overview = (overrides: Record<string, unknown> = {}) => ({
  users: { total: 120, owners: 10, verifiedOwners: 7 },
  vehicles: { total: 30, active: 25 },
  bookings: { total: 80, pending: 4, completionRate: 75 },
  finance: { totalRevenue: 1500000, successfulPaymentCount: 60, failedPaymentCount: 2 },
  ...overrides,
});

const setup = () => {
  svc.getDashboardOverview.mockResolvedValue(overview());
  svc.getRevenueChart.mockResolvedValue([{ month: "2026-09", revenue: 250000 }]);
  svc.getUserGrowthChart.mockResolvedValue([{ month: "2026-09", total: 40 }]);
  svc.getBookingTrendsChart.mockResolvedValue([{ month: "2026-08", total: 12 }]);
  svc.getActivityFeed.mockResolvedValue(
    Array.from({ length: 6 }, (_, i) => ({
      id: `ev-${i}`,
      title: `Event ${i}`,
      description: `Description ${i}`,
      type: ["booking", "user", "audit"][i % 3],
      timestamp: minutesAgo([5, 120, 3000, 10, 10, 10][i]),
    })),
  );
  svc.getPendingActions.mockResolvedValue([
    { id: "owner-approvals", title: "Owner approvals", count: 3, severity: "high", href: "/admin/verifications/owners" },
    { id: "pending-bookings", title: "Pending bookings", count: 4, severity: "medium", href: "/admin/bookings" },
    { id: "custom", title: "Custom", count: 1, severity: "low", href: "/admin/reports" },
  ]);
};

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it("requests six months of data and renders all sections", async () => {
    render(<AdminDashboardPage />);
    expect(await screen.findByText("Owner approvals")).toBeTruthy();
    expect(svc.getRevenueChart).toHaveBeenCalledWith(6);
    expect(svc.getActivityFeed).toHaveBeenCalledWith(15);

    expect(screen.getByText("Owner approvals").closest("a")?.getAttribute("href")).toBe(
      "/en/admin/verifications/owners?status=PENDING_VERIFICATION",
    );
    expect(screen.getByText("Pending bookings").closest("a")?.getAttribute("href")).toBe(
      "/en/admin/bookings?status=PENDING",
    );
    expect(screen.getByText("Custom").closest("a")?.getAttribute("href")).toBe("/en/admin/reports");

    expect(screen.getByText('kpi.subStat.verifiedOwners:{"verified":7,"total":10}')).toBeTruthy();
    expect(screen.getByText('kpi.subStat.pendingBookings:{"count":4}')).toBeTruthy();
    expect(screen.getByText("Event 0")).toBeTruthy();
    expect(screen.queryByText("Event 5")).toBeNull();
    expect(screen.getByText("5m ago")).toBeTruthy();
    expect(screen.getByText("2h ago")).toBeTruthy();
    expect(screen.getByText("2d ago")).toBeTruthy();
    expect(screen.getByText("viewAllActivity").closest("a")?.getAttribute("href")).toBe("/en/admin/audit-logs");
    expect(screen.getByText("2026-08")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
  });

  it("shows empty sections when there is nothing to act on", async () => {
    svc.getDashboardOverview.mockResolvedValue(overview({ bookings: { total: 0, pending: 0, completionRate: 0 } }));
    svc.getActivityFeed.mockResolvedValue([]);
    svc.getPendingActions.mockResolvedValue([]);
    svc.getRevenueChart.mockResolvedValue([]);
    svc.getUserGrowthChart.mockResolvedValue([]);
    svc.getBookingTrendsChart.mockResolvedValue([]);
    render(<AdminDashboardPage />);
    expect(await screen.findByText("sections.pendingEmpty")).toBeTruthy();
    expect(screen.getByText("sections.activityEmpty")).toBeTruthy();
    expect(screen.getAllByText("charts.empty").length).toBe(3);
    expect(screen.queryByText("viewAllActivity")).toBeNull();
    expect(screen.queryByText(/pendingBookings/)).toBeNull();
  });

  it("shows a hard error with retry when the first load fails", async () => {
    svc.getDashboardOverview.mockRejectedValueOnce(new Error("Gateway timeout"));
    render(<AdminDashboardPage />);
    expect(await screen.findByText("Gateway timeout")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByLabelText("ariaRefresh")));
    expect(await screen.findByText("Owner approvals")).toBeTruthy();
  });

  it("uses a generic error message for non-Error failures", async () => {
    svc.getPendingActions.mockRejectedValueOnce("nope");
    render(<AdminDashboardPage />);
    expect(await screen.findByText("Failed to load dashboard data")).toBeTruthy();
  });

  it("keeps stale data with a soft error banner when a refresh fails", async () => {
    render(<AdminDashboardPage />);
    await screen.findByText("Owner approvals");
    svc.getDashboardOverview.mockRejectedValueOnce(new Error("Refresh failed"));
    await act(async () => fireEvent.click(screen.getByText("refresh")));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Refresh failed")).toBeTruthy();
    expect(screen.getByText("Owner approvals")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("retry")));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
