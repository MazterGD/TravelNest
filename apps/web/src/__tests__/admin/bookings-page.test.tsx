/**
 * Admin booking management page: deep-link filters, list/pagination, CSV
 * export, and the detail modal's state-machine-guarded status update and
 * cancel-with-refund flows.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/bookings",
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getBookings: vi.fn(),
    getBookingById: vi.fn(),
    updateBookingStatus: vi.fn(),
    cancelBookingWithRefund: vi.fn(),
    exportBookingsCsv: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminBookingsPage from "@/app/[locale]/admin/bookings/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const booking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-0000abcd1234",
  startDate: now,
  endDate: now,
  pickupLocation: "Colombo",
  dropoffLocation: "Kandy",
  totalAmount: 45000,
  status: "PENDING",
  customer: { firstName: "Ravi", lastName: "Kumar", email: "ravi@x.lk" },
  vehicle: { name: "Lanka Cruiser", licensePlate: "NB-1234" },
  payment: { status: "COMPLETED", amount: 45000 },
  ...overrides,
});

const list = (bookings: any[], extra: Record<string, unknown> = {}) => ({
  bookings,
  total: bookings.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...extra,
});

const lastDialog = () => screen.getAllByRole("dialog").pop() as HTMLElement;
const lastQuery = () => svc.getBookings.mock.calls.at(-1)[0];

const renderPage = async () => {
  render(<AdminBookingsPage />);
  await waitFor(() => expect(svc.getBookings).toHaveBeenCalled());
};

const openDetail = async (code = "ABCD1234") => {
  await act(async () => fireEvent.click(screen.getByLabelText(`View details for booking ${code}`)));
  return screen.findByRole("dialog");
};

describe("AdminBookingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getBookings.mockResolvedValue(
      list([
        booking(),
        booking({
          id: "booking-0000zzzz9999",
          status: "MYSTERY",
          payment: { status: "WEIRD" },
          customer: { firstName: "Mala", lastName: "Silva", email: "mala@x.lk" },
        }),
        booking({ id: "booking-0000nopay0001", payment: null, status: "CANCELLED" }),
      ]),
    );
    svc.getBookingById.mockResolvedValue(booking());
    svc.updateBookingStatus.mockResolvedValue({});
    svc.cancelBookingWithRefund.mockResolvedValue({});
    svc.exportBookingsCsv.mockResolvedValue(undefined);
  });

  it("renders bookings with status and payment badges", async () => {
    await renderPage();
    expect(await screen.findByText("#ABCD1234")).toBeTruthy();
    expect(screen.getByText("Mystery")).toBeTruthy();
    expect(screen.getByText("WEIRD")).toBeTruthy();
    expect(screen.getByText("1–3 of 3")).toBeTruthy();
    expect(screen.getAllByText("Lanka Cruiser").length).toBe(3);
  });

  it("seeds valid status, payment status and search from the URL", async () => {
    nav.search = "status=CONFIRMED&paymentStatus=REFUNDED&search=ravi";
    await renderPage();
    expect(lastQuery()).toMatchObject({ status: "CONFIRMED", paymentStatus: "REFUNDED", search: "ravi" });
  });

  it("drops invalid URL statuses", async () => {
    nav.search = "status=NOPE&paymentStatus=NOPE";
    await renderPage();
    expect(lastQuery()).toMatchObject({ status: undefined, paymentStatus: undefined });
  });

  it("shows empty and error states", async () => {
    svc.getBookings.mockResolvedValueOnce(list([]));
    await renderPage();
    expect(await screen.findByText("No bookings found")).toBeTruthy();
    svc.getBookings.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByLabelText("Refresh bookings list"));
    expect(await screen.findByText(/Failed to load bookings/)).toBeTruthy();
  });

  it("filters by pills, search, payment status and dates; paginates", async () => {
    svc.getBookings.mockResolvedValue(list([booking()], { page: 2, totalPages: 4, total: 70 }));
    await renderPage();
    await screen.findByText("Page 2 of 4");
    fireEvent.click(screen.getByLabelText("Go to next page"));
    await waitFor(() => expect(lastQuery().page).toBe(3));
    fireEvent.click(screen.getByLabelText("Go to previous page"));
    await waitFor(() => expect(lastQuery().page).toBe(1));

    fireEvent.click(screen.getByText("Ongoing"));
    await waitFor(() => expect(lastQuery().status).toBe("ONGOING"));
    fireEvent.change(screen.getByLabelText("Search bookings"), { target: { value: "  ravi " } });
    await waitFor(() => expect(lastQuery().search).toBe("ravi"));
    fireEvent.change(document.querySelector("select") as HTMLSelectElement, { target: { value: "FAILED" } });
    await waitFor(() => expect(lastQuery().paymentStatus).toBe("FAILED"));
    fireEvent.change(document.querySelector("select") as HTMLSelectElement, { target: { value: "" } });
    await waitFor(() => expect(lastQuery().paymentStatus).toBeUndefined());
    fireEvent.change(screen.getByLabelText("Start date from"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Start date to"), { target: { value: "2026-09-30" } });
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ startDateFrom: "2026-09-01", startDateTo: "2026-09-30", page: 1 }),
    );

    await act(async () => fireEvent.click(screen.getByLabelText("Export bookings as CSV")));
    expect(svc.exportBookingsCsv).toHaveBeenCalledWith({
      search: "ravi",
      status: "ONGOING",
      paymentStatus: undefined,
      startDateFrom: "2026-09-01",
      startDateTo: "2026-09-30",
    });

    fireEvent.change(screen.getByLabelText("Start date from"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Start date to"), { target: { value: "" } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ startDateFrom: undefined, startDateTo: undefined }));
  });

  it("reports export errors", async () => {
    svc.exportBookingsCsv.mockRejectedValueOnce(new Error("CSV broke"));
    await renderPage();
    await screen.findByText("#ABCD1234");
    await act(async () => fireEvent.click(screen.getByLabelText("Export bookings as CSV")));
    expect(await screen.findByText(/CSV broke/)).toBeTruthy();
    svc.exportBookingsCsv.mockRejectedValueOnce("x");
    await act(async () => fireEvent.click(screen.getByLabelText("Export bookings as CSV")));
    expect(await screen.findByText(/Failed to export bookings CSV/)).toBeTruthy();
  });

  it("moves a pending booking to the next state after confirmation", async () => {
    await renderPage();
    await screen.findByText("#ABCD1234");
    const dialog = await openDetail();
    expect(svc.getBookingById).toHaveBeenCalledWith("booking-0000abcd1234");
    expect(within(dialog).getByText("Booking #ABCD1234")).toBeTruthy();
    expect(within(dialog).getByText("Kandy")).toBeTruthy();
    expect(within(dialog).getByText("NB-1234")).toBeTruthy();
    expect(within(dialog).getByText("Amount paid")).toBeTruthy();

    const moveTo = dialog.querySelector("select") as HTMLSelectElement;
    expect(moveTo.value).toBe("CONFIRMED");

    fireEvent.click(within(dialog).getByText("Update Status", { selector: "button" }));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.updateBookingStatus).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByText("Update Status", { selector: "button" }));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    expect(screen.getByText("Move this booking from PENDING to CONFIRMED?")).toBeTruthy();
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Update Status")));
    await waitFor(() =>
      expect(svc.updateBookingStatus).toHaveBeenCalledWith("booking-0000abcd1234", "CONFIRMED", "Updated by admin"),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("cancels with a typed reason and status reason", async () => {
    svc.getBookingById.mockResolvedValue(booking({ status: "ONGOING" }));
    await renderPage();
    await screen.findByText("#ABCD1234");
    let dialog = await openDetail();
    fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, { target: { value: "CANCELLED" } });
    fireEvent.change(within(dialog).getByLabelText("Reason (optional)"), { target: { value: " Driver sick " } });
    fireEvent.click(within(dialog).getByText("Update Status", { selector: "button" }));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Update Status")));
    await waitFor(() =>
      expect(svc.updateBookingStatus).toHaveBeenCalledWith("booking-0000abcd1234", "CANCELLED", "Driver sick"),
    );

    dialog = await openDetail();
    const reason = within(dialog).getByLabelText("Refund reason") as HTMLInputElement;
    expect(reason.value).toBe("Cancelled by admin review");
    fireEvent.change(reason, { target: { value: "   " } });
    expect(
      (within(dialog).getByText("Cancel Booking & Process Refund").closest("button") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(reason, { target: { value: "Vehicle breakdown" } });
    fireEvent.change(within(dialog).getByLabelText("Refund amount (leave blank for full refund)"), {
      target: { value: "5000" },
    });
    fireEvent.click(within(dialog).getByText("Cancel Booking & Process Refund"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.cancelBookingWithRefund).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByText("Cancel Booking & Process Refund"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Cancel & Refund")));
    await waitFor(() =>
      expect(svc.cancelBookingWithRefund).toHaveBeenCalledWith("booking-0000abcd1234", "Vehicle breakdown", 5000),
    );
  });

  it("refunds in full when the amount is blank and surfaces mutation errors", async () => {
    svc.getBookingById.mockResolvedValue(booking({ status: "CONFIRMED" }));
    svc.cancelBookingWithRefund.mockRejectedValueOnce(new Error("Gateway refused"));
    await renderPage();
    await screen.findByText("#ABCD1234");
    const dialog = await openDetail();
    fireEvent.click(within(dialog).getByText("Cancel Booking & Process Refund"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Cancel & Refund")));
    await waitFor(() =>
      expect(svc.cancelBookingWithRefund).toHaveBeenCalledWith(
        "booking-0000abcd1234",
        "Cancelled by admin review",
        undefined,
      ),
    );
    expect(await screen.findByText(/Gateway refused/)).toBeTruthy();
  });

  it("hides management for terminal bookings and shows missing payment", async () => {
    svc.getBookingById.mockResolvedValue(
      booking({ status: "COMPLETED", payment: null, dropoffLocation: null, vehicle: null }),
    );
    await renderPage();
    await screen.findByText("#ABCD1234");
    const dialog = await openDetail();
    expect(within(dialog).getByText("No payment recorded")).toBeTruthy();
    expect(within(dialog).queryByText("Drop-off")).toBeNull();
    expect(within(dialog).getByText("—")).toBeTruthy();
    expect(within(dialog).queryByText("Update Status")).toBeNull();
    expect(within(dialog).queryByText("Cancel & Refund")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("hides status update for unknown statuses but keeps refund", async () => {
    svc.getBookingById.mockResolvedValue(booking({ status: "MYSTERY", payment: { status: "WEIRD", amount: null } }));
    await renderPage();
    await screen.findByText("#ABCD1234");
    const dialog = await openDetail();
    expect(within(dialog).queryByText("Update Status")).toBeNull();
    expect(within(dialog).getByText("Cancel & Refund")).toBeTruthy();
    expect(within(dialog).queryByText("Amount paid")).toBeNull();
  });

  it("shows a loading state and an error when details fail", async () => {
    svc.getBookingById.mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("#ABCD1234");
    await openDetail();
    expect(await screen.findByText(/Failed to load booking details/)).toBeTruthy();
    expect(screen.getByLabelText("Loading booking details")).toBeTruthy();
  });
});
