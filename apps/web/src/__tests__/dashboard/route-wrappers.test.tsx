/**
 * Thin dashboard route files: server page wrappers + metadata, the layout,
 * the customer auth guard, and the disputes / messages / notifications pages.
 */
import { configure, act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const guardState = { isLoading: false, isAuthorized: true };
const getTranslations = vi.fn(async ({ namespace }: any) => (key: string) => `${namespace}.${key}`);
const redirect = vi.fn();
const { captured, stub } = vi.hoisted(() => {
  const captured: Record<string, any> = {};
  const stub = (name: string) => (props: any) => {
    captured[name] = props;
    return null;
  };
  return { captured, stub };
});

vi.mock("next-intl/server", () => ({ getTranslations: (a: any) => getTranslations(a) }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks", () => ({ useCustomerGuard: () => guardState }));
vi.mock("@/components/ui", () => ({
  LoadingSpinner: () => <div data-testid="spinner" />,
}));
vi.mock("@/components/layout/CustomerSidebar", () => ({
  CustomerSidebar: ({ locale }: any) => <nav data-testid="sidebar">{locale}</nav>,
}));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => <footer>footer</footer> }));
vi.mock("@/components/chat", () => ({
  ChatLayout: (props: any) => {
    captured.chat = props;
    return <div data-testid="chat" />;
  },
}));
vi.mock("@/components/dashboard/NotificationList", () => ({
  NotificationList: (props: any) => {
    captured.notifications = props;
    return <div data-testid="notifications" />;
  },
}));
vi.mock("@/components/features/disputes/DisputesView", () => ({
  DisputesView: (props: any) => {
    captured.disputes = props;
    return <div data-testid="disputes" />;
  },
}));
vi.mock("@/lib/api", () => ({ bookingService: { getMyBookings: vi.fn() } }));

vi.mock("@/app/[locale]/dashboard/DashboardContent", () => ({ DashboardContent: stub("DashboardContent") }));
vi.mock("@/app/[locale]/dashboard/bookings/BookingsPageContent", () => ({ BookingsPageContent: stub("Bookings") }));
vi.mock("@/app/[locale]/dashboard/bookings/[id]/payment/PaymentPageContent", () => ({ default: stub("Payment") }));
vi.mock("@/app/[locale]/dashboard/bookings/confirm/BookingConfirmPageContent", () => ({ default: stub("Confirm") }));
vi.mock("@/app/[locale]/dashboard/trips/TripsPageContent", () => ({ TripsPageContent: stub("Trips") }));
vi.mock("@/app/[locale]/dashboard/trips/[id]/TripDetailPageContent", () => ({ TripDetailPageContent: stub("TripDetail") }));
vi.mock("@/app/[locale]/dashboard/trips/new/NewTripPageContent", () => ({ NewTripPageContent: stub("NewTrip") }));
vi.mock("@/app/[locale]/dashboard/packages/packages-page-content", () => ({ PackagesPageContent: stub("Packages") }));
vi.mock("@/app/[locale]/vehicles/[id]/VehicleDetailsPageContent", () => ({ default: stub("Vehicle") }));
vi.mock("@/app/[locale]/dashboard/profile/ProfilePageContent", () => ({ ProfilePageContent: stub("Profile") }));
vi.mock("@/app/[locale]/dashboard/quotations/new/NewQuotationPageContent", () => ({ NewQuotationPageContent: stub("NewQuotation") }));
vi.mock("@/app/[locale]/dashboard/quotations/[id]/QuotationDetailPageContent", () => ({ QuotationDetailPageContent: stub("QuotationDetail") }));
vi.mock("@/app/[locale]/dashboard/quotations/compare/ComparisonPageContent", () => ({ default: stub("Compare") }));
vi.mock("@/app/[locale]/dashboard/reviews/ReviewsPageContent", () => ({ ReviewsPageContent: stub("Reviews") }));
vi.mock("@/app/[locale]/dashboard/search/search-page-content", () => ({ SearchPageContent: stub("Search") }));

import { bookingService } from "@/lib/api";
import DashboardLayout from "@/app/[locale]/dashboard/layout";
import { DashboardLayoutClient } from "@/app/[locale]/dashboard/DashboardLayoutClient";
import * as dashboardPage from "@/app/[locale]/dashboard/page";
import * as bookingsPage from "@/app/[locale]/dashboard/bookings/page";
import PaymentPage from "@/app/[locale]/dashboard/bookings/[id]/payment/page";
import ConfirmPage from "@/app/[locale]/dashboard/bookings/confirm/page";
import * as tripsPage from "@/app/[locale]/dashboard/trips/page";
import * as tripDetailPage from "@/app/[locale]/dashboard/trips/[id]/page";
import * as newTripPage from "@/app/[locale]/dashboard/trips/new/page";
import PackagesPage from "@/app/[locale]/dashboard/packages/page";
import VehiclePage from "@/app/[locale]/dashboard/vehicles/[id]/page";
import * as profilePage from "@/app/[locale]/dashboard/profile/page";
import * as newQuotationPage from "@/app/[locale]/dashboard/quotations/new/page";
import QuotationDetailPage from "@/app/[locale]/dashboard/quotations/[id]/page";
import QuotationsPage from "@/app/[locale]/dashboard/quotations/page";
import ComparePage from "@/app/[locale]/dashboard/quotations/compare/page";
import * as reviewsPage from "@/app/[locale]/dashboard/reviews/page";
import SearchPage from "@/app/[locale]/dashboard/search/page";
import DisputesPage from "@/app/[locale]/dashboard/disputes/page";
import MessagesPage from "@/app/[locale]/dashboard/messages/page";
import NotificationsPage from "@/app/[locale]/dashboard/notifications/page";

const p = (v: Record<string, string>) => Promise.resolve(v) as any;

beforeEach(() => {
  vi.clearAllMocks();
  guardState.isLoading = false;
  guardState.isAuthorized = true;
  for (const k of Object.keys(captured)) delete captured[k];
});

describe("server page wrappers", () => {
  it.each([
    ["dashboard", dashboardPage, "dashboard", "pageTitle", "pageDescription"],
    ["bookings", bookingsPage, "booking", "pageTitle", "pageDescription"],
    ["trips", tripsPage, "trip", "listPageTitle", "listPageDescription"],
    ["trip detail", tripDetailPage, "trip", "detailPageTitle", "detailPageDescription"],
    ["new trip", newTripPage, "trip", "newPageTitle", "newPageDescription"],
    ["profile", profilePage, "profile", "pageTitle", "pageDescription"],
    ["new quotation", newQuotationPage, "quotation", "newRequestPageTitle", "newRequestPageDescription"],
    ["reviews", reviewsPage, "review", "pageTitle", "pageDescription"],
  ])("%s metadata uses the %s namespace", async (_n: string, mod: any, ns: string, title: string, desc: string) => {
    const meta = await mod.generateMetadata({ params: p({ locale: "si" }) });
    expect(getTranslations).toHaveBeenCalledWith({ locale: "si", namespace: ns });
    expect(meta).toEqual({ title: `${ns}.${title}`, description: `${ns}.${desc}` });
  });

  it.each([
    [dashboardPage.default, { locale: "ta" }, { locale: "ta" }],
    [bookingsPage.default, { locale: "ta" }, { locale: "ta" }],
    [tripsPage.default, { locale: "ta" }, { locale: "ta" }],
    [tripDetailPage.default, { locale: "ta", id: "t9" }, { locale: "ta", tripId: "t9" }],
    [newTripPage.default, { locale: "ta" }, { locale: "ta" }],
    [PackagesPage, { locale: "ta" }, { locale: "ta" }],
    [VehiclePage, { locale: "ta", id: "v9" }, { locale: "ta", vehicleId: "v9", isDashboard: true }],
    [profilePage.default, { locale: "ta" }, { locale: "ta" }],
    [newQuotationPage.default, { locale: "ta" }, { locale: "ta" }],
    [QuotationDetailPage, { locale: "ta", id: "q9" }, { locale: "ta", requestId: "q9" }],
    [reviewsPage.default, { locale: "ta" }, { locale: "ta" }],
    [SearchPage, { locale: "ta" }, { locale: "ta" }],
  ])("page #%# forwards route params to its content component", async (Page: any, params: any, expected: any) => {
    const el = await Page({ params: p(params) });
    expect(el.props).toEqual(expected);
  });

  it("the legacy quotations list redirects to trips", async () => {
    await QuotationsPage({ params: p({ locale: "si" }) });
    expect(redirect).toHaveBeenCalledWith("/si/dashboard/trips");
  });

  it.each([
    ["Payment", PaymentPage, { id: "b1", locale: "en" }, { bookingId: "b1", locale: "en" }],
    ["Confirm", ConfirmPage, { locale: "en" }, { locale: "en" }],
    ["Compare", ComparePage, { locale: "en" }, { locale: "en" }],
  ])("client page %s unwraps params with use()", async (name: string, Page: any, params: any, expected: any) => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <Page params={p(params)} />
        </Suspense>,
      );
    });
    await waitFor(() => expect(captured[name]).toEqual(expected));
  });
});

describe("dashboard layout + guard", () => {
  it("renders the sidebar for the locale, the children and a footer", async () => {
    const el = await DashboardLayout({ children: <p>child</p>, params: p({ locale: "si" }) });
    render(el);
    expect(screen.getByTestId("sidebar").textContent).toBe("si");
    expect(screen.getByText("child")).toBeTruthy();
    expect(screen.getByText("footer")).toBeTruthy();
  });

  it("blocks children while the guard loads or the user is unauthorised", () => {
    guardState.isLoading = true;
    const { rerender } = render(<DashboardLayoutClient locale="en"><p>secret</p></DashboardLayoutClient>);
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
    guardState.isLoading = false;
    guardState.isAuthorized = false;
    rerender(<DashboardLayoutClient locale="en"><p>secret</p></DashboardLayoutClient>);
    expect(screen.queryByText("secret")).toBeNull();
    guardState.isAuthorized = true;
    rerender(<DashboardLayoutClient locale="en"><p>secret</p></DashboardLayoutClient>);
    expect(screen.getByText("secret")).toBeTruthy();
  });
});

describe("disputes page", () => {
  it("loads the customer's bookings as dispute options", async () => {
    (bookingService.getMyBookings as any).mockResolvedValue({
      bookings: [
        { id: "b1", vehicleName: "Lanka Coach", startDate: "2026-06-03T00:00:00Z" },
        { id: "b2", startDate: "2026-06-04T00:00:00Z" },
      ],
    });
    render(<DisputesPage />);
    expect(captured.disputes.bookingsLoading).toBe(true);
    await waitFor(() => expect(captured.disputes.bookingsLoading).toBe(false));
    expect(bookingService.getMyBookings).toHaveBeenCalledWith({ page: 1, limit: 100 });
    expect(captured.disputes.locale).toBe("en");
    expect(captured.disputes.bookingOptions.map((o: any) => o.id)).toEqual(["b1", "b2"]);
    expect(captured.disputes.bookingOptions[0].label.startsWith("Lanka Coach · ")).toBe(true);
    expect(captured.disputes.bookingOptions[1].label.startsWith("Booking · ")).toBe(true);
  });

  it("still renders the disputes view when bookings fail or are missing", async () => {
    (bookingService.getMyBookings as any).mockRejectedValueOnce(new Error("offline"));
    const { unmount } = render(<DisputesPage />);
    await waitFor(() => expect(captured.disputes.bookingsLoading).toBe(false));
    expect(captured.disputes.bookingOptions).toEqual([]);
    unmount();
    (bookingService.getMyBookings as any).mockResolvedValueOnce({});
    render(<DisputesPage />);
    await waitFor(() => expect(captured.disputes.bookingsLoading).toBe(false));
    expect(captured.disputes.bookingOptions).toEqual([]);
  });

  it("ignores a late response after unmount", async () => {
    let resolve!: (v: any) => void;
    (bookingService.getMyBookings as any).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { unmount } = render(<DisputesPage />);
    unmount();
    await act(async () => resolve({ bookings: [{ id: "x", startDate: "2026-01-01" }] }));
    expect(captured.disputes.bookingOptions).toEqual([]);
  });
});

describe("messages page", () => {
  const renderMessages = async (booking?: string | string[]) => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <MessagesPage params={p({ locale: "en" })} searchParams={Promise.resolve({ booking }) as any} />
        </Suspense>,
      );
    });
    await screen.findByTestId("chat");
  };

  it("opens the conversation for ?booking=<id>", async () => {
    await renderMessages("b7");
    expect(screen.getByText("title")).toBeTruthy();
    expect(captured.chat).toEqual({
      emptyDescKey: "emptyListDesc",
      initialBookingId: "b7",
      bookingBasePath: "/dashboard/bookings",
    });
  });

  it("ignores a repeated booking query param", async () => {
    await renderMessages(["a", "b"]);
    expect(captured.chat.initialBookingId).toBeUndefined();
  });
});

describe("notifications page", () => {
  it("deep-links notifications to their related records", () => {
    render(<NotificationsPage params={{ locale: "si" }} />);
    expect(screen.getByText("title")).toBeTruthy();
    const { resolveHref, settingsHref } = captured.notifications;
    expect(settingsHref).toBe("/si/dashboard/settings");
    expect(resolveHref({ data: { bookingId: "b1" } })).toBe("/si/dashboard/bookings/b1");
    expect(resolveHref({ data: { quotationId: "q1" } })).toBe("/si/dashboard/quotations");
    expect(resolveHref({ category: "Bookings" })).toBe("/si/dashboard/bookings");
    expect(resolveHref({ category: "Payments", data: { bookingId: 5 } })).toBe("/si/dashboard/bookings");
    expect(resolveHref({ category: "Quotations" })).toBe("/si/dashboard/quotations");
    expect(resolveHref({ category: "Reviews" })).toBe("/si/dashboard/reviews");
    expect(resolveHref({ category: "System" })).toBeNull();
  });
});
