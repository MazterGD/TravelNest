/**
 * Customer booking detail page: loading/error/not-found states, pricing and
 * route rendering, and the cancel / dispute / rating / invoice actions.
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const push = vi.fn();
const guard = { isLoading: false };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/en/dashboard/bookings/b1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => "en",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : String(href)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: any, opts: any) => {
    void Promise.resolve()
      .then(loader)
      .catch(() => undefined);
    return (props: any) => (
      <div data-testid="map" data-props={JSON.stringify(props)}>
        {opts?.loading ? opts.loading() : null}
      </div>
    );
  },
}));

vi.mock("@/components/ui/InteractiveMap", () => ({
  default: () => null,
  InteractiveMap: () => null,
}));

vi.mock("@/hooks", async (importOriginal: any) => ({
  ...(await importOriginal()),
  useProtectedRoute: () => guard,
}));

vi.mock("@/lib/api/services", () => ({
  bookingService: { getById: vi.fn(), cancel: vi.fn() },
  reviewService: { create: vi.fn() },
  disputeService: { create: vi.fn() },
}));

vi.mock("@/lib/utils/pdfUtils", () => ({
  printAsPDF: vi.fn(),
  buildInvoiceHTML: vi.fn(() => "<html/>"),
}));

import BookingDetailsContent from "@/app/[locale]/dashboard/bookings/[id]/BookingDetailsContent";
import BookingDetailsPage from "@/app/[locale]/dashboard/bookings/[id]/page";
import { bookingService, disputeService, reviewService } from "@/lib/api/services";
import { buildInvoiceHTML, printAsPDF } from "@/lib/utils/pdfUtils";
import { Suspense } from "react";
import { act } from "@testing-library/react";

const getById = bookingService.getById as any;
const cancel = bookingService.cancel as any;

const makeBooking = (over: Record<string, any> = {}) => ({
  id: "b1",
  bookingRef: "BK-001",
  customer: { id: "c1", name: "Nimal", phone: "0771", email: "n@x.lk" },
  vehicle: {
    id: "v1",
    name: "Lanka Coach",
    registration: "NB-1234",
    type: "LUXURY_AC",
    brand: "Ashok",
    model: "Viking",
    year: 2020,
    capacity: 40,
    image: "https://img/bus.webp",
    amenities: ["wifi", "usb_charging"],
    fuelType: "DIESEL",
    transmission: "MANUAL",
    acType: "full-ac",
    isRemoved: true,
  },
  owner: {
    id: "o1",
    name: "Sunil",
    phone: "0712345678",
    email: "o@x.lk",
    avatar: null,
    rating: 4.56,
    reviewCount: 12,
    completedTrips: 30,
  },
  trip: {
    startDate: "2026-06-03T00:00:00.000Z",
    endDate: "2026-06-05T00:00:00.000Z",
    startTime: "08:30",
    pickupLocation: "Colombo",
    pickupLatitude: 6.9,
    pickupLongitude: 79.8,
    dropoffLocation: "Kandy",
    dropoffLatitude: 7.29,
    dropoffLongitude: 80.63,
    estimatedDistance: "120 km",
    estimatedDuration: "3h",
    passengers: 25,
    itineraryStops: [
      { locationName: "Colombo", coordinates: [79.8, 6.9] },
      { locationName: "Kegalle", lat: 7.25, lng: 80.35 },
      { locationName: "Kandy", coordinates: [80.63, 7.29] },
    ],
    itineraryRoute: { coordinates: [[79.8, 6.9], [80.63, 7.29]] },
  },
  driver: { name: "Kamal", phone: "0700000000", license: "B123" },
  payment: {
    id: "p1",
    total: 50000,
    paid: 0,
    status: "PENDING",
    method: "PAYHERE",
    receiptUrl: "https://receipt/1",
    platformCommission: 5000,
    netAmount: 45000,
    breakdown: {
      basePrice: 40000,
      driverAllowance: 5000,
      additionalCharges: 5000,
      subtotal: 50000,
      tax: 100,
      customItems: [{ description: "Parking", amount: 500 }],
    },
  },
  timeline: [
    { event: "booking_created", timestamp: "2026-06-01T00:00:00Z" },
    { event: "booking_cancelled", timestamp: "2026-06-02T00:00:00Z", description: "Changed plans" },
    { event: "mystery", timestamp: "2026-06-02T00:00:00Z" },
  ],
  status: "PENDING",
  notes: "Need roof rack",
  hasReview: false,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-01T00:00:00Z",
  ...over,
});

const renderPage = async (booking: any = makeBooking()) => {
  getById.mockResolvedValue(booking);
  render(<BookingDetailsContent bookingId="b1" locale="en" />);
  await screen.findByText("title");
};

beforeEach(() => {
  vi.clearAllMocks();
  guard.isLoading = false;
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("BookingDetailsContent", () => {
  it("shows a spinner while the route guard is loading and does not fetch", () => {
    guard.isLoading = true;
    const { container } = render(<BookingDetailsContent bookingId="b1" locale="en" />);
    expect(getById).not.toHaveBeenCalled();
    expect(container.querySelector(".animate-spin, svg")).toBeTruthy();
  });

  it("renders the full booking: route, stops, vehicle, owner, driver, pricing, timeline", async () => {
    await renderPage({ booking: makeBooking() });
    expect(getById).toHaveBeenCalledWith("b1");
    expect(screen.getByText('reference:{"ref":"BK-001"}')).toBeTruthy();
    expect(screen.getAllByText("status.pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("paymentStatusLabels.pending").length).toBe(2);
    // pickup/dropoff duplicates in itinerary_stops are removed; only Kegalle stays as a stop
    expect(screen.getByText('stopLabel:{"index":1}')).toBeTruthy();
    expect(screen.getByText("Kegalle")).toBeTruthy();
    const map = screen.getByTestId("map");
    const props = JSON.parse(map.getAttribute("data-props")!);
    expect(props.initialWaypoints.map((w: any) => w.name)).toEqual(["Colombo", "Kegalle", "Kandy"]);
    expect(props.initialRouteGeometry).toEqual([[6.9, 79.8], [7.29, 80.63]]);
    expect(screen.getByText("120 km")).toBeTruthy();
    expect(screen.getByText("Need roof rack")).toBeTruthy();
    expect(screen.getByText("vehicleNoLongerListed")).toBeTruthy();
    expect(screen.getByText("Ashok Viking • 2020")).toBeTruthy();
    expect(screen.getByText("diesel")).toBeTruthy();
    expect(screen.getByText("usb charging")).toBeTruthy();
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("(12)")).toBeTruthy();
    expect(screen.getByText("S")).toBeTruthy();
    expect(screen.getByText("Kamal")).toBeTruthy();
    expect(screen.getByText("driverLicense: B123", { exact: false })).toBeTruthy();
    expect(screen.getByText("Parking")).toBeTruthy();
    expect(screen.getByText("breakdownTax")).toBeTruthy();
    expect(screen.getByText("timeline.bookingCancelled")).toBeTruthy();
    expect(screen.getByText("Changed plans")).toBeTruthy();
    expect(screen.getByText("mystery")).toBeTruthy();
    expect(screen.getByText("viewReceipt").getAttribute("href")).toBe("https://receipt/1");
  });

  it("Pay now routes to the payment page, Message owner to messages", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("payNow"));
    expect(push).toHaveBeenCalledWith("/en/dashboard/bookings/b1/payment");
    fireEvent.click(screen.getByText("messageOwner"));
    expect(push).toHaveBeenCalledWith("/en/dashboard/messages?booking=b1");
  });

  it("downloads the invoice and opens the receipt", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await renderPage();
    fireEvent.click(screen.getByText("downloadInvoice"));
    expect(buildInvoiceHTML).toHaveBeenCalledWith(expect.objectContaining({ bookingRef: "BK-001" }));
    expect(printAsPDF).toHaveBeenCalledWith("<html/>", "TraveNest Invoice – BK-001");
    fireEvent.click(screen.getByText("downloadReceipt"));
    expect(open).toHaveBeenCalledWith("https://receipt/1", "_blank", "noopener,noreferrer");
  });

  it("Contact owner dials the owner's phone", async () => {
    await renderPage();
    const loc = window.location;
    const fake = { href: "" } as any;
    Object.defineProperty(window, "location", { configurable: true, value: fake });
    fireEvent.click(screen.getByText("contactOwner"));
    expect(fake.href).toBe("tel:0712345678");
    Object.defineProperty(window, "location", { configurable: true, value: loc });
  });

  it("requires a cancel reason, then cancels and returns to the bookings list", async () => {
    cancel.mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getByText("cancelBooking"));
    expect(screen.getByText("cancelDialog.title")).toBeTruthy();
    fireEvent.click(screen.getByText("cancelDialog.confirm"));
    expect(window.alert).toHaveBeenCalledWith("cancelDialog.reasonRequired");
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("cancelDialog.placeholder"), {
      target: { value: "Trip postponed" },
    });
    fireEvent.click(screen.getByText("cancelDialog.confirm"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/dashboard/bookings"));
    expect(cancel).toHaveBeenCalledWith("b1", "Trip postponed");
  });

  it("alerts the API error when cancelling fails and can close the dialog", async () => {
    cancel.mockRejectedValueOnce(new Error("Too late to cancel"));
    await renderPage();
    fireEvent.click(screen.getByText("cancelBooking"));
    fireEvent.change(screen.getByPlaceholderText("cancelDialog.placeholder"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByText("cancelDialog.confirm"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Too late to cancel"));
    cancel.mockRejectedValueOnce({});
    fireEvent.click(screen.getByText("cancelDialog.confirm"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("cancelDialog.error"));
    fireEvent.click(screen.getByText("cancelDialog.keep"));
    expect(screen.queryByText("cancelDialog.title")).toBeNull();
  });

  it("raises a dispute only once subject and description are long enough", async () => {
    (disputeService.create as any).mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getByText("raiseButton"));
    const submit = screen.getByText("submit").closest("button")!;
    expect(submit.disabled).toBe(true);
    fireEvent.change(document.querySelector("select")!, { target: { value: "PAYMENT_ISSUE" } });
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), { target: { value: " Overcharged " } });
    fireEvent.change(screen.getByPlaceholderText("descriptionPlaceholder"), {
      target: { value: "Charged twice for the same trip" },
    });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/dashboard/disputes"));
    expect(disputeService.create).toHaveBeenCalledWith({
      bookingId: "b1",
      type: "PAYMENT_ISSUE",
      subject: "Overcharged",
      description: "Charged twice for the same trip",
    });
  });

  it("alerts when raising a dispute fails and the dialog can be dismissed", async () => {
    (disputeService.create as any).mockRejectedValueOnce({});
    await renderPage();
    fireEvent.click(screen.getByText("raiseButton"));
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), { target: { value: "Late bus" } });
    fireEvent.change(screen.getByPlaceholderText("descriptionPlaceholder"), {
      target: { value: "The bus came two hours late" },
    });
    fireEvent.click(screen.getByText("submit"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("createError"));
    (disputeService.create as any).mockRejectedValueOnce(new Error("Already disputed"));
    fireEvent.click(screen.getByText("submit"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Already disputed"));
    fireEvent.click(screen.getByText("cancel"));
    expect(screen.queryByText("raiseTitle")).toBeNull();
  });

  it("rates a completed, unreviewed booking and refetches", async () => {
    (reviewService.create as any).mockResolvedValue({});
    const completed = makeBooking({
      status: "COMPLETED",
      payment: { ...makeBooking().payment, status: "PAID", breakdown: null, receiptUrl: null },
    });
    await renderPage(completed);
    expect(screen.queryByText("cancelBooking")).toBeNull();
    expect(screen.queryByText("payNow")).toBeNull();
    fireEvent.click(screen.getByText("rateService"));
    fireEvent.click(screen.getByLabelText("3 star"));
    fireEvent.change(screen.getByPlaceholderText("ratingDialog.placeholder"), {
      target: { value: "Great driver" },
    });
    fireEvent.click(screen.getByText("ratingDialog.submit"));
    await waitFor(() => expect(getById).toHaveBeenCalledTimes(2));
    expect(reviewService.create).toHaveBeenCalledWith({
      bookingId: "b1",
      vehicleId: "v1",
      rating: 3,
      comment: "Great driver",
      isRecommended: true,
    });
  });

  it("alerts when the rating fails and the rating dialog can be cancelled", async () => {
    (reviewService.create as any).mockRejectedValueOnce({});
    await renderPage(makeBooking({ status: "completed" }));
    fireEvent.click(screen.getByText("rateService"));
    fireEvent.click(screen.getByText("ratingDialog.submit"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("ratingDialog.error"));
    expect((reviewService.create as any).mock.calls[0][0].comment).toBeUndefined();
    (reviewService.create as any).mockRejectedValueOnce(new Error("Already reviewed"));
    fireEvent.click(screen.getByText("ratingDialog.submit"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Already reviewed"));
    fireEvent.click(screen.getByText("ratingDialog.cancel"));
    expect(screen.queryByText("ratingDialog.title")).toBeNull();
  });

  it("handles minimal bookings: removed owner, no coordinates, unknown statuses", async () => {
    await renderPage(
      makeBooking({
        status: "weird",
        owner: { id: "o1", name: "Ex", phone: "1", email: "e", isRemoved: true, avatar: "https://a/av.png" },
        vehicle: { ...makeBooking().vehicle, image: null, brand: "", fuelType: null, transmission: null, acType: null, amenities: [], year: undefined, isRemoved: false },
        driver: { name: "NoPhone", phone: null, license: null },
        trip: {
          ...makeBooking().trip,
          startTime: null,
          estimatedDuration: null,
          estimatedDistance: null,
          pickupLatitude: null,
          pickupLongitude: null,
          dropoffLatitude: null,
          dropoffLongitude: null,
          itineraryStops: [
            { locationName: "A", lat: 6, lng: 79 },
            { locationName: "NoCoords" },
            { locationName: "B", lat: 7, lng: 80 },
          ],
          itineraryRoute: null,
        },
        payment: { ...makeBooking().payment, status: "mystery", method: "", breakdown: { basePrice: 1, driverAllowance: 1, additionalCharges: 0, subtotal: 0, tax: 0 } },
        timeline: [],
        notes: undefined,
      }),
    );
    expect(screen.getByText("operatorRemoved")).toBeTruthy();
    expect(screen.queryByText("messageOwner")).toBeNull();
    expect(screen.getAllByText("weird").length).toBeGreaterThan(0);
    expect(screen.getAllByText("mystery").length).toBe(2);
    expect(screen.getByText("N/A")).toBeTruthy();
    expect(screen.getByText("NoCoords")).toBeTruthy();
    const props = JSON.parse(screen.getByTestId("map").getAttribute("data-props")!);
    expect(props.initialWaypoints.map((w: any) => w.name)).toEqual(["Colombo", "Kandy"]);
    expect(props.initialRouteGeometry).toEqual([]);
    expect(screen.queryByText("timelineTitle")).toBeNull();
    expect(screen.queryByText("breakdownSubtotal")).toBeNull();
  });

  it("renders no waypoints when there are neither coordinates nor stops", async () => {
    await renderPage(
      makeBooking({
        status: "CONFIRMED",
        driver: null,
        owner: { id: "o1", name: "Plain", phone: "1", email: "e", rating: 0, completedTrips: undefined },
        trip: { ...makeBooking().trip, pickupLatitude: null, dropoffLatitude: null, itineraryStops: undefined },
        payment: { ...makeBooking().payment, status: "partial", receiptUrl: null },
      }),
    );
    const props = JSON.parse(screen.getByTestId("map").getAttribute("data-props")!);
    expect(props.initialWaypoints).toEqual([]);
    expect(screen.queryByText("driverTitle")).toBeNull();
    expect(screen.getByText("payNow")).toBeTruthy();
    expect(screen.getByText("cancelBooking")).toBeTruthy();
  });

  it.each([
    ["ongoing", "paid"],
    ["in_progress", "completed"],
    ["cancelled", "refunded"],
    ["disputed", "failed"],
  ])("maps status %s / payment %s to labels", async (status: string, pay: string) => {
    await renderPage(makeBooking({ status, payment: { ...makeBooking().payment, status: pay } }));
    expect(screen.getAllByText(/^status\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^paymentStatusLabels\./).length).toBe(2);
  });

  it("shows the API error and lets the customer go back to bookings", async () => {
    getById.mockRejectedValue(new Error("Booking not found"));
    render(<BookingDetailsContent bookingId="b1" locale="en" />);
    expect(await screen.findByText("Booking not found")).toBeTruthy();
    fireEvent.click(screen.getByText("goToBookings"));
    expect(push).toHaveBeenCalledWith("/en/dashboard/bookings");
  });

  it("falls back to the generic load error message", async () => {
    getById.mockRejectedValue({});
    render(<BookingDetailsContent bookingId="b1" locale="en" />);
    expect(await screen.findByText("loadError")).toBeTruthy();
  });

  it("shows not-found when the API returns nothing", async () => {
    // An empty body unwraps to a falsy booking.
    getById.mockResolvedValue("");
    render(<BookingDetailsContent bookingId="b1" locale="en" />);
    expect(await screen.findByText("notFound")).toBeTruthy();
    fireEvent.click(screen.getByText("goToBookings"));
    expect(push).toHaveBeenCalledWith("/en/dashboard/bookings");
  });

  it("route page unwraps params and renders the content", async () => {
    getById.mockResolvedValue(makeBooking());
    await act(async () => {
      render(
        <Suspense fallback={<p>loading</p>}>
          <BookingDetailsPage params={Promise.resolve({ id: "b1", locale: "en" })} />
        </Suspense>,
      );
    });
    expect(await screen.findByText("title")).toBeTruthy();
    expect(getById).toHaveBeenCalledWith("b1");
  });
});
