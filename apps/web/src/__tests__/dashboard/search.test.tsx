/**
 * Dashboard vehicle search: loading/error/empty states, client-side filters,
 * sorting and the progressive nearby-city tiers (exact → radius → district).
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  nextLocation: {} as Record<string, any>,
}));

vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/dashboard/search",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("next/image", () => ({ default: ({ src, alt }: any) => <img src={src} alt={alt} /> }));
vi.mock("@/components/ui", async (importOriginal: any) => ({
  ...(await importOriginal()),
  LocationAutocomplete: ({ placeholder, value, onChange, onSelectLocation, disabled }: any) => (
    <div>
      <input aria-label={placeholder} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => onSelectLocation(h.nextLocation[placeholder])}>{`pick:${placeholder}`}</button>
    </div>
  ),
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  vehicleService: { getAll: vi.fn() },
  landingContentService: { getPublicConfig: vi.fn() },
}));

import { SearchPageContent } from "@/app/[locale]/dashboard/search/search-page-content";
import { ApiError, landingContentService, vehicleService } from "@/lib/api";

const getAll = vehicleService.getAll as any;
const getConfig = landingContentService.getPublicConfig as any;

const vehicle = (over: Record<string, any>) => ({
  isActive: true,
  type: "ORDINARY",
  seats: 40,
  acType: "NON_AC",
  pricePerDay: 20000,
  createdAt: "2026-01-01",
  amenities: [],
  images: [],
  owner: { firstName: "Sunil", lastName: "Perera", district: "Colombo" },
  ...over,
});

const fleet = [
  vehicle({ id: "kandy", name: "Hill Coach", location: "Kandy", latitude: 7.2906, longitude: 80.6337, type: "LUXURY_AC", seats: 50, acType: "full-ac", pricePerDay: 50000, averageRating: 4.8, createdAt: "2026-03-01", amenities: ["WiFi", "tv", "usb", "gps", "music"], images: ["https://img/k.webp"], owner: { firstName: "Kamal", district: "Kandy" } }),
  vehicle({ id: "dehiwala", name: "Coastal Bus", location: "Dehiwala", latitude: 6.8511, longitude: 79.8659, seats: 30, pricePerDay: 15000, averageRating: 3.2, createdAt: "2026-02-01", amenities: ["wifi"] }),
  vehicle({ id: "negombo", name: "Lagoon Rider", location: "Negombo", latitude: 7.2083, longitude: 79.8358, type: "SEMI_LUXURY", seats: 20, acType: "AC", pricePerDay: 30000, owner: null }),
  vehicle({ id: "nocoords", name: "Mystery Van", location: "Ratnapura", latitude: null, longitude: null, seats: 12, pricePerDay: 8000, owner: { district: "Ratnapura" } }),
  vehicle({ id: "inactive", name: "Retired", location: "Kandy", isActive: false }),
];

const config = {
  options: {
    vehicleTypes: [
      { value: "ORDINARY", label: "Ord" },
      { value: "SEMI_LUXURY", label: "Semi" },
      { value: "LUXURY_AC", label: "Lux" },
      { value: "MINI", label: "Mini bus" },
    ],
    acTypes: [
      { value: "FULL_AC", label: "Full" },
      { value: "AC", label: "AC" },
      { value: "NON_AC", label: "Non" },
      { value: "DUAL", label: "Dual zone" },
    ],
    amenities: ["wifi", "ac", "music", "usb", "tv", "reclining", "reading", "gps", "fridge"].map((id) => ({ id, label: `L-${id}` })),
    districts: ["Colombo", "Kandy"],
  },
};

const names = () => Array.from(document.querySelectorAll("h3")).map((e) => e.textContent);

const renderSearch = async () => {
  render(<SearchPageContent locale="en" />);
  await waitFor(() => expect(screen.queryByText("results")).toBeTruthy());
  await waitFor(() => expect(names().length).toBeGreaterThan(0));
};

const btn = (text: string) => screen.getAllByText(text).find((e) => e.tagName === "BUTTON")!;
const openFilters = () => fireEvent.click(screen.getByText("filters.title"));
const selectByLabel = (label: string, value: string) => {
  const select = screen.getByText(label).parentElement!.querySelector("select")!;
  fireEvent.change(select, { target: { value } });
};
const pick = (placeholder: string, loc: Record<string, any>) => {
  h.nextLocation[placeholder] = loc;
  fireEvent.click(screen.getByText(`pick:${placeholder}`));
};

beforeEach(() => {
  vi.clearAllMocks();
  getAll.mockResolvedValue({ vehicles: fleet });
  getConfig.mockResolvedValue(config);
});

describe("SearchPageContent", () => {
  it("lists active vehicles with owner, seats, AC, rating, amenities and price", async () => {
    await renderSearch();
    expect(getAll).toHaveBeenCalledWith({ limit: 48 });
    expect(names()).toEqual(["Hill Coach", "Coastal Bus", "Lagoon Rider", "Mystery Van"]);
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("Kamal")).toBeTruthy();
    expect(screen.getAllByText("owner").length).toBe(2);
    expect(screen.getByText("4.8")).toBeTruthy();
    expect(screen.getByAltText("Hill Coach").getAttribute("src")).toBe("https://img/k.webp");
    await waitFor(() => expect(screen.getAllByText("filters.amenityOptions.wifi").length).toBe(2));
    expect(screen.getAllByText("filters.acTypes.fullAc").length).toBeGreaterThan(0);
    expect(screen.queryByText("music")).toBeNull();
    expect(screen.getAllByText("viewDetails")[0].closest("a")!.getAttribute("href")).toBe("/en/dashboard/vehicles/kandy");
  });

  it("filters by free-text query, type, capacity, AC type, district, passengers and amenities", async () => {
    await renderSearch();
    fireEvent.change(screen.getByPlaceholderText("search"), { target: { value: "perera" } });
    expect(names()).toEqual(["Coastal Bus"]);
    fireEvent.change(screen.getByPlaceholderText("search"), { target: { value: "" } });
    openFilters();
    await waitFor(() => expect(screen.getByText("Dual zone")).toBeTruthy());
    expect(screen.getByText("Mini bus")).toBeTruthy();
    selectByLabel("filters.vehicleType", "SEMI_LUXURY");
    expect(names()).toEqual(["Lagoon Rider"]);
    selectByLabel("filters.vehicleType", "");
    fireEvent.change(screen.getByPlaceholderText("filters.min"), { target: { value: "25" } });
    fireEvent.change(screen.getByPlaceholderText("filters.max"), { target: { value: "45" } });
    expect(names()).toEqual(["Coastal Bus"]);
    fireEvent.change(screen.getByPlaceholderText("filters.min"), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("filters.max"), { target: { value: "" } });
    fireEvent.click(btn("filters.acTypes.ac"));
    expect(names()).toEqual(["Lagoon Rider"]);
    fireEvent.click(btn("filters.acTypes.ac"));
    selectByLabel("filters.district", "Kandy");
    expect(names()).toEqual(["Hill Coach"]);
    selectByLabel("filters.district", "");
    fireEvent.change(screen.getByLabelText("passengers"), { target: { value: "35" } });
    expect(names()).toEqual(["Hill Coach"]);
    fireEvent.change(screen.getByLabelText("passengers"), { target: { value: "-1" } });
    expect(names().length).toBe(4);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-12-01" } });
    fireEvent.click(btn("filters.amenityOptions.tv"));
    expect(names()).toEqual(["Hill Coach"]);
    fireEvent.click(btn("filters.amenityOptions.tv"));
    fireEvent.click(btn("filters.amenityOptions.reading"));
    expect(names()).toEqual(["noResults"]);
    expect(screen.getByText("adjustFilters")).toBeTruthy();
    fireEvent.click(screen.getAllByText("filters.clearAll")[1]);
    expect(names().length).toBe(4);
  });

  it("sorts by price, rating and newest", async () => {
    await renderSearch();
    // Filters are closed, so the sort dropdown is the only native select.
    const sort = document.querySelector("select")!;
    fireEvent.change(sort, { target: { value: "price_asc" } });
    expect(names()).toEqual(["Mystery Van", "Coastal Bus", "Lagoon Rider", "Hill Coach"]);
    fireEvent.change(sort, { target: { value: "price_desc" } });
    expect(names()).toEqual(["Hill Coach", "Lagoon Rider", "Coastal Bus", "Mystery Van"]);
    fireEvent.change(sort, { target: { value: "rating" } });
    expect(names().slice(0, 2)).toEqual(["Hill Coach", "Coastal Bus"]);
    fireEvent.change(sort, { target: { value: "newest" } });
    expect(names()[0]).toBe("Hill Coach");
  });

  it("prefers exact city matches for a picked origin", async () => {
    await renderSearch();
    openFilters();
    pick("from", { displayName: "Kandy, Central", city: "", lat: 7.29, lng: 80.63, district: "Kandy" });
    expect(names()).toEqual(["Hill Coach"]);
    expect(screen.queryByText(/nearby\./)).toBeNull();
  });

  it("widens to the nearest radius ring around the picked place", async () => {
    await renderSearch();
    openFilters();
    pick("from", { displayName: "Colombo", city: "Colombo", lat: 6.9271, lng: 79.8612, district: "Colombo" });
    expect(names()).toEqual(["Coastal Bus"]);
    expect(screen.getByText('nearby.withinRadius:{"place":"colombo","km":10}')).toBeTruthy();
  });

  it("reports the 20 km and 30 km rings", async () => {
    await renderSearch();
    openFilters();
    pick("from", { city: "Ja-Ela", lat: 7.0, lng: 79.85, district: "Gampaha" });
    expect(screen.getByText('nearby.withinRadius:{"place":"Ja-Ela","km":20}')).toBeTruthy();
    pick("from", { city: "Kochchikade", lat: 7.4583, lng: 79.835, district: "Gampaha" });
    expect(names()).toEqual(["Lagoon Rider"]);
    expect(screen.getByText('nearby.withinRadius:{"place":"Kochchikade","km":30}')).toBeTruthy();
  });

  it("falls back to the same district, then to none", async () => {
    await renderSearch();
    openFilters();
    pick("from", { city: "Embilipitiya", lat: 6.3, lng: 80.85, district: "Ratnapura" });
    expect(names()).toEqual(["Mystery Van"]);
    expect(screen.getByText('nearby.sameDistrict:{"place":"Embilipitiya"}')).toBeTruthy();
    pick("from", { city: "Jaffna", lat: 9.66, lng: 80.02, district: "Jaffna" });
    expect(screen.getByText('nearby.none:{"place":"jaffna"}')).toBeTruthy();
    pick("from", { city: "Nowhere", lat: 9.66, lng: 80.02, district: "" });
    expect(screen.getByText('nearby.none:{"place":"Nowhere"}')).toBeTruthy();
  });

  it("one-way searches consider the destination too; round trip clears it", async () => {
    await renderSearch();
    openFilters();
    expect((screen.getByLabelText("to") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("tripType.oneWay"));
    pick("to", { displayName: "Negombo, Western", lat: 7.2083, lng: 79.8358, district: "Gampaha" });
    expect(names()).toEqual(["Lagoon Rider"]);
    fireEvent.click(screen.getByText("tripType.roundTrip"));
    expect((screen.getByLabelText("to") as HTMLInputElement).value).toBe("");
    expect(names().length).toBe(4);
  });

  it("uses free-text location matching when nothing is picked", async () => {
    await renderSearch();
    openFilters();
    fireEvent.change(screen.getByLabelText("from"), { target: { value: "dehi" } });
    expect(names()).toEqual(["Coastal Bus"]);
    fireEvent.click(screen.getByText("tripType.oneWay"));
    fireEvent.change(screen.getByLabelText("to"), { target: { value: "negombo" } });
    expect(names()).toEqual(["Coastal Bus", "Lagoon Rider"]);
    fireEvent.change(screen.getByLabelText("from"), { target: { value: "" } });
    expect(names()).toEqual(["Lagoon Rider"]);
    expect(screen.queryByText(/nearby\./)).toBeNull();
  });

  it("shows the API error and retries", async () => {
    getAll.mockRejectedValueOnce(new ApiError(500, "Server down"));
    render(<SearchPageContent locale="en" />);
    expect(await screen.findByText("Server down")).toBeTruthy();
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(names().length).toBe(4));
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  it("shows a generic error for unexpected failures and handles empty payloads", async () => {
    getAll.mockRejectedValueOnce(new Error("x"));
    getConfig.mockRejectedValueOnce(new Error("config down"));
    render(<SearchPageContent locale="en" />);
    expect(await screen.findByText("errors.fetchVehicles")).toBeTruthy();
    getAll.mockResolvedValueOnce({ data: {} });
    fireEvent.click(screen.getByText("retry"));
    expect(await screen.findByText("noResults")).toBeTruthy();
  });

  it("reads vehicles from a wrapped data envelope", async () => {
    getAll.mockResolvedValue({ data: { vehicles: [fleet[1]] } });
    await renderSearch();
    expect(names()).toEqual(["Coastal Bus"]);
  });
});
