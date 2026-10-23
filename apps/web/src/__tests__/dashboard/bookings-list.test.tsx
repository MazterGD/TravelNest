/**
 * Customer bookings list: status tabs, filters + sort (each resetting the
 * page), pagination, cancel confirmation, CSV export and error/empty states.
 */
import { configure, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  push: vi.fn(),
  router: null as any,
  cards: [] as any[],
}));

vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("next/navigation", () => ({
  useRouter: () => (h.router ??= { push: h.push }),
  usePathname: () => "/en/dashboard/bookings",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/components/features/customer", () => ({
  BookingCard: ({ booking, onCancel, onReview, onViewDetails }: any) => {
    h.cards.push(booking);
    return (
      <article data-testid="booking-card">
        <h3>{booking.vehicleName}</h3>
        <span>{booking.ownerName}</span>
        <button onClick={onCancel}>{`cancel-${booking.id}`}</button>
        <button onClick={onReview}>{`review-${booking.id}`}</button>
        <button onClick={onViewDetails}>{`view-${booking.id}`}</button>
      </article>
    );
  },
}));
vi.mock("@/components/ui", async (importOriginal: any) => ({
  ...(await importOriginal()),
  ConfirmDialog: ({ isOpen, onClose, onConfirm, title, confirmText, cancelText }: any) =>
    isOpen ? (
      <div role="dialog">
        <p>{title}</p>
        <button onClick={onConfirm}>{confirmText}</button>
        <button onClick={onClose}>{cancelText}</button>
      </div>
    ) : null,
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  bookingService: { getMyBookings: vi.fn(), cancel: vi.fn() },
}));

import { BookingsPageContent } from "@/app/[locale]/dashboard/bookings/BookingsPageContent";
import { ApiError, bookingService } from "@/lib/api";

const getMine = bookingService.getMyBookings as any;
const cancel = bookingService.cancel as any;

const row = (id: string, over: Record<string, any> = {}) => ({
  id,
  bookingReference: `BK-${id}`,
  startDate: "2026-12-01",
  endDate: "2026-12-02",
  createdAt: "2026-11-01",
  updatedAt: "2026-11-01",
  totalAmount: 50000,
  status: "CONFIRMED",
  paymentStatus: "PAID",
  vehicleName: `Bus ${id}`,
  vehicleType: "LUXURY_AC",
  ownerName: "Sunil",
  pickupLocation: "Colombo, Western",
  dropoffLocation: { address: "Kandy", city: "Kandy" },
  passengerCount: 20,
  ...over,
});

const page = (bookings: any[], total = bookings.length, totalPages = 1) => ({
  bookings,
  pagination: { total, totalPages },
});

const lastQuery = () => getMine.mock.calls.at(-1)[0];
const selectFor = (label: string) =>
  screen.getByText(label, { selector: "label" }).parentElement!.querySelector("select")!;
const inputFor = (label: string) =>
  screen.getByText(label, { selector: "label" }).parentElement!.querySelector("input")!;

const renderList = async () => {
  render(<BookingsPageContent locale="en" />);
  await waitFor(() => expect(getMine).toHaveBeenCalled());
  await waitFor(() => expect(document.querySelector('[class*="animate-pulse"]')).toBeNull());
};

beforeEach(() => {
  vi.clearAllMocks();
  h.cards = [];
  getMine.mockResolvedValue(page([row("1"), row("2", { vehicleName: "", ownerName: "", paymentStatus: undefined, bookingReference: undefined, bookingRef: "REF-2", pickupLocation: { address: "Galle" } })], 14, 3));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BookingsPageContent", () => {
  it("loads the first page and maps rows into booking cards", async () => {
    await renderList();
    expect(getMine).toHaveBeenCalledWith({
      status: undefined, startDate: undefined, endDate: undefined, vehicleType: undefined,
      sort: "createdAt_desc", page: 1, limit: 6,
    });
    expect(screen.getAllByTestId("booking-card").length).toBe(2);
    expect(screen.getByText("vehicleFallback")).toBeTruthy();
    expect(screen.getByText("ownerFallback")).toBeTruthy();
    const second = h.cards.find((b) => b.id === "2");
    expect(second.bookingReference).toBe("REF-2");
    expect(second.paymentStatus).toBe("pending");
    const first = h.cards.find((b) => b.id === "1");
    expect(first.pickupLocation).toEqual({ address: "Colombo, Western", city: "Colombo" });
    expect(screen.getByText('pagination.showing:{"from":1,"to":6,"total":14}')).toBeTruthy();
    expect(screen.getByText('pagination.page:{"current":1,"total":3}')).toBeTruthy();
  });

  it("paginates forward and back", async () => {
    await renderList();
    expect((screen.getByText("pagination.previous") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("pagination.next"));
    await waitFor(() => expect(lastQuery().page).toBe(2));
    await screen.findByText('pagination.showing:{"from":7,"to":12,"total":14}');
    fireEvent.click(screen.getByText("pagination.next"));
    await screen.findByText('pagination.showing:{"from":13,"to":14,"total":14}');
    expect((screen.getByText("pagination.next") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("pagination.previous"));
    await waitFor(() => expect(lastQuery().page).toBe(2));
  });

  it("filters by tab, dates, vehicle type and sort, resetting to page 1", async () => {
    await renderList();
    fireEvent.click(screen.getByText("pagination.next"));
    await waitFor(() => expect(lastQuery().page).toBe(2));
    fireEvent.click(screen.getByText("completed"));
    await waitFor(() => expect(lastQuery()).toMatchObject({ status: "completed", page: 1 }));
    fireEvent.change(inputFor("filters.dateFrom"), { target: { value: "2026-12-01" } });
    await waitFor(() => expect(lastQuery().startDate).toBe("2026-12-01"));
    fireEvent.change(inputFor("filters.dateTo"), { target: { value: "2026-12-31" } });
    await waitFor(() => expect(lastQuery().endDate).toBe("2026-12-31"));
    fireEvent.change(selectFor("filters.vehicleType"), { target: { value: "SEMI_LUXURY" } });
    await waitFor(() => expect(lastQuery().vehicleType).toBe("SEMI_LUXURY"));
    fireEvent.change(selectFor("filters.sortBy"), { target: { value: "totalAmount_desc" } });
    await waitFor(() => expect(lastQuery().sort).toBe("totalAmount_desc"));
    expect(screen.getByText("filters.activeFilters:")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("filters.clearFilters"));
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ startDate: undefined, endDate: undefined, vehicleType: undefined, sort: "createdAt_desc", status: "completed" }),
    );
    expect(screen.queryByText("filters.activeFilters:")).toBeNull();
  });

  it("routes to review and detail pages", async () => {
    await renderList();
    fireEvent.click(screen.getByText("review-1"));
    expect(h.push).toHaveBeenCalledWith("/en/dashboard/reviews?booking=1");
    fireEvent.click(screen.getByText("view-2"));
    expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings/2");
  });

  it("cancels a booking after confirmation and reloads", async () => {
    cancel.mockResolvedValue({});
    await renderList();
    fireEvent.click(screen.getByText("cancel-1"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByText("cancelDialog.cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("cancel-1"));
    fireEvent.click(screen.getByText("cancelDialog.confirm"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(cancel).toHaveBeenCalledWith("1", "Cancelled by customer");
    expect(getMine).toHaveBeenCalledTimes(2);
  });

  it("shows a cancel error that clears itself after 4 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cancel.mockRejectedValueOnce(new ApiError(409, "Too late to cancel")).mockRejectedValueOnce(new Error("x"));
    await renderList();
    fireEvent.click(screen.getByText("cancel-1"));
    fireEvent.click(screen.getByText("cancelDialog.confirm"));
    expect((await screen.findByRole("alert")).textContent).toBe("Too late to cancel");
    fireEvent.click(screen.getByText("cancelDialog.confirm"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("errors.cancelFailed"));
    await act(async () => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows load errors with a retry", async () => {
    getMine.mockRejectedValueOnce(new ApiError(500, "Server busy")).mockRejectedValueOnce(new Error("x"));
    render(<BookingsPageContent locale="en" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Server busy");
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("errors.fetchBookings"));
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shows the empty state and disables export with no bookings", async () => {
    getMine.mockResolvedValue({});
    await renderList();
    expect(screen.getByText("noBookings")).toBeTruthy();
    expect(screen.queryByText(/pagination\./)).toBeNull();
    expect(screen.getByText("exportCSV").closest("button")!.disabled).toBe(true);
  });

  it("exports all matching bookings as CSV", async () => {
    const createURL = vi.fn(() => "blob:csv");
    const revokeURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    (URL as any).createObjectURL = createURL;
    (URL as any).revokeObjectURL = revokeURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    let blob: Blob | null = null;
    createURL.mockImplementation(((b: Blob) => {
      blob = b;
      return "blob:csv";
    }) as any);
    await renderList();
    getMine.mockResolvedValueOnce({
      bookings: [
        row("1", { ownerName: 'Sunil "Bus" Perera' }),
        row("2", { vehicleName: null, ownerName: null, ownerPhone: "077", pickupLocation: null, dropoffLocation: "Ella", passengerCount: null, vehicleType: null }),
      ],
    });
    fireEvent.click(screen.getByText("exportCSV"));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(lastQuery()).toMatchObject({ page: 1, limit: 1000 });
    expect(revokeURL).toHaveBeenCalledWith("blob:csv");
    const text = await (blob as unknown as Blob).text();
    const lines = text.split("\n");
    expect(lines[0]).toContain('"Booking Ref","Status","Vehicle"');
    expect(lines[1]).toContain('"Sunil ""Bus"" Perera"');
    expect(lines[2]).toContain('"Ella"');
    click.mockRestore();
    (URL as any).createObjectURL = origCreate;
    (URL as any).revokeObjectURL = origRevoke;
  });

  it("swallows export failures", async () => {
    await renderList();
    getMine.mockRejectedValueOnce(new Error("x"));
    fireEvent.click(screen.getByText("exportCSV"));
    await waitFor(() => expect(screen.getByText("exportCSV").closest("button")!.disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("uses an empty list when the export payload has no bookings", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    (URL as any).createObjectURL = () => "blob:x";
    (URL as any).revokeObjectURL = () => undefined;
    await renderList();
    getMine.mockResolvedValueOnce({});
    fireEvent.click(screen.getByText("exportCSV"));
    await waitFor(() => expect(click).toHaveBeenCalled());
    (URL as any).createObjectURL = origCreate;
    (URL as any).revokeObjectURL = origRevoke;
    click.mockRestore();
  });
});
