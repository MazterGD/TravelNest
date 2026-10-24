/**
 * Owner analytics page: KPI overview (growth up/down), revenue and booking
 * charts with empty states, vehicle performance table and the per-vehicle
 * analytics modal (keyboard open, booking history, Escape/backdrop close).
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  reducedMotion: false,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/analytics",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => state.t, useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks", () => ({ useOwnerGuard: () => state.guard }));
vi.mock("@/components/ui/LoadingSpinner", () => ({ LoadingSpinner: () => <div data-testid="spinner" /> }));
// Plain elements keep modal open/close synchronous in jsdom.
vi.mock("motion/react", () => {
  const strip = ({ initial, animate, exit, variants, transition, ...rest }: any) => rest;
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => state.reducedMotion,
    motion: { div: (props: any) => <div {...strip(props)} /> },
  };
});
vi.mock("recharts", () => {
  const Pass = ({ children }: any) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Area: () => null,
    Bar: () => null,
    XAxis: () => null,
    YAxis: ({ tickFormatter }: any) =>
      tickFormatter ? <span data-testid="y-ticks">{[900, 15000].map((v) => tickFormatter(v)).join(",")}</span> : null,
    CartesianGrid: () => null,
    Tooltip: ({ content }: any) => (
      <div data-testid="tooltip">
        {content({ active: true, payload: [{ value: 4200 }], label: "Sep" })}
        {content({ active: false, payload: [] })}
      </div>
    ),
  };
});
vi.mock("@/lib/api", () => ({
  ownerService: {
    getAnalyticsOverview: vi.fn(),
    getAnalyticsRevenue: vi.fn(),
    getAnalyticsVehicles: vi.fn(),
    getAnalyticsVehicleBookings: vi.fn(),
  },
}));

import { ownerService } from "@/lib/api";
import OwnerAnalyticsPage from "@/app/[locale]/owner/analytics/page";

const owner = ownerService as any;
const now = "2026-10-01T10:00:00.000Z";

const overview = (overrides: Record<string, unknown> = {}) => ({
  totalRevenue: 500000,
  thisMonthRevenue: 80000,
  revenueGrowth: 12,
  totalBookings: 20,
  completedBookings: 15,
  completionRate: 75,
  totalVehicles: 3,
  activeVehicles: 2,
  fleetUtilization: 66,
  averageRating: 4.6,
  ...overrides,
});

const vehicleRows = [
  { id: "veh-1", name: "Lanka Cruiser", isActive: true, totalBookings: 8, completedBookings: 6, revenue: 300000, averageRating: 4.4, reviewCount: 5 },
  { id: "veh-2", name: "Hill Rider", isActive: false, totalBookings: 0, completedBookings: 0, revenue: 0, averageRating: 0, reviewCount: 0 },
];

describe("OwnerAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.reducedMotion = false;
    owner.getAnalyticsOverview.mockResolvedValue(overview());
    owner.getAnalyticsRevenue.mockResolvedValue([
      { month: "Aug", revenue: 0, bookings: 0 },
      { month: "Sep", revenue: 80000, bookings: 3 },
    ]);
    owner.getAnalyticsVehicles.mockResolvedValue(vehicleRows);
    owner.getAnalyticsVehicleBookings.mockResolvedValue([
      { id: "booking-0000abcd1234", date: now, amount: 45000, status: "COMPLETED" },
      { id: "booking-0000zzzz9999", date: now, amount: 1000, status: "CANCELLED" },
    ]);
  });

  it("shows a spinner while the guard is loading", () => {
    state.guard = { isLoading: true, isAuthorized: false };
    render(<OwnerAnalyticsPage />);
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(owner.getAnalyticsOverview).not.toHaveBeenCalled();
  });

  it("renders KPIs, charts and the vehicle table", async () => {
    render(<OwnerAnalyticsPage />);
    expect(await screen.findByText("LKR 500,000")).toBeTruthy();
    expect(screen.getByText(/12% overview.growth/)).toBeTruthy();
    expect(screen.getByText(/75% overview.completionRate/)).toBeTruthy();
    expect(screen.getByText("4.6/5.0")).toBeTruthy();
    expect(screen.getByText(/2\/3/)).toBeTruthy();
    expect(screen.getByTestId("area-chart")).toBeTruthy();
    expect(screen.getByTestId("bar-chart")).toBeTruthy();
    expect(screen.getByTestId("y-ticks").textContent).toBe("900,15k");
    expect(screen.getByText(/revenueChart.tooltip 4,200/)).toBeTruthy();
    expect(screen.getByText(/4200 bookingsChart.tooltipLabel/)).toBeTruthy();
    expect(screen.getByText("Lanka Cruiser")).toBeTruthy();
    expect(screen.getByText("LKR 300,000")).toBeTruthy();
    expect(screen.getByText("vehicleTable.noRating")).toBeTruthy();
    expect(screen.getByText("vehicleModal.clickRow")).toBeTruthy();
  });

  it("shows negative growth and empty states", async () => {
    owner.getAnalyticsOverview.mockResolvedValue(overview({ revenueGrowth: -5, averageRating: 0 }));
    owner.getAnalyticsRevenue.mockResolvedValue([{ month: "Sep", revenue: 0, bookings: 0 }]);
    owner.getAnalyticsVehicles.mockResolvedValue([]);
    render(<OwnerAnalyticsPage />);
    expect(await screen.findByText(/5% overview.growth/)).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getAllByText("revenueChart.noData").length).toBe(2);
    expect(screen.getByText("vehicleTable.noVehicles")).toBeTruthy();
  });

  it("hides growth when flat and handles missing overview", async () => {
    owner.getAnalyticsOverview.mockResolvedValue(null);
    render(<OwnerAnalyticsPage />);
    await screen.findByText("Lanka Cruiser");
    expect(screen.queryByText(/overview.growth/)).toBeNull();
  });

  it("shows a load error and retries", async () => {
    owner.getAnalyticsOverview.mockRejectedValueOnce(new Error("x"));
    render(<OwnerAnalyticsPage />);
    expect(await screen.findByText("error.loadFailed")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("error.tryAgain")));
    expect(await screen.findByText("LKR 500,000")).toBeTruthy();
    expect(screen.queryByText("error.loadFailed")).toBeNull();
  });

  it("keeps the error visible after the guard drops authorisation", async () => {
    owner.getAnalyticsOverview.mockRejectedValueOnce(new Error("x"));
    const { rerender } = render(<OwnerAnalyticsPage />);
    await screen.findByText("error.loadFailed");
    state.guard = { isLoading: false, isAuthorized: false };
    rerender(<OwnerAnalyticsPage />);
    expect(screen.getByText("error.loadFailed")).toBeTruthy();
  });

  it("opens the vehicle modal with booking history and closes it", async () => {
    render(<OwnerAnalyticsPage />);
    const row = await screen.findByLabelText("Lanka Cruiser — vehicleModal.title");
    fireEvent.click(row);
    const dialog = screen.getByRole("dialog");
    expect(owner.getAnalyticsVehicleBookings).toHaveBeenCalledWith("veh-1");
    expect(within(dialog).getByText("75%")).toBeTruthy();
    expect(await within(dialog).findByText("#ABCD1234")).toBeTruthy();
    expect(within(dialog).getByText("#ABCD1234").closest("a")?.getAttribute("href")).toBe(
      "/en/owner/bookings/booking-0000abcd1234",
    );
    expect(within(dialog).getByText("Cancelled")).toBeTruthy();
    expect(within(dialog).getByText("4.4")).toBeTruthy();
    expect(within(dialog).getByText("vehicleModal.viewFleetProfile").closest("a")?.getAttribute("href")).toBe("/en/owner/fleet/veh-1");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("vehicleModal.close");

    fireEvent.keyDown(document, { key: "a" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("vehicleModal.close"));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(row, { key: " " });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("dialog").firstChild as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(row, { key: "Tab" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows empty and failed booking history for an inactive vehicle with reduced motion", async () => {
    state.reducedMotion = true;
    owner.getAnalyticsVehicleBookings.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("x"));
    render(<OwnerAnalyticsPage />);
    fireEvent.click(await screen.findByLabelText("Hill Rider — vehicleModal.title"));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("vehicleTable.inactive")).toBeTruthy();
    expect(within(dialog).getByText("vehicleModal.noReviews")).toBeTruthy();
    expect(within(dialog).getByText("0%")).toBeTruthy();
    expect(await within(dialog).findByText("vehicleModal.noBookings")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("vehicleModal.close"));

    fireEvent.click(screen.getByLabelText("Hill Rider — vehicleModal.title"));
    dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("vehicleModal.noBookings")).toBeTruthy();
  });

  it("ignores booking history that resolves after the modal closes", async () => {
    let resolve: (v: unknown) => void = () => {};
    let reject: (e: unknown) => void = () => {};
    owner.getAnalyticsVehicleBookings
      .mockReturnValueOnce(new Promise((r) => (resolve = r)))
      .mockReturnValueOnce(new Promise((_, j) => (reject = j)));
    render(<OwnerAnalyticsPage />);
    fireEvent.click(await screen.findByLabelText("Lanka Cruiser — vehicleModal.title"));
    expect(screen.getByText("vehicleModal.loadingBookings")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("vehicleModal.close"));
    await act(async () => resolve([]));
    fireEvent.click(screen.getByLabelText("Hill Rider — vehicleModal.title"));
    fireEvent.click(screen.getByLabelText("vehicleModal.close"));
    await act(async () => reject(new Error("late")));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
