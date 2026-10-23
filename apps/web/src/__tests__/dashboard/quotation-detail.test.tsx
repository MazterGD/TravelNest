/**
 * Single quotation view: status banners, pricing breakdown, map waypoints,
 * owner contact, and the accept / decline confirmation flows.
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  // Stable translator: `t` is a useCallback dependency of the fetcher.
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  push: vi.fn(),
  router: null as any,
  guard: { isLoading: false, isAuthorized: true },
  map: {} as any,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => (h.router ??= { push: h.push }),
  usePathname: () => "/en/dashboard/quotations/q1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("next/dynamic", () => ({
  default: (loader: any, opts: any) => {
    void Promise.resolve().then(loader).catch(() => undefined);
    return (props: any) => {
      h.map = props;
      return <div data-testid="map">{opts?.loading?.()}</div>;
    };
  },
}));
vi.mock("@/components/ui/InteractiveMap", () => ({ InteractiveMap: () => null }));
vi.mock("@/hooks", async (importOriginal: any) => ({
  ...(await importOriginal()),
  useProtectedRoute: () => h.guard,
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  quotationService: { getById: vi.fn(), respondToQuotation: vi.fn() },
}));

import { QuotationDetailPageContent } from "@/app/[locale]/dashboard/quotations/[id]/QuotationDetailPageContent";
import { ApiError, quotationService } from "@/lib/api";

const getById = quotationService.getById as any;
const respond = quotationService.respondToQuotation as any;

const quote = (over: Record<string, any> = {}) => ({
  id: "q1",
  quotationId: "QUO-0001",
  status: "SENT",
  tripId: "t1",
  totalAmount: 55000,
  validUntil: "2026-12-10T00:00:00Z",
  vehicleRentalCost: 40000,
  driverCost: 5000,
  fuelCost: 8000,
  tollCharges: 500,
  tax: 1500,
  customItems: [{ description: "Parking", amount: 0 }],
  additionalNotes: "Includes water bottles",
  pickupLocation: "Colombo",
  dropoffLocation: "Kandy",
  startDate: "2026-12-01T00:00:00Z",
  endDate: "2026-12-03T00:00:00Z",
  startTime: "07:00",
  passengerCount: 30,
  estimatedDistance: "116 km",
  specialRequests: "Roof rack",
  itineraryRoute: { coordinates: [[79.8, 6.9], [80.6, 7.3]] },
  trip: {
    pickupLatitude: 6.9, pickupLongitude: 79.8, pickupCity: "Colombo",
    dropoffLatitude: 7.3, dropoffLongitude: 80.6, dropoffCity: "Kandy",
    intermediateStops: [
      { location: { city: "Kegalle", lat: 7.25, lng: 80.35 } },
      { location: { address: "Pinnawala junction", lat: 7.3, lng: 80.38 } },
      { location: { city: "Mawanella" } },
      null,
    ],
  },
  vehicle: {
    name: "Lanka Coach",
    licensePlate: "NB-1234",
    year: 2019,
    images: ["https://img/bus.webp"],
    owner: { firstName: "Sunil", lastName: "Perera", email: "sunil@example.lk" },
  },
  ...over,
});

const renderDetail = async (q: any = quote()) => {
  getById.mockResolvedValue(q);
  render(<QuotationDetailPageContent locale="en" requestId="q1" />);
  await waitFor(() => expect(screen.queryByTestId("map") || screen.queryByText("errorLoadingQuotations")).toBeTruthy());
};

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.isLoading = false;
  h.guard.isAuthorized = true;
});

describe("QuotationDetailPageContent", () => {
  it("waits for authorisation before loading", () => {
    h.guard.isAuthorized = false;
    render(<QuotationDetailPageContent locale="en" requestId="q1" />);
    expect(getById).not.toHaveBeenCalled();
  });

  it("renders a priced, respondable quotation in full", async () => {
    await renderDetail({ data: { quotation: quote() } });
    expect(getById).toHaveBeenCalledWith("q1");
    expect(screen.getByText("QUO-0001")).toBeTruthy();
    expect(screen.getByText('statusBadge.sent:{"defaultValue":"SENT"}')).toBeTruthy();
    expect(screen.getAllByText("Lanka Coach").length).toBe(2);
    expect(screen.getAllByText("LKR 55,000").length).toBe(2);
    expect(screen.getByText("LKR 1,500")).toBeTruthy();
    expect(screen.getByText("Parking")).toBeTruthy();
    expect(screen.getByText("Includes water bottles")).toBeTruthy();
    expect(screen.getByText("Roof rack")).toBeTruthy();
    expect(screen.getByText("Kegalle")).toBeTruthy();
    expect(screen.getByText("Pinnawala junction")).toBeTruthy();
    expect(screen.getByText("Mawanella")).toBeTruthy();
    expect(screen.getByText("NB-1234")).toBeTruthy();
    expect(screen.getByText("sunil@example.lk")).toBeTruthy();
    expect(screen.getByText(/^tripDateRange|^dateRange/)).toBeTruthy();
    expect(h.map.initialWaypoints.map((w: any) => w.name)).toEqual(["Colombo", "Kegalle", "Pinnawala junction", "Kandy"]);
    expect(h.map.initialRouteGeometry).toEqual([[6.9, 79.8], [7.3, 80.6]]);
    expect(screen.getByText("backToTrips").closest("a")!.getAttribute("href")).toBe("/en/dashboard/trips/t1");
    expect(screen.getByText('openMessages:{"defaultValue":"Open messages"}').closest("a")!.getAttribute("href")).toBe("/en/dashboard/messages");
  });

  it("accepts and routes to the created booking", async () => {
    respond.mockResolvedValue({ quotation: { booking: { id: "b9" } } });
    await renderDetail();
    fireEvent.click(screen.getByText("acceptQuotation"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByText("confirm.cancelAction"));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("acceptQuotation"));
    fireEvent.click(screen.getAllByText("acceptQuotation")[1]);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings/b9"));
    expect(respond).toHaveBeenCalledWith("q1", { status: "ACCEPTED" });
  });

  it("falls back to the top-level booking id or the bookings list", async () => {
    respond.mockResolvedValueOnce({ booking: { id: "b7" } }).mockResolvedValueOnce({});
    await renderDetail(quote({ status: "VIEWED" }));
    fireEvent.click(screen.getByText("acceptQuotation"));
    fireEvent.click(screen.getAllByText("acceptQuotation")[1]);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings/b7"));
    fireEvent.click(screen.getByText("acceptQuotation"));
    fireEvent.click(screen.getAllByText("acceptQuotation")[1]);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings"));
  });

  it("shows accept errors from the API or a generic message", async () => {
    respond.mockRejectedValueOnce(new ApiError(409, "Vehicle already booked")).mockRejectedValueOnce(new Error("x"));
    await renderDetail();
    fireEvent.click(screen.getByText("acceptQuotation"));
    fireEvent.click(screen.getAllByText("acceptQuotation")[1]);
    expect((await screen.findByRole("alert")).textContent).toBe("Vehicle already booked");
    fireEvent.click(screen.getAllByText("acceptQuotation")[1]);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("submitFailed"));
  });

  it("declines with an optional reason and reloads", async () => {
    respond.mockResolvedValue({});
    await renderDetail();
    fireEvent.click(screen.getByText("decline"));
    fireEvent.change(screen.getByPlaceholderText("confirm.rejectReasonPlaceholder"), { target: { value: "  Too pricey " } });
    fireEvent.click(screen.getAllByText("decline")[1]);
    await waitFor(() => expect(getById).toHaveBeenCalledTimes(2));
    expect(respond).toHaveBeenCalledWith("q1", { status: "REJECTED", rejectionReason: "Too pricey" });
  });

  it("declines without a reason; errors are surfaced; the dialog can be cancelled", async () => {
    respond.mockRejectedValueOnce(new ApiError(400, "Already expired")).mockRejectedValueOnce(new Error("x"));
    await renderDetail();
    fireEvent.click(screen.getByText("decline"));
    fireEvent.click(screen.getAllByText("decline")[1]);
    expect((await screen.findByRole("alert")).textContent).toBe("Already expired");
    expect(respond.mock.calls[0][1].rejectionReason).toBeUndefined();
    fireEvent.click(screen.getAllByText("decline")[1]);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("submitFailed"));
    fireEvent.click(screen.getByText("confirm.cancelAction"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    ["PENDING", "statusBanner.pendingTitle"],
    ["EXPIRED", "statusBanner.expiredBody"],
    ["ACCEPTED", "statusBanner.acceptedBody"],
  ])("shows the %s banner and hides the actions", async (status: string, text: string) => {
    await renderDetail(quote({ status }));
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("decline")).toBeNull();
  });

  it("shows the rejection reason and a booking chat link", async () => {
    await renderDetail(quote({ status: "REJECTED", rejectionReason: "Found cheaper", booking: { id: "b5" } }));
    expect(screen.getByText("statusBanner.rejectedBody")).toBeTruthy();
    expect(screen.getByText("rejectionReason: Found cheaper", { exact: false })).toBeTruthy();
    expect(screen.getByText('chatWithOwner:{"defaultValue":"Chat with owner"}').closest("a")!.getAttribute("href")).toBe("/en/dashboard/messages?booking=b5");
  });

  it("renders an unpriced quotation with sparse data", async () => {
    await renderDetail(
      quote({
        status: "UNKNOWN",
        totalAmount: 0,
        tripId: null,
        startDate: null,
        endDate: null,
        startTime: null,
        estimatedDistance: null,
        specialRequests: null,
        pickupLocation: null,
        dropoffLocation: null,
        passengerCount: undefined,
        customItems: "bad",
        itineraryRoute: null,
        trip: null,
        rejectionReason: null,
        vehicle: { brand: "Tata", model: "LP", images: [] },
      }),
    );
    expect(screen.getAllByText("Tata LP").length).toBe(2);
    expect(screen.queryByText("priceBreakdown")).toBeNull();
    expect(screen.getByText("back").closest("a")!.getAttribute("href")).toBe("/en/dashboard/trips");
    expect(screen.getByText("noDestination")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBe(3);
    expect(h.map.initialWaypoints).toEqual([]);
    expect(h.map.initialRouteGeometry).toEqual([]);
    expect(screen.queryByText(/ownerContact/)).toBeNull();
  });

  it("names the vehicle by plate, or unassigned, and shows single-day dates", async () => {
    await renderDetail(
      quote({
        vehicle: { licensePlate: "WP-1", owner: { firstName: "A", lastName: "B" } },
        endDate: "2026-12-01T00:00:00Z",
        validUntil: null,
        tollCharges: 0,
        tax: 0,
        additionalNotes: null,
      }),
    );
    expect(screen.getAllByText("WP-1").length).toBeGreaterThan(0);
    expect(screen.queryByText(/dateRange/)).toBeNull();
    expect(screen.queryByText("validUntil", { exact: false })).toBeNull();
    expect(screen.queryByText("tollCharges")).toBeNull();
  });

  it("falls back to 'vehicle unassigned' without a vehicle", async () => {
    await renderDetail(quote({ vehicle: null }));
    expect(screen.getByText("vehicleUnassigned")).toBeTruthy();
  });

  it("shows API errors, generic errors and the not-found state", async () => {
    getById.mockRejectedValueOnce(new ApiError(404, "Quotation missing"));
    const { unmount } = render(<QuotationDetailPageContent locale="si" requestId="q1" />);
    expect(await screen.findByText("Quotation missing")).toBeTruthy();
    unmount();
    getById.mockRejectedValueOnce(new Error("x"));
    const second = render(<QuotationDetailPageContent locale="en" requestId="q1" />);
    await waitFor(() => expect(screen.getAllByText("errorLoadingQuotations").length).toBe(2));
    second.unmount();
    getById.mockResolvedValueOnce(null);
    render(<QuotationDetailPageContent locale="en" requestId="q1" />);
    expect(await screen.findByText("quotationNotFound")).toBeTruthy();
    expect(screen.getByText("backToTrips").closest("a")!.getAttribute("href")).toBe("/en/dashboard/trips");
  });

  it("formats amounts for non-English locales", async () => {
    getById.mockResolvedValue(quote());
    render(<QuotationDetailPageContent locale="si" requestId="q1" />);
    await screen.findByTestId("map");
    expect(screen.getAllByText(/^LKR /).length).toBeGreaterThan(3);
  });
});
