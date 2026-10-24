/**
 * Data-driven marketing pages: contact form and config, about statistics,
 * trip package listing with filters, and package detail.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ params: { locale: "en", id: "pkg1" } as Record<string, string> }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => nav.params,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/landing/ImageWithFallback", () => ({
  ImageWithFallback: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const services = vi.hoisted(() => ({
  landingContentService: {
    getPublicConfig: vi.fn(),
    submitContactForm: vi.fn(),
    getAboutStats: vi.fn(),
  },
  tripPackageService: { getAll: vi.fn(), getById: vi.fn() },
}));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { ...services, ApiError };
});

import ContactPage from "@/app/[locale]/contact/page";
import AboutPage from "@/app/[locale]/about/page";
import PackagesPage from "@/app/[locale]/packages/page";
import PackageDetailPage from "@/app/[locale]/packages/[id]/page";
import { ApiError } from "@/lib/api/client";

const { landingContentService, tripPackageService } = services;

beforeEach(() => {
  vi.clearAllMocks();
  nav.params = { locale: "en", id: "pkg1" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("contact page", () => {
  const fillForm = () => {
    const set = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    set("form.name", "Nimal");
    set("form.email", "nimal@x.lk");
    set("form.subject", "Group trip");
    fireEvent.change(screen.getByLabelText("form.message"), {
      target: { value: "Need a bus for 40 people" },
    });
  };
  const submit = async () => {
    await act(async () => {
      fireEvent.submit(screen.getByLabelText("form.name").closest("form")!);
    });
  };

  it("uses translated fallbacks when config is unavailable", async () => {
    landingContentService.getPublicConfig.mockRejectedValueOnce(new ApiError(500, "down"));
    render(<ContactPage />);
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith("Failed to fetch contact config:", "down"),
    );
    expect(screen.getByText("info.email.value")).toBeTruthy();
    expect(screen.getByText("mapPlaceholder")).toBeTruthy();
    expect(screen.getByText("items.verification.answer")).toBeTruthy();

    fireEvent.click(screen.getByText("items.payment.question"));
    expect(screen.queryByText("items.verification.answer")).toBeNull();
    expect(screen.getByText("items.payment.answer")).toBeTruthy();
    fireEvent.click(screen.getByText("items.payment.question"));
    expect(screen.queryByText("items.payment.answer")).toBeNull();
  });

  it("logs non-API config errors", async () => {
    landingContentService.getPublicConfig.mockRejectedValueOnce("odd");
    render(<ContactPage />);
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith("Failed to fetch contact config:", "odd"),
    );
  });

  it("renders configured contact details, social links, map and FAQs", async () => {
    landingContentService.getPublicConfig.mockResolvedValue({
      contactInfo: { address: "1 Galle Rd", email: "hi@travenest.lk", phone: "+94111", hours: "9-5" },
      googleMapsEmbed: { embedUrl: "https://maps.example/embed" },
      socialMediaLinks: { facebook: "https://fb.example", linkedin: "https://li.example" },
      faqs: [{ id: "f1", question: "Custom Q", answer: "Custom A" }],
    });
    const { container } = render(<ContactPage />);
    expect(await screen.findByText("hi@travenest.lk")).toBeTruthy();
    expect(container.querySelector('a[href="mailto:hi@travenest.lk"]')).toBeTruthy();
    expect(container.querySelector('a[href="tel:+94111"]')).toBeTruthy();
    expect(screen.getByText("Facebook").closest("a")?.getAttribute("href")).toBe("https://fb.example");
    expect(screen.queryByText("Twitter")).toBeNull();
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("https://maps.example/embed");
    expect(screen.getByText("Custom A")).toBeTruthy();
  });

  it("submits the form, omitting an empty phone, then clears it", async () => {
    landingContentService.getPublicConfig.mockResolvedValue({});
    landingContentService.submitContactForm.mockResolvedValue({});
    render(<ContactPage />);
    fillForm();
    await submit();
    expect(landingContentService.submitContactForm).toHaveBeenCalledWith({
      name: "Nimal",
      email: "nimal@x.lk",
      phone: undefined,
      subject: "Group trip",
      message: "Need a bus for 40 people",
    });
    expect(screen.getByText("form.success")).toBeTruthy();
    expect((screen.getByLabelText("form.name") as HTMLInputElement).value).toBe("");
  });

  it("shows an error banner when submission fails", async () => {
    landingContentService.getPublicConfig.mockResolvedValue({});
    render(<ContactPage />);
    fillForm();
    fireEvent.change(screen.getByLabelText("form.phone"), { target: { value: "0771234567" } });
    landingContentService.submitContactForm.mockRejectedValueOnce(new ApiError(429, "slow"));
    await submit();
    expect(screen.getByText("form.error")).toBeTruthy();
    expect(landingContentService.submitContactForm.mock.calls[0][0].phone).toBe("0771234567");
    landingContentService.submitContactForm.mockRejectedValueOnce(new Error("x"));
    await submit();
    expect(console.error).toHaveBeenLastCalledWith("Contact submit failed:", expect.any(Error));
  });
});

describe("about page", () => {
  it("shows API statistics with localized labels and icons", async () => {
    landingContentService.getAboutStats.mockResolvedValue({
      stats: [
        { label: "Verified Buses", value: "120", icon: "bus" },
        { label: "Custom Stat", value: "7" },
      ],
    });
    render(<AboutPage />);
    expect(await screen.findByText("120")).toBeTruthy();
    expect(screen.getByText("statistics.items.verifiedBuses")).toBeTruthy();
    expect(screen.getByText("Custom Stat")).toBeTruthy();
    expect(landingContentService.getPublicConfig).not.toHaveBeenCalled();
  });

  it("falls back to config statistics and then to an empty state", async () => {
    landingContentService.getAboutStats.mockResolvedValueOnce({ stats: [] });
    landingContentService.getPublicConfig.mockResolvedValueOnce({
      aboutStats: [{ label: "Happy Customers", value: "5k", icon: "USERS" }],
    });
    const { unmount } = render(<AboutPage />);
    expect(await screen.findByText("5k")).toBeTruthy();
    unmount();

    landingContentService.getAboutStats.mockResolvedValueOnce({});
    landingContentService.getPublicConfig.mockResolvedValueOnce({});
    const second = render(<AboutPage />);
    expect(await screen.findByText("statistics.empty")).toBeTruthy();
    second.unmount();

    landingContentService.getAboutStats.mockRejectedValueOnce(new ApiError(500, "down"));
    const third = render(<AboutPage />);
    expect(await screen.findByText("statistics.empty")).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith("Failed to fetch about stats:", "down");
    third.unmount();

    landingContentService.getAboutStats.mockRejectedValueOnce("odd");
    render(<AboutPage />);
    await waitFor(() =>
      expect(console.error).toHaveBeenLastCalledWith("Failed to fetch about stats:", "odd"),
    );
  });
});

describe("packages page", () => {
  const pkg = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: `Package ${id}`,
    startLocation: "Colombo",
    endLocation: "Somewhere",
    durationDays: 2,
    minPassengers: 10,
    maxPassengers: 40,
    price: 45000,
    ...extra,
  });

  it("lists active packages with localized places and detail links", async () => {
    landingContentService.getPublicConfig.mockResolvedValue({
      options: { quotationVehicleTypes: [{ value: "LUXURY_AC", label: "Luxury AC" }] },
    });
    tripPackageService.getAll.mockResolvedValue({
      packages: [
        pkg("p1", { vehicle: { name: "Blue Bus", images: ["/bus.webp"] } }),
        pkg("p2"),
      ],
    });
    const { container } = render(<PackagesPage />);
    expect(await screen.findByText("Package p1")).toBeTruthy();
    expect(tripPackageService.getAll).toHaveBeenCalledWith({
      isActive: true,
      limit: 24,
      sortBy: "newest",
      sortOrder: "desc",
    });
    expect(screen.getAllByText("colombo → Somewhere").length).toBe(2);
    expect(screen.getByText("Blue Bus")).toBeTruthy();
    expect(screen.getByText("vehicleFallback")).toBeTruthy();
    expect(screen.getByAltText("Package p1").getAttribute("src")).toBe("/bus.webp");
    expect(container.querySelector('a[href="/en/packages/p2"]')).toBeTruthy();
    expect(screen.getAllByText("Luxury AC").length).toBeGreaterThan(0);
  });

  it("sends every filter to the API and clears them", async () => {
    landingContentService.getPublicConfig.mockResolvedValue({
      options: { vehicleTypes: [{ value: "ORDINARY", label: "Ordinary" }] },
    });
    tripPackageService.getAll.mockResolvedValue({ packages: [] });
    const { container } = render(<PackagesPage />);
    expect(await screen.findByText("empty")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: " kandy " } });
    fireEvent.change(screen.getByLabelText("filters.startLocation"), { target: { value: " Colombo " } });
    fireEvent.change(screen.getByLabelText("filters.endLocation"), { target: { value: "Ella" } });
    fireEvent.change(screen.getByLabelText("filters.durationDays"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("filters.minPrice"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("filters.maxPrice"), { target: { value: "90000" } });
    fireEvent.change(container.querySelector("select")!, { target: { value: "ORDINARY" } });

    await waitFor(() =>
      expect(tripPackageService.getAll).toHaveBeenLastCalledWith({
        isActive: true,
        limit: 24,
        sortBy: "newest",
        sortOrder: "desc",
        search: "kandy",
        startLocation: "Colombo",
        endLocation: "Ella",
        durationDays: 3,
        minPrice: 1000,
        maxPrice: 90000,
        vehicleType: "ORDINARY",
      }),
    );

    const clears = screen.getAllByText("filters.clear");
    fireEvent.click(clears[clears.length - 1]);
    await waitFor(() =>
      expect(tripPackageService.getAll.mock.calls.at(-1)?.[0]).toEqual({
        isActive: true,
        limit: 24,
        sortBy: "newest",
        sortOrder: "desc",
      }),
    );
    expect((screen.getByLabelText("filters.endLocation") as HTMLInputElement).value).toBe("");
  });

  it("shows API and generic load errors and tolerates missing options", async () => {
    landingContentService.getPublicConfig.mockResolvedValueOnce({});
    tripPackageService.getAll.mockRejectedValueOnce(new ApiError(500, "Packages unavailable"));
    const { unmount } = render(<PackagesPage />);
    expect(await screen.findByText("Packages unavailable")).toBeTruthy();
    unmount();

    landingContentService.getPublicConfig.mockRejectedValueOnce(new Error("x"));
    tripPackageService.getAll.mockRejectedValueOnce(new Error("x"));
    render(<PackagesPage />);
    expect(await screen.findByText("errors.fetchPackages")).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(
      "Failed to fetch package filter options:",
      expect.any(Error),
    );
  });

  it("treats a missing package list as empty", async () => {
    landingContentService.getPublicConfig.mockResolvedValue({});
    tripPackageService.getAll.mockResolvedValue({});
    render(<PackagesPage />);
    expect(await screen.findByText("emptyHint")).toBeTruthy();
  });
});

describe("package detail page", () => {
  const detail = {
    id: "pkg1",
    title: "Hill Country Tour",
    description: "Tea estates",
    startLocation: "Kandy",
    endLocation: "Nuwara Eliya",
    durationDays: 3,
    minPassengers: 10,
    maxPassengers: 30,
    price: 120000,
    owner: { firstName: "Sunil", lastName: "Perera", isVerified: true },
    vehicle: { images: ["/hero.webp"] },
  };

  it("renders the package with localized route, owner and booking link", async () => {
    tripPackageService.getById.mockResolvedValue({ tripPackage: detail });
    const { container } = render(<PackageDetailPage />);
    expect(await screen.findByText("Hill Country Tour")).toBeTruthy();
    expect(tripPackageService.getById).toHaveBeenCalledWith("pkg1");
    expect(screen.getAllByText("kandy → nuwaraEliya").length).toBe(2);
    expect(screen.getByText("Tea estates")).toBeTruthy();
    expect(screen.getByText("detail.verifiedOwner")).toBeTruthy();
    expect(screen.getByAltText("Hill Country Tour").getAttribute("src")).toBe("/hero.webp");
    expect(container.querySelector('a[href="/en/dashboard/packages?book=pkg1"]')).toBeTruthy();
    expect(container.querySelector("a button")).toBeNull();
  });

  it("uses fallbacks for missing description, image and unverified owner", async () => {
    tripPackageService.getById.mockResolvedValue({
      tripPackage: { ...detail, description: "", vehicle: null, owner: { isVerified: false } },
    });
    render(<PackageDetailPage />);
    expect(await screen.findByText("detail.overviewFallback")).toBeTruthy();
    expect(screen.getByText("detail.owner")).toBeTruthy();
    expect(screen.queryByAltText("Hill Country Tour")).toBeNull();
  });

  it("shows not-found states for errors and empty responses", async () => {
    tripPackageService.getById.mockRejectedValueOnce(new Error("404"));
    const { container, unmount } = render(<PackageDetailPage />);
    expect(await screen.findByText("errors.fetchPackages")).toBeTruthy();
    expect(container.querySelector('a[href="/en/search"]')).toBeTruthy();
    unmount();

    tripPackageService.getById.mockResolvedValueOnce({ tripPackage: null });
    render(<PackageDetailPage />);
    expect(await screen.findByText("detail.notFoundMessage")).toBeTruthy();
  });
});
