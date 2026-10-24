/**
 * Trip packages page: search + filters, compare table (max 3), and the
 * booking modal's validation and redirect to payment.
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  push: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  usePathname: () => "/en/dashboard/packages",
  useSearchParams: () => h.search,
  useParams: () => ({ locale: "en" }),
}));
vi.mock("@/components/features/customer", () => ({
  TripPackageCard: ({ tripPackage, isSelected, onToggleCompare, onBook }: any) => (
    <article data-testid="pkg">
      <h3>{tripPackage.title}</h3>
      <span>{isSelected ? "selected" : "not-selected"}</span>
      <button onClick={() => onToggleCompare(tripPackage.id)}>{`compare-${tripPackage.id}`}</button>
      <button onClick={() => onBook(tripPackage)}>{`book-${tripPackage.id}`}</button>
    </article>
  ),
}));
vi.mock("@/components/ui", async (importOriginal: any) => ({
  ...(await importOriginal()),
  Modal: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
        <button onClick={onClose}>close-modal</button>
      </div>
    ) : null,
  DatePicker: ({ label, value, onChange }: any) => (
    <label>
      {label}
      <input type="date" value={value} onChange={onChange} />
    </label>
  ),
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  tripPackageService: { getAll: vi.fn(), book: vi.fn(), getById: vi.fn() },
}));

import { PackagesPageContent } from "@/app/[locale]/dashboard/packages/packages-page-content";
import { ApiError, tripPackageService } from "@/lib/api";

const getAll = tripPackageService.getAll as any;
const book = tripPackageService.book as any;

const pkg = (id: string, over: Record<string, any> = {}) => ({
  id,
  title: `Package ${id}`,
  startLocation: "Colombo",
  endLocation: "Kandy",
  durationDays: 2,
  minPassengers: 10,
  maxPassengers: 40,
  price: 50000,
  vehicle: { name: "Lanka Coach" },
  ...over,
});

const packages = [
  pkg("a"),
  pkg("b", { title: "Southern Coast", startLocation: "Galle", endLocation: "Matara", durationDays: 3, minPassengers: 5, maxPassengers: 15, price: 30000, vehicle: null }),
  pkg("c", { title: "Hill Country", startLocation: "Kandy", endLocation: "Ella", durationDays: 4, price: 90000 }),
  pkg("d", { title: "North Tour", startLocation: "Jaffna", endLocation: "Mannar" }),
];

const titles = () => screen.queryAllByTestId("pkg").map((e) => e.querySelector("h3")!.textContent);
const field = (label: string) =>
  screen.getByText(label, { selector: "label" }).parentElement!.querySelector("input") as HTMLInputElement;

const renderPage = async () => {
  render(<PackagesPageContent locale="en" />);
  await waitFor(() => expect(titles().length).toBe(4));
};

beforeEach(() => {
  vi.clearAllMocks();
  getAll.mockResolvedValue({ packages });
  h.search = new URLSearchParams();
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

describe("PackagesPageContent", () => {
  it("opens the booking form for the package named in ?book=", async () => {
    h.search = new URLSearchParams("book=c");
    await renderPage();

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain("Hill Country");
  });

  it("fetches a package named in ?book= that is not in the list", async () => {
    (tripPackageService.getById as any).mockResolvedValue({ tripPackage: pkg("z", { title: "Hidden Gem" }) });
    h.search = new URLSearchParams("book=z");
    await renderPage();

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain("Hidden Gem");
  });

  it("loads active packages", async () => {
    render(<PackagesPageContent locale="en" />);
    expect(screen.getByText("loading")).toBeTruthy();
    await waitFor(() => expect(titles().length).toBe(4));
    expect(getAll).toHaveBeenCalledWith({ isActive: true });
  });

  it("searches and filters packages", async () => {
    await renderPage();
    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: "ella" } });
    expect(titles()).toEqual(["Hill Country"]);
    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: "" } });
    fireEvent.click(screen.getByText("filters.title"));
    const apply = (label: string, value: string, expected: string[]) => {
      fireEvent.change(field(label), { target: { value } });
      expect(titles()).toEqual(expected);
      fireEvent.change(field(label), { target: { value: "" } });
    };
    apply("filters.startLocation", "gal", ["Southern Coast"]);
    apply("filters.endLocation", "mann", ["North Tour"]);
    apply("filters.durationDays", "4", ["Hill Country"]);
    apply("filters.minPassengers", "20", ["Package a", "Hill Country", "North Tour"]);
    apply("filters.maxPassengers", "6", ["Southern Coast"]);
    apply("filters.minPrice", "60000", ["Hill Country"]);
    apply("filters.maxPrice", "40000", ["Southern Coast"]);
    fireEvent.change(field("filters.maxPrice"), { target: { value: "1" } });
    expect(screen.getByText("empty")).toBeTruthy();
    fireEvent.click(screen.getByText("filters.clear"));
    expect(titles().length).toBe(4);
  });

  it("compares up to three packages side by side", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("compare-a"));
    expect(screen.queryByText("compare.title")).toBeNull();
    fireEvent.click(screen.getByText("compare-b"));
    expect(screen.getByText("compare.title")).toBeTruthy();
    expect(screen.getByText("Colombo → Kandy")).toBeTruthy();
    expect(screen.getByText("vehicleFallback")).toBeTruthy();
    expect(screen.getByText("LKR 30,000")).toBeTruthy();
    expect(screen.getByText("5 - 15")).toBeTruthy();
    fireEvent.click(screen.getByText("compare-c"));
    fireEvent.click(screen.getByText("compare-d"));
    expect(window.alert).toHaveBeenCalledWith("errors.compareLimit");
    expect(screen.getAllByText("selected").length).toBe(3);
    const removeButtons = document.querySelectorAll("thead button");
    fireEvent.click(removeButtons[0]);
    expect(screen.getAllByText("selected").length).toBe(2);
    fireEvent.click(screen.getByText("compare.clear"));
    expect(screen.queryByText("compare.title")).toBeNull();
  });

  it("validates the booking modal before booking", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("book-b"));
    expect(screen.getByText('modal.titleWithName:{"name":"Southern Coast"}')).toBeTruthy();
    const pax = field('modal.passengerCount:{"min":5}');
    expect(pax.value).toBe("5");
    fireEvent.click(screen.getByText("modal.confirm"));
    expect(window.alert).toHaveBeenCalledWith("errors.missingStartDate");
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
    fireEvent.change(pax, { target: { value: "50" } });
    fireEvent.click(screen.getByText("modal.confirm"));
    expect(window.alert).toHaveBeenCalledWith("errors.passengerLimit");
    fireEvent.change(pax, { target: { value: "2" } });
    fireEvent.click(screen.getByText("modal.confirm"));
    expect((window.alert as any).mock.calls.length).toBe(3);
    expect(book).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("modal.cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("books a package and goes to payment", async () => {
    book.mockResolvedValue({ booking: { id: "bk1" } });
    await renderPage();
    fireEvent.click(screen.getByText("book-a"));
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
    fireEvent.change(field("modal.notes"), { target: { value: "Vegetarian lunch" } });
    fireEvent.click(screen.getByText("modal.confirm"));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings/bk1/payment"));
    expect(book).toHaveBeenCalledWith("a", {
      startDate: new Date("2026-12-01").toISOString(),
      passengerCount: 10,
      notes: "Vegetarian lunch",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("alerts booking errors", async () => {
    book.mockRejectedValueOnce(new ApiError(409, "Sold out")).mockRejectedValueOnce(new Error("x"));
    await renderPage();
    fireEvent.click(screen.getByText("book-a"));
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByText("modal.confirm"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Sold out"));
    expect(book.mock.calls[0][1].notes).toBeUndefined();
    fireEvent.click(screen.getByText("modal.confirm"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("errors.bookingFailed"));
    fireEvent.click(screen.getByText("close-modal"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows API and generic load errors and an empty list", async () => {
    getAll.mockRejectedValueOnce(new ApiError(500, "Packages offline"));
    const first = render(<PackagesPageContent locale="en" />);
    expect(await screen.findByText("Packages offline")).toBeTruthy();
    first.unmount();
    getAll.mockRejectedValueOnce(new Error("x"));
    const second = render(<PackagesPageContent locale="en" />);
    expect(await screen.findByText("errors.fetchPackages")).toBeTruthy();
    second.unmount();
    getAll.mockResolvedValueOnce({});
    render(<PackagesPageContent locale="en" />);
    expect(await screen.findByText("empty")).toBeTruthy();
  });
});
