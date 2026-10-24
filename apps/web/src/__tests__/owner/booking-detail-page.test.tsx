/**
 * Owner booking detail: status-gated actions (start trip within window,
 * confirm cash, complete, cancel with reason), driver assignment modal,
 * payment breakdown, timeline, itinerary, invoice and dispute navigation.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  push: vi.fn(),
  mapProps: null as any,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push, replace: vi.fn() }),
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en/owner/bookings/bk-1",
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
vi.mock("@/lib/utils/pdfUtils", () => ({
  buildInvoiceHTML: vi.fn(() => "<html>invoice</html>"),
  printAsPDF: vi.fn(),
}));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {}
  return {
    ApiError,
    bookingService: {
      getById: vi.fn(),
      startTrip: vi.fn(),
      confirmBooking: vi.fn(),
      complete: vi.fn(),
      rejectBooking: vi.fn(),
    },
    driverService: {
      getAvailable: vi.fn(),
      assignToBooking: vi.fn(),
      unassignFromBooking: vi.fn(),
    },
  };
});

import { ApiError, bookingService, driverService } from "@/lib/api";
import { buildInvoiceHTML, printAsPDF } from "@/lib/utils/pdfUtils";
import BookingDetailsPage from "@/app/[locale]/owner/bookings/[id]/page";

const bookings = bookingService as any;
const drivers = driverService as any;
const today = new Date();
const iso = (offsetDays: number) => new Date(today.getTime() + offsetDays * 86400000).toISOString();

const booking = (overrides: Record<string, unknown> = {}) => ({
  id: "bk-1",
  bookingRef: "TN-BK-001",
  status: "CONFIRMED",
  createdAt: iso(-5),
  customer: { firstName: "Ravi", lastName: "Kumar", phone: "0771234567", email: "ravi@x.lk" },
  trip: {
    startDate: iso(0),
    endDate: iso(1),
    startTime: "07:30",
    estimatedDuration: "3h",
    passengers: 40,
    itineraryStops: [{ coordinates: [79.8, 6.9], locationName: "Colombo" }],
    itineraryRoute: { coordinates: [[79.8, 6.9], [80.6, 7.3]] },
  },
  vehicle: { id: "veh-1", licensePlate: "NB-1234", type: "LUXURY_AC", capacity: 45, amenities: ["wifi", "usb_charging"] },
  driver: { id: "drv-1", name: "Sunil Driver", phone: "0711111111" },
  payment: {
    status: "completed",
    method: "PAYHERE",
    total: 50000,
    commissionRate: 0.1,
    platformCommission: 5000,
    netAmount: 45000,
    breakdown: { basePrice: 40000, driverAllowance: 5000, additionalCharges: 5000 },
  },
  itinerary: [
    { location: "Colombo", time: "07:30", notes: "Pick up at hotel" },
    { name: "Kandy" },
  ],
  timeline: [
    { event: "booking_created", timestamp: iso(-5), description: "Created by customer" },
    { event: "payment_received", timestamp: iso(-4) },
    { event: "booking_cancelled", timestamp: iso(-3) },
    { event: "custom_event", timestamp: iso(-2) },
  ],
  gpsTracking: true,
  ...overrides,
});

const renderPage = async () => {
  const params = Promise.resolve({ id: "bk-1", locale: "en" });
  await act(async () => {
    render(
      <Suspense fallback={<div>suspended</div>}>
        <BookingDetailsPage params={params} />
      </Suspense>,
    );
    await params;
  });
  await waitFor(() => expect(bookings.getById).toHaveBeenCalled());
};

describe("Owner BookingDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    bookings.getById.mockResolvedValue({ booking: booking() });
    for (const fn of ["startTrip", "confirmBooking", "complete", "rejectBooking"]) bookings[fn].mockResolvedValue({});
    drivers.getAvailable.mockResolvedValue({
      drivers: [
        { id: "drv-1", name: "Sunil Driver", phone: "0711111111", photoUrl: null, status: "ACTIVE" },
        { id: "drv-2", name: "Nimal Driver", phone: "0722222222", photoUrl: null, status: "ACTIVE" },
      ],
    });
    drivers.assignToBooking.mockResolvedValue({});
    drivers.unassignFromBooking.mockResolvedValue({});
  });

  it("is gated by the guard and user", async () => {
    state.user = null;
    await renderPage();
    expect(screen.queryByText("TN-BK-001")).toBeNull();
  });

  it("renders customer, trip, vehicle, driver, payment and timeline", async () => {
    await renderPage();
    expect(await screen.findByText("TN-BK-001")).toBeTruthy();
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
    expect(screen.getByText("0771234567").getAttribute("href")).toBe("tel:0771234567");
    expect(screen.getByText("ravi@x.lk").getAttribute("href")).toBe("mailto:ravi@x.lk");
    expect(screen.getByLabelText("messageCustomer").getAttribute("href")).toBe("/en/owner/messages?booking=bk-1");
    expect(screen.getByText("startTimeLabel: 07:30")).toBeTruthy();
    expect(screen.getByText("Pick up at hotel")).toBeTruthy();
    expect(screen.getByText("Kandy")).toBeTruthy();
    expect(state.mapProps.initialWaypoints).toEqual([{ lat: 6.9, lng: 79.8, name: "Colombo" }]);
    expect(state.mapProps.initialRouteGeometry).toEqual([[6.9, 79.8], [7.3, 80.6]]);
    expect(screen.getByText("usb charging")).toBeTruthy();
    expect(screen.getByText("Sunil Driver")).toBeTruthy();
    expect(screen.getByText("changeDriver")).toBeTruthy();
    expect(screen.getByText(/platformCommission \(10\.0%\)/)).toBeTruthy();
    expect(screen.getByText("-currency 5,000")).toBeTruthy();
    expect(screen.getByText("currency 45,000")).toBeTruthy();
    expect(screen.getByText("Created by customer")).toBeTruthy();
    expect(screen.getByText("custom_event")).toBeTruthy();
    expect(screen.getByText("gpsEnabled")).toBeTruthy();
    expect(screen.getByText("startTrip")).toBeTruthy();
    expect(screen.getByText("cancelTrip")).toBeTruthy();
    expect(screen.queryByText("confirmCash")).toBeNull();
  });

  it("starts a trip and reloads, and surfaces start errors", async () => {
    bookings.startTrip.mockResolvedValueOnce({}).mockRejectedValueOnce(new (ApiError as any)("Too early")).mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("TN-BK-001");
    await act(async () => fireEvent.click(screen.getByText("startTrip")));
    expect(bookings.startTrip).toHaveBeenCalledWith("bk-1");
    expect(bookings.getById).toHaveBeenCalledTimes(2);
    await act(async () => fireEvent.click(screen.getByText("startTrip")));
    expect(screen.getByText("Too early")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("startTrip")));
    expect(screen.getByText("startError")).toBeTruthy();
  });

  it("does not offer starting before the trip window", async () => {
    bookings.getById.mockResolvedValue(booking({ trip: { startDate: iso(5), endDate: iso(6) } }));
    await renderPage();
    await screen.findByText("TN-BK-001");
    expect(screen.queryByText("startTrip")).toBeNull();
  });

  it("confirms a pending cash booking", async () => {
    bookings.getById.mockResolvedValue(booking({ status: "PENDING", payment: { method: "CASH", status: "pending" }, driver: null }));
    bookings.confirmBooking.mockResolvedValueOnce({}).mockRejectedValueOnce(new (ApiError as any)("Cash not received")).mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("TN-BK-001");
    expect(screen.getByText("noDriver")).toBeTruthy();
    expect(screen.getByText("assignDriver")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("confirmCash")));
    expect(bookings.confirmBooking).toHaveBeenCalledWith("bk-1");
    await act(async () => fireEvent.click(screen.getByText("confirmCash")));
    expect(screen.getByText("Cash not received")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("confirmCash")));
    expect(screen.getByText("confirmCashError")).toBeTruthy();
  });

  it("completes an ongoing trip and handles errors", async () => {
    bookings.getById.mockResolvedValue(booking({ status: "ONGOING" }));
    bookings.complete.mockResolvedValueOnce({}).mockRejectedValueOnce(new (ApiError as any)("Not finished")).mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("TN-BK-001");
    expect(screen.queryByText("cancelTrip")).toBeNull();
    await act(async () => fireEvent.click(screen.getByText("completeTrip")));
    expect(bookings.complete).toHaveBeenCalledWith("bk-1");
    await act(async () => fireEvent.click(screen.getByText("completeTrip")));
    expect(screen.getByText("Not finished")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("completeTrip")));
    expect(screen.getByText("completeError")).toBeTruthy();
  });

  it("cancels with a required reason and reports failures inside the modal", async () => {
    bookings.rejectBooking.mockRejectedValueOnce(new (ApiError as any)("Already started")).mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("TN-BK-001");
    fireEvent.click(screen.getByText("cancelTrip"));
    const confirm = screen.getByText("cancelModal.confirm").closest("button") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("cancelModal.reasonPlaceholder"), { target: { value: "  Bus breakdown  " } });
    await act(async () => fireEvent.click(confirm));
    expect(bookings.rejectBooking).toHaveBeenCalledWith("bk-1", "Bus breakdown");
    expect(screen.getByText("Already started")).toBeTruthy();
    await act(async () => fireEvent.click(confirm));
    expect(screen.getByText("cancelError")).toBeTruthy();
    fireEvent.click(screen.getByText("cancelModal.keepBooking"));
    expect(screen.queryByText("cancelModal.title")).toBeNull();

    fireEvent.click(screen.getByText("cancelTrip"));
    fireEvent.change(screen.getByPlaceholderText("cancelModal.reasonPlaceholder"), { target: { value: "Weather" } });
    await act(async () => fireEvent.click(screen.getByText("cancelModal.confirm")));
    expect(screen.queryByText("cancelModal.title")).toBeNull();
    expect(bookings.getById).toHaveBeenCalledTimes(2);
  });

  it("assigns a different driver from the modal", async () => {
    await renderPage();
    await screen.findByText("TN-BK-001");
    await act(async () => fireEvent.click(screen.getByText("changeDriver")));
    expect(drivers.getAvailable).toHaveBeenCalledWith(expect.any(String), expect.any(String), "bk-1");
    // [unassign, current driver, other driver]: the current driver starts selected.
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
    fireEvent.click(radios[2]);
    await act(async () => fireEvent.click(screen.getByText("driverModal.confirm")));
    expect(drivers.assignToBooking).toHaveBeenCalledWith("bk-1", "drv-2");
    expect(screen.queryByText("driverModal.title")).toBeNull();
    expect(bookings.getById).toHaveBeenCalledTimes(2);
  });

  it("reports driver loading and assignment errors and can cancel", async () => {
    drivers.getAvailable.mockRejectedValueOnce(new Error("x"));
    drivers.assignToBooking.mockRejectedValueOnce(new Error("Driver busy")).mockRejectedValueOnce({});
    bookings.getById.mockResolvedValue(booking({ driver: null, driverId: "drv-2", trip: undefined, startDate: iso(0), endDate: iso(0) }));
    await renderPage();
    await screen.findByText("TN-BK-001");
    await act(async () => fireEvent.click(screen.getByText("assignDriver")));
    expect(screen.getByText("driverModal.loadError")).toBeTruthy();
    expect(screen.getByText("driverModal.noDrivers")).toBeTruthy();
    fireEvent.click(screen.getByText("driverModal.cancel"));

    await act(async () => fireEvent.click(screen.getByText("assignDriver")));
    await act(async () => fireEvent.click(screen.getByText("driverModal.confirm")));
    expect(screen.getByText("Driver busy")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("driverModal.confirm")));
    expect(screen.getByText("driverModal.assignError")).toBeTruthy();
  });

  it("unassigns when the booking carries a legacy driverName", async () => {
    drivers.unassignFromBooking.mockRejectedValueOnce(new Error("Locked")).mockRejectedValueOnce({});
    bookings.getById.mockResolvedValue(booking({ driverName: "Legacy Driver" }));
    drivers.getAvailable.mockResolvedValue({ drivers: [] });
    await renderPage();
    await screen.findByText("TN-BK-001");
    await act(async () => fireEvent.click(screen.getByText("changeDriver")));
    fireEvent.click(screen.getByText("driverModal.unassign"));
    await act(async () => fireEvent.click(screen.getByText("driverModal.confirmUnassign")));
    expect(screen.getByText("Locked")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("driverModal.confirmUnassign")));
    expect(screen.getByText("driverModal.unassignError")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("driverModal.confirmUnassign")));
    expect(drivers.unassignFromBooking).toHaveBeenCalledWith("bk-1");
    expect(screen.queryByText("driverModal.title")).toBeNull();
  });

  it("offers unassign for a booking whose driver arrives as a nested object", async () => {
    bookings.getById.mockResolvedValue(booking({ driverName: undefined }));
    drivers.getAvailable.mockResolvedValue({ drivers: [] });
    await renderPage();
    await screen.findByText("TN-BK-001");

    await act(async () => fireEvent.click(screen.getByText("changeDriver")));

    expect(screen.getByText("driverModal.unassign")).toBeTruthy();
    expect(screen.queryByText("driverModal.noDrivers")).toBeNull();
  });

  it("generates an invoice and navigates to disputes", async () => {
    await renderPage();
    await screen.findByText("TN-BK-001");
    fireEvent.click(screen.getByText("generateInvoice"));
    expect(buildInvoiceHTML).toHaveBeenCalledWith(expect.objectContaining({ bookingRef: "TN-BK-001", status: "CONFIRMED" }));
    expect(printAsPDF).toHaveBeenCalledWith("<html>invoice</html>", "TraveNest Invoice – TN-BK-001");
    fireEvent.click(screen.getByText("reportIssue"));
    expect(state.push).toHaveBeenCalledWith("/en/owner/disputes");
  });

  it("renders fallbacks for a removed customer and sparse booking", async () => {
    bookings.getById.mockResolvedValue({
      id: "bk-1",
      bookingRef: "TN-BK-002",
      status: "COMPLETED",
      createdAt: iso(-1),
      customer: { name: "Gone User", isRemoved: true },
      vehicle: { name: "Bus", seats: 30 },
      itineraryStops: [{ lat: 1, lng: 2, locationName: "X" }],
      itineraryRoute: { coordinates: [[2, 1]] },
    });
    await renderPage();
    expect(await screen.findByText("TN-BK-002")).toBeTruthy();
    expect(screen.getByText("customerRemoved")).toBeTruthy();
    expect(screen.queryByLabelText("messageCustomer")).toBeNull();
    expect(screen.getByText("noItinerary")).toBeTruthy();
    expect(screen.queryByText("assignDriver")).toBeNull();
    expect(screen.getByText("paymentLabel pending")).toBeTruthy();
    expect(state.mapProps.initialWaypoints).toEqual([{ lat: 1, lng: 2, name: "X" }]);
    expect(screen.queryByText(/platformCommission \(/)).toBeNull();
  });

  it("shows contact fallbacks when phone/email are missing", async () => {
    bookings.getById.mockResolvedValue(booking({ customer: {}, timeline: [], itinerary: [] }));
    await renderPage();
    await screen.findByText("TN-BK-001");
    expect(screen.getAllByText("na").length).toBeGreaterThanOrEqual(3);
  });

  it("shows API and generic load errors and not-found", async () => {
    bookings.getById.mockRejectedValueOnce(new (ApiError as any)("Booking hidden"));
    const params = Promise.resolve({ id: "bk-1", locale: "en" });
    let view: any;
    await act(async () => {
      view = render(
        <Suspense fallback={null}>
          <BookingDetailsPage params={params} />
        </Suspense>,
      );
      await params;
    });
    expect(await screen.findByText("Booking hidden")).toBeTruthy();
    view.unmount();

    bookings.getById.mockRejectedValueOnce(new Error("x"));
    await renderPage();
    expect(await screen.findByText("errorLoad")).toBeTruthy();
  });

  it("shows not-found for an empty response", async () => {
    bookings.getById.mockResolvedValue(null);
    await renderPage();
    expect(await screen.findByText("notFound")).toBeTruthy();
  });
});
