/**
 * Public vehicle details: data loading with graceful degradation, gallery and
 * lightbox, specs/amenities/reviews/similar vehicles, pricing, availability
 * and the request-quotation action.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/vehicles/v1",
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

const services = vi.hoisted(() => ({
  vehicleService: { getById: vi.fn(), getAvailability: vi.fn(), getSimilarVehicles: vi.fn() },
  reviewService: { getByVehicle: vi.fn() },
}));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { ...services, ApiError };
});

import VehicleDetailsPageContent from "@/app/[locale]/vehicles/[id]/VehicleDetailsPageContent";
import { ApiError } from "@/lib/api/client";

const { vehicleService, reviewService } = services;

const vehicle = (extra: Record<string, unknown> = {}) => ({
  id: "v1",
  name: "Blue Liner",
  description: "Comfortable coach",
  type: "LUXURY_AC",
  brand: "Ashok",
  model: "Viking",
  year: 2021,
  licensePlate: "NB-1234",
  color: "dark_blue",
  seats: 45,
  fuelType: "DIESEL",
  transmission: "MANUAL",
  acType: "FULL_AC",
  condition: "EXCELLENT",
  amenities: ["wifi", "water", "jacuzzi"],
  images: ["/legacy.webp"],
  photos: [
    { url: "/front.webp", isPrimary: true, tag: "EXTERIOR" },
    { url: "/legacy.webp" },
  ],
  pricePerDay: 30000,
  pricePerKm: 120,
  pricePerHour: 2000,
  driverAllowance: 2500,
  location: "Kandy",
  isAvailable: true,
  isActive: true,
  owner: {
    id: "o1",
    firstName: "Sunil",
    lastName: "Perera",
    isVerified: true,
    businessName: "Sunil Travels",
    baseLocation: "Galle",
  },
  ...extra,
});

const reviews = {
  reviews: Array.from({ length: 6 }, (_, i) => ({
    id: `r${i}`,
    rating: 5,
    title: i === 0 ? "Great trip" : null,
    comment: i === 0 ? "Driver was kind" : null,
    isRecommended: i === 0,
    customerName: i === 1 ? "" : `Customer ${i}`,
    customerAvatar: null,
    ownerResponse: i === 0 ? "Thank you!" : null,
    createdAt: i === 2 ? "not-a-date" : "2026-06-03T00:00:00Z",
  })),
  stats: { averageRating: 4.5, totalReviews: 8, ratingDistribution: { 5: 6, 4: 2 } },
};

const availability = {
  month: "2026-06",
  booked: [{ id: "b1", startDate: "2026-06-20", endDate: "2026-06-21", status: "CONFIRMED" }],
  blocked: [
    { id: "x1", startDate: "2026-06-05", endDate: "2026-06-06", reason: "Service" },
    { id: "x2", startDate: "2026-06-25", endDate: "2026-06-26", reason: null },
  ],
};

const renderPage = async (props: Partial<{ isDashboard: boolean }> = {}) => {
  const utils = render(<VehicleDetailsPageContent locale="en" vehicleId="v1" {...props} />);
  await screen.findAllByText("Blue Liner");
  return utils;
};

beforeEach(() => {
  vi.clearAllMocks();
  vehicleService.getById.mockResolvedValue(vehicle());
  reviewService.getByVehicle.mockResolvedValue(reviews);
  vehicleService.getAvailability.mockResolvedValue(availability);
  vehicleService.getSimilarVehicles.mockResolvedValue({
    vehicles: [
      { id: "s1", name: "Similar One", location: "Colombo", seats: 30, pricePerDay: 20000, photos: [{ url: "/s1.webp" }] },
      { id: "s2", name: "Similar Two", location: "Ella", seats: 25, pricePerDay: 18000 },
    ],
  });
});

describe("vehicle details", () => {
  it("loads the vehicle, reviews, availability and similar vehicles", async () => {
    const { container } = await renderPage();
    expect(vehicleService.getById).toHaveBeenCalledWith("v1");
    expect(reviewService.getByVehicle).toHaveBeenCalledWith("v1");
    expect(vehicleService.getSimilarVehicles).toHaveBeenCalledWith("v1", 4);

    expect(screen.getByText("Ashok Viking · 2021")).toBeTruthy();
    expect(screen.getByText("status.available")).toBeTruthy();
    expect(screen.getByText("status.verified")).toBeTruthy();
    expect(screen.getAllByText("valueLabels.acType.fullAc").length).toBe(2);
    expect(screen.getByText("valueLabels.vehicleType.luxuryAc")).toBeTruthy();
    expect(screen.getByText("valueLabels.condition.excellent")).toBeTruthy();
    expect(screen.getByText("Dark Blue")).toBeTruthy();
    expect(screen.getByText("Comfortable coach")).toBeTruthy();
    expect(screen.getByText("amenityLabels.wifi")).toBeTruthy();
    expect(screen.getByText("amenityLabels.water")).toBeTruthy();
    expect(screen.queryByText("jacuzzi")).toBeNull();

    expect(screen.getAllByText("4.5").length).toBeGreaterThan(0);
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("Great trip")).toBeTruthy();
    expect(screen.getByText("Thank you!")).toBeTruthy();
    expect(screen.getByText("Recommends this vehicle")).toBeTruthy();
    expect(screen.getByText("reviews.anonymous")).toBeTruthy();
    expect(screen.getByText("specs.notAvailable")).toBeTruthy();
    expect(screen.queryByText("Customer 5")).toBeNull();
    expect(screen.getByText("actions.viewAllReviews")).toBeTruthy();

    expect(screen.getByText("Sunil Travels")).toBeTruthy();
    expect(screen.getByText("owner.businessName")).toBeTruthy();
    expect(screen.getByText("galle")).toBeTruthy();

    const periods = screen.getAllByText(/availability\.status\./).map((n) => n.textContent);
    expect(periods).toEqual([
      "availability.status.blockedWithReason|Service",
      "availability.status.booked",
      "availability.status.blocked",
    ]);

    expect(container.querySelector('a[href="/en/vehicles/s1"]')).toBeTruthy();
    expect(screen.getByAltText("Similar One").getAttribute("src")).toBe("/s1.webp");
    expect(screen.queryByAltText("Similar Two")).toBeNull();
    expect(container.querySelector('a[href="/en/search"]')).toBeTruthy();
  });

  it("navigates the gallery and lightbox with clicks", async () => {
    await renderPage();
    expect(screen.getByAltText("Blue Liner — photo 1").getAttribute("src")).toBe("/front.webp");
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getByLabelText("View photo 1 of 2 — exterior")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("View photo 2 of 2"));
    expect(screen.getByAltText("Blue Liner — photo 2").getAttribute("src")).toBe("/legacy.webp");

    fireEvent.click(screen.getByAltText("Blue Liner — photo 2").parentElement!);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Next photo"));
    expect(screen.getByAltText("Blue Liner — photo 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Previous photo"));
    expect(screen.getByAltText("Blue Liner — photo 2 of 2")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Go to photo 1"));
    expect(screen.getByAltText("Blue Liner — photo 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByAltText("Blue Liner — photo 1 of 2").parentElement!);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close gallery"));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByAltText("Blue Liner — photo 1").parentElement!);
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports keyboard navigation in the lightbox", async () => {
    vehicleService.getById.mockResolvedValue(
      vehicle({ photos: undefined, images: ["/a.webp", "/b.webp", "/c.webp"] }),
    );
    await renderPage();
    fireEvent.click(screen.getByAltText("Blue Liner — photo 1").parentElement!);
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByAltText("Blue Liner — photo 3 of 3")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByAltText("Blue Liner — photo 1 of 3")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.todo(
    "lightbox arrow keys cycle through photo-only galleries (VehicleDetailsPageContent.tsx:307-311 uses vehicle.images.length, which is 0 when only photos exist, so the index becomes NaN)",
  );

  it("requests a quotation for an available vehicle", async () => {
    await renderPage();
    fireEvent.click(screen.getAllByText("actions.requestQuotation")[0]);
    expect(router.push).toHaveBeenCalledWith("/en/dashboard/quotations/new?vehicleId=v1");
  });

  it("disables booking and falls back for sparse vehicles", async () => {
    vehicleService.getById.mockResolvedValue({
      data: {
        vehicle: vehicle({
          description: "",
          year: 0,
          color: undefined,
          fuelType: undefined,
          transmission: undefined,
          acType: "",
          condition: undefined,
          type: "DOUBLE_DECKER",
          amenities: [],
          images: [],
          photos: [],
          pricePerKm: undefined,
          pricePerHour: undefined,
          driverAllowance: undefined,
          isAvailable: false,
          owner: { id: "o", firstName: "Kamal", lastName: "Silva", isVerified: false },
        }),
      },
    });
    reviewService.getByVehicle.mockResolvedValue({ reviews: undefined });
    vehicleService.getAvailability.mockResolvedValue({ month: "x", booked: [], blocked: [] });
    vehicleService.getSimilarVehicles.mockResolvedValue({});
    await renderPage({ isDashboard: true });

    expect(screen.getByText("empty.noImages")).toBeTruthy();
    expect(screen.getByText("Double Decker")).toBeTruthy();
    expect(screen.getAllByText("specs.notAvailable").length).toBe(1);
    expect(screen.getByText("valueLabels.condition.good")).toBeTruthy();
    expect(screen.getByText("empty.noReviews")).toBeTruthy();
    expect(screen.getByText("Kamal Silva")).toBeTruthy();
    expect(screen.getByText("owner.label")).toBeTruthy();
    expect(screen.getAllByText("kandy", { selector: "p" }).length).toBe(2);
    expect(screen.getByText("availability.noBlockedDates")).toBeTruthy();
    expect(screen.getByText("status.unavailable")).toBeTruthy();
    expect(screen.queryByText("status.verified")).toBeNull();
    expect(screen.queryByText("pricing.pricePerKm")).toBeNull();
    const buttons = screen.getAllByText("actions.requestQuotation").map((n) => n.closest("button")!);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(screen.queryByText("sections.similarVehicles")).toBeNull();
  });

  it("degrades gracefully when secondary data fails", async () => {
    vehicleService.getById.mockResolvedValue({
      vehicle: vehicle({
        acType: "solar_ac",
        condition: "WORN",
        owner: {
          id: "o",
          firstName: "A",
          lastName: "B",
          isVerified: true,
          businessProfile: { businessName: "Profile Biz" },
        },
      }),
    });
    reviewService.getByVehicle.mockRejectedValue(new Error("x"));
    vehicleService.getAvailability.mockRejectedValue(new Error("x"));
    vehicleService.getSimilarVehicles.mockRejectedValue(new Error("x"));
    await renderPage();
    expect(screen.getByText("availability.note")).toBeTruthy();
    expect(screen.getByText("empty.noReviews")).toBeTruthy();
    expect(screen.getByText("Profile Biz")).toBeTruthy();
    expect(screen.getAllByText("Solar Ac").length).toBe(2);
    expect(screen.getByText("Worn")).toBeTruthy();
  });

  it("covers the remaining localized enum labels", async () => {
    vehicleService.getById.mockResolvedValue(
      vehicle({ type: "semi-luxury", acType: "non-ac", condition: "fair" }),
    );
    const first = await renderPage();
    expect(screen.getByText("valueLabels.vehicleType.semiLuxury")).toBeTruthy();
    expect(screen.getAllByText("valueLabels.acType.nonAc").length).toBe(2);
    expect(screen.getByText("valueLabels.condition.fair")).toBeTruthy();
    first.unmount();

    vehicleService.getById.mockResolvedValue(vehicle({ type: "ORDINARY", acType: "AC", condition: "GOOD" }));
    await renderPage();
    expect(screen.getByText("valueLabels.vehicleType.ordinary")).toBeTruthy();
    expect(screen.getAllByText("valueLabels.acType.ac").length).toBe(2);
    expect(screen.getByText("valueLabels.condition.good")).toBeTruthy();
  });

  it("shows an error with a back button when the vehicle cannot be loaded", async () => {
    vehicleService.getById.mockRejectedValueOnce(new ApiError(404, "Vehicle not found"));
    const { unmount } = render(<VehicleDetailsPageContent locale="en" vehicleId="v1" />);
    expect(await screen.findByText("Vehicle not found")).toBeTruthy();
    fireEvent.click(screen.getByText("actions.goBack"));
    expect(router.back).toHaveBeenCalled();
    unmount();

    vehicleService.getById.mockResolvedValueOnce({});
    const second = render(<VehicleDetailsPageContent locale="en" vehicleId="v1" />);
    expect(await screen.findByText("errors.fetchVehicle")).toBeTruthy();
    second.unmount();
  });

  it("shows a loading skeleton first", async () => {
    let release: (v: unknown) => void = () => {};
    vehicleService.getById.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const { container } = render(<VehicleDetailsPageContent locale="en" vehicleId="v1" />);
    expect(container.querySelector("h1")).toBeNull();
    release(vehicle());
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    await waitFor(() => expect(vehicleService.getSimilarVehicles).toHaveBeenCalled());
  });
});
