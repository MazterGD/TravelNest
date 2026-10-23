/**
 * Trip detail page: status banners, trip facts, quotation responses list,
 * compare link, map waypoints and the cancel-trip confirmation.
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  guard: { isLoading: false, isAuthorized: true },
  map: {} as any,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/dashboard/trips/t1",
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
  tripService: { getById: vi.fn(), cancel: vi.fn() },
}));

import { TripDetailPageContent } from "@/app/[locale]/dashboard/trips/[id]/TripDetailPageContent";
import { ApiError, tripService } from "@/lib/api";

const getById = tripService.getById as any;
const cancel = tripService.cancel as any;

const trip = (over: Record<string, any> = {}) => ({
  id: "t1",
  tripCode: "TRP-001",
  status: "AWAITING_QUOTES",
  title: null,
  pickupLocation: "Colombo, Western",
  pickupCity: null,
  dropoffLocation: "Kandy, Central",
  dropoffCity: null,
  pickupLatitude: 6.9,
  pickupLongitude: 79.8,
  dropoffLatitude: 7.3,
  dropoffLongitude: 80.6,
  startDate: "2026-12-01T00:00:00Z",
  endDate: "2026-12-03T00:00:00Z",
  startTime: "07:00",
  passengerCount: 30,
  needsAC: true,
  vehicleTypePreference: "LUXURY_AC",
  specialRequests: "Roof rack",
  estimatedDistance: "116 km",
  estimatedDuration: "3h",
  itineraryRoute: { coordinates: [[79.8, 6.9], [80.6, 7.3]] },
  intermediateStops: [
    { location: { city: "Kegalle", lat: 7.25, lng: 80.35 } },
    { location: { address: "Pinnawala", lat: 7.3, lng: 80.38 } },
    { location: { city: "NoCoords" } },
    { location: {} },
  ],
  quotations: [
    { id: "q1", status: "SENT", totalAmount: 50000, vehicleId: "v1", vehicle: { brand: "Ashok", model: "Viking", owner: { firstName: "Sunil", lastName: "Perera" } } },
    { id: "q2", status: "ACCEPTED", totalAmount: 45000, vehicleId: "v2", vehicle: { name: "Hill Coach" } },
    { id: "q3", status: "PENDING", vehicleId: "v3", vehicle: { licensePlate: "WP-1" } },
    { id: "q4", status: "PENDING", vehicleId: null },
    { id: "q5", status: "REJECTED", totalAmount: 0, vehicleId: "v5" },
    { id: "q6", status: null, vehicleId: "v6" },
  ],
  ...over,
});

const renderTrip = async (data: any = trip()) => {
  getById.mockResolvedValue(data);
  render(<TripDetailPageContent locale="en" tripId="t1" />);
  await waitFor(() => expect(screen.queryByTestId("map") || screen.queryByRole("alert")).toBeTruthy());
};

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.isLoading = false;
  h.guard.isAuthorized = true;
});

describe("TripDetailPageContent", () => {
  it("does not fetch until authorised", () => {
    h.guard.isAuthorized = false;
    render(<TripDetailPageContent locale="en" tripId="t1" />);
    expect(getById).not.toHaveBeenCalled();
  });

  it("shows trip facts, quotation responses and the compare link", async () => {
    await renderTrip({ data: { trip: trip() } });
    expect(getById).toHaveBeenCalledWith("t1");
    expect(screen.getByText("TRP-001")).toBeTruthy();
    expect(screen.getByText("status.awaiting_quotes")).toBeTruthy();
    expect(screen.getByText("Colombo → Kandy")).toBeTruthy();
    expect(screen.getByText('awaitingBannerBody:{"received":2,"total":6}')).toBeTruthy();
    expect(screen.getByText('quotationsSubtitle:{"received":2,"total":6}')).toBeTruthy();
    expect(screen.getByText("yes")).toBeTruthy();
    expect(screen.getByText("LUXURY_AC")).toBeTruthy();
    expect(screen.getByText("Roof rack")).toBeTruthy();
    expect(screen.getByText("NoCoords")).toBeTruthy();
    expect(screen.getByText("116 km")).toBeTruthy();
    expect(h.map.initialWaypoints.map((w: any) => w.name)).toEqual(["Colombo, Western", "Kegalle", "Pinnawala", "Kandy, Central"]);
    expect(h.map.initialRouteGeometry).toEqual([[6.9, 79.8], [7.3, 80.6]]);
    expect(screen.getByText("compareQuotations").closest("a")!.getAttribute("href")).toBe("/en/dashboard/quotations/compare?tripId=t1");
    const links = Array.from(document.querySelectorAll('a[href^="/en/dashboard/quotations/q"]'));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/en/dashboard/quotations/q1",
      "/en/dashboard/quotations/q2",
      "/en/dashboard/quotations/q3",
      "/en/dashboard/quotations/q5",
      "/en/dashboard/quotations/q6",
    ]);
    expect(links[0].textContent).toContain("Ashok Viking");
    expect(links[0].textContent).toContain("Sunil Perera");
    expect(links[0].textContent).toContain("LKR 50,000");
    expect(links[1].textContent).toContain("Hill Coach");
    expect(links[2].textContent).toContain("WP-1");
    expect(links[2].textContent).toContain("—");
    expect(links[3].textContent).toContain("vehicleUnassigned");
    expect(links[3].textContent).toContain("ownerFallback");
    expect(screen.getByText("addMoreVehicles").closest("a")!.getAttribute("href")).toBe("/en/dashboard/search?tripId=t1");
  });

  it("shows the planning banner and an empty quotes list with an add-vehicles CTA", async () => {
    await renderTrip(
      trip({
        status: "PLANNING", title: "Office outing", quotations: undefined, intermediateStops: null,
        startTime: null, vehicleTypePreference: null, specialRequests: null, needsAC: false,
        estimatedDistance: null, estimatedDuration: null, itineraryRoute: null,
        endDate: "2026-12-01T00:00:00Z", pickupLatitude: null, dropoffLatitude: null,
        pickupCity: "Colombo", dropoffCity: "Kandy",
      }),
    );
    expect(screen.getByText("planningBannerTitle")).toBeTruthy();
    expect(screen.getByText("Office outing")).toBeTruthy();
    expect(screen.getByText("noQuotesTitle")).toBeTruthy();
    expect(screen.getAllByText("addMoreVehicles").length).toBe(2);
    expect(screen.getByText("no")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBe(2);
    expect(screen.queryByText(/dateRange/)).toBeNull();
    expect(screen.queryByText("compareQuotations")).toBeNull();
    expect(h.map.initialWaypoints).toEqual([]);
    expect(h.map.initialRouteGeometry).toEqual([]);
  });

  it.each(["CONFIRMED", "COMPLETED", "CANCELLED", "EXPIRED"])(
    "a %s trip has no banner and cannot be edited or cancelled",
    async (status: string) => {
      await renderTrip(trip({ status, quotations: [], dropoffLocation: null }));
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByText("cancelTrip")).toBeNull();
      expect(screen.queryByText("addMoreVehicles")).toBeNull();
      expect(screen.getAllByText("noDestination").length).toBe(1);
      expect(screen.getByText("Colombo → noDestination")).toBeTruthy();
    },
  );

  it("cancels the trip after confirmation and reloads", async () => {
    cancel.mockResolvedValue({});
    await renderTrip();
    fireEvent.click(screen.getByText("cancelTrip"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByText("keepTrip"));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("cancelTrip"));
    fireEvent.click(screen.getByText("confirmCancel"));
    await waitFor(() => expect(getById).toHaveBeenCalledTimes(2));
    expect(cancel).toHaveBeenCalledWith("t1");
  });

  it("shows the API error when cancelling fails", async () => {
    cancel.mockRejectedValue(new ApiError(409, "Trip has a booking"));
    await renderTrip();
    fireEvent.click(screen.getByText("cancelTrip"));
    fireEvent.click(screen.getByText("confirmCancel"));
    expect((await screen.findByRole("alert")).textContent).toBe("Trip has a booking");
  });

  it("shows a generic message when cancelling fails unexpectedly", async () => {
    cancel.mockRejectedValue(new Error("x"));
    await renderTrip();
    fireEvent.click(screen.getByText("cancelTrip"));
    fireEvent.click(screen.getByText("confirmCancel"));
    expect((await screen.findByRole("alert")).textContent).toBe("cancelFailed");
  });

  it("shows load errors and not-found", async () => {
    getById.mockRejectedValueOnce(new ApiError(404, "No such trip"));
    const first = render(<TripDetailPageContent locale="en" tripId="t1" />);
    expect((await screen.findByRole("alert")).textContent).toBe("No such trip");
    expect(screen.getByText("backToTrips").closest("a")!.getAttribute("href")).toBe("/en/dashboard/trips");
    first.unmount();
    getById.mockRejectedValueOnce(new Error("x"));
    const second = render(<TripDetailPageContent locale="en" tripId="t1" />);
    expect((await screen.findByRole("alert")).textContent).toBe("fetchError");
    second.unmount();
    getById.mockResolvedValueOnce(undefined);
    render(<TripDetailPageContent locale="si" tripId="t1" />);
    expect((await screen.findByRole("alert")).textContent).toBe("notFound");
  });

  it("formats amounts for other locales", async () => {
    getById.mockResolvedValue(trip());
    render(<TripDetailPageContent locale="ta" tripId="t1" />);
    await screen.findByTestId("map");
    expect(screen.getAllByText(/^LKR /).length).toBe(2);
  });
});
