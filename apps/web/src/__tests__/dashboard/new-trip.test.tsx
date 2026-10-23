/**
 * New trip form: validation, stop editing, route estimates, draft saving and
 * the post-create redirect (trip detail vs. straight into a quotation).
 */
import { configure, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  push: vi.fn(),
  router: null as any,
  params: new URLSearchParams(),
  guard: { isLoading: false, isAuthorized: true },
  auth: { user: { id: "u1" } as any },
  map: {} as any,
  nextLocation: {} as Record<string, any>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => (h.router ??= { push: h.push, replace: vi.fn() }),
  useSearchParams: () => h.params,
  usePathname: () => "/en/dashboard/trips/new",
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
      <button type="button" onClick={() => onSelectLocation(h.nextLocation[placeholder])}>{`pick:${placeholder}`}</button>
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
  tripService: { create: vi.fn() },
  landingContentService: { getPublicConfig: vi.fn(), getRouteEstimate: vi.fn() },
}));

import { NewTripPageContent } from "@/app/[locale]/dashboard/trips/new/NewTripPageContent";
import { ApiError, landingContentService, tripService } from "@/lib/api";

const create = tripService.create as any;
const config = landingContentService.getPublicConfig as any;
const estimate = landingContentService.getRouteEstimate as any;

const pick = (placeholder: string, loc: Record<string, any>) => {
  h.nextLocation[placeholder] = loc;
  fireEvent.click(screen.getByText(`pick:${placeholder}`));
};
const submit = () => fireEvent.click(screen.getByText("createTrip"));
const fillMinimum = () => {
  pick("pickupLocation", { displayName: "Colombo, Western", city: "Colombo", district: "Colombo", lat: 6.9, lng: 79.8 });
  fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
  fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: "07:30" } });
};
const renderForm = async () => {
  render(<NewTripPageContent locale="en" />);
  await waitFor(() => expect(config).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.params = new URLSearchParams();
  h.guard.isLoading = false;
  h.guard.isAuthorized = true;
  h.auth.user = { id: "u1" };
  h.nextLocation = {};
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  config.mockResolvedValue({ options: { quotationVehicleTypes: [{ value: "LUXURY_AC", label: "Luxury AC" }] } });
  estimate.mockResolvedValue({ displayDistance: "116 km", displayDuration: "2h 30m" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NewTripPageContent", () => {
  it("shows a spinner until the customer is signed in and authorised", () => {
    h.guard.isAuthorized = false;
    render(<NewTripPageContent locale="en" />);
    expect(screen.queryByText("newTitle")).toBeNull();
  });

  it("validates pickup, date, time, return date and passengers in order", async () => {
    await renderForm();
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe("validation.pickup");
    pick("pickupLocation", { displayName: "Colombo, W", city: "", district: "Colombo" });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validation.pickupDate");
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validation.pickupTime");
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: "07:30" } });
    fireEvent.click(screen.getByText("roundTrip"));
    expect(screen.getByText("roundTrip").getAttribute("aria-pressed")).toBe("true");
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validation.returnDate");
    fireEvent.change(document.querySelectorAll('input[type="date"]')[1], { target: { value: "2026-12-03" } });
    const pax = screen.getByLabelText("passengersLabel") as HTMLInputElement;
    fireEvent.change(pax, { target: { value: "" } });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("validation.passengers");
    fireEvent.blur(pax);
    expect(pax.value).toBe("1");
    fireEvent.change(pax, { target: { value: "x40" } });
    fireEvent.change(pax, { target: { value: "0" } });
    fireEvent.blur(pax);
    expect(pax.value).toBe("40");
    fireEvent.click(screen.getByText("oneWay"));
    expect(document.querySelectorAll('input[type="date"]').length).toBe(1);
  });

  it("creates a round trip with all preferences and opens the trip", async () => {
    create.mockResolvedValue({ trip: { id: "t1" } });
    await renderForm();
    fillMinimum();
    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), { target: { value: "  Office outing " } });
    pick("destination", { displayName: "Kandy, Central", city: "", district: "Kandy", lat: 7.29, lng: 80.63 });
    fireEvent.click(screen.getByText("roundTrip"));
    fireEvent.change(document.querySelectorAll('input[type="date"]')[1], { target: { value: "2026-12-03" } });
    fireEvent.change(document.querySelector("select")!, { target: { value: "LUXURY_AC" } });
    fireEvent.click(document.querySelector('input[type="checkbox"]')!);
    fireEvent.change(screen.getByPlaceholderText("specialRequestsPlaceholder"), { target: { value: "Wheelchair" } });
    fireEvent.click(screen.getByText("addIntermediateStop"));
    fireEvent.click(screen.getByText("addIntermediateStop"));
    pick('stopLabel:{"index":1}', { displayName: "Kegalle, Sab", district: "Kegalle", lat: 7.25, lng: 80.35 });
    await waitFor(() => expect(screen.getByText("116 km")).toBeTruthy());
    expect(h.map.initialWaypoints.map((w: any) => w.name)).toEqual(["Colombo", "Kegalle", "Kandy"]);
    expect(estimate.mock.calls.at(-1)[0].intermediateStops.map((s: any) => s.city)).toEqual(["Kegalle"]);
    act(() => h.map.onRouteCalculated({ route: { distanceKm: 130.26, durationMinutes: 200, optimizedWaypoints: [{ n: 1 }], geometry: { g: 1 } } }));
    expect(screen.getByText("130.3 km")).toBeTruthy();
    expect(screen.getByText("3h 20m")).toBeTruthy();
    submit();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/trips/t1"));
    const payload = create.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Office outing",
      isRoundTrip: true,
      vehicleTypePreference: "LUXURY_AC",
      needsAC: false,
      specialRequests: "Wheelchair",
      startTime: "07:30",
      estimatedDistance: "130.3 km",
      itineraryStops: [{ n: 1 }],
      itineraryRoute: { g: 1 },
    });
    expect(payload.dropoffLocation).toMatchObject({ address: "Kandy, Central", city: "Kandy", district: "Kandy" });
    expect(payload.intermediateStops.map((s: any) => s.location.city)).toEqual(["Kegalle"]);
    expect(payload.endDate).toBe(new Date("2026-12-03").toISOString());
  });

  it("sends a minimal one-way trip with no destination", async () => {
    create.mockResolvedValue({ data: { trip: { id: "t2" } } });
    await renderForm();
    fillMinimum();
    fireEvent.change(screen.getByPlaceholderText("pickupLocation"), { target: { value: "Colombo 3" } });
    submit();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/trips/t2"));
    const payload = create.mock.calls[0][0];
    expect(payload.title).toBeUndefined();
    expect(payload.dropoffLocation).toBeUndefined();
    expect(payload.endDate).toBeUndefined();
    expect(payload.vehicleTypePreference).toBeUndefined();
    expect(payload.specialRequests).toBeUndefined();
    expect(payload.itineraryStops).toBeUndefined();
    expect(payload.itineraryRoute).toBeUndefined();
    expect(payload.pickupLocation).toMatchObject({ address: "Colombo 3", city: "Colombo 3" });
  });

  it("goes to the trips list when no id comes back", async () => {
    create.mockResolvedValue({});
    await renderForm();
    fillMinimum();
    submit();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/trips"));
  });

  it("continues into the quotation form when started from a vehicle", async () => {
    h.params = new URLSearchParams("vehicleId=v9");
    create.mockResolvedValue({ trip: { id: "t3" } });
    render(<NewTripPageContent locale="en" />);
    fillMinimum();
    fireEvent.click(screen.getByText("createAndQuote"));
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith("/en/dashboard/quotations/new?vehicleId=v9&tripId=t3"),
    );
  });

  it("removes the stored draft after creating the trip", async () => {
    localStorage.setItem("trip-draft", "{}");
    create.mockResolvedValue({ trip: { id: "t1" } });
    await renderForm();
    fillMinimum();
    submit();
    await waitFor(() => expect(localStorage.getItem("trip-draft")).toBeNull());
  });

  it("shows API and generic errors", async () => {
    create.mockRejectedValueOnce(new ApiError(400, "Dates overlap"));
    await renderForm();
    fillMinimum();
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe("Dates overlap");
    create.mockRejectedValueOnce(new Error("x"));
    submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("submitFailed"));
  });

  it("edits, reorders and removes stops", async () => {
    await renderForm();
    fireEvent.click(screen.getByText("addIntermediateStop"));
    fireEvent.click(screen.getByText("addIntermediateStop"));
    const s1 = 'stopLabel:{"index":1}';
    fireEvent.change(screen.getByPlaceholderText(s1), { target: { value: "Galle" } });
    fireEvent.change(screen.getByPlaceholderText('stopLabel:{"index":2}'), { target: { value: "Matara" } });
    expect((screen.getAllByLabelText("moveStopUp")[0] as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByLabelText("moveStopDown")[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByLabelText("moveStopDown")[0]);
    expect((screen.getByPlaceholderText(s1) as HTMLInputElement).value).toBe("Matara");
    fireEvent.click(screen.getAllByLabelText("moveStopUp")[1]);
    expect((screen.getByPlaceholderText(s1) as HTMLInputElement).value).toBe("Galle");
    fireEvent.click(screen.getAllByLabelText("removeStop")[0]);
    expect((screen.getByPlaceholderText(s1) as HTMLInputElement).value).toBe("Matara");
  });

  it("clears estimates on route errors and ignores empty map results", async () => {
    estimate.mockRejectedValue(new Error("down"));
    await renderForm();
    pick("pickupLocation", { displayName: "Colombo", city: "Colombo", district: "Colombo" });
    pick("destination", { displayName: "Kandy", city: "Kandy", district: "Kandy" });
    await waitFor(() => expect(estimate).toHaveBeenCalled());
    expect(screen.getAllByText("—").length).toBe(2);
    act(() => h.map.onRouteCalculated({ route: { distanceKm: 4, durationMinutes: 20 } }));
    expect(screen.getByText("20m")).toBeTruthy();
    act(() => h.map.onRouteCalculated(undefined));
    expect(screen.getByText("20m")).toBeTruthy();
  });

  it("saves a draft and hides the confirmation after three seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderForm();
    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), { target: { value: "Pilgrimage" } });
    fireEvent.click(screen.getByText("saveDraft"));
    expect(screen.getByRole("status").textContent).toBe("draftSaved");
    expect(JSON.parse(localStorage.getItem("trip-draft")!).title).toBe("Pilgrimage");
    act(() => vi.advanceTimersByTime(3100));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps working when the config request fails or has no types", async () => {
    config.mockRejectedValueOnce(new Error("down"));
    const { unmount } = await (async () => {
      const r = render(<NewTripPageContent locale="en" />);
      await waitFor(() => expect(console.error).toHaveBeenCalled());
      return r;
    })();
    unmount();
    config.mockResolvedValueOnce({ options: {} });
    await renderForm();
    expect(screen.getByText("newTitle")).toBeTruthy();
  });

  it.todo("restores a saved trip draft from localStorage when the form re-opens (Save draft currently has no restore path)");
});
