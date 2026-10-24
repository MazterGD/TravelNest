/**
 * Owner bookings list: status tab mapping and counts, search (incl. the
 * ?vehicleReg= deep link), customer contact actions, removed customers,
 * list/calendar view switch, empty and error states.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  search: "",
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/bookings",
}));
vi.mock("next-intl", () => ({ useTranslations: () => state.t, useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks", () => ({ useOwnerGuard: () => state.guard }));
vi.mock("@/store", () => ({ useAuthStore: () => ({ user: state.user }) }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {}
  return { ApiError, bookingService: { getOwnerBookings: vi.fn() } };
});

import { ApiError, bookingService } from "@/lib/api";
import BookingsManagementPage from "@/app/[locale]/owner/bookings/page";

const bookings = bookingService as any;

const booking = (id: string, status: string, overrides: Record<string, unknown> = {}) => ({
  id,
  bookingRef: `TN-${id}`,
  customer: { name: "Ravi Kumar", phone: "0771234567", email: "ravi@x.lk", organization: "Royal College" },
  vehicle: { registration: "NB-1234", type: "LUXURY_AC" },
  trip: { startDate: "2026-11-01", endDate: "2026-11-02", route: "Colombo → Kandy", passengers: 40 },
  payment: { total: 45000, status: "paid" },
  status,
  createdAt: "2026-10-01",
  ...overrides,
});

const refs = () => Array.from(document.querySelectorAll("h3")).map((h) => h.textContent);

const renderPage = async () => {
  render(<BookingsManagementPage />);
  await waitFor(() => expect(bookings.getOwnerBookings).toHaveBeenCalled());
  await waitFor(() => expect(document.querySelector(".animate-spin")).toBeNull());
};

describe("Owner BookingsManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    state.search = "";
    bookings.getOwnerBookings.mockResolvedValue({
      bookings: [
        booking("1", "PENDING", { payment: { total: 1000, status: "pending" } }),
        booking("2", "CONFIRMED", { customer: { name: "Mala", phone: "", email: "", isRemoved: true }, vehicle: { registration: "NC-9999", type: "ORDINARY" }, payment: { total: 2000, status: "partial" } }),
        booking("3", "ONGOING", { payment: { total: 3000, status: "refunded" } }),
        booking("4", "COMPLETED"),
        booking("5", "CANCELLED"),
        booking("6", "WEIRD"),
      ],
    });
  });

  it("is gated by guard and user", () => {
    state.user = null;
    render(<BookingsManagementPage />);
    expect(bookings.getOwnerBookings).not.toHaveBeenCalled();
  });

  it("shows upcoming bookings by default with counts and contact actions", async () => {
    await renderPage();
    expect(refs()).toEqual(["TN-1", "TN-2", "TN-6"]);
    expect(screen.getByText("tabUpcoming (3)")).toBeTruthy();
    expect(screen.getByText("tabInProgress (1)")).toBeTruthy();
    expect(screen.getByText("tabCompleted (1)")).toBeTruthy();
    expect(screen.getByText("tabCancelled (1)")).toBeTruthy();
    expect(screen.getByText(/^3 bookingPlural/)).toBeTruthy();
    expect(screen.getByText("customerRemoved")).toBeTruthy();
    expect(screen.getAllByText("messageCustomer").length).toBe(2);
    expect(screen.getAllByText("call")[0].closest("a")?.getAttribute("href")).toBe("tel:0771234567");
    expect(screen.getAllByText("emailBtn")[0].closest("a")?.getAttribute("href")).toBe("mailto:ravi@x.lk");
    expect(screen.getAllByText("viewDetails")[0].closest("a")?.getAttribute("href")).toBe("/en/owner/bookings/1");
    expect(screen.getAllByText("Royal College").length).toBe(2);
    expect(screen.getByText("currency 2,000")).toBeTruthy();
  });

  it("switches status tabs including empty states", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("tabInProgress (1)"));
    expect(refs()).toEqual(["TN-3"]);
    expect(screen.getByText(/^1 bookingSingular/)).toBeTruthy();
    fireEvent.click(screen.getByText("tabCompleted (1)"));
    expect(refs()).toEqual(["TN-4"]);
    fireEvent.click(screen.getByText("tabCancelled (1)"));
    expect(refs()).toEqual(["TN-5"]);
    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: "nothing" } });
    expect(screen.getByText('emptyTitle:{"status":"cancelled"}')).toBeTruthy();
    fireEvent.click(screen.getByText("tabUpcoming (3)"));
    expect(screen.getByText("emptyUpcomingTitle")).toBeTruthy();
  });

  it("searches by reference, customer and registration", async () => {
    await renderPage();
    const search = screen.getByPlaceholderText("searchPlaceholder");
    fireEvent.change(search, { target: { value: "tn-6" } });
    expect(refs()).toEqual(["TN-6"]);
    fireEvent.change(search, { target: { value: "MALA" } });
    expect(refs()).toEqual(["TN-2"]);
    fireEvent.change(search, { target: { value: "nc-99" } });
    expect(refs()).toEqual(["TN-2"]);
  });

  it("pre-fills the search from ?vehicleReg=", async () => {
    state.search = "vehicleReg=NC-9999";
    await renderPage();
    expect((screen.getByPlaceholderText("searchPlaceholder") as HTMLInputElement).value).toBe("NC-9999");
    expect(refs()).toEqual(["TN-2"]);
  });

  it("toggles the calendar placeholder view", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("viewCalendar"));
    expect(screen.getByText("calendarComingSoon")).toBeTruthy();
    expect(refs()).toEqual(["calendarTitle"]);
    fireEvent.click(screen.getByText("viewList"));
    expect(refs()).toContain("TN-1");
  });

  it.todo("exports the bookings list when the Export button is clicked (the button has no handler)");

  it("shows API and generic errors", async () => {
    bookings.getOwnerBookings.mockRejectedValueOnce(new (ApiError as any)("Bookings offline"));
    const first = render(<BookingsManagementPage />);
    expect(await screen.findByText("Bookings offline")).toBeTruthy();
    first.unmount();
    bookings.getOwnerBookings.mockRejectedValueOnce(new Error("x"));
    render(<BookingsManagementPage />);
    expect(await screen.findByText("errorLoad")).toBeTruthy();
  });

  it("treats a malformed response as no bookings", async () => {
    bookings.getOwnerBookings.mockResolvedValue({ bookings: null });
    await renderPage();
    expect(screen.getByText("emptyUpcomingTitle")).toBeTruthy();
  });
});
