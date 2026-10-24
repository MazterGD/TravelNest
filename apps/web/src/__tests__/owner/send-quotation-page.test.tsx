/**
 * Owner "send quotation" page: request + fleet loading, suitability sorting
 * and warnings, requested-vehicle mode, OSRM-distance-driven pricing, custom
 * line items, validity and the sendQuotation payload / redirect.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  push: vi.fn(),
  mapProps: null as any,
  // Stable translator: the page lists `t` as an effect dependency.
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push, replace: vi.fn() }),
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en/owner/quotations/send/q1",
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
vi.mock("@/lib/api/services", () => ({
  quotationService: { getById: vi.fn(), sendQuotation: vi.fn() },
  vehicleService: { getMyVehicles: vi.fn() },
  landingContentService: { getPublicConfig: vi.fn() },
}));

import { landingContentService, quotationService, vehicleService } from "@/lib/api/services";
import SendQuotationPage from "@/app/[locale]/owner/quotations/send/[id]/page";

const quotes = quotationService as any;
const vehicles = vehicleService as any;
const landing = landingContentService as any;

const pricing = {
  driverCostPercentage: 0.1,
  fuelCostPerKm: 30,
  tollChargesBase: 500,
  permitFeesBase: 0,
  taxRate: 0.1,
  defaultValidityDays: 7,
  validityOptionsDays: [3, 7, 14],
};

const quotation = (overrides: Record<string, unknown> = {}) => ({
  id: "q1",
  vehicleId: null,
  customer: { firstName: "Nimal", lastName: "Perera", email: "nimal@x.lk", phone: "0771234567" },
  pickupLocation: "Colombo",
  dropoffLocation: "Kandy",
  startDate: "2026-11-01T00:00:00.000Z",
  endDate: "2026-11-02T00:00:00.000Z",
  startTime: "07:30 AM",
  estimatedDuration: "3h",
  estimatedDistance: "100 km",
  passengerCount: 40,
  vehicleType: "Luxury AC",
  specialRequests: "Need luggage space",
  itineraryStops: [
    { coordinates: [79.86, 6.93], locationName: "Colombo" },
    { lat: 7.29, lng: 80.63, locationName: "Kandy" },
  ],
  itineraryRoute: { coordinates: [[79.86, 6.93], [80.63, 7.29]] },
  ...overrides,
});

const fleet = [
  { id: "v-small", brand: "Toyota", model: "Coaster", licensePlate: "NB-1", type: "LUXURY_AC", seats: 29, pricePerDay: 20000, pricePerKm: 80, acType: "full-ac" },
  { id: "v-ok", make: "Ashok", model: "Viking", registrationNumber: "NB-2", type: "LUXURY_AC", passengerCapacity: 45, pricePerDay: 30000, pricePerKm: 100, acType: "full-ac", fuelCostPerKm: 40 },
  { id: "v-ord", model: "Lanka", type: "ORDINARY", seats: 50, pricePerDay: 15000 },
  { id: "v-ok2", brand: "Isuzu", model: "Journey", licensePlate: "NB-3", type: "LUXURY_AC", seats: 42, pricePerDay: 25000, pricePerKm: 90 },
];

const renderPage = async (id = "q1") => {
  const params = Promise.resolve({ id, locale: "en" });
  await act(async () => {
    render(
      <Suspense fallback={<div>suspended</div>}>
        <SendQuotationPage params={params} />
      </Suspense>,
    );
    await params;
  });
};

const sendButton = () => screen.getByText("actions.send").closest("button") as HTMLButtonElement;

describe("SendQuotationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    state.mapProps = null;
    landing.getPublicConfig.mockResolvedValue({ quotationPricing: pricing });
    quotes.getById.mockResolvedValue({ quotation: quotation() });
    vehicles.getMyVehicles.mockResolvedValue({ vehicles: fleet });
    quotes.sendQuotation.mockResolvedValue({ quotation: { id: "q1-sent" } });
  });

  it("waits for the guard before loading anything", async () => {
    state.guard = { isLoading: true, isAuthorized: false };
    await renderPage();
    expect(landing.getPublicConfig).not.toHaveBeenCalled();
    expect(screen.queryByText("title")).toBeNull();
  });

  it("shows not-found when the quotation is missing", async () => {
    quotes.getById.mockResolvedValue({ quotation: null });
    await renderPage();
    expect(await screen.findByText("errors.notFound")).toBeTruthy();
    expect(screen.getByText("errors.backToQuotations").closest("a")?.getAttribute("href")).toBe("/en/owner/quotations");
  });

  it("shows not-found with a generic error when loading throws", async () => {
    landing.getPublicConfig.mockRejectedValue(new Error("down"));
    await renderPage();
    expect(await screen.findByText("errors.notFound")).toBeTruthy();
  });

  it("renders request details, map waypoints and vehicles sorted by suitability", async () => {
    await renderPage();
    expect(await screen.findByText("title")).toBeTruthy();
    expect(quotes.getById).toHaveBeenCalledWith("q1");
    expect(screen.getAllByText("Nimal Perera").length).toBeGreaterThan(0);
    expect(screen.getByText("Need luggage space")).toBeTruthy();
    expect(state.mapProps.readOnly).toBe(true);
    expect(state.mapProps.initialWaypoints).toEqual([
      { lat: 6.93, lng: 79.86, name: "Colombo" },
      { lat: 7.29, lng: 80.63, name: "Kandy" },
    ]);
    expect(state.mapProps.initialRouteGeometry).toEqual([[6.93, 79.86], [7.29, 80.63]]);

    const names = Array.from(document.querySelectorAll("button[aria-pressed] h3")).map((h) => h.textContent);
    expect(names).toEqual([
      "Isuzu Journey (NB-3)",
      "Ashok Viking (NB-2)",
      " Lanka ()",
      "Toyota Coaster (NB-1)",
    ]);
    expect(screen.getByText((c) => c.includes('vehicleSelection.insufficientCapacity:{"capacity":29,"passengers":40}'))).toBeTruthy();
    expect(screen.getByText((c) => c.includes('vehicleSelection.typeMismatch:{"type":"Luxury AC"}'))).toBeTruthy();
    expect(screen.getByText("preview.selectVehiclePrompt")).toBeTruthy();
    expect(sendButton().disabled).toBe(true);
  });

  it("prices a selected vehicle, edits costs and line items, and sends", async () => {
    await renderPage();
    await screen.findByText("title");
    fireEvent.click(screen.getByText("Ashok Viking (NB-2)").closest("button") as HTMLButtonElement);
    expect(screen.getByText("vehicleSelection.selected")).toBeTruthy();

    // rental = 100 km x 100/km, driver = 30000 x 10%, fuel = 100 km x 40/km, toll = base 500
    expect(screen.getAllByText("LKR 10,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LKR 3,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LKR 4,000").length).toBeGreaterThan(0);
    expect(screen.getByText("LKR 17,500")).toBeTruthy();
    expect(screen.getByText("LKR 1,750")).toBeTruthy();
    expect(screen.getByText("LKR 19,250")).toBeTruthy();

    const numberInputs = () => Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
    fireEvent.change(numberInputs()[1], { target: { value: "5000" } });
    fireEvent.change(numberInputs()[3], { target: { value: "0" } });

    fireEvent.click(screen.getByText("pricing.addItem"));
    fireEvent.change(screen.getByPlaceholderText("pricing.descriptionPlaceholder"), { target: { value: "Parking" } });
    fireEvent.change(screen.getByPlaceholderText("pricing.amountPlaceholder"), { target: { value: "1000" } });
    expect(screen.getByText("Parking")).toBeTruthy();

    vi.spyOn(Date, "now").mockReturnValueOnce(1).mockReturnValueOnce(2);
    fireEvent.click(screen.getByText("pricing.addItem"));
    expect(screen.getByText("preview.other")).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText("pricing.removeItem")[1]);
    expect(screen.queryByText("preview.other")).toBeNull();
    vi.restoreAllMocks();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "14" } });
    expect(screen.getByText('preview.validFor:{"days":14}')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("settings.notesPlaceholder"), { target: { value: "Includes driver meals" } });

    await act(async () => fireEvent.click(sendButton()));
    expect(quotes.sendQuotation).toHaveBeenCalledWith("q1", {
      vehicleId: "v-ok",
      startTime: "07:30 AM",
      estimatedDistance: "100 km",
      estimatedDuration: "3h",
      vehicleRentalCost: 10000,
      driverCost: 5000,
      fuelCost: 4000,
      tollCharges: 0,
      customItems: [{ description: "Parking", amount: 1000 }],
      subtotal: 20000,
      tax: 2000,
      totalAmount: 22000,
      additionalNotes: "Includes driver meals",
      validityDays: 14,
    });
    expect(state.push).toHaveBeenCalledWith("/en/owner/quotations/sent/q1-sent");
  });

  it("warns when the selected vehicle is unsuitable and falls back to the request id on redirect", async () => {
    quotes.sendQuotation.mockResolvedValue({});
    await renderPage();
    await screen.findByText("title");
    fireEvent.click(screen.getByText("Toyota Coaster (NB-1)").closest("button") as HTMLButtonElement);
    expect(screen.getByText("vehicleSelection.warningTitle")).toBeTruthy();
    await act(async () => fireEvent.click(sendButton()));
    expect(quotes.sendQuotation.mock.calls[0][1].fuelCost).toBe(3000);
    expect(state.push).toHaveBeenCalledWith("/en/owner/quotations/sent/q1");
  });

  it("surfaces send errors", async () => {
    quotes.sendQuotation.mockRejectedValueOnce(new Error("Quotation expired")).mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("title");
    fireEvent.click(screen.getByText("Isuzu Journey (NB-3)").closest("button") as HTMLButtonElement);
    await act(async () => fireEvent.click(sendButton()));
    expect(await screen.findByText("Quotation expired")).toBeTruthy();
    await act(async () => fireEvent.click(sendButton()));
    expect(await screen.findByText("errors.sendFailed")).toBeTruthy();
    expect(state.push).not.toHaveBeenCalled();
  });

  it("blocks sending when trip distance or duration is missing", async () => {
    quotes.getById.mockResolvedValue({
      quotation: quotation({ estimatedDuration: null, startTime: null, specialRequests: null, customer: null, itineraryStops: undefined, itineraryRoute: undefined }),
    });
    await renderPage();
    await screen.findByText("title");
    expect(state.mapProps.initialWaypoints).toEqual([]);
    expect(state.mapProps.initialRouteGeometry).toEqual([]);
    fireEvent.click(screen.getByText("Isuzu Journey (NB-3)").closest("button") as HTMLButtonElement);
    await act(async () => fireEvent.click(sendButton()));
    expect(screen.getByText("errors.missingTripDetails")).toBeTruthy();
    expect(quotes.sendQuotation).not.toHaveBeenCalled();
  });

  it("locks to the requested vehicle and pre-computes fuel from its rate", async () => {
    quotes.getById.mockResolvedValue({ quotation: quotation({ vehicleId: "v-ok", vehicleType: "", startTime: "" }) });
    await renderPage();
    expect(await screen.findByText("vehicleSelection.requested")).toBeTruthy();
    expect(screen.getByText(/Luxury AC • 45 seats • FULL AC/)).toBeTruthy();
    expect(document.querySelectorAll("button[aria-pressed]").length).toBe(0);
    await act(async () => fireEvent.click(sendButton()));
    expect(quotes.sendQuotation).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({ vehicleId: "v-ok", fuelCost: 4000, startTime: "08:00 AM" }),
    );
  });

  it("falls back to platform fuel rate and handles an unknown requested vehicle", async () => {
    quotes.getById.mockResolvedValue({ quotation: quotation({ vehicleId: "missing", vehicleType: "standard", passengerCount: 10 }) });
    landing.getPublicConfig.mockResolvedValue({ quotationPricing: { ...pricing, defaultValidityDays: 0 } });
    await renderPage();
    expect(await screen.findByText("vehicleSelection.select")).toBeTruthy();
    const lanka = screen.getByText(/Lanka \(\)/, { selector: "h3" }).closest("button") as HTMLButtonElement;
    expect(lanka.textContent).toContain("vehicleSelection.suitable");
    fireEvent.click(lanka);
    // ordinary bus has no fuel rate: platform 30/km x 100 km
    expect(screen.getAllByText("LKR 3,000").length).toBeGreaterThan(0);
  });

  it("prompts to add a vehicle when the fleet is empty", async () => {
    vehicles.getMyVehicles.mockResolvedValue({});
    await renderPage();
    expect(await screen.findByText("vehicleSelection.noVehicles")).toBeTruthy();
    expect(screen.getByText("vehicleSelection.addVehicle").closest("a")?.getAttribute("href")).toBe("/en/owner/fleet/add");
  });
});
