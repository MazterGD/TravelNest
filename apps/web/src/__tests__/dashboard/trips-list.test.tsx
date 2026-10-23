/**
 * Trips list: status-tab counts and filtering, trip cards, empty and error
 * states with retry.
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  guard: { isLoading: false, isAuthorized: true },
}));

vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/dashboard/trips",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/hooks", async (importOriginal: any) => ({
  ...(await importOriginal()),
  useProtectedRoute: () => h.guard,
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  tripService: { list: vi.fn() },
}));

import { TripsPageContent } from "@/app/[locale]/dashboard/trips/TripsPageContent";
import { ApiError, tripService } from "@/lib/api";

const list = tripService.list as any;

const trip = (id: string, status: string, over: Record<string, any> = {}) => ({
  id,
  tripCode: `TRP-${id}`,
  status,
  title: null,
  pickupLocation: "Colombo, Western",
  pickupCity: null,
  dropoffLocation: "Kandy, Central",
  dropoffCity: null,
  startDate: "2026-12-01T00:00:00Z",
  passengerCount: 20,
  ...over,
});

const trips = [
  trip("1", "PLANNING", { title: "Office outing", quotations: [{}, {}] }),
  trip("2", "AWAITING_QUOTES", { pickupCity: "Galle", dropoffCity: "Ella", _count: { quotations: 4 } }),
  trip("3", "CONFIRMED", { dropoffLocation: null, pickupLocation: "" }),
  trip("4", "COMPLETED"),
  trip("5", "CANCELLED"),
  trip("6", "EXPIRED"),
];

const cards = () => Array.from(document.querySelectorAll("li a")).map((a) => a.getAttribute("href"));
const tab = (label: string) => screen.getAllByRole("tab").find((el) => el.textContent?.startsWith(label))!;

const renderTrips = async () => {
  render(<TripsPageContent locale="en" />);
  await waitFor(() => expect(cards().length).toBeGreaterThan(0));
};

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.isLoading = false;
  h.guard.isAuthorized = true;
  list.mockResolvedValue({ trips });
});

describe("TripsPageContent", () => {
  it("does not fetch until authorised", () => {
    h.guard.isAuthorized = false;
    render(<TripsPageContent locale="en" />);
    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByText("listTitle")).toBeNull();
  });

  it("lists all trips with per-tab counts and card details", async () => {
    await renderTrips();
    expect(list).toHaveBeenCalledWith({ limit: 50 });
    expect(cards().length).toBe(6);
    expect(tab("tabs.all").textContent).toBe("tabs.all6");
    expect(tab("tabs.active").textContent).toBe("tabs.active2");
    expect(tab("tabs.expired").textContent).toBe("tabs.expired1");
    expect(screen.getByText("Office outing")).toBeTruthy();
    expect(screen.getByText('quotesAttached:{"count":2}')).toBeTruthy();
    expect(screen.getByText('quotesAttached:{"count":4}')).toBeTruthy();
    expect(screen.getAllByText('quotesAttached:{"count":0}').length).toBe(4);
    expect(screen.getByText("Galle → Ella")).toBeTruthy();
    expect(Array.from(document.querySelectorAll("h3")).some((e) => e.textContent === " → noDestination")).toBe(true);
    expect(screen.getByText("status.awaiting_quotes")).toBeTruthy();
    expect(cards()[0]).toBe("/en/dashboard/trips/1");
  });

  it.each([
    ["tabs.active", ["1", "2"]],
    ["tabs.confirmed", ["3"]],
    ["tabs.completed", ["4"]],
    ["tabs.cancelled", ["5"]],
    ["tabs.expired", ["6"]],
  ])("filters by the %s tab", async (label: string, ids: string[]) => {
    await renderTrips();
    fireEvent.click(tab(label));
    expect(cards()).toEqual(ids.map((id: string) => `/en/dashboard/trips/${id}`));
    fireEvent.click(tab("tabs.all"));
    expect(cards().length).toBe(6);
  });

  it("shows the empty state when there are no trips in a tab", async () => {
    list.mockResolvedValue({ data: { trips: [trip("1", "PLANNING")] } });
    await renderTrips();
    fireEvent.click(tab("tabs.completed"));
    expect(screen.getByText("emptyTitle")).toBeTruthy();
    expect(screen.getByText("planFirstTrip").closest("a")!.getAttribute("href")).toBe("/en/dashboard/trips/new");
  });

  it("shows an empty list when the payload has no trips", async () => {
    list.mockResolvedValue(null);
    render(<TripsPageContent locale="en" />);
    expect(await screen.findByText("emptyTitle")).toBeTruthy();
  });

  it("shows load errors and retries", async () => {
    list.mockRejectedValueOnce(new ApiError(500, "Trips offline")).mockRejectedValueOnce(new Error("x"));
    render(<TripsPageContent locale="en" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Trips offline");
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("fetchError"));
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(cards().length).toBe(6));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
