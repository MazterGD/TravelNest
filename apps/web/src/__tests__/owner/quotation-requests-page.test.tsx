/**
 * Owner quotation requests page: pending/all tabs, server-side filters
 * (vehicle type, passenger range, dates, sort), client-side search, expiry
 * badges, send-quotation links and empty states.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/quotations",
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
vi.mock("@/hooks", async () => {
  const actual = await vi.importActual<any>("@/hooks/useUtils");
  return { useOwnerGuard: () => state.guard, useClickOutside: actual.useClickOutside };
});
vi.mock("@/store", () => ({ useAuthStore: () => ({ user: state.user }) }));
vi.mock("@/lib/api/services", () => ({
  quotationService: { getOwnerRequests: vi.fn() },
  landingContentService: { getPublicConfig: vi.fn() },
}));

import { landingContentService, quotationService } from "@/lib/api/services";
import QuotationRequestsPage from "@/app/[locale]/owner/quotations/page";

const quotes = quotationService as any;
const landing = landingContentService as any;
const DAY = 86400000;

const request = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  quotationId: `QUO-${id}`,
  status: "PENDING",
  customer: { firstName: "Nimal", lastName: "Perera" },
  pickupLocation: "Colombo",
  dropoffLocation: "Kandy",
  createdAt: "2026-10-01T00:00:00.000Z",
  startDate: "2026-11-01T00:00:00.000Z",
  passengerCount: 40,
  vehicleType: "LUXURY_AC",
  validUntil: new Date(Date.now() + 3.5 * DAY).toISOString(),
  ...overrides,
});

const lastQuery = () => quotes.getOwnerRequests.mock.calls.at(-1)[0];

const renderPage = async () => {
  render(<QuotationRequestsPage />);
  await waitFor(() => expect(quotes.getOwnerRequests).toHaveBeenCalled());
  await waitFor(() => expect(document.querySelector(".animate-spin")).toBeNull());
};

describe("QuotationRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    landing.getPublicConfig.mockResolvedValue({ options: { vehicleTypes: [{ value: "LUXURY_AC", label: "Luxury AC" }] } });
    quotes.getOwnerRequests.mockResolvedValue({
      quotations: [
        request("1"),
        request("2", { customer: { firstName: "Mala" }, dropoffLocation: null, passengerCount: 0, vehicleType: null, validUntil: new Date(Date.now() - 2 * DAY).toISOString() }),
        request("3", { customer: null, status: "ACCEPTED", validUntil: new Date(Date.now() - 0.2 * DAY).toISOString(), pickupLocation: "Galle" }),
        request("4", { status: "REJECTED", validUntil: undefined, createdAt: "not-a-date", quotationId: undefined }),
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is gated by guard and user", () => {
    state.user = null;
    render(<QuotationRequestsPage />);
    expect(screen.queryByText("ownerQuotations.title")).toBeNull();
  });

  it("loads pending requests and renders cards with badges and actions", async () => {
    await renderPage();
    expect(quotes.getOwnerRequests).toHaveBeenCalledWith({
      status: "PENDING",
      vehicleType: undefined,
      passengerMin: undefined,
      passengerMax: undefined,
      startDate: undefined,
      endDate: undefined,
      sortBy: "newest",
    });
    expect(screen.getByText('ownerQuotations.requestCount:{"count":4}')).toBeTruthy();
    expect(screen.getByText('ownerQuotations.newBadge:{"count":2}')).toBeTruthy();
    expect(screen.getAllByText("Nimal Perera").length).toBe(2);
    expect(screen.getByText("Mala")).toBeTruthy();
    expect(screen.getAllByText("ownerQuotations.unknownCustomer").length).toBe(1);
    expect(screen.getByText('ownerQuotations.badges.expiresIn:{"days":4}')).toBeTruthy();
    expect(screen.getByText("ownerQuotations.badges.expired")).toBeTruthy();
    expect(screen.getByText("ownerQuotations.badges.expiresToday")).toBeTruthy();
    expect(screen.getByText(/ownerQuotations.labels.dropoffPending/)).toBeTruthy();
    expect(screen.getAllByText("—").length).toBe(2);
    expect(screen.getByText('ownerQuotations.labels.requestedOn:{"date":""}')).toBeTruthy();
    expect(screen.getAllByText("ownerQuotations.actions.sendQuotation").length).toBe(2);
  });

  it("switches to all requests and applies server-side filters", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("ownerQuotations.tabs.all"));
    await waitFor(() => expect(lastQuery().status).toBeUndefined());

    fireEvent.click(screen.getByText("ownerQuotations.filters.toggle"));
    await screen.findByText("Luxury AC");
    const [typeSel, paxSel, sortSel] = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
    const [from, to] = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(typeSel, { target: { value: "LUXURY_AC" } });
    fireEvent.change(paxSel, { target: { value: "31-40" } });
    fireEvent.change(from, { target: { value: "2026-11-01" } });
    fireEvent.change(to, { target: { value: "2026-11-30" } });
    fireEvent.change(sortSel, { target: { value: "passengersHigh" } });
    await waitFor(() =>
      expect(lastQuery()).toEqual({
        status: undefined,
        vehicleType: "LUXURY_AC",
        passengerMin: 31,
        passengerMax: 40,
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        sortBy: "passengersHigh",
      }),
    );
    fireEvent.change(paxSel, { target: { value: "50-plus" } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ passengerMin: 50, passengerMax: undefined }));

    fireEvent.click(screen.getByText("ownerQuotations.filters.clearFilters"));
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ vehicleType: undefined, passengerMin: undefined, startDate: undefined, sortBy: "newest" }),
    );
    fireEvent.click(screen.getByText("ownerQuotations.filters.toggle"));
    expect(document.querySelectorAll("select").length).toBe(0);
    fireEvent.click(screen.getByText("ownerQuotations.tabs.pending"));
    await waitFor(() => expect(lastQuery().status).toBe("PENDING"));
  });

  it("searches by customer, route and quotation id", async () => {
    await renderPage();
    const search = screen.getByLabelText("ownerQuotations.filters.searchPlaceholder");
    fireEvent.change(search, { target: { value: "mala" } });
    expect(screen.getByText('ownerQuotations.requestCount:{"count":1}')).toBeTruthy();
    fireEvent.change(search, { target: { value: "galle" } });
    expect(screen.getByText('ownerQuotations.requestCount:{"count":1}')).toBeTruthy();
    fireEvent.change(search, { target: { value: "kandy" } });
    expect(screen.getByText('ownerQuotations.requestCount:{"count":3}')).toBeTruthy();
    fireEvent.change(search, { target: { value: "quo-4" } });
    expect(screen.getByText('ownerQuotations.requestCount:{"count":0}')).toBeTruthy();
    fireEvent.change(search, { target: { value: "quo-1" } });
    expect(screen.getByText("QUO-1")).toBeTruthy();
  });

  it("shows tab-specific empty states and tolerates failures", async () => {
    quotes.getOwnerRequests.mockResolvedValue({});
    landing.getPublicConfig.mockRejectedValue(new Error("x"));
    await renderPage();
    expect(screen.getByText("ownerQuotations.empty.pendingTitle")).toBeTruthy();
    expect(screen.queryByText(/ownerQuotations.newBadge/)).toBeNull();
    quotes.getOwnerRequests.mockRejectedValue(new Error("down"));
    fireEvent.click(screen.getByText("ownerQuotations.tabs.all"));
    await waitFor(() => expect(lastQuery().status).toBeUndefined());
    expect(await screen.findByText("ownerQuotations.empty.allTitle")).toBeTruthy();
    expect(console.error).toHaveBeenCalled();
  });

  it("tolerates config without vehicle types", async () => {
    landing.getPublicConfig.mockResolvedValue({ options: {} });
    await renderPage();
    fireEvent.click(screen.getByText("ownerQuotations.filters.toggle"));
    expect(document.querySelectorAll("select")[0].querySelectorAll("option").length).toBe(1);
  });

  it.todo("pre-filters requests by ?vehicleId= when arriving from the fleet detail quick-nav (the param is ignored)");
});
