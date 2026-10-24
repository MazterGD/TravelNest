/**
 * Owner sent-quotation detail: timeline (sent/viewed/accepted/rejected),
 * customer contact, trip + map, pricing breakdown, validity countdown and
 * not-found handling.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  mapProps: null as any,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/quotations/sent/q1",
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
vi.mock("next/dynamic", () => ({
  default: () => (props: any) => {
    state.mapProps = props;
    return <div data-testid="map" />;
  },
}));
vi.mock("@/hooks", () => ({ useOwnerGuard: () => state.guard }));
vi.mock("@/store", () => ({ useAuthStore: () => ({ user: state.user }) }));
vi.mock("@/lib/api/services", () => ({ quotationService: { getById: vi.fn() } }));

import { quotationService } from "@/lib/api/services";
import QuotationDetailPage from "@/app/[locale]/owner/quotations/sent/[id]/page";

const quotes = quotationService as any;
const DAY = 86400000;

const quotation = (overrides: Record<string, unknown> = {}) => ({
  id: "q1",
  quotationId: "QUO-2026-001",
  customer: { firstName: "Nimal", lastName: "Perera", email: "nimal@x.lk", phone: "0771234567" },
  pickupLocation: "Colombo",
  dropoffLocation: "Kandy",
  startDate: "2026-11-01T00:00:00.000Z",
  endDate: "2026-11-02T00:00:00.000Z",
  startTime: "07:30",
  estimatedDistance: "120 km",
  estimatedDuration: "3h",
  itineraryStops: [{ coordinates: [79.8, 6.9], locationName: "Colombo" }, { lat: 7.3, lng: 80.6, locationName: "Kandy" }],
  itineraryRoute: { coordinates: [[79.8, 6.9], [80.6, 7.3]] },
  passengerCount: 40,
  vehicle: { licensePlate: "NB-1234" },
  vehicleType: "LUXURY_AC",
  vehicleRentalCost: 12000,
  driverCost: 3000,
  fuelCost: 4000,
  tollCharges: 500,
  customItems: [{ description: "Parking", amount: 700 }],
  subtotal: 20200,
  tax: 2020,
  totalAmount: 22220,
  status: "VIEWED",
  sentAt: "2026-10-01T08:00:00.000Z",
  createdAt: "2026-09-30T08:00:00.000Z",
  viewedAt: "2026-10-02T08:00:00.000Z",
  respondedAt: null,
  validUntil: new Date(Date.now() + 5.5 * DAY).toISOString(),
  additionalNotes: "Includes meals",
  rejectionReason: null,
  ...overrides,
});

const renderPage = async () => {
  const params = Promise.resolve({ id: "q1", locale: "en" });
  await act(async () => {
    render(
      <Suspense fallback={<div>suspended</div>}>
        <QuotationDetailPage params={params} />
      </Suspense>,
    );
    await params;
  });
};

describe("Owner QuotationDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    quotes.getById.mockResolvedValue({ quotation: quotation() });
  });

  it("waits for authorisation before loading", async () => {
    state.guard = { isLoading: false, isAuthorized: false };
    await renderPage();
    expect(quotes.getById).not.toHaveBeenCalled();
  });

  it("renders a viewed quotation with pricing, trip, map and validity", async () => {
    await renderPage();
    expect(await screen.findByText("QUO-2026-001")).toBeTruthy();
    expect(quotes.getById).toHaveBeenCalledWith("q1");
    expect(screen.getByText('detail.quotationFor:{"name":"Nimal Perera"}')).toBeTruthy();
    expect(screen.getByText("status.VIEWED")).toBeTruthy();
    expect(screen.getByText("detail.timeline.viewedByCustomer")).toBeTruthy();
    expect(screen.getByText("nimal@x.lk").getAttribute("href")).toBe("mailto:nimal@x.lk");
    expect(screen.getByText("0771234567").getAttribute("href")).toBe("tel:0771234567");
    expect(screen.getByText("120 km • 3h")).toBeTruthy();
    expect(screen.getByText("07:30")).toBeTruthy();
    expect(screen.getByText("NB-1234")).toBeTruthy();
    expect(screen.getByText("Includes meals")).toBeTruthy();
    expect(screen.getByText("Parking")).toBeTruthy();
    expect(screen.getByText("LKR 22,220")).toBeTruthy();
    expect(screen.getByText('detail.validity.daysRemaining:{"days":6}')).toBeTruthy();
    expect(state.mapProps.initialWaypoints).toEqual([
      { lat: 6.9, lng: 79.8, name: "Colombo" },
      { lat: 7.3, lng: 80.6, name: "Kandy" },
    ]);
    expect(state.mapProps.initialRouteGeometry).toEqual([[6.9, 79.8], [7.3, 80.6]]);
    expect(screen.queryByText("detail.accepted.title")).toBeNull();
  });

  it("shows the accepted timeline entry and accepted panel", async () => {
    quotes.getById.mockResolvedValue({
      quotation: quotation({ status: "ACCEPTED", respondedAt: "2026-10-03T08:00:00.000Z", validUntil: new Date(Date.now() + 1.5 * DAY).toISOString() }),
    });
    await renderPage();
    expect(await screen.findByText("detail.timeline.acceptedByCustomer")).toBeTruthy();
    expect(screen.getByText("detail.accepted.title")).toBeTruthy();
    expect(screen.getByText('detail.validity.daysRemaining:{"days":2}')).toBeTruthy();
  });

  it.todo("links accepted quotations to an existing owner route (currently /owner/bookings/create, which does not exist)");
  it.todo("shows the vehicle's real seat capacity on the sent quotation detail (capacity is hard-coded to 0)");

  it("shows the rejection reason and sparse fallbacks for a rejected quotation", async () => {
    quotes.getById.mockResolvedValue({
      quotation: quotation({
        status: "REJECTED",
        respondedAt: "2026-10-03T08:00:00.000Z",
        rejectionReason: "Too expensive",
        viewedAt: null,
        sentAt: null,
        validUntil: null,
        customer: null,
        vehicle: null,
        startTime: null,
        estimatedDistance: null,
        estimatedDuration: "2h",
        additionalNotes: null,
        customItems: null,
        vehicleRentalCost: null,
        driverCost: null,
        fuelCost: null,
        tollCharges: null,
        subtotal: null,
        tax: null,
        totalAmount: null,
        itineraryStops: undefined,
        itineraryRoute: undefined,
      }),
    });
    await renderPage();
    expect(await screen.findByText("detail.timeline.rejectedByCustomer")).toBeTruthy();
    expect(screen.getByText("Too expensive")).toBeTruthy();
    expect(screen.queryByText("detail.timeline.viewedByCustomer")).toBeNull();
    expect(screen.getByText("detail.validity.expired")).toBeTruthy();
    expect(screen.queryByText(/detail.validity.validUntil/)).toBeNull();
    expect(screen.queryByText("detail.customer.email")).toBeNull();
    expect(screen.getByText("LUXURY_AC")).toBeTruthy();
    expect(screen.getByText("2h")).toBeTruthy();
    expect(screen.getAllByText("LKR 0").length).toBe(7);
    expect(state.mapProps.initialWaypoints).toEqual([]);
  });

  it.each(["SENT", "EXPIRED", "WEIRD"])("renders the %s status badge", async (status: string) => {
    quotes.getById.mockResolvedValue({ quotation: quotation({ status, viewedAt: null, estimatedDuration: null }) });
    await renderPage();
    await screen.findByText("QUO-2026-001");
    expect(screen.getByText(status === "WEIRD" ? "status.SENT" : `status.${status}`)).toBeTruthy();
    expect(screen.getByText("120 km")).toBeTruthy();
  });

  it("shows not-found when loading fails", async () => {
    quotes.getById.mockRejectedValue(new Error("x"));
    await renderPage();
    expect(await screen.findByText("detail.notFound.title")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText("detail.notFound.back").closest("a")?.getAttribute("href")).toBe("/en/owner/quotations/sent"),
    );
  });
});
