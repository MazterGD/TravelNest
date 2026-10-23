/**
 * Quotation comparison page: the three data sources (trip, request, explicit
 * ids), filtering/sorting, selection limits, accept/reject and PDF export.
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  push: vi.fn(),
  router: null as any,
  params: new URLSearchParams(),
  guard: { isLoading: false },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => (h.router ??= { push: h.push, replace: vi.fn() }),
  useSearchParams: () => h.params,
  usePathname: () => "/en/dashboard/quotations/compare",
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
vi.mock("next/image", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));
vi.mock("@/hooks", async (importOriginal: any) => ({
  ...(await importOriginal()),
  useProtectedRoute: () => h.guard,
}));
vi.mock("@/lib/api/services", () => ({
  quotationService: { getById: vi.fn(), getMyRequests: vi.fn(), respondToQuotation: vi.fn() },
  tripService: { getById: vi.fn() },
}));
vi.mock("@/lib/utils/pdfUtils", () => ({
  printAsPDF: vi.fn(),
  buildComparisonHTML: vi.fn(() => "<html/>"),
}));

import ComparisonPageContent from "@/app/[locale]/dashboard/quotations/compare/ComparisonPageContent";
import { quotationService, tripService } from "@/lib/api/services";
import { buildComparisonHTML, printAsPDF } from "@/lib/utils/pdfUtils";

const qs = {
  getById: quotationService.getById as any,
  mine: quotationService.getMyRequests as any,
  respond: quotationService.respondToQuotation as any,
  trip: tripService.getById as any,
};

const tripQuote = (id: string, total: number, over: Record<string, any> = {}) => ({
  id,
  status: "SENT",
  totalAmount: total,
  vehicleId: `v-${id}`,
  validUntil: "2026-12-01T00:00:00Z",
  additionalNotes: `note-${id}`,
  vehicleRentalCost: 30000,
  driverCost: 5000,
  fuelCost: 4000,
  tollCharges: 1000,
  tax: 200,
  customItems: [{ description: "Parking", amount: 300 }, { description: "Free" }],
  vehicle: {
    name: `Bus ${id}`,
    images: [`https://img/${id}.webp`],
    brand: "Ashok",
    model: "Viking",
    year: 2019,
    seats: 40,
    fuelType: "Diesel",
    transmission: "Manual",
    features: ["WiFi"],
    owner: { id: `o-${id}`, firstName: "Sunil", lastName: "Perera", phone: "0771234567" },
  },
  ...over,
});

const tripPayload = (quotations: any[], over: Record<string, any> = {}) => ({
  trip: {
    id: "t1",
    customerId: "c1",
    pickupLocation: "Colombo, Western",
    dropoffLocation: "Kandy, Central",
    startDate: "2026-12-01T00:00:00Z",
    endDate: "2026-12-03T00:00:00Z",
    startTime: "07:00",
    passengerCount: 30,
    specialRequests: "Roof rack",
    quotations,
    ...over,
  },
});

const renderPage = async () => {
  render(<ComparisonPageContent locale="en" />);
  await screen.findByText("comparison.title");
};

const cardNames = () => Array.from(document.querySelectorAll("h3")).map((e) => e.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.isLoading = false;
  h.params = new URLSearchParams("tripId=t1");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("ComparisonPageContent — trip mode", () => {
  it("does not fetch while the guard is loading", () => {
    h.guard.isLoading = true;
    render(<ComparisonPageContent locale="en" />);
    expect(qs.trip).not.toHaveBeenCalled();
    expect(screen.queryByText("comparison.title")).toBeNull();
  });

  it("shows only owner-priced quotations, cheapest first, with the best value badge", async () => {
    qs.trip.mockResolvedValue({
      data: tripPayload([
        tripQuote("a", 60000),
        tripQuote("b", 45000, { status: "viewed" }),
        tripQuote("c", 50000, { status: "ACCEPTED" }),
        tripQuote("pending", 1000, { status: "PENDING" }),
        tripQuote("noprice", 1000, { totalAmount: null }),
        tripQuote("novehicle", 1000, { vehicleId: null }),
        { id: "nostatus", totalAmount: 1, vehicleId: "x" },
      ]),
    });
    await renderPage();
    expect(qs.trip).toHaveBeenCalledWith("t1");
    expect(cardNames()).toEqual(["Bus b", "Bus c", "Bus a"]);
    expect(screen.getAllByText("comparison.bestValueBadge").length).toBe(1);
    expect(screen.getByText("Colombo → Kandy", { exact: false })).toBeTruthy();
    expect(screen.getByText('comparison.passengerCount:{"count":30}')).toBeTruthy();
    expect(screen.getByText("Roof rack")).toBeTruthy();
    expect(screen.getByText('comparison.selectedCount:{"count":3}')).toBeTruthy();
    expect(screen.getAllByText("Sunil Perera").length).toBe(3);
    expect(screen.getAllByText("Ashok Viking (2019)").length).toBe(3);
    expect(screen.getAllByText('comparison.seats:{"count":40}').length).toBe(3);
    expect(screen.getAllByLabelText("comparison.contactOwner: 0771234567")[0].getAttribute("href")).toBe("tel:0771234567");
  });

  it("sorts high-to-low and filters to best value", async () => {
    qs.trip.mockResolvedValue(tripPayload([tripQuote("a", 60000), tripQuote("b", 45000)]));
    await renderPage();
    const [filter, sort] = Array.from(document.querySelectorAll("select"));
    fireEvent.change(sort, { target: { value: "price-desc" } });
    expect(cardNames()).toEqual(["Bus a", "Bus b"]);
    fireEvent.change(filter, { target: { value: "best-value" } });
    expect(cardNames()).toEqual(["Bus b"]);
    fireEvent.change(filter, { target: { value: "other" } });
    fireEvent.change(sort, { target: { value: "unsorted" } });
    expect(cardNames()).toEqual(["Bus a", "Bus b"]);
  });

  it("expands and collapses the price breakdown", async () => {
    qs.trip.mockResolvedValue(tripPayload([tripQuote("a", 60000)]));
    await renderPage();
    fireEvent.click(screen.getByText("comparison.priceBreakdown"));
    expect(screen.getByText("comparison.vehicleRental")).toBeTruthy();
    expect(screen.getByText("Rs. 300", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByText("comparison.priceBreakdown"));
    expect(screen.queryByText("comparison.vehicleRental")).toBeNull();
  });

  it("removes a quotation from the comparison (never the last) and adds it back", async () => {
    qs.trip.mockResolvedValue(tripPayload([tripQuote("a", 60000), tripQuote("b", 45000)]));
    await renderPage();
    fireEvent.click(screen.getAllByLabelText("comparison.removeFromComparison")[1]);
    expect(cardNames()).toEqual(["Bus b"]);
    expect(screen.getByText("comparison.addMore")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("comparison.removeFromComparison"));
    expect(screen.getByText('comparison.selectedCount:{"count":1}')).toBeTruthy();
    fireEvent.click(screen.getByText("Bus a").closest("button")!);
    expect(cardNames()).toEqual(["Bus b", "Bus a"]);
  });

  it("caps the comparison at four selections", async () => {
    qs.trip.mockResolvedValue(
      tripPayload([1, 2, 3, 4, 5].map((n) => tripQuote(`q${n}`, n * 1000))),
    );
    await renderPage();
    expect(screen.getByText('comparison.selectedCount:{"count":5}')).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText("comparison.removeFromComparison")[0]);
    fireEvent.click(screen.getAllByLabelText("comparison.removeFromComparison")[0]);
    expect(screen.getByText('comparison.selectedCount:{"count":3}')).toBeTruthy();
    fireEvent.click(screen.getByText("Bus q1").closest("button")!);
    expect(screen.getByText('comparison.selectedCount:{"count":4}')).toBeTruthy();
    expect(screen.queryByText("comparison.addMore")).toBeNull();
  });

  it("accepting routes to booking confirmation", async () => {
    qs.trip.mockResolvedValue(tripPayload([tripQuote("a", 60000)]));
    await renderPage();
    fireEvent.click(screen.getByText("comparison.acceptAndBook"));
    expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings/confirm?quotationId=a");
  });

  it("rejecting drops the quotation; a failure shows an alert", async () => {
    qs.trip.mockResolvedValue(tripPayload([tripQuote("a", 60000), tripQuote("b", 45000)]));
    qs.respond.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({});
    await renderPage();
    fireEvent.click(screen.getAllByText("comparison.reject")[0]);
    expect((await screen.findByRole("alert")).textContent).toBe("comparison.rejectError");
    fireEvent.click(screen.getAllByText("comparison.reject")[0]);
    await waitFor(() => expect(cardNames()).toEqual(["Bus a"]));
    expect(qs.respond).toHaveBeenCalledWith("b", { status: "REJECTED", rejectionReason: "Selected another quotation" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("exports the visible comparison as a PDF", async () => {
    qs.trip.mockResolvedValue(tripPayload([tripQuote("a", 60000)]));
    await renderPage();
    fireEvent.click(screen.getByText("comparison.downloadPDF"));
    expect(buildComparisonHTML).toHaveBeenCalledWith(
      [expect.objectContaining({ vehicleName: "Bus a", price: 60000, notes: "note-a" })],
      { pickupCity: "Colombo", dropoffCity: "Kandy", pickupDate: "2026-12-01", pickupTime: "07:00", passengerCount: 30 },
    );
    expect(printAsPDF).toHaveBeenCalledWith("<html/>", "TraveNest – Quotation Comparison");
  });

  it("shows the empty state and skips the PDF when nothing is comparable", async () => {
    qs.trip.mockResolvedValue({
      id: "t1",
      pickupCity: "Galle",
      dropoffLocation: null,
      quotations: "nope",
    });
    await renderPage();
    expect(screen.getByText("comparison.noQuotationsSelected")).toBeTruthy();
    fireEvent.click(screen.getByText("comparison.downloadPDF"));
    expect(printAsPDF).not.toHaveBeenCalled();
  });

  it("falls back to generic owner/vehicle labels for sparse quotations", async () => {
    qs.trip.mockResolvedValue(
      tripPayload([
        { id: "s1", status: "SENT", totalAmount: 0, vehicleId: "v1", notes: "plain" },
        { id: "s2", status: "SENT", totalAmount: 10, vehicleId: "v2", vehicle: { brand: "Tata", year: 0, seats: 0, features: "x" } },
      ], { startDate: null, endDate: null, pickupLocation: null, passengerCount: 0, specialRequests: null }),
    );
    await renderPage();
    expect(screen.getByText("comparison.vehicleFallback")).toBeTruthy();
    expect(screen.getAllByText("comparison.ownerFallback").length).toBe(2);
    expect(screen.getAllByText("Tata").length).toBe(2);
    expect(screen.queryByText("comparison.specialRequirements")).toBeNull();
    expect(screen.queryByText("comparison.validUntil")).toBeNull();
  });

  it("stops loading when the trip response is empty", async () => {
    qs.trip.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByText("comparison.noQuotationsSelected")).toBeTruthy();
    expect(screen.queryByText("comparison.tripDetails")).toBeNull();
  });

  it("logs and shows the empty state when loading fails", async () => {
    qs.trip.mockRejectedValue(new Error("down"));
    await renderPage();
    expect(console.error).toHaveBeenCalled();
    expect(screen.getByText("comparison.noQuotationsSelected")).toBeTruthy();
    fireEvent.click(screen.getByText("comparison.downloadPDF"));
    expect(printAsPDF).not.toHaveBeenCalled();
  });
});

describe("ComparisonPageContent — request mode", () => {
  const base = {
    id: "r1",
    customerId: "c1",
    pickupLocation: "Colombo, Western",
    dropoffLocation: "Ella, Uva",
    startDate: "2026-12-01T00:00:00Z",
    endDate: "2026-12-02T00:00:00Z",
    startTime: "06:00",
    passengerCount: 20,
    status: "QUOTED",
  };

  it("compares owner-priced quotations that match the request's route and date", async () => {
    h.params = new URLSearchParams("requestId=r1");
    qs.getById.mockResolvedValue({ data: { quotation: base } });
    qs.mine.mockResolvedValue({
      data: {
        quotations: [
          { ...base, id: "m1", status: "SENT", totalAmount: 30000, vehicleId: "v1", vehicle: { name: "Match bus", owner: { firstName: "A", lastName: "B" } }, validUntil: "2026-12-01" },
          { ...base, id: "m2", status: "viewed", totalAmount: 20000, customItems: [{ amount: 5 }], vehicle: { year: 2020 } },
          { ...base, id: "wrongdate", status: "SENT", totalAmount: 1, startDate: "2027-01-01T00:00:00Z" },
          { ...base, id: "wrongroute", status: "SENT", totalAmount: 1, dropoffLocation: "Galle" },
          { ...base, id: "pending", status: "PENDING", totalAmount: 1 },
          { ...base, id: "nostatus", status: undefined, totalAmount: 1 },
        ],
      },
    });
    await renderPage();
    expect(qs.getById).toHaveBeenCalledWith("r1");
    expect(cardNames()).toEqual(["comparison.vehicleFallback", "Match bus"]);
    expect(screen.getByText("Colombo → Ella", { exact: false })).toBeTruthy();
    expect(screen.getByText("A B")).toBeTruthy();
  });

  it("handles object locations and sparse request fields", async () => {
    h.params = new URLSearchParams("requestId=r1");
    qs.getById.mockResolvedValue({
      quotation: { id: "r1", pickupLocation: { city: "Negombo" }, dropoffLocation: { city: "Jaffna" } },
    });
    qs.mine.mockResolvedValue({});
    await renderPage();
    expect(screen.getByText("Negombo → Jaffna", { exact: false })).toBeTruthy();
    expect(screen.getByText("comparison.noQuotationsSelected")).toBeTruthy();
  });

  it("supports a flat quotations list", async () => {
    h.params = new URLSearchParams("requestId=r1");
    qs.getById.mockResolvedValue({ quotation: base });
    qs.mine.mockResolvedValue({ quotations: [{ ...base, id: "f1", status: "accepted", totalAmount: 5 }] });
    await renderPage();
    expect(cardNames()).toEqual(["comparison.vehicleFallback"]);
  });
});

describe("ComparisonPageContent — explicit ids", () => {
  it("loads each quotation by id and maps the alternate response shapes", async () => {
    h.params = new URLSearchParams("ids=x,y,z");
    qs.getById.mockImplementation(async (id: string) => {
      if (id === "x")
        return {
          data: {
            quotation: {
              id: "x", ownerName: "Named Owner", vehicleName: "Named Bus", vehicleImage: "https://i/x.webp",
              totalAmount: 9000, status: "SENT", validUntil: "Dec 1", vehicleRentalCost: 8000,
              ownerPhone: "0700", vehicle: { brand: "Leyland", model: "Lynx", year: 2018, seats: 30, fuelType: "Diesel", transmission: "Auto", features: ["AC"] },
            },
          },
        };
      if (id === "y")
        return {
          quotation: {
            id: "y", owner: { firstName: "Kamal", lastName: "Silva", phone: "0711" }, vehicle: { name: "Veh Y", images: ["https://i/y.webp"] },
            totalAmount: 7000, expiryDate: "2026-12-05T00:00:00Z", vehicleRentalCost: 1, customItems: [{ amount: 3 }],
          },
        };
      return { id: "z", totalAmount: 8000, message: "hello" };
    });
    await renderPage();
    expect(qs.getById).toHaveBeenCalledTimes(3);
    expect(cardNames()).toEqual(["Veh Y", "comparison.vehicleFallback", "Named Bus"]);
    expect(screen.getByText("Named Owner")).toBeTruthy();
    expect(screen.getByText("Kamal Silva")).toBeTruthy();
    expect(screen.getByText("Dec 1")).toBeTruthy();
    expect(screen.queryByText("comparison.tripDetails")).toBeNull();
    fireEvent.click(screen.getByText("comparison.downloadPDF"));
    expect(buildComparisonHTML).toHaveBeenCalledWith(expect.any(Array), {
      pickupCity: "", dropoffCity: "", pickupDate: "", pickupTime: "", passengerCount: 0,
    });
  });

  it("shows the empty state with no query parameters at all", async () => {
    h.params = new URLSearchParams();
    await renderPage();
    expect(screen.getByText("comparison.noQuotationsSelected")).toBeTruthy();
    expect(qs.getById).not.toHaveBeenCalled();
  });
});
