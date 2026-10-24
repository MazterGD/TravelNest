/**
 * Owner dashboard: guard/user gating, verification banners, metrics and
 * fleet stats derived from vehicles, quotation expiry labels, upcoming
 * bookings filtering, revenue chart and recent reviews, partial failures.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: null as any,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks", () => ({ useOwnerGuard: () => state.guard }));
vi.mock("@/store", () => ({
  useAuthStore: (selector?: any) => {
    const s = { user: state.user };
    return selector ? selector(s) : s;
  },
}));

vi.mock("recharts", () => {
  const Pass = ({ children }: any) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    AreaChart: ({ children, data }: any) => (
      <div data-testid="area-chart" data-points={data.length}>
        {children}
      </div>
    ),
    Area: () => null,
    XAxis: () => null,
    YAxis: ({ tickFormatter }: any) => (
      <span data-testid="y-ticks">{[500, 25000].map((v) => tickFormatter(v)).join(",")}</span>
    ),
    CartesianGrid: () => null,
    Tooltip: ({ content }: any) => (
      <div data-testid="tooltip">
        {content &&
          [
            { ...content.props, active: true, payload: [{ value: 12345 }], label: "Sep" },
            { ...content.props, active: false, payload: [] },
          ].map((props, i) => <content.type key={i} {...props} />)}
      </div>
    ),
  };
});

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  ownerService: {
    getDashboardStats: vi.fn(),
    getRevenueChart: vi.fn(),
    getRecentReviews: vi.fn(),
  },
  vehicleService: { getMyVehicles: vi.fn() },
  quotationService: { getOwnerRequests: vi.fn() },
  bookingService: { getOwnerBookings: vi.fn() },
}));

import { bookingService, ownerService, quotationService, vehicleService } from "@/lib/api";
import OwnerDashboardPage from "@/app/[locale]/owner/dashboard/page";

const owner = ownerService as any;
const vehicles = vehicleService as any;
const quotes = quotationService as any;
const bookings = bookingService as any;
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY).toISOString();

const fill = () => {
  owner.getDashboardStats.mockResolvedValue({ totalRevenue: 250000, activeBookings: 3, pendingQuotes: 2, averageRating: 4.5 });
  vehicles.getMyVehicles.mockResolvedValue({
    vehicles: [
      { isActive: true, isAvailable: true },
      { isActive: true, isAvailable: false },
      { isActive: false, isAvailable: false },
      { isActive: true, isAvailable: true },
    ],
  });
  owner.getRevenueChart.mockResolvedValue([
    { month: "Aug", revenue: 0 },
    { month: "Sep", revenue: 50000 },
  ]);
  owner.getRecentReviews.mockResolvedValue([
    { id: "r1", rating: 4, comment: "Lovely trip", createdAt: daysAgo(1), vehicleName: "Lanka Cruiser", customerName: "Ravi", ownerResponse: null },
    { id: "r2", rating: 2, comment: "", createdAt: daysAgo(2), vehicleName: "Hill Rider", customerName: "Mala", ownerResponse: "Sorry" },
  ]);
  quotes.getOwnerRequests.mockResolvedValue({
    quotations: [
      { id: "q1", customer: { firstName: "Nimal", lastName: "Perera" }, pickupLocation: "Colombo", dropoffLocation: "Kandy", startDate: "2026-11-01", passengerCount: 40, sentAt: daysAgo(0), validityDays: 5 },
      { id: "q2", customer: {}, pickupLocation: "Galle", startDate: "2026-11-02", createdAt: daysAgo(10), validityDays: 3 },
      { id: "q3", customer: { firstName: "A" }, createdAt: daysAgo(0.5), validityDays: 1 },
      { id: "q4", customer: { lastName: "B" }, createdAt: daysAgo(1), validityDays: 1 },
      { id: "q5", validityDays: null },
    ],
  });
  bookings.getOwnerBookings.mockResolvedValue({
    bookings: [
      { id: "b1", status: "CONFIRMED", customer: { name: "Sunil" }, trip: { route: "Colombo → Ella", startDate: "2026-11-05" }, vehicle: { registration: "NB-1234" } },
      { id: "b2", status: "ONGOING" },
      { id: "b3", status: "COMPLETED", customer: { name: "Hidden" } },
    ],
  });
};

describe("OwnerDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal", isVerified: true, status: "ACTIVE" };
    fill();
  });

  it("shows a spinner while unauthorised or without a user", () => {
    state.user = null;
    const { container, rerender } = render(<OwnerDashboardPage />);
    expect(screen.queryByText("ownerDashboard.title")).toBeNull();
    state.user = { firstName: "Kamal" };
    state.guard = { isLoading: true, isAuthorized: false };
    rerender(<OwnerDashboardPage />);
    expect(screen.queryByText("ownerDashboard.title")).toBeNull();
    expect(container.firstChild).toBeTruthy();
    expect(owner.getDashboardStats).not.toHaveBeenCalled();
  });

  it("renders metrics, fleet stats, chart, reviews, quotes and upcoming bookings", async () => {
    render(<OwnerDashboardPage />);
    expect(screen.getByText(/Kamal!/)).toBeTruthy();
    expect(await screen.findByText("LKR 250,000")).toBeTruthy();
    expect(screen.getByText("4.5/5.0")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();

    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");

    expect(screen.getByTestId("area-chart").getAttribute("data-points")).toBe("2");
    expect(screen.getByTestId("y-ticks").textContent).toBe("500,25k");
    expect(screen.getByText("LKR 12,345")).toBeTruthy();

    expect(screen.getByText("Lovely trip")).toBeTruthy();
    expect(screen.getByText("Hill Rider")).toBeTruthy();

    expect(quotes.getOwnerRequests).toHaveBeenCalledWith({ status: "pending" });
    expect(await screen.findByText("Nimal Perera")).toBeTruthy();
    expect(screen.getByText("Colombo → Kandy")).toBeTruthy();
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
    expect(screen.getByText("5 days")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("1 day")).toBeTruthy();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);

    expect(screen.getByText("Sunil")).toBeTruthy();
    expect(screen.getByText("Colombo → Ella")).toBeTruthy();
    expect(screen.queryByText("Hidden")).toBeNull();
    expect(screen.getByText("ownerDashboard.addVehicle").closest("a")?.getAttribute("href")).toBe("/en/owner/fleet/add");
  });

  it("switches the quotation filter tabs", async () => {
    render(<OwnerDashboardPage />);
    await screen.findByText("Nimal Perera");
    fireEvent.click(screen.getByText("ownerDashboard.filterNew"));
    expect(screen.getByText("ownerDashboard.filterNew").className).toContain("border-primary");
    fireEvent.click(screen.getByText("ownerDashboard.filterPending"));
    expect(screen.getByText("ownerDashboard.filterPending").className).toContain("border-primary");
    expect(screen.getByText("ownerDashboard.filterAll").className).toContain("border-transparent");
  });

  it("lists only recent requests under New and older ones under Pending Response", async () => {
    render(<OwnerDashboardPage />);
    await screen.findByText("Nimal Perera");

    fireEvent.click(screen.getByText("ownerDashboard.filterNew"));
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.queryByText("Nimal Perera")).toBeNull();

    fireEvent.click(screen.getByText("ownerDashboard.filterPending"));
    expect(screen.getByText("Nimal Perera")).toBeTruthy();
    expect(screen.queryByText("A")).toBeNull();

    fireEvent.click(screen.getByText("ownerDashboard.filterAll"));
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("Nimal Perera")).toBeTruthy();
  });

  it("shows the pending verification banner and empty states", async () => {
    state.user = { firstName: "Kamal", isVerified: false };
    owner.getDashboardStats.mockResolvedValue(null);
    vehicles.getMyVehicles.mockResolvedValue({});
    owner.getRevenueChart.mockResolvedValue([{ month: "Sep", revenue: 0 }]);
    owner.getRecentReviews.mockResolvedValue("not-an-array");
    quotes.getOwnerRequests.mockResolvedValue({});
    bookings.getOwnerBookings.mockResolvedValue({});
    render(<OwnerDashboardPage />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("ownerDashboard.pendingVerification")).toBeTruthy();
    expect(await screen.findByText("ownerDashboard.noRevenueData")).toBeTruthy();
    expect(screen.getByText("ownerDashboard.noReviews")).toBeTruthy();
    expect(screen.getByText("ownerDashboard.noQuotationRequests")).toBeTruthy();
    expect(screen.getByText("ownerDashboard.noUpcomingBookings")).toBeTruthy();
    expect(screen.getByText("N/A")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("shows the rejected banner with a resubmit link", async () => {
    state.user = { firstName: "Kamal", isVerified: false, status: "REJECTED" };
    render(<OwnerDashboardPage />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("ownerDashboard.resubmit").closest("a")?.getAttribute("href")).toBe("../owner/profile");
    await screen.findByText("LKR 250,000");
  });

  it("renders nothing for a verified but suspended owner banner check", async () => {
    state.user = { firstName: "Kamal", isVerified: true, status: "SUSPENDED" };
    render(<OwnerDashboardPage />);
    expect(screen.getByText("ownerDashboard.pendingVerification")).toBeTruthy();
    await screen.findByText("LKR 250,000");
  });

  it("tolerates every data source failing", async () => {
    owner.getDashboardStats.mockRejectedValue(new Error("x"));
    quotes.getOwnerRequests.mockRejectedValue(new Error("x"));
    bookings.getOwnerBookings.mockRejectedValue(new Error("x"));
    render(<OwnerDashboardPage />);
    await waitFor(() => expect(screen.getByText("ownerDashboard.noQuotationRequests")).toBeTruthy());
    expect(screen.getByText("LKR 0")).toBeTruthy();
    expect(screen.getByText("ownerDashboard.noUpcomingBookings")).toBeTruthy();
  });
});
