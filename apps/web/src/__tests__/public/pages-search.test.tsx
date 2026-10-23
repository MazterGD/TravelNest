/**
 * Vehicle search page: URL-seeded filters, query building (one-way vs round
 * trip, radius coordinates, seats, sort), nearby-match notices, results,
 * pagination, empty and error states.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => nav.search,
  usePathname: () => "/en/search",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}|${Object.values(values).join("|")}` : key,
  useLocale: () => "en",
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/ui", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // A plain input plus a "pick" button standing in for a geocoder suggestion.
    LocationAutocomplete: ({ placeholder, value, disabled, onChange, onSelectLocation }: any) => (
      <div>
        <input
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() =>
            onSelectLocation(
              placeholder === "fromPlaceholder"
                ? { city: "Kandy", displayName: "Kandy, LK", lat: 7.29, lng: 80.63, district: "Kandy" }
                : { city: "", displayName: "Ella, Badulla", lat: 6.87, lng: 81.05, district: "Badulla" },
            )
          }
        >
          pick-{placeholder}
        </button>
      </div>
    ),
  };
});

const services = vi.hoisted(() => ({
  vehicleService: { getAll: vi.fn() },
  landingContentService: { getPublicConfig: vi.fn() },
}));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { ...services, ApiError };
});

import SearchPage from "@/app/[locale]/search/page";
import { ApiError } from "@/lib/api/client";

const { vehicleService, landingContentService } = services;

const options = {
  options: {
    vehicleTypes: [
      { value: "ORDINARY", label: "Ordinary" },
      { value: "semi-luxury", label: "Semi" },
      { value: "LUXURY_AC", label: "Lux" },
      { value: "DOUBLE_DECKER", label: "Double Decker" },
    ],
    acTypes: [
      { value: "full-ac", label: "Full" },
      { value: "ac", label: "AC" },
      { value: "non-ac", label: "Non" },
      { value: "solar", label: "Solar" },
    ],
    amenities: [
      { id: "wifi", label: "WiFi" },
      { id: "usb", label: "USB" },
      { id: "minibar", label: "Mini bar" },
    ],
    districts: ["Colombo", "Gampaha"],
  },
};

const bus = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Bus ${id}`,
  type: "LUXURY_AC",
  seats: 45,
  acType: "FULL_AC",
  location: "Colombo",
  pricePerDay: 25000,
  amenities: [],
  ...extra,
});

const result = (vehicles: unknown[], extra: Record<string, unknown> = {}) => ({
  vehicles,
  pagination: { page: 1, limit: 12, total: vehicles.length, totalPages: 1 },
  ...extra,
});

const lastQuery = () => vehicleService.getAll.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = new URLSearchParams();
  landingContentService.getPublicConfig.mockResolvedValue(options);
  vehicleService.getAll.mockResolvedValue(result([]));
});

describe("search page", () => {
  it("seeds filters from the URL and sends the derived query", async () => {
    nav.search = new URLSearchParams(
      "vehicleType=LUXURY_AC&minCapacity=20&maxCapacity=50&acType=ac&district=Colombo&amenities=wifi, usb,&from=Colombo&to=Kandy&tripType=one_way&date=2026-12-01&passengers=30",
    );
    render(<SearchPage />);
    await waitFor(() => expect(vehicleService.getAll).toHaveBeenCalled());
    expect(lastQuery()).toEqual({
      type: "LUXURY_AC",
      district: "Colombo",
      acType: "ac",
      location: "Colombo",
      location2: "Kandy",
      minSeats: 30,
      maxSeats: 50,
      amenities: "wifi,usb",
      startDate: "2026-12-01",
      page: 1,
      limit: 12,
    });
    expect(screen.getAllByText("11").length).toBeGreaterThan(0);
  });

  it("ignores invalid counts and treats unknown trip types as round trips", async () => {
    nav.search = new URLSearchParams("minCapacity=abc&passengers=-3&to=Kandy&tripType=weird");
    render(<SearchPage />);
    await waitFor(() => expect(vehicleService.getAll).toHaveBeenCalled());
    expect(lastQuery()).toEqual({ page: 1, limit: 12 });
    expect((screen.getByPlaceholderText("toPlaceholder") as HTMLInputElement).disabled).toBe(true);
  });

  it("localizes filter options and applies them to the query", async () => {
    const { container } = render(<SearchPage />);
    expect(await screen.findByText("filters.acTypes.fullAc")).toBeTruthy();
    expect(screen.getByText("Solar")).toBeTruthy();
    expect(screen.getByText("filters.amenityOptions.wifi")).toBeTruthy();
    expect(screen.getByText("Mini bar")).toBeTruthy();
    expect(screen.getAllByText("filters.vehicleTypes.semiLuxury").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Double Decker").length).toBeGreaterThan(0);
    expect(screen.getAllByText("colombo").length).toBeGreaterThan(0);

    const [typeSelect, districtSelect, sortSelect] = Array.from(container.querySelectorAll("select"));
    fireEvent.change(typeSelect, { target: { value: "ORDINARY" } });
    fireEvent.change(districtSelect, { target: { value: "Gampaha" } });
    fireEvent.change(sortSelect, { target: { value: "price_desc" } });
    fireEvent.click(screen.getByText("filters.acTypes.ac"));
    fireEvent.click(screen.getByText("filters.amenityOptions.wifi"));
    fireEvent.click(screen.getByText("filters.amenityOptions.usb"));
    fireEvent.click(screen.getByText("filters.amenityOptions.usb"));
    fireEvent.change(screen.getByPlaceholderText("filters.min"), { target: { value: "40" } });
    fireEvent.change(screen.getByPlaceholderText("filters.max"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("dateLabel"), { target: { value: "2026-11-11" } });
    fireEvent.change(screen.getByPlaceholderText("passengersPlaceholder"), { target: { value: "25" } });

    await waitFor(() =>
      expect(lastQuery()).toEqual({
        type: "ORDINARY",
        district: "Gampaha",
        acType: "ac",
        minSeats: 40,
        maxSeats: 60,
        amenities: "wifi",
        startDate: "2026-11-11",
        sortBy: "price",
        sortOrder: "desc",
        page: 1,
        limit: 12,
      }),
    );

    fireEvent.click(screen.getByText("filters.acTypes.ac"));
    for (const [value, expected] of [
      ["price_asc", { sortBy: "price", sortOrder: "asc" }],
      ["rating", { sortBy: "rating", sortOrder: "desc" }],
      ["newest", { sortBy: "newest", sortOrder: "desc" }],
    ] as const) {
      fireEvent.change(sortSelect, { target: { value } });
      await waitFor(() => expect(lastQuery()).toMatchObject(expected));
    }
    expect(lastQuery().acType).toBeUndefined();

    fireEvent.click(screen.getAllByText("filters.clearAll")[0]);
    await waitFor(() => expect(lastQuery()).toEqual({ page: 1, limit: 12 }));
  });

  it("sends coordinates for picked places; one-way adds the destination", async () => {
    render(<SearchPage />);
    await waitFor(() => expect(vehicleService.getAll).toHaveBeenCalled());

    fireEvent.click(screen.getByText("pick-fromPlaceholder"));
    await waitFor(() =>
      expect(lastQuery()).toEqual({
        district: "Kandy",
        location: "Kandy",
        lat: 7.29,
        lng: 80.63,
        page: 1,
        limit: 12,
      }),
    );

    fireEvent.click(screen.getByText("tripType.oneWay"));
    fireEvent.click(screen.getByText("pick-toPlaceholder"));
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({
        location2: "Ella",
        district2: "Badulla",
        lat2: 6.87,
        lng2: 81.05,
      }),
    );

    fireEvent.change(screen.getByPlaceholderText("toPlaceholder"), { target: { value: "Badulla town" } });
    fireEvent.change(screen.getByPlaceholderText("fromPlaceholder"), { target: { value: "Matale" } });
    await waitFor(() =>
      expect(lastQuery()).toEqual({ location: "Matale", location2: "Badulla town", page: 1, limit: 12 }),
    );

    fireEvent.click(screen.getByText("tripType.roundTrip"));
    await waitFor(() => expect(lastQuery()).toEqual({ location: "Matale", page: 1, limit: 12 }));
    expect((screen.getByPlaceholderText("toPlaceholder") as HTMLInputElement).value).toBe("");
  });

  it("renders vehicle cards with images, ratings, amenities and links", async () => {
    vehicleService.getAll.mockResolvedValue(
      result([
        bus("v1", {
          photos: [{ url: "/a.webp" }, { url: "/primary.webp", isPrimary: true }],
          owner: { firstName: "Sunil", lastName: "" },
          averageRating: 4.56,
          reviewCount: 12,
          amenities: ["wifi", "usb", "unknown", "minibar", "tv"],
        }),
        bus("v2", { images: ["/legacy.webp"], averageRating: 3, acType: "SOLAR_AC", type: "MINI" }),
        bus("v3", { acType: null, averageRating: 0 }),
      ]),
    );
    const { container } = render(<SearchPage />);
    expect(await screen.findByText("Bus v1")).toBeTruthy();
    expect(screen.getByAltText("Bus v1").getAttribute("src")).toBe("/primary.webp");
    expect(screen.getByAltText("Bus v2").getAttribute("src")).toBe("/legacy.webp");
    expect(screen.queryByAltText("Bus v3")).toBeNull();
    expect(screen.getByText("Sunil")).toBeTruthy();
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("(12)")).toBeTruthy();
    expect(screen.getByText("3.0")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
    expect(screen.getByText("SOLAR AC")).toBeTruthy();
    expect(screen.getByText("MINI")).toBeTruthy();
    const card = screen.getByText("Bus v1").closest("article")!;
    expect(within(card).getByText("Mini bar")).toBeTruthy();
    expect(container.querySelector('a[href="/en/vehicles/v3"]')).toBeTruthy();
  });

  it("paginates results", async () => {
    vehicleService.getAll.mockResolvedValue(
      result([bus("v1")], { pagination: { page: 1, limit: 12, total: 30, totalPages: 3 } }),
    );
    render(<SearchPage />);
    expect(await screen.findByText("1 / 3")).toBeTruthy();
    expect((screen.getByLabelText("previous") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("next"));
    await waitFor(() => expect(lastQuery().page).toBe(2));
    expect(await screen.findByText("2 / 3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("previous"));
    await waitFor(() => expect(lastQuery().page).toBe(1));
  });

  it("explains nearby matches by radius or district", async () => {
    nav.search = new URLSearchParams("from=Kandy");
    vehicleService.getAll.mockResolvedValueOnce(result([bus("v1")], { matchTier: "20km" }));
    const { container, unmount } = render(<SearchPage />);
    expect(await screen.findByText("nearby.withinRadius|kandy|20")).toBeTruthy();
    unmount();

    for (const [tier, text] of [
      ["10km", "nearby.withinRadius|kandy|10"],
      ["30km", "nearby.withinRadius|kandy|30"],
      ["district", "nearby.sameDistrict|kandy"],
    ]) {
      vehicleService.getAll.mockResolvedValueOnce(result([bus("v1")], { matchTier: tier }));
      const r = render(<SearchPage />);
      expect(await screen.findByText(text)).toBeTruthy();
      r.unmount();
    }

    vehicleService.getAll.mockResolvedValueOnce(result([bus("v1")], { matchTier: "exact" }));
    render(<SearchPage />);
    await screen.findByText("Bus v1");
    expect(container.textContent).not.toContain("nearby.");
  });

  it("shows a nearby-none message or generic hint when nothing matches", async () => {
    nav.search = new URLSearchParams("to=Jaffna&tripType=one_way");
    vehicleService.getAll.mockResolvedValueOnce({ matchTier: "none" });
    const { unmount } = render(<SearchPage />);
    expect(await screen.findByText("nearby.none|jaffna")).toBeTruthy();
    unmount();

    nav.search = new URLSearchParams();
    render(<SearchPage />);
    expect(await screen.findByText("adjustFilters")).toBeTruthy();
    fireEvent.click(screen.getByText("filters.clearAll"));
  });

  it("shows API or generic errors and retries", async () => {
    vehicleService.getAll.mockRejectedValueOnce(new ApiError(503, "Search is down"));
    render(<SearchPage />);
    expect(await screen.findByText("Search is down")).toBeTruthy();
    vehicleService.getAll.mockRejectedValueOnce(new Error("x"));
    fireEvent.click(screen.getByText("retry"));
    expect(await screen.findByText("errors.fetchVehicles")).toBeTruthy();
    fireEvent.click(screen.getByText("retry"));
    expect(await screen.findByText("adjustFilters")).toBeTruthy();
  });

  it("degrades silently when filter options fail and toggles the mobile panel", async () => {
    landingContentService.getPublicConfig.mockRejectedValueOnce(new Error("x"));
    render(<SearchPage />);
    await waitFor(() => expect(vehicleService.getAll).toHaveBeenCalled());
    const toggle = screen.getAllByText("filters.title")[0].closest("button")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByText("filters.amenities")).toBeNull();
  });

  it("re-reads filters when the URL changes", async () => {
    const { rerender } = render(<SearchPage />);
    await waitFor(() => expect(vehicleService.getAll).toHaveBeenCalled());
    nav.search = new URLSearchParams("vehicleType=ORDINARY");
    rerender(<SearchPage />);
    await waitFor(() => expect(lastQuery()).toEqual({ type: "ORDINARY", page: 1, limit: 12 }));
  });

  it("drops a stale response when filters change mid-request", async () => {
    let release: (v: unknown) => void = () => {};
    vehicleService.getAll.mockImplementationOnce(() => new Promise((r) => (release = r)));
    render(<SearchPage />);
    await waitFor(() => expect(vehicleService.getAll).toHaveBeenCalledTimes(1));
    vehicleService.getAll.mockResolvedValueOnce(result([bus("fresh")]));
    fireEvent.change(screen.getByPlaceholderText("filters.min"), { target: { value: "10" } });
    await act(async () => {
      release(result([bus("stale")]));
    });
    expect(await screen.findByText("Bus fresh")).toBeTruthy();
    expect(screen.queryByText("Bus stale")).toBeNull();

    let reject: (e: unknown) => void = () => {};
    vehicleService.getAll.mockImplementationOnce(() => new Promise((_r, j) => (reject = j)));
    fireEvent.change(screen.getByPlaceholderText("filters.min"), { target: { value: "11" } });
    await waitFor(() => expect(vehicleService.getAll).toHaveBeenCalledTimes(3));
    fireEvent.change(screen.getByPlaceholderText("filters.min"), { target: { value: "12" } });
    await act(async () => {
      reject(new Error("late"));
    });
    await waitFor(() => expect(vehicleService.getAll).toHaveBeenCalledTimes(4));
    expect(screen.queryByText("errors.fetchVehicles")).toBeNull();
  });

  it.todo(
    "pre-selects the trip package when opened from a package's 'Book this package' link (?package=<id>)",
  );
});
