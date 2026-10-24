/**
 * New quotation request form: trip-attachment chooser, location/stop editing,
 * route estimates, validation, draft saving and submission routing.
 */
import { configure, act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  push: vi.fn(),
  router: null as any,
  params: new URLSearchParams(),
  guard: { isLoading: false, isAuthorized: true },
  auth: { user: { id: "u1", firstName: "Nimal" } as any },
  map: {} as any,
  nextLocation: {} as Record<string, any>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => (h.router ??= { push: h.push, replace: vi.fn() }),
  useSearchParams: () => h.params,
  usePathname: () => "/en/dashboard/quotations/new",
  useParams: () => ({ locale: "en" }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => "en",
}));
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
vi.mock("@/components/ui", async (importOriginal: any) => ({
  ...(await importOriginal()),
  LocationAutocomplete: ({ placeholder, value, onChange, onSelectLocation }: any) => (
    <div>
      <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => onSelectLocation(h.nextLocation[placeholder])}>
        {`pick:${placeholder}`}
      </button>
    </div>
  ),
}));
vi.mock("@/store", () => ({ useAuthStore: () => h.auth }));
vi.mock("@/hooks", async (importOriginal: any) => ({
  ...(await importOriginal()),
  useProtectedRoute: () => h.guard,
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  quotationService: { requestQuotation: vi.fn() },
  landingContentService: { getPublicConfig: vi.fn(), getRouteEstimate: vi.fn() },
  vehicleService: { getById: vi.fn() },
  tripService: { getActive: vi.fn() },
}));

import { NewQuotationPageContent } from "@/app/[locale]/dashboard/quotations/new/NewQuotationPageContent";
import { ApiError, landingContentService, quotationService, tripService, vehicleService } from "@/lib/api";

const svc = {
  request: quotationService.requestQuotation as any,
  config: landingContentService.getPublicConfig as any,
  estimate: landingContentService.getRouteEstimate as any,
  vehicle: vehicleService.getById as any,
  active: tripService.getActive as any,
};

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

const trip = (over: Record<string, any> = {}) => ({
  id: "t1",
  tripCode: "TRP-1",
  title: "Family trip",
  pickupLocation: "Colombo, Western",
  pickupCity: "Colombo",
  pickupDistrict: "Colombo",
  pickupLatitude: 6.9,
  pickupLongitude: 79.8,
  dropoffLocation: "Kandy, Central",
  dropoffCity: "Kandy",
  dropoffDistrict: "Kandy",
  dropoffLatitude: 7.29,
  dropoffLongitude: 80.63,
  intermediateStops: [{ id: "s1", location: { address: "Kegalle", city: "Kegalle", district: "Kegalle", lat: 7.2, lng: 80.3 } }],
  startDate: future(5),
  endDate: future(7),
  startTime: "07:00",
  isRoundTrip: true,
  passengerCount: 30,
  vehicleTypePreference: "LUXURY_AC",
  needsAC: false,
  specialRequests: "Roof rack",
  estimatedDistance: "120 km",
  estimatedDuration: "3h",
  ...over,
});

const pickLoc = (placeholder: string, loc: Record<string, any>) => {
  h.nextLocation[placeholder] = loc;
  fireEvent.click(screen.getByText(`pick:${placeholder}`));
};

const fillValidForm = () => {
  pickLoc("pickupLocation", { displayName: "Colombo, Western", city: "Colombo", district: "Colombo", lat: 6.9, lng: 79.8 });
  pickLoc("destination", { displayName: "Galle, Southern", city: "", district: "Galle", lat: 6.03, lng: 80.21 });
  const [date] = document.querySelectorAll('input[type="date"]');
  fireEvent.change(date, { target: { value: "2026-12-01" } });
  fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: "08:00" } });
};

const renderForm = async () => {
  render(<NewQuotationPageContent locale="en" />);
  await waitFor(() => expect(svc.active).toHaveBeenCalled());
  await waitFor(() => expect(svc.config).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.params = new URLSearchParams("vehicleId=v1");
  h.guard.isLoading = false;
  h.guard.isAuthorized = true;
  h.auth.user = { id: "u1" };
  h.nextLocation = {};
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  svc.vehicle.mockResolvedValue({ vehicle: { id: "v1", brand: "Ashok", model: "Viking", type: "LUXURY_AC", licensePlate: "NB-1", seats: 40, amenities: ["WiFi", "TV"] } });
  svc.active.mockResolvedValue({ trips: [] });
  svc.config.mockResolvedValue({
    options: { districts: ["Colombo"], quotationVehicleTypes: [{ value: "ORDINARY", label: "Ordinary" }] },
    recentSearches: [{ id: "r1", from: "Matara", to: "Ella", date: "2026-11-01", passengers: 12 }],
  });
  svc.estimate.mockResolvedValue({ displayDistance: "116 km", displayDuration: "2h 30m" });
});

describe("NewQuotationPageContent", () => {
  it("shows a spinner until the customer is authorised and signed in", () => {
    h.auth.user = null;
    render(<NewQuotationPageContent locale="en" />);
    expect(screen.queryByText("requestQuotation")).toBeNull();
  });

  it("redirects to search when no vehicle is chosen", async () => {
    h.params = new URLSearchParams();
    await renderForm();
    expect(h.push).toHaveBeenCalledWith("/en/dashboard/search");
    expect(svc.vehicle).not.toHaveBeenCalled();
  });

  it("loads the selected vehicle and its amenities", async () => {
    await renderForm();
    expect(svc.vehicle).toHaveBeenCalledWith("v1");
    expect(await screen.findByText("Ashok Viking")).toBeTruthy();
    expect(screen.getByText("LUXURY_AC • NB-1")).toBeTruthy();
    const wifi = screen.getByText("WiFi").previousSibling as HTMLInputElement;
    fireEvent.click(wifi);
    expect(wifi.checked).toBe(true);
    fireEvent.click(wifi);
    expect(wifi.checked).toBe(false);
    expect(screen.getByText("tripAttachment.willCreate")).toBeTruthy();
    expect(screen.queryByText("tripAttachment.choose")).toBeNull();
  });

  it("tolerates a vehicle response without data or amenities", async () => {
    svc.vehicle.mockResolvedValueOnce(null);
    const { unmount } = render(<NewQuotationPageContent locale="en" />);
    await waitFor(() => expect(svc.vehicle).toHaveBeenCalled());
    expect(screen.queryByText("Required Amenities")).toBeNull();
    unmount();
    svc.vehicle.mockResolvedValueOnce({ id: "v1", brand: "Tata" });
    render(<NewQuotationPageContent locale="en" />);
    expect(await screen.findByText("Tata", { exact: false })).toBeTruthy();
    svc.vehicle.mockRejectedValueOnce(new Error("x"));
  });

  it("asks which trip to attach to, then pre-fills the form from the chosen trip", async () => {
    svc.active.mockResolvedValue({ data: { trips: [trip(), trip({ id: "old", endDate: "2020-01-01" })] } });
    await renderForm();
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Family trip")).toBeTruthy();
    fireEvent.click(screen.getByText("Family trip"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText('tripAttachment.attached:{"trip":"Family trip"}')).toBeTruthy();
    expect((screen.getByPlaceholderText("pickupLocation") as HTMLInputElement).value).toBe("Colombo, Western");
    expect((screen.getByPlaceholderText('stopLabel:{"index":1}') as HTMLInputElement).value).toBe("Kegalle");
    expect(screen.getByText("roundTrip")).toBeTruthy();
    expect((screen.getByLabelText("Passenger count") as HTMLInputElement).value).toBe("30");
    expect((screen.getByPlaceholderText("specialRequestsPlaceholder") as HTMLTextAreaElement).value).toBe("Roof rack");
    expect(document.querySelectorAll('input[type="date"]').length).toBe(2);
    await waitFor(() => expect(screen.getByText("116 km")).toBeTruthy());

    svc.request.mockResolvedValue({ quotation: { tripId: "t1" } });
    fireEvent.click(screen.getByText("requestQuotations"));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/trips/t1"));
    const payload = svc.request.mock.calls[0][0];
    expect(payload).toMatchObject({ vehicleId: "v1", tripId: "t1", isRoundTrip: true, passengerCount: 30, vehicleType: "LUXURY_AC", needsAC: false, specialRequests: "Roof rack", startTime: "07:00" });
    expect(payload.endDate).toBe(trip().endDate.split("T")[0]);

    fireEvent.click(screen.getByText("tripAttachment.change"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByText("tripPrompt.startNew"));
    expect(screen.getByText("tripAttachment.willCreate")).toBeTruthy();
    expect(screen.getByText("tripAttachment.choose")).toBeTruthy();
  });

  it("builds trip titles from cities when a trip has no title and handles sparse trips", async () => {
    svc.active.mockResolvedValue({
      trips: [
        trip({ id: "a", title: null, pickupCity: null, dropoffCity: null, dropoffLocation: "Ella, Uva" }),
        trip({
          id: "b", title: null, pickupCity: null, pickupLocation: "Jaffna", dropoffLocation: null, dropoffCity: null,
          intermediateStops: [{ location: null }], startDate: future(3), endDate: future(3), startTime: null,
          vehicleTypePreference: null, specialRequests: null, estimatedDistance: null, estimatedDuration: null,
          pickupDistrict: null, pickupLatitude: null, pickupLongitude: null,
        }),
      ],
    });
    await renderForm();
    expect(await screen.findByText("Colombo → Ella")).toBeTruthy();
    expect(screen.getByText("Jaffna → tripPrompt.noDestination")).toBeTruthy();
    fireEvent.click(screen.getByText("Jaffna → tripPrompt.noDestination"));
    expect(screen.getByText('tripAttachment.attached:{"trip":"Family trip"}'.replace("Family trip", "TRP-1"))).toBeTruthy();
    expect((screen.getByPlaceholderText("pickupLocation") as HTMLInputElement).value).toBe("Jaffna");
    expect(document.querySelectorAll('input[type="date"]').length).toBe(1);
  });

  it("skips the chooser for a trip pre-attached via the URL", async () => {
    h.params = new URLSearchParams("vehicleId=v1&tripId=t9");
    svc.active.mockResolvedValue({ trips: [trip()] });
    await renderForm();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("tripAttachment.attachedGeneric")).toBeTruthy();
    expect(screen.getByText("tripAttachment.change")).toBeTruthy();
  });

  it("resolves the prompt when loading trips fails", async () => {
    svc.active.mockRejectedValue(new Error("down"));
    await renderForm();
    expect(await screen.findByText("tripAttachment.willCreate")).toBeTruthy();
  });

  it("validates each required field in order", async () => {
    await renderForm();
    const submit = () => fireEvent.click(screen.getByText("requestQuotations"));
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe("validationError.pickup");
    pickLoc("pickupLocation", { displayName: "Colombo, W", city: "Colombo", district: "Colombo" });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validationError.dropoff");
    pickLoc("destination", { displayName: "Kandy, C", city: "Kandy", district: "Kandy" });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validationError.pickupDate");
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validationError.pickupTime");
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: "08:00" } });
    fireEvent.click(screen.getByText("roundTrip"));
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validationError.returnDate");
    fireEvent.change(document.querySelectorAll('input[type="date"]')[1], { target: { value: "2026-12-03" } });
    const pax = screen.getByLabelText("Passenger count") as HTMLInputElement;
    fireEvent.change(pax, { target: { value: "" } });
    expect(pax.value).toBe("");
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validationError.passengers");
    fireEvent.blur(pax);
    expect(pax.value).toBe("1");
    fireEvent.change(pax, { target: { value: "2a5" } });
    expect(pax.value).toBe("25");
    fireEvent.change(pax, { target: { value: "0" } });
    expect(pax.value).toBe("25");
    fireEvent.blur(pax);
    expect(pax.value).toBe("25");
    fireEvent.click(screen.getByText("oneWay"));
    expect(document.querySelectorAll('input[type="date"]').length).toBe(1);
  });

  it("submits a fresh trip request and routes to the trips list when no trip id comes back", async () => {
    svc.request.mockResolvedValue({});
    await renderForm();
    fillValidForm();
    fireEvent.change(screen.getByPlaceholderText("destination"), { target: { value: "Galle Fort" } });
    fireEvent.change(screen.getByPlaceholderText("pickupLocation"), { target: { value: "Colombo 7" } });
    fireEvent.click(screen.getByText("requestQuotations"));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/trips"));
    const payload = svc.request.mock.calls[0][0];
    expect(payload.tripId).toBeUndefined();
    expect(payload.vehicleType).toBe("ORDINARY");
    expect(payload.endDate).toBeUndefined();
    expect(payload.specialRequests).toBeUndefined();
    expect(payload.itineraryStops).toBeUndefined();
    expect(payload.itineraryRoute).toBeUndefined();
    expect(payload.pickupLocation).toMatchObject({ address: "Colombo 7", city: "Colombo 7", district: "Colombo" });
    expect(payload.dropoffLocation).toMatchObject({ address: "Galle Fort", district: "Galle" });
  });

  it("routes to the nested trip id from a wrapped response", async () => {
    svc.request.mockResolvedValue({ data: { quotation: { tripId: "t42" } } });
    await renderForm();
    fillValidForm();
    fireEvent.click(screen.getByText("requestQuotations"));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/trips/t42"));
  });

  it("uses the dropoff address fallback to city when address is empty", async () => {
    svc.request.mockResolvedValue({});
    await renderForm();
    fillValidForm();
    fireEvent.click(screen.getByText("pick:pickupLocation"));
    h.nextLocation.pickupLocation = { displayName: "", city: "Negombo", district: "Gampaha" };
    fireEvent.click(screen.getByText("pick:pickupLocation"));
    fireEvent.click(screen.getByText("requestQuotations"));
    await waitFor(() => expect(svc.request).toHaveBeenCalled());
    expect(svc.request.mock.calls[0][0].pickupLocation.address).toBe("Negombo");
  });

  it("shows the API error message, or a generic one for unknown failures", async () => {
    svc.request.mockRejectedValueOnce(new ApiError(409, "Vehicle unavailable"));
    await renderForm();
    fillValidForm();
    fireEvent.click(screen.getByText("requestQuotations"));
    expect((await screen.findByRole("alert")).textContent).toBe("Vehicle unavailable");
    svc.request.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(screen.getByText("requestQuotations"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("submitFailed"));
  });

  it("adds, edits, reorders and removes intermediate stops and feeds them to the map", async () => {
    await renderForm();
    fillValidForm();
    fireEvent.click(screen.getByText("addIntermediateStop"));
    fireEvent.click(screen.getByText("addIntermediateStop"));
    const s1 = 'stopLabel:{"index":1}';
    const s2 = 'stopLabel:{"index":2}';
    pickLoc(s1, { displayName: "Kalutara, W", city: "Kalutara", district: "Kalutara", lat: 6.58, lng: 79.96 });
    fireEvent.change(screen.getByPlaceholderText(s2), { target: { value: "Bentota" } });
    await waitFor(() => expect(h.map.initialWaypoints.map((w: any) => w.name)).toEqual(["Colombo", "Kalutara", "Galle"]));
    await waitFor(() => expect(svc.estimate).toHaveBeenCalled());
    const lastCall = svc.estimate.mock.calls.at(-1)[0];
    expect(lastCall.intermediateStops.map((s: any) => s.city)).toEqual(["Kalutara"]);

    // Stops are keyed by id, so React moves the DOM nodes: re-query after each move.
    const buttons = (icon: string) =>
      Array.from(document.querySelectorAll("button")).filter((b) => b.querySelector(`.lucide-${icon}`));
    expect(buttons("arrow-up")[0].disabled).toBe(true);
    expect(buttons("arrow-down")[1].disabled).toBe(true);
    fireEvent.click(buttons("arrow-down")[0]);
    expect((screen.getByPlaceholderText(s1) as HTMLInputElement).value).toBe("Bentota");
    fireEvent.click(buttons("arrow-up")[1]);
    expect((screen.getByPlaceholderText(s1) as HTMLInputElement).value).toBe("Kalutara, W");
    fireEvent.click(screen.getAllByLabelText("removeStop")[0]);
    expect((screen.getByPlaceholderText(s1) as HTMLInputElement).value).toBe("Bentota");
  });

  it("clears the estimate when the route API fails and applies map-calculated routes", async () => {
    svc.estimate.mockRejectedValue(new Error("osrm down"));
    await renderForm();
    fillValidForm();
    await waitFor(() => expect(svc.estimate).toHaveBeenCalled());
    expect(screen.getAllByText("—").length).toBe(2);
    act(() => h.map.onRouteCalculated({ route: { distanceKm: 120.44, durationMinutes: 150, optimizedWaypoints: [{ a: 1 }], geometry: { type: "LineString" } } }));
    expect(screen.getByText("120.4 km")).toBeTruthy();
    expect(screen.getByText("2h 30m")).toBeTruthy();
    act(() => h.map.onRouteCalculated({ route: { distanceKm: 5, durationMinutes: 45 } }));
    expect(screen.getByText("45m")).toBeTruthy();
    act(() => h.map.onRouteCalculated(null));
    expect(screen.getByText("45m")).toBeTruthy();
    svc.request.mockResolvedValue({});
    fireEvent.click(screen.getByText("requestQuotations"));
    await waitFor(() => expect(svc.request).toHaveBeenCalled());
    expect(svc.request.mock.calls[0][0].itineraryRoute).toMatchObject({ distanceKm: 5 });
  });

  it("saves a draft to localStorage and confirms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await renderForm();
      fireEvent.change(screen.getByPlaceholderText("specialRequestsPlaceholder"), { target: { value: "Wheelchair" } });
      fireEvent.click(screen.getByText("saveDraft"));
      expect(screen.getByRole("status").textContent).toBe("draftSaved");
      expect(JSON.parse(localStorage.getItem("quotation-draft")!).specialRequirements).toBe("Wheelchair");
      act(() => vi.advanceTimersByTime(3100));
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes the saved draft after a successful submit", async () => {
    localStorage.setItem("quotation-draft", "{}");
    svc.request.mockResolvedValue({});
    await renderForm();
    fillValidForm();
    fireEvent.click(screen.getByText("requestQuotations"));
    await waitFor(() => expect(localStorage.getItem("quotation-draft")).toBeNull());
  });

  it("loads a recent search into the form", async () => {
    await renderForm();
    fireEvent.click(screen.getByText("recentSearchesTitle"));
    fireEvent.click(await screen.findByText("Matara → Ella"));
    expect((screen.getByPlaceholderText("pickupLocation") as HTMLInputElement).value).toBe("Matara");
    expect((screen.getByLabelText("Passenger count") as HTMLInputElement).value).toBe("12");
    expect(screen.queryByText("Matara → Ella")).toBeNull();
  });

  it("survives a failing public config request", async () => {
    svc.config.mockRejectedValue(new Error("down"));
    await renderForm();
    fireEvent.click(screen.getByText("recentSearchesTitle"));
    expect(screen.queryByText("Matara → Ella")).toBeNull();
  });

  it("tolerates a config payload with empty option lists", async () => {
    svc.config.mockResolvedValue({ options: {} });
    await renderForm();
    fireEvent.click(screen.getByText("recentSearchesTitle"));
    expect(screen.getAllByText("recentSearchesTitle").length).toBe(1);
  });

  it.todo("sends the customer's selected 'Required Amenities' with the quotation request (currently collected but dropped from the payload)");
  it("restores a saved draft when the form re-opens, and ignores an unreadable one", async () => {
    localStorage.setItem(
      "quotation-draft",
      JSON.stringify({ passengerCount: 30, specialRequirements: "Roof rack", pickupTime: "07:30" }),
    );
    await renderForm();
    expect((screen.getByPlaceholderText("specialRequestsPlaceholder") as HTMLTextAreaElement).value).toBe("Roof rack");
    expect((screen.getByLabelText("Passenger count") as HTMLInputElement).value).toBe("30");
    cleanup();

    localStorage.setItem("quotation-draft", "{not json");
    await renderForm();
    expect((screen.getByPlaceholderText("specialRequestsPlaceholder") as HTMLTextAreaElement).value).toBe("");
  });
});
