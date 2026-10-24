/**
 * Owner workspace shell and thin wrapper pages: layout guard + pending
 * approval bypass, notifications deep-link resolver, messages booking
 * param, and the disputes booking-options loader.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pathname: "/en/owner/fleet",
  guard: { isLoading: false, isAuthorized: true },
  notificationProps: null as any,
  chatProps: null as any,
  disputesProps: [] as any[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useParams: () => ({ locale: "si" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "ta",
}));

vi.mock("@/hooks", () => ({
  useOwnerGuard: () => state.guard,
}));

vi.mock("@/components/layout/OwnerSidebar", () => ({
  OwnerSidebar: ({ locale }: { locale: string }) => <nav data-testid="sidebar">{locale}</nav>,
}));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => <footer>footer</footer> }));
vi.mock("@/components/ui", () => ({ LoadingSpinner: () => <div data-testid="spinner" /> }));
vi.mock("@/components/ui/LoadingSpinner", () => ({ LoadingSpinner: () => <div data-testid="spinner" /> }));
vi.mock("@/components/dashboard/NotificationList", () => ({
  NotificationList: (props: any) => {
    state.notificationProps = props;
    return <div data-testid="notification-list" />;
  },
}));
vi.mock("@/components/chat", () => ({
  ChatLayout: (props: any) => {
    state.chatProps = props;
    return <div data-testid="chat" />;
  },
}));
vi.mock("@/components/features/disputes/DisputesView", () => ({
  DisputesView: (props: any) => {
    state.disputesProps.push(props);
    return <div data-testid="disputes">{props.bookingsLoading ? "loading" : props.bookingOptions.length}</div>;
  },
}));
vi.mock("@/lib/api", () => ({
  bookingService: { getOwnerBookings: vi.fn() },
}));

import { bookingService } from "@/lib/api";
import OwnerLayout from "@/app/[locale]/owner/layout";
import OwnerNotificationsPage from "@/app/[locale]/owner/notifications/page";
import OwnerMessagesPage from "@/app/[locale]/owner/messages/page";
import OwnerDisputesPage from "@/app/[locale]/owner/disputes/page";

beforeEach(() => {
  state.guard = { isLoading: false, isAuthorized: true };
  state.pathname = "/en/owner/fleet";
  state.notificationProps = null;
  state.chatProps = null;
  state.disputesProps = [];
  vi.clearAllMocks();
});

describe("OwnerLayout", () => {
  it("renders pending-approval pages without the guarded shell", () => {
    state.pathname = "/en/owner/pending-approval";
    state.guard = { isLoading: true, isAuthorized: false };
    render(<OwnerLayout>pending content</OwnerLayout>);
    expect(screen.getByText("pending content")).toBeTruthy();
    expect(screen.queryByTestId("sidebar")).toBeNull();
    expect(screen.queryByTestId("spinner")).toBeNull();
  });

  it("shows a spinner while the guard resolves or rejects", () => {
    state.guard = { isLoading: true, isAuthorized: false };
    const { rerender } = render(<OwnerLayout>child</OwnerLayout>);
    expect(screen.getByTestId("spinner")).toBeTruthy();
    state.guard = { isLoading: false, isAuthorized: false };
    rerender(<OwnerLayout>child</OwnerLayout>);
    expect(screen.queryByText("child")).toBeNull();
  });

  it.each([
    ["/en/owner/quotations/sent/abc", "items.sentQuotes"],
    ["/en/owner/quotations", "items.quotations"],
    ["/en/owner/settings", "items.settings"],
    ["/en/owner/somewhere", "items.dashboard"],
  ])("renders the shell with the title for %s", (path: string, key: string) => {
    state.pathname = path;
    render(<OwnerLayout>body</OwnerLayout>);
    expect(screen.getByText("body")).toBeTruthy();
    expect(screen.getByText(key)).toBeTruthy();
    expect(screen.getByTestId("sidebar").textContent).toBe("si");
    expect(screen.getByText("footer")).toBeTruthy();
    expect(screen.getByText("breadcrumbRoot")).toBeTruthy();
  });
});

describe("OwnerNotificationsPage", () => {
  it("is gated by the owner guard", () => {
    state.guard = { isLoading: false, isAuthorized: false };
    render(<OwnerNotificationsPage />);
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(screen.queryByTestId("notification-list")).toBeNull();
  });

  it("deep-links notification categories to owner sections", () => {
    render(<OwnerNotificationsPage />);
    expect(screen.getByText("title")).toBeTruthy();
    const { resolveHref, settingsHref } = state.notificationProps;
    expect(settingsHref).toBe("/ta/owner/profile");
    expect(resolveHref({ category: "Bookings" })).toBe("/ta/owner/bookings");
    expect(resolveHref({ category: "Payments" })).toBe("/ta/owner/earnings");
    expect(resolveHref({ category: "Quotations" })).toBe("/ta/owner/quotations");
    expect(resolveHref({ category: "Reviews" })).toBe("/ta/owner/reviews");
    expect(resolveHref({ category: "System" })).toBeNull();
  });
});

describe("OwnerMessagesPage", () => {
  const renderMessages = async (booking?: string | string[]) => {
    const searchParams = Promise.resolve({ booking });
    await act(async () => {
      render(
        <Suspense fallback={<div>suspended</div>}>
          <OwnerMessagesPage searchParams={searchParams} />
        </Suspense>,
      );
      await searchParams;
    });
  };

  it("opens the conversation for a single booking id", async () => {
    await renderMessages("bk-1");
    await screen.findByTestId("chat");
    expect(state.chatProps).toMatchObject({
      initialBookingId: "bk-1",
      bookingBasePath: "/owner/bookings",
      emptyDescKey: "emptyListDescOwner",
    });
  });

  it("ignores array booking params", async () => {
    await renderMessages(["a", "b"]);
    await screen.findByTestId("chat");
    expect(state.chatProps.initialBookingId).toBeUndefined();
  });

  it("is gated by the owner guard", async () => {
    state.guard = { isLoading: true, isAuthorized: false };
    await renderMessages();
    await screen.findByTestId("spinner");
    expect(screen.queryByTestId("chat")).toBeNull();
  });
});

describe("OwnerDisputesPage", () => {
  it("maps owner bookings into dispute booking options", async () => {
    (bookingService.getOwnerBookings as any).mockResolvedValue({
      bookings: [
        { id: "bk-1", vehicleName: "Lanka Cruiser", startDate: "2026-10-01T00:00:00.000Z" },
        { id: 2, startDate: "2026-11-01T00:00:00.000Z" },
      ],
    });
    render(<OwnerDisputesPage />);
    expect(screen.getByTestId("disputes").textContent).toBe("loading");
    await waitFor(() => expect(screen.getByTestId("disputes").textContent).toBe("2"));
    expect(bookingService.getOwnerBookings).toHaveBeenCalledWith({ page: 1, limit: 100 });
    const last = state.disputesProps.at(-1);
    expect(last.locale).toBe("si");
    expect(last.bookingOptions[0].id).toBe("bk-1");
    expect(last.bookingOptions[0].label).toMatch(/^Lanka Cruiser · /);
    expect(last.bookingOptions[1]).toMatchObject({ id: "2" });
    expect(last.bookingOptions[1].label).toMatch(/^Booking · /);
  });

  it("handles missing bookings and failures without blocking the view", async () => {
    (bookingService.getOwnerBookings as any).mockResolvedValueOnce({});
    const first = render(<OwnerDisputesPage />);
    await waitFor(() => expect(screen.getByTestId("disputes").textContent).toBe("0"));
    first.unmount();

    (bookingService.getOwnerBookings as any).mockRejectedValueOnce(new Error("down"));
    render(<OwnerDisputesPage />);
    await waitFor(() => expect(screen.getByTestId("disputes").textContent).toBe("0"));
  });

  it("ignores results that arrive after unmount", async () => {
    let resolve: (v: unknown) => void = () => {};
    (bookingService.getOwnerBookings as any).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const view = render(<OwnerDisputesPage />);
    view.unmount();
    await act(async () => resolve({ bookings: [{ id: "x", startDate: "2026-01-01" }] }));
    expect(state.disputesProps.every((p) => p.bookingOptions.length === 0)).toBe(true);
  });
});
