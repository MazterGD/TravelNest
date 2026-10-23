/**
 * Booking confirmation (review before accepting a quotation): summary,
 * price breakdown, accept → PENDING booking redirect, and error states.
 */
import { configure, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  router: null as any,
  params: new URLSearchParams(),
  guard: { isLoading: false },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => (h.router ??= { push: h.push, back: h.back }),
  useSearchParams: () => h.params,
  usePathname: () => "/en/dashboard/bookings/confirm",
  useParams: () => ({ locale: "en" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: ({ children }: any) => <>{children}</> }));
vi.mock("@/hooks", async (importOriginal: any) => ({
  ...(await importOriginal()),
  useProtectedRoute: () => h.guard,
}));
vi.mock("@/lib/api/services", () => ({
  quotationService: { getById: vi.fn(), respondToQuotation: vi.fn() },
}));

import BookingConfirmPageContent from "@/app/[locale]/dashboard/bookings/confirm/BookingConfirmPageContent";
import { quotationService } from "@/lib/api/services";

const getById = quotationService.getById as any;
const respond = quotationService.respondToQuotation as any;

const quotation = (over: Record<string, any> = {}) => ({
  id: "q1",
  quotationId: "QUO-1",
  vehicleType: "LUXURY_AC",
  startDate: "2026-12-01T00:00:00Z",
  endDate: "2026-12-03T00:00:00Z",
  startTime: "07:00",
  pickupLocation: "Colombo",
  dropoffLocation: "Kandy",
  passengerCount: 30,
  specialRequests: "Roof rack",
  vehicleRentalCost: 40000,
  driverCost: 5000,
  fuelCost: 8000,
  tollCharges: 700,
  tax: 1300,
  totalAmount: 55000,
  additionalNotes: "Water provided",
  vehicle: {
    licensePlate: "NB-1234",
    year: 2019,
    owner: { firstName: "Sunil", lastName: "Perera", email: "s@x.lk", phone: "0771234567" },
  },
  ...over,
});

const renderConfirm = async (data: any = quotation()) => {
  getById.mockResolvedValue(data);
  render(<BookingConfirmPageContent locale="en" />);
  await screen.findByText("Confirm Booking", { selector: "button" });
};

beforeEach(() => {
  vi.clearAllMocks();
  h.params = new URLSearchParams("quotationId=q1");
  h.guard.isLoading = false;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("BookingConfirmPageContent", () => {
  it("does not fetch while the guard is loading", () => {
    h.guard.isLoading = true;
    render(<BookingConfirmPageContent locale="en" />);
    expect(getById).not.toHaveBeenCalled();
  });

  it("summarises the quotation for review", async () => {
    await renderConfirm({ data: { quotation: quotation() } });
    expect(getById).toHaveBeenCalledWith("q1");
    expect(screen.getByText("LUXURY AC Bus")).toBeTruthy();
    expect(screen.getByText("License Plate: NB-1234")).toBeTruthy();
    expect(screen.getAllByText("(2 days)").length).toBeGreaterThan(0);
    expect(screen.getByText("Roof rack")).toBeTruthy();
    expect(screen.getByText("0771234567")).toBeTruthy();
    expect(screen.getByText("Additional Notes")).toBeTruthy();
    expect(screen.getByText("Rs. 700")).toBeTruthy();
    expect(screen.getByText("Rs. 55,000")).toBeTruthy();
  });

  it("handles a single-day trip without optional details", async () => {
    await renderConfirm({
      quotation: quotation({
        endDate: null, specialRequests: null, additionalNotes: null, tollCharges: 0,
        vehicle: { licensePlate: "X", year: 2020, owner: { firstName: "A", lastName: "B" } },
      }),
    });
    expect(screen.getAllByText("(1 day)").length).toBeGreaterThan(0);
    expect(screen.queryByText("Special Requirements")).toBeNull();
    expect(screen.queryByText("Additional Notes")).toBeNull();
    expect(screen.queryByText("Rs. 0")).toBeNull();
  });

  it("accepts the quotation and opens the new booking", async () => {
    respond.mockResolvedValue({ quotation: { booking: { id: "b1" } } });
    await renderConfirm();
    fireEvent.click(screen.getByText("Confirm Booking", { selector: "button" }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings/b1"));
    expect(respond).toHaveBeenCalledWith("q1", { status: "ACCEPTED" });
  });

  it("falls back to the top-level booking id, then to the bookings list", async () => {
    respond.mockResolvedValueOnce({ booking: { id: "b2" } }).mockResolvedValueOnce({});
    await renderConfirm();
    fireEvent.click(screen.getByText("Confirm Booking", { selector: "button" }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings/b2"));
    // A successful accept keeps the button in its "creating" state until navigation.
    expect(screen.getByText("Creating Booking...")).toBeTruthy();
    cleanup();
    await renderConfirm();
    fireEvent.click(screen.getByText("Confirm Booking", { selector: "button" }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings"));
  });

  it("shows the accept error and lets the customer go back", async () => {
    respond.mockRejectedValueOnce(new Error("Quotation expired"));
    await renderConfirm();
    fireEvent.click(screen.getByText("Confirm Booking", { selector: "button" }));
    expect(await screen.findByText("Quotation expired")).toBeTruthy();
    fireEvent.click(screen.getByText("Go Back"));
    expect(h.back).toHaveBeenCalled();
  });

  it("uses a generic message when accepting fails without one", async () => {
    respond.mockRejectedValueOnce({});
    await renderConfirm();
    fireEvent.click(screen.getByText("Confirm Booking", { selector: "button" }));
    expect(await screen.findByText("Failed to create booking")).toBeTruthy();
  });

  it("Back and Cancel return to the previous page", async () => {
    await renderConfirm();
    fireEvent.click(screen.getByText("Back"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(h.back).toHaveBeenCalledTimes(2);
  });

  it("shows load errors", async () => {
    getById.mockRejectedValueOnce(new Error("Not found"));
    const first = render(<BookingConfirmPageContent locale="en" />);
    expect(await screen.findByText("Not found")).toBeTruthy();
    first.unmount();
    getById.mockRejectedValueOnce({});
    render(<BookingConfirmPageContent locale="en" />);
    expect(await screen.findByText("Failed to load quotation details")).toBeTruthy();
  });

  it("explains a missing quotation id instead of loading forever", async () => {
    h.params = new URLSearchParams();

    render(<BookingConfirmPageContent locale="en" />);

    expect(await screen.findByText("No quotation ID provided")).toBeTruthy();
    expect(getById).not.toHaveBeenCalled();
  });

  it("never logs the quotation, which carries contact details", async () => {
    await renderConfirm();

    expect(console.log).not.toHaveBeenCalled();
  });
});
