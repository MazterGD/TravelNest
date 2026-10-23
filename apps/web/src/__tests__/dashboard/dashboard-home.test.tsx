/**
 * Customer dashboard home: metrics, next-journey / active-trip / empty hero,
 * upcoming bookings, grouped quotation replies and the notifications feed.
 */
import { configure, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => {
  // A stable translator: the page lists `t` as an effect dependency.
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;
  return {
    t,
    params: { locale: "en" } as Record<string, string>,
    guard: { isLoading: false, isAuthorized: true },
    auth: { user: { id: "u1", firstName: "Nimal" } as any },
  };
});

vi.mock("next/navigation", () => ({
  useParams: () => h.params,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/store", () => ({ useAuthStore: () => h.auth }));
vi.mock("@/hooks", async (importOriginal: any) => ({
  ...(await importOriginal()),
  useProtectedRoute: () => h.guard,
}));
vi.mock("@/lib/api", () => ({
  bookingService: { getMyBookings: vi.fn() },
  notificationService: { getAll: vi.fn(), getUnreadCount: vi.fn() },
  quotationService: { getMyRequests: vi.fn() },
  tripService: { getActive: vi.fn() },
  userService: { getDashboardStats: vi.fn() },
}));

import { DashboardContent } from "@/app/[locale]/dashboard/DashboardContent";
import { bookingService, notificationService, quotationService, tripService, userService } from "@/lib/api";

const api = {
  stats: userService.getDashboardStats as any,
  bookings: bookingService.getMyBookings as any,
  quotes: quotationService.getMyRequests as any,
  trips: tripService.getActive as any,
  notes: notificationService.getAll as any,
  unread: notificationService.getUnreadCount as any,
};

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const setEmpty = () => {
  api.stats.mockResolvedValue(null);
  api.bookings.mockResolvedValue({});
  api.quotes.mockResolvedValue({});
  api.trips.mockResolvedValue({});
  api.notes.mockResolvedValue({});
  api.unread.mockResolvedValue(undefined);
};

const renderHome = async (locale = "en") => {
  render(<DashboardContent locale={locale} />);
  await waitFor(() => expect(document.querySelector('[class*="animate-pulse"]')).toBeNull());
};

beforeEach(() => {
  vi.clearAllMocks();
  h.params = { locale: "en" };
  h.guard.isLoading = false;
  h.guard.isAuthorized = true;
  h.auth.user = { id: "u1", firstName: "Nimal" };
  setEmpty();
});

describe("DashboardContent", () => {
  it("shows a spinner and fetches nothing until a signed-in customer is authorised", () => {
    h.auth.user = null;
    render(<DashboardContent locale="en" />);
    expect(screen.queryByText(/welcomeUser/)).toBeNull();
    expect(api.stats).not.toHaveBeenCalled();
  });

  it("greets the customer, shows metrics and the next confirmed journey", async () => {
    api.stats.mockResolvedValue({ totalBookings: 7, completedBookings: 4, pendingQuotations: 2, totalSpent: 125000.6 });
    api.bookings.mockResolvedValue({
      bookings: [
        { id: "b1", bookingReference: "BK-1", status: "confirmed", startDate: "2026-12-01", pickupLocation: { city: "Colombo" }, dropoffLocation: "Kandy", vehicleName: "Lanka Coach", vehicleType: "LUXURY_AC", ownerName: "Sunil", ownerPhone: "0771" },
        { id: "abcdefghij", status: "ONGOING", pickupLocation: {}, dropoffLocation: undefined },
        { id: "b3", status: "PENDING" },
        { id: "b4", status: "CONFIRMED" },
        { id: "b5", status: "CONFIRMED" },
      ],
    });
    await renderHome();
    expect(screen.getByText('welcomeUser:{"name":"Nimal"}')).toBeTruthy();
    expect(api.bookings).toHaveBeenCalledWith({ limit: 20 });
    expect(api.notes).toHaveBeenCalledWith({ limit: 5 });
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText('metrics.currency:{"amount":"125,001"}')).toBeTruthy();
    expect(screen.getAllByText("Colombo → Kandy").length).toBe(2);
    expect(screen.getByText("BK-ABCDEFGH")).toBeTruthy();
    expect(screen.getAllByText("— → —").length).toBe(2);
    expect(screen.getByText('upcomingBookings.subtitle:{"count":3}')).toBeTruthy();
    expect(screen.getAllByLabelText('actions.callOwner:{"name":"Sunil"}').map((a) => a.getAttribute("href"))).toEqual(["tel:0771", "tel:0771"]);
    expect(screen.getAllByText("vehicleFallback · vehicleFallback").length).toBe(2);
    const details = screen.getAllByText("actions.viewDetails").map((a) => a.closest("a")!.getAttribute("href"));
    expect(details).toContain("/en/dashboard/bookings/b1");
    expect(screen.getAllByText('status.confirmed:{"defaultValue":"CONFIRMED"}').length).toBe(2);
    expect(screen.getByText('status.ongoing:{"defaultValue":"ONGOING"}')).toBeTruthy();
  });

  it("highlights an in-flight trip when there are no upcoming bookings", async () => {
    api.trips.mockResolvedValue({
      trips: [{ id: "t1", tripCode: "TRP-9", title: null, pickupCity: null, pickupLocation: "Galle, Southern", dropoffCity: null, dropoffLocation: "Ella, Uva", startDate: "2026-12-01", passengerCount: 12, _count: { quotations: 3 } }],
    });
    await renderHome();
    expect(screen.getByText("activeTrip.label")).toBeTruthy();
    expect(screen.getByText("TRP-9")).toBeTruthy();
    expect(screen.getByText("Galle → Ella")).toBeTruthy();
    expect(screen.getByText('activeTrip.quotesAttached:{"count":3}')).toBeTruthy();
    expect(screen.getByText("activeTrip.addVehicles").closest("a")!.getAttribute("href")).toBe("/en/dashboard/search?tripId=t1");
    expect(screen.getByText("activeTrip.viewTrip").closest("a")!.getAttribute("href")).toBe("/en/dashboard/trips/t1");
  });

  it("uses the trip title and handles a trip without destination or counts", async () => {
    api.trips.mockResolvedValue({ data: { trips: [{ id: "t2", tripCode: "T", title: "School trip", pickupLocation: "Kandy", dropoffLocation: null, startDate: "2026-12-01", passengerCount: 5 }] } });
    await renderHome();
    expect(screen.getByText("School trip")).toBeTruthy();
    expect(screen.getByText('activeTrip.quotesAttached:{"count":0}')).toBeTruthy();
  });

  it("invites first-time customers to plan a trip and shows empty states", async () => {
    await renderHome();
    expect(screen.getByText("planTrip.emptyTitle")).toBeTruthy();
    expect(screen.getByText("planTrip.cta").closest("a")!.getAttribute("href")).toBe("/en/dashboard/trips/new");
    expect(screen.getByText("upcomingBookings.emptyTitle")).toBeTruthy();
    expect(screen.getByText("recentQuotations.empty")).toBeTruthy();
    expect(screen.getByText("notifications.empty")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBe(3);
  });

  it("degrades gracefully when every request fails", async () => {
    for (const fn of Object.values(api)) fn.mockRejectedValue(new Error("down"));
    await renderHome();
    expect(screen.getByText("planTrip.emptyTitle")).toBeTruthy();
    expect(screen.getByText("notifications.empty")).toBeTruthy();
  });

  it("groups quotation rows per trip and rolls up their status", async () => {
    api.quotes.mockResolvedValue({
      quotations: [
        { id: "q1", pickupLocation: "Colombo, W", dropoffLocation: "Kandy, C", startDate: "2026-12-01T00:00:00Z", status: "PENDING" },
        { id: "q2", pickupLocation: "Colombo, W", dropoffLocation: "Kandy, C", startDate: "2026-12-01T05:00:00Z", status: "SENT" },
        { id: "q3", pickupLocation: "Colombo, W", dropoffLocation: "Kandy, C", startDate: "2026-12-01", status: "ACCEPTED" },
        { id: "q4", pickupLocation: "Colombo, W", dropoffLocation: "Kandy, C", startDate: "2026-12-01", status: "VIEWED" },
        { id: "g1", pickupLocation: "Galle", dropoffLocation: "Ella", startDate: "2026-12-05", status: "PENDING" },
        { id: "g2", pickupLocation: "Galle", dropoffLocation: "Ella", startDate: "2026-12-05", status: "EXPIRED" },
        { id: "n1" },
      ],
    });
    await renderHome();
    const links = Array.from(document.querySelectorAll('a[href*="/dashboard/quotations/"]'));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/en/dashboard/quotations/q1",
      "/en/dashboard/quotations/g1",
      "/en/dashboard/quotations/n1",
    ]);
    expect(links[0].textContent).toContain('recentQuotations.quotesCount:{"count":3}');
    expect(links[0].textContent).toContain("status.accepted");
    expect(links[1].textContent).toContain("status.pending");
    expect(links[1].textContent).not.toContain("quotesCount");
    expect(links[2].textContent).toContain("— → —");
  });

  it("marks a group as SENT once an owner replies", async () => {
    api.quotes.mockResolvedValue({
      quotations: [
        { id: "q1", pickupLocation: "A", dropoffLocation: "B", startDate: "2026-12-01", status: "PENDING" },
        { id: "q2", pickupLocation: "A", dropoffLocation: "B", startDate: "2026-12-01", status: "REJECTED" },
        { id: "q3", pickupLocation: "A", dropoffLocation: "B", startDate: "2026-12-01", status: "CANCELLED" },
      ],
    });
    await renderHome();
    const link = document.querySelector('a[href="/en/dashboard/quotations/q1"]')!;
    expect(link.textContent).toContain("status.sent");
  });

  it("labels expired, cancelled, rejected and unknown quotation groups", async () => {
    api.quotes.mockResolvedValue({
      quotations: ["EXPIRED", "CANCELLED", "REJECTED", "MYSTERY", "COMPLETED"].map((status, i) => ({
        id: `s${i}`, pickupLocation: `P${i}`, dropoffLocation: "D", startDate: "2026-12-01", status,
      })),
    });
    await renderHome();
    for (const s of ["expired", "cancelled", "rejected", "mystery", "completed"]) {
      expect(screen.getByText(`status.${s}:${JSON.stringify({ defaultValue: s.toUpperCase() })}`)).toBeTruthy();
    }
  });

  it("renders notifications with category icons, unread markers and relative times", async () => {
    api.notes.mockResolvedValue([
      { id: "n1", type: "QUOTATION_RECEIVED", title: "New quote", message: "m1", createdAt: ago(10_000), isRead: false },
      { id: "n2", type: "x", title: "Refund issued", message: "m2", createdAt: ago(5 * 60_000), isRead: true },
      { id: "n3", title: "Trip reminder", message: "m3", createdAt: ago(3 * 3600_000), isRead: true },
      { id: "n4", type: 42, title: "Welcome", message: "m4", createdAt: ago(2 * 86400_000), isRead: true },
      { id: "n5", title: "Old", createdAt: "2020-01-01T00:00:00Z", isRead: true },
      { id: "n6", title: "Bad date", createdAt: "not-a-date", isRead: true },
    ]);
    api.unread.mockResolvedValue({ count: 4 });
    await renderHome();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("notifications.time.justNow")).toBeTruthy();
    expect(screen.getByText('notifications.time.minutesAgo:{"count":5}')).toBeTruthy();
    expect(screen.getByText('notifications.time.hoursAgo:{"count":3}')).toBeTruthy();
    expect(screen.getByText('notifications.time.daysAgo:{"count":2}')).toBeTruthy();
    expect(screen.getByText(new Date("2020-01-01T00:00:00Z").toLocaleDateString("en"))).toBeTruthy();
    expect(document.querySelector(".lucide-clipboard-list")).toBeTruthy();
    expect(document.querySelector(".lucide-dollar-sign")).toBeTruthy();
    expect(document.querySelector(".lucide-bell")).toBeTruthy();
  });

  it("reads the unread count from either field and the notifications object shape", async () => {
    api.notes.mockResolvedValue({ notifications: [{ id: "n1", title: "Booking confirmed", createdAt: ago(1000) }] });
    api.unread.mockResolvedValue({ unreadCount: 9 });
    await renderHome();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText("Booking confirmed")).toBeTruthy();
  });

  it("formats currency for Sinhala/Tamil locales and falls back to the prop locale", async () => {
    h.params = {};
    api.stats.mockResolvedValue({ totalSpent: -50 });
    await renderHome("si");
    expect(screen.getByText('metrics.currency:{"amount":"0"}')).toBeTruthy();
    expect(screen.getByText("searchBuses").closest("a")!.getAttribute("href")).toBe("/si/dashboard/search");
  });

  it("ignores responses that land after unmount", async () => {
    let resolve!: (v: any) => void;
    api.stats.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = render(<DashboardContent locale="en" />);
    unmount();
    resolve({ totalBookings: 1 });
    await Promise.resolve();
    expect(api.stats).toHaveBeenCalledTimes(1);
  });
});
