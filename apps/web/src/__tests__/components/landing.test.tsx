/**
 * Component tests for the public landing sections: ImageWithFallback,
 * SearchSection, TrustIndicators, PopularRoutes, PopularPackages,
 * FeaturedVehicles, HowItWorks, Testimonials, FAQ and OwnerCTA.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ push: vi.fn(), messages: {} as any }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
}));
vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns === "locations" ? `loc.${key}` : key),
  useLocale: () => "en",
  useMessages: () => h.messages,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  FAQ,
  FeaturedVehicles,
  HowItWorks,
  ImageWithFallback,
  OwnerCTA,
  PopularPackages,
  PopularRoutes,
  SearchSection,
  Testimonials,
  TrustIndicators,
} from "@/components/landing";

beforeEach(() => {
  h.push.mockReset();
  h.messages = {};
});

describe("ImageWithFallback", () => {
  it("swaps to a placeholder on error, keeping the original url", () => {
    render(<ImageWithFallback src="/bad.png" alt="Bus" className="c" style={{ width: 10 }} />);
    const img = screen.getByAltText("Bus");
    expect(img.className).toBe("c");
    fireEvent.error(img);
    const fallback = screen.getByAltText("Error loading image");
    expect(fallback.getAttribute("data-original-url")).toBe("/bad.png");
    expect(fallback.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    expect(fallback.parentElement!.parentElement!.className).toContain("c");
  });

  it("handles a missing className on error", () => {
    render(<ImageWithFallback src="/x.png" alt="X" />);
    fireEvent.error(screen.getByAltText("X"));
    expect(screen.getByAltText("Error loading image").parentElement!.parentElement!.className).toContain("bg-muted");
  });
});

describe("SearchSection", () => {
  it("builds a search query from trimmed fields and valid passengers", () => {
    const { container } = render(<SearchSection searchHref="/en/search" howItWorksHref="/en/how" />);
    fireEvent.change(screen.getByPlaceholderText("form.fromPlaceholder"), { target: { value: " Colombo " } });
    fireEvent.change(screen.getByPlaceholderText("form.toPlaceholder"), { target: { value: "Kandy" } });
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByPlaceholderText("form.passengersPlaceholder"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "form.searchButton" }));
    expect(h.push).toHaveBeenCalledWith("/en/search?from=Colombo&to=Kandy&date=2026-12-01&passengers=30");
    expect(screen.getByRole("link", { name: "scrollPrompt" }).getAttribute("href")).toBe("/en/how");
    expect(screen.getByText("bullets.verifiedOwners · bullets.transparentPricing · bullets.instantQuotes")).toBeTruthy();
    expect(screen.getByText("verifiedBuses.label · verifiedBuses.sublabel")).toBeTruthy();
  });

  it("navigates to the bare search page when empty or passengers invalid", () => {
    const { container } = render(<SearchSection searchHref="/en/search" howItWorksHref="/en/how" />);
    fireEvent.change(screen.getByPlaceholderText("form.passengersPlaceholder"), { target: { value: "0" } });
    // Submit directly: jsdom's constraint validation (min=1) would block a click-submit.
    fireEvent.submit(container.querySelector("form")!);
    expect(h.push).toHaveBeenCalledWith("/en/search");
  });

  it.todo("search form labels are associated with their inputs (SearchSection.tsx:103,119,135,150 have no htmlFor/id)");
  it.todo("search inputs keep a visible focus indicator instead of bare focus:outline-none (SearchSection.tsx:113,129,144,161)");
});

describe("TrustIndicators", () => {
  it("localizes by db key, by label and falls back to raw values", () => {
    render(
      <TrustIndicators
        stats={[
          { key: "VERIFIED_BUSES", label: "x", value: "120+", sublabel: "s" },
          { key: null, label: " Happy Customers ", value: "5k" },
          { label: "Successful trips", value: "900" },
          { key: "unknown", label: "Drivers", value: "40", sublabel: "Licensed" },
          { label: "Nothing", value: "1" },
        ] as any}
      />,
    );
    expect(screen.getByText("headline")).toBeTruthy();
    expect(screen.getByText("stats.verifiedBuses.label")).toBeTruthy();
    expect(screen.getByText("stats.happyTravelers.sublabel")).toBeTruthy();
    expect(screen.getByText("stats.tripsCompleted.label")).toBeTruthy();
    expect(screen.getByText("Drivers")).toBeTruthy();
    expect(screen.getByText("Licensed")).toBeTruthy();
    expect(screen.getByText("Nothing")).toBeTruthy();
    expect(screen.getByText("120+")).toBeTruthy();
  });
});

describe("PopularRoutes", () => {
  const routes = [
    { id: "r1", fromCity: "Colombo", toCity: "Kandy", imageUrl: "/r1.png", isPopular: true, durationHours: 3, bookingsCount: 40, avgPrice: 25000 },
    { id: "r2", fromCity: "Galle", toCity: "", imageUrl: "/r2.png", isPopular: false, durationHours: 2, bookingsCount: 5, avgPrice: 12000 },
    { id: "r3", fromCity: "", toCity: "Ella", imageUrl: "/r3.png", durationHours: 6, bookingsCount: 1, avgPrice: 9000 },
    { id: "r4", fromCity: "", toCity: "", imageUrl: "/r4.png", durationHours: 1, bookingsCount: 0, avgPrice: 1 },
  ];

  it("renders a primary bento card and secondary routes with search links", () => {
    render(<PopularRoutes searchHref="/en/search" routes={routes as any} />);
    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("href")).toBe("/en/search?from=Colombo&to=Kandy");
    expect(links[1].getAttribute("href")).toBe("/en/search?from=Galle");
    expect(links[2].getAttribute("href")).toBe("/en/search?to=Ella");
    expect(links[3].getAttribute("href")).toBe("/en/search");
    expect(screen.getByText("mostPopular")).toBeTruthy();
    expect(screen.getByAltText("loc.colombo to loc.kandy")).toBeTruthy();
    expect(screen.getByText(/LKR\s?25,000/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "viewAllRoutes" }).getAttribute("href")).toBe("/en/search");
  });

  it("omits the popular tag and shows a placeholder when there are no routes", () => {
    const { rerender } = render(<PopularRoutes searchHref="/s" routes={[{ ...routes[1], isPopular: false }] as any} />);
    expect(screen.queryByText("mostPopular")).toBeNull();
    rerender(<PopularRoutes searchHref="/s" routes={[]} />);
    expect(screen.getAllByText("subtitle").length).toBe(2);
  });

  it.todo("route cards do not nest a <button> (CTAButton) inside a link (PopularRoutes.tsx:112, PopularPackages.tsx:108, FeaturedVehicles.tsx:162)");
});

describe("PopularPackages", () => {
  it("renders nothing without packages", () => {
    const { container } = render(<PopularPackages packagesHref="/p" packages={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders localized package cards with price and links", () => {
    render(
      <PopularPackages
        packagesHref="/en/packages"
        packages={[
          { id: "p1", startLocation: "Nuwara  Eliya", endLocation: "Mirissa", durationDays: 3, minPassengers: 10, maxPassengers: 40, price: 15000 },
        ] as any}
      />,
    );
    expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe("/en/packages/p1");
    expect(screen.getByText("loc.nuwaraEliya → Mirissa")).toBeTruthy();
    expect(screen.getByText("10-40 capacityLabel")).toBeTruthy();
    expect(screen.getByText(/LKR\s?15,000/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "viewAllPackages" }).getAttribute("href")).toBe("/en/packages");
  });
});

describe("FeaturedVehicles", () => {
  const vehicles = [
    { id: "v1", name: "Lanka Coach", location: "Colombo", imageUrl: "/v1.png", rating: 4.8, reviewsCount: 12, seats: 45, amenities: ["AC", "WiFi", "Music", "TV"], pricePerDay: 30000 },
    { id: "v2", name: "Mini", location: "Mirissa", imageUrl: null, rating: 4, reviewsCount: 1, seats: 20, amenities: [], pricePerDay: 10000 },
  ];

  it("renders cards with amenity labels and fallback image", () => {
    render(<FeaturedVehicles searchHref="/en/search" vehicles={vehicles as any} />);
    expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe("/en/vehicles/v1");
    expect(screen.getByText("amenities.ac")).toBeTruthy();
    expect(screen.getByText("amenities.wifi")).toBeTruthy();
    expect(screen.getByText("amenities.music")).toBeTruthy();
    expect(screen.getByText("TV")).toBeTruthy();
    expect(screen.getByText("loc.colombo")).toBeTruthy();
    expect(screen.getByText("Mirissa")).toBeTruthy();
    expect(screen.getByAltText("Mini").getAttribute("src")).toContain("unsplash");
    expect(screen.getByText("(12)")).toBeTruthy();
  });

  it("prefers localized message overrides", () => {
    h.messages = { landing: { featuredVehicles: { items: [{ name: "ලංකා කෝච්", location: "කොළඹ" }] } } };
    render(<FeaturedVehicles searchHref="/s" vehicles={vehicles as any} />);
    expect(screen.getByText("ලංකා කෝච්")).toBeTruthy();
    expect(screen.getByText("කොළඹ")).toBeTruthy();
    expect(screen.getByText("Mini")).toBeTruthy();
  });
});

describe("HowItWorks and OwnerCTA", () => {
  it("renders three steps and the search CTA", () => {
    render(<HowItWorks searchHref="/en/search" />);
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBe(3);
    expect(screen.getByRole("link", { name: "cta.button" }).getAttribute("href")).toBe("/en/search");
  });

  it("renders benefits and the owner register CTA", () => {
    render(<OwnerCTA ownerRegisterHref="/en/register/owner" />);
    expect(screen.getByText("benefits.0")).toBeTruthy();
    expect(screen.getByText("card.stats.2.value")).toBeTruthy();
    const cta = screen.getByRole("link", { name: "primaryButton" });
    expect(cta.getAttribute("href")).toBe("/en/register/owner");
    expect(cta.className).toContain("focus-visible:ring-offset-foreground");
  });
});

describe("Testimonials", () => {
  const items = [
    { id: "t1", name: "Nimal", role: "Teacher", organization: "School", quote: "Great trip", tripDetails: "Colombo → Kandy", rating: 5, imageUrl: "/n.png" },
    { id: "t2", name: "Ama", role: "Lead", organization: "Org", quote: "Smooth", tripDetails: "Galle", rating: 3, imageUrl: "/a.png" },
  ];

  it("renders raw testimonials, stars and duplicated partner marquee", () => {
    const { container } = render(
      <Testimonials testimonials={items as any} trustedPartners={[{ id: "p1", name: "Dialog" }, { id: "", name: "SLT" }]} />,
    );
    expect(screen.getByText("“Great trip”")).toBeTruthy();
    expect(container.querySelectorAll(".fill-amber-400").length).toBe(8);
    expect(screen.getAllByText("Dialog").length).toBe(2);
    expect(screen.getAllByText("SLT").length).toBe(2);
    expect(screen.getByAltText("Nimal")).toBeTruthy();
  });

  it("uses localized items and partner names when provided", () => {
    h.messages = {
      landing: {
        testimonials: {
          items: [{ name: "නිමල්", role: "ගුරු", organization: "පාසල", quote: "නියමයි", tripDetails: "කොළඹ" }],
          trustedBy: ["ඩයලොග්"],
        },
      },
    };
    render(<Testimonials testimonials={items as any} trustedPartners={[{ id: "p1", name: "Dialog" }]} />);
    expect(screen.getByText("නිමල්")).toBeTruthy();
    expect(screen.getByText("“නියමයි”")).toBeTruthy();
    expect(screen.getAllByText("ඩයලොග්").length).toBe(2);
    expect(screen.getByText("Ama")).toBeTruthy();
  });
});

describe("FAQ", () => {
  it("opens the first item by default and toggles items", () => {
    render(<FAQ contactHref="/en/contact" helpCenterHref="/en/faq" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(6);
    expect(buttons[0].getAttribute("aria-expanded")).toBe("true");
    expect(buttons[1].getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(buttons[1]);
    expect(buttons[0].getAttribute("aria-expanded")).toBe("false");
    expect(buttons[1].getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(buttons[1]);
    expect(buttons[1].getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("link", { name: "cta.contactButton" }).getAttribute("href")).toBe("/en/contact");
    expect(screen.getByRole("link", { name: "cta.helpCenterButton" }).getAttribute("href")).toBe("/en/faq");
  });
});
