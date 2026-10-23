/**
 * Component tests for the layout chrome: MainLayout, Header (+ owner bell),
 * Footer, LanguageSwitcher and the Admin / Customer / Owner sidebars.
 * Auth store, notification stream and API services are mocked.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class ApiError extends Error {}
  return {
    ApiError,
    push: vi.fn(),
    pathname: "/en",
    params: { locale: "en" } as Record<string, string>,
    auth: {} as any,
    streamCb: null as null | (() => void),
    notifCount: vi.fn(),
    msgCount: vi.fn(),
    logoutApi: vi.fn(),
    stopTokenRefresh: vi.fn(),
    publicConfig: vi.fn(),
    replace: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn() }),
  usePathname: () => h.pathname,
  useParams: () => h.params,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/store", () => ({ useAuthStore: () => h.auth }));
vi.mock("@/hooks", () => ({
  useNotificationStream: (cb: () => void) => {
    h.streamCb = cb;
  },
}));
vi.mock("@/lib/api", () => ({
  ApiError: h.ApiError,
  notificationService: { getUnreadCount: h.notifCount },
  messageService: { getUnreadCount: h.msgCount },
  authService: { logout: h.logoutApi },
  api: { stopTokenRefresh: h.stopTokenRefresh },
  landingContentService: { getPublicConfig: h.publicConfig },
}));

import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { CustomerSidebar } from "@/components/layout/CustomerSidebar";
import { OwnerSidebar } from "@/components/layout/OwnerSidebar";

const realLocation = window.location;

const mkUser = (over: any = {}) => ({
  id: "u1",
  firstName: "Kamal",
  lastName: "Perera",
  email: "kamal@example.lk",
  role: "CUSTOMER",
  isVerified: true,
  avatar: null,
  ...over,
});

const setAuth = (over: any = {}) => {
  h.auth = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    logout: vi.fn(),
    ...over,
  };
};

beforeEach(() => {
  h.push.mockReset();
  h.pathname = "/en";
  h.params = { locale: "en" };
  h.streamCb = null;
  h.notifCount.mockReset().mockResolvedValue({ unreadCount: 0 });
  h.msgCount.mockReset().mockResolvedValue({ unreadCount: 0 });
  h.logoutApi.mockReset().mockResolvedValue(undefined);
  h.stopTokenRefresh.mockReset();
  h.publicConfig.mockReset().mockResolvedValue({ socialMediaLinks: {} });
  h.replace.mockReset();
  setAuth();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, replace: h.replace },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

const flush = () => act(async () => {});

describe("LanguageSwitcher", () => {
  it("opens, switches locale by rewriting the path and closes", async () => {
    h.pathname = "/en/search";
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    const options = screen.getAllByRole("button");
    expect(options.length).toBe(4);
    expect(options[1].className).toContain("bg-primary");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "සිංහල" }));
    });
    expect(h.push).toHaveBeenCalledWith("/si/search");
    expect(screen.getAllByRole("button").length).toBe(1);
  });

  it("closes without navigating for the current locale or backdrop click", () => {
    h.params = {};
    const { container } = render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getAllByRole("button", { name: "English" })[1]);
    expect(h.push).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button").length).toBe(1);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(container.querySelector(".fixed.inset-0")!);
    expect(screen.getAllByRole("button").length).toBe(1);
  });
});

describe("Footer", () => {
  it("renders locale-aware links and the follow-us fallback", async () => {
    render(<Footer />);
    await flush();
    expect(screen.getByRole("link", { name: "faq" }).getAttribute("href")).toBe("/en/faq");
    expect(screen.getByRole("link", { name: "refundPolicy" }).getAttribute("href")).toBe("/en/refund-policy");
    expect(screen.getByRole("link", { name: "tripPackages" }).getAttribute("href")).toBe("/en/packages");
    expect(screen.getByText("followUs")).toBeTruthy();
    expect(screen.getByText("copyright")).toBeTruthy();
  });

  it("renders only configured social links in a new tab", async () => {
    h.publicConfig.mockResolvedValue({
      socialMediaLinks: { facebook: "https://fb.com/tn", linkedin: "https://li.com/tn" },
    });
    render(<Footer />);
    await waitFor(() => expect(screen.getByText("social.facebook")).toBeTruthy());
    const fb = screen.getByText("social.facebook").closest("a")!;
    expect(fb.getAttribute("href")).toBe("https://fb.com/tn");
    expect(fb.getAttribute("target")).toBe("_blank");
    expect(fb.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("social.linkedin")).toBeTruthy();
    expect(screen.queryByText("social.twitter")).toBeNull();
    expect(screen.queryByText("followUs")).toBeNull();
  });

  it("handles missing links and logs ApiError / generic failures", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.publicConfig.mockResolvedValueOnce({});
    const first = render(<Footer />);
    await flush();
    expect(screen.getByText("followUs")).toBeTruthy();
    first.unmount();
    h.publicConfig.mockRejectedValueOnce(new h.ApiError("down"));
    const second = render(<Footer />);
    await flush();
    expect(errSpy).toHaveBeenCalledWith("Failed to load footer social links:", "down");
    second.unmount();
    const generic = new Error("boom");
    h.publicConfig.mockRejectedValueOnce(generic);
    render(<Footer />);
    await flush();
    expect(errSpy).toHaveBeenCalledWith("Failed to load footer social links:", generic);
    errSpy.mockRestore();
  });

  it("ignores a late response after unmount", async () => {
    let resolve!: (v: any) => void;
    h.publicConfig.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = render(<Footer />);
    unmount();
    await act(async () => resolve({ socialMediaLinks: { facebook: "x" } }));
    expect(screen.queryByText("social.facebook")).toBeNull();
  });
});

describe("Header", () => {
  it("shows guest navigation and toggles the mobile menu", async () => {
    render(<Header />);
    await flush();
    expect(screen.getAllByRole("link", { name: "login" })[0].getAttribute("href")).toBe("/en/login");
    expect(screen.getAllByRole("link", { name: "home" })[0].getAttribute("href")).toBe("/en");
    const toggle = screen.getByRole("button", { name: "openMenu" });
    fireEvent.click(toggle);
    expect(screen.getAllByRole("link", { name: "register" }).length).toBe(2);
    fireEvent.click(screen.getAllByRole("link", { name: "search" })[1]);
    expect(screen.getAllByRole("link", { name: "register" }).length).toBe(1);
    fireEvent.click(toggle);
    fireEvent.click(screen.getAllByRole("link", { name: "login" })[1]);
    fireEvent.click(toggle);
    fireEvent.click(screen.getAllByRole("link", { name: "register" })[1]);
    expect(screen.getAllByRole("link", { name: "register" }).length).toBe(1);
  });

  it("toggles the scrolled shadow on window scroll", () => {
    const { container } = render(<Header />);
    const header = container.querySelector("header")!;
    expect(header.className).toContain("shadow-none");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 50 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header.className).not.toContain("shadow-none");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("shows the customer dashboard link and logs out", async () => {
    setAuth({ isAuthenticated: true, user: mkUser() });
    render(<Header />);
    await flush();
    expect(screen.getAllByRole("link", { name: "home" })[0].getAttribute("href")).toBe("/en/dashboard");
    expect(screen.getByRole("link", { name: "Kamal" }).getAttribute("href")).toBe("/en/dashboard");
    expect(screen.queryByRole("link", { name: "login" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    expect(screen.getByRole("link", { name: "dashboardFor" }).getAttribute("href")).toBe("/en/dashboard");
    fireEvent.click(screen.getByRole("link", { name: "dashboardFor" }));
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    const logoutButtons = screen.getAllByRole("button", { name: "logout" });
    fireEvent.click(logoutButtons[1]);
    expect(h.auth.logout).toHaveBeenCalled();
    expect(h.push).toHaveBeenCalledWith("/en");
    expect(screen.queryByRole("link", { name: "dashboardFor" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    expect(h.auth.logout).toHaveBeenCalledTimes(2);
  });

  it("renders the verified owner bell with a live unread badge refreshed by the stream", async () => {
    h.notifCount.mockResolvedValueOnce({ unreadCount: 3 }).mockResolvedValueOnce({ unreadCount: 120 });
    setAuth({ isAuthenticated: true, user: mkUser({ role: "VEHICLE_OWNER" }) });
    render(<Header />);
    await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
    const bell = screen.getByTitle("title");
    expect(bell.getAttribute("href")).toBe("/en/owner/notifications");
    expect(screen.getByLabelText("unreadBadge")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Kamal" }).getAttribute("href")).toBe("/en/owner/profile");
    await act(async () => {
      h.streamCb!();
    });
    expect(screen.getByText("99+")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    const mobileBell = screen.getByRole("link", { name: "notifications" });
    expect(mobileBell.getAttribute("href")).toBe("/en/owner/notifications");
    expect(screen.getByRole("link", { name: "profile" }).getAttribute("href")).toBe("/en/owner/profile");
    fireEvent.click(mobileBell);
    expect(screen.queryByRole("link", { name: "notifications" })).toBeNull();
  });

  it("keeps the bell hidden when unread polling fails or returns nothing", async () => {
    h.notifCount.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("y"));
    setAuth({ isAuthenticated: true, user: mkUser({ role: "VEHICLE_OWNER" }) });
    const { unmount } = render(<Header />);
    await flush();
    await act(async () => {
      h.streamCb!();
    });
    await act(async () => {
      h.streamCb!();
    });
    expect(screen.queryByLabelText("unreadBadge")).toBeNull();
    unmount();
  });

  it("ignores an unread count that arrives after unmount", async () => {
    let resolve!: (v: any) => void;
    h.notifCount.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    setAuth({ isAuthenticated: true, user: mkUser({ role: "VEHICLE_OWNER" }) });
    const { unmount } = render(<Header />);
    unmount();
    await act(async () => resolve({ unreadCount: 5 }));
    expect(screen.queryByText("5")).toBeNull();
  });

  it("disables navigation for pending (unverified) owners", async () => {
    setAuth({ isAuthenticated: true, user: mkUser({ role: "VEHICLE_OWNER", isVerified: false }) });
    render(<Header />);
    await flush();
    expect(screen.queryByRole("link", { name: "search" })).toBeNull();
    const logo = screen.getByRole("link", { name: /TravelNest/ });
    expect(logo.getAttribute("href")).toBe("/en/owner/pending-approval");
    const disabled = screen.getAllByTitle("disabledPending") as HTMLButtonElement[];
    expect(disabled.length).toBe(2);
    expect(disabled.every((b) => b.disabled && b.getAttribute("aria-disabled") === "true")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    expect(screen.getAllByTitle("disabledPending").length).toBe(4);
    expect(h.notifCount).not.toHaveBeenCalled();
  });

  it("hides authenticated UI while auth is loading", async () => {
    setAuth({ isAuthenticated: true, isLoading: true, user: mkUser({ role: "ADMIN" }) });
    render(<Header />);
    await flush();
    expect(screen.getAllByRole("link", { name: "login" }).length).toBe(1);
  });

  it("announces the mobile menu state on its toggle", async () => {
    render(<Header />);
    await flush();

    const toggle = screen.getByRole("button", { name: "openMenu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("closeMenu");
  });
});

describe("MainLayout", () => {
  it("wraps children with header and footer", async () => {
    render(
      <MainLayout>
        <p>Page body</p>
      </MainLayout>,
    );
    await flush();
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main").textContent).toBe("Page body");
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });
});

describe("AdminSidebar", () => {
  beforeEach(() => {
    setAuth({ isAuthenticated: true, user: mkUser({ role: "ADMIN", firstName: "Ada", lastName: "Silva" }) });
    h.pathname = "/en/admin/dashboard";
  });

  it("highlights the active item, shows unread badges and refreshes from the stream", async () => {
    h.notifCount.mockResolvedValueOnce({ unreadCount: 4 }).mockResolvedValueOnce({ unreadCount: 250 }).mockRejectedValueOnce(new Error("x"));
    render(<AdminSidebar locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("4 unread")).toBeTruthy());
    const dash = screen.getByRole("link", { name: "items.dashboard" });
    expect(dash.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /items.users/ }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("groups.finance")).toBeTruthy();
    await act(async () => {
      h.streamCb!();
    });
    expect(screen.getByText("99+")).toBeTruthy();
    await act(async () => {
      h.streamCb!();
    });
    expect(screen.getByText("99+")).toBeTruthy();
    expect(screen.getAllByText("AS").length).toBe(2);
  });

  it("marks prefix routes active and uses a white badge on an active item", async () => {
    h.pathname = "/en/admin/notifications/abc";
    h.notifCount.mockResolvedValue({ unreadCount: 2 });
    render(<AdminSidebar locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("2 unread")).toBeTruthy());
    expect(screen.getByLabelText("2 unread").className).toContain("bg-white");
    expect(screen.getByRole("link", { name: /items.dashboard/ }).getAttribute("aria-current")).toBeNull();
  });

  it("collapses to icon rail with titles and dot badges, and expands back", async () => {
    h.notifCount.mockResolvedValue({ unreadCount: 1 });
    const { container } = render(<AdminSidebar locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("1 unread")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "collapseSidebar" }));
    const users = screen.getByRole("link", { name: "items.users" });
    expect(users.getAttribute("title")).toBe("items.users");
    expect(screen.queryByText("groups.finance")).toBeNull();
    expect(container.querySelector("aside")!.className).toContain("w-16");
    expect(container.querySelector("aside .h-2.w-2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /openAccountMenu/ }));
    expect(screen.getByRole("link", { name: "profile" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "expandSidebar" }));
    expect(container.querySelector("aside")!.className).toContain("w-64");
  });

  it("opens the account menu, closes on outside pointerdown/backdrop, and logs out", async () => {
    render(<AdminSidebar locale="en" />);
    await flush();
    const pill = screen.getByRole("button", { name: "Ada Silva — openAccountMenu" });
    expect(pill.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(pill);
    expect(pill.getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(pill);
    expect(pill.getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(document.body);
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(pill);
    fireEvent.click(pill.parentElement!.querySelector('.fixed.inset-0')!);
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(pill);
    fireEvent.click(screen.getByRole("link", { name: "profile" }));
    expect(screen.queryByRole("link", { name: "profile" })).toBeNull();
    fireEvent.click(pill);
    h.logoutApi.mockRejectedValueOnce(new Error("offline"));
    localStorage.setItem("travenest-auth", "x");
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    expect(h.logoutApi).toHaveBeenCalled();
    expect(h.auth.logout).toHaveBeenCalled();
    expect(localStorage.getItem("travenest-auth")).toBeNull();
    expect(h.stopTokenRefresh).toHaveBeenCalled();
    expect(h.replace).toHaveBeenCalledWith("/en");
    await flush();
  });

  it("drives the mobile drawer", async () => {
    h.params = {};
    render(<AdminSidebar locale="si" />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    expect(screen.getAllByRole("complementary").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "closeMenu" }));
    expect(screen.getAllByRole("complementary").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    const drawer = screen.getAllByRole("complementary")[1];
    fireEvent.click(within(drawer).getByRole("link", { name: /items.users/ }));
    expect(screen.getAllByRole("complementary").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    fireEvent.click(screen.getAllByRole("complementary")[1].parentElement!.querySelector('[aria-hidden="true"]')!);
    expect(screen.getAllByRole("complementary").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    const drawer2 = screen.getAllByRole("complementary")[1];
    fireEvent.click(within(drawer2).getByRole("button", { name: /openAccountMenu/ }));
    fireEvent.click(within(drawer2).getByRole("link", { name: "profile" }));
    expect(screen.getAllByRole("complementary").length).toBe(1);
    fireEvent.click(screen.getAllByRole("button", { name: /openAccountMenu/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    expect(h.replace).toHaveBeenCalledWith("/si");
  });

  it("falls back to placeholders without a user and shows avatars when set", async () => {
    setAuth({ user: null });
    const { unmount } = render(<AdminSidebar locale="en" />);
    await flush();
    expect(screen.getByRole("button", { name: "Admin — openAccountMenu" })).toBeTruthy();
    expect(screen.getAllByText("A").length).toBe(2);
    expect(screen.getByText("—")).toBeTruthy();
    unmount();
    setAuth({ user: mkUser({ avatar: "/av.png" }) });
    render(<AdminSidebar locale="en" />);
    await flush();
    expect(screen.getAllByAltText("Kamal Perera").length).toBe(2);
  });

  it("ignores counts resolved after unmount", async () => {
    let resolve!: (v: any) => void;
    h.notifCount.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { unmount } = render(<AdminSidebar locale="en" />);
    unmount();
    await act(async () => resolve({ unreadCount: 9 }));
    expect(screen.queryByText("9")).toBeNull();
  });

  it("swallows an initial unread fetch failure", async () => {
    h.notifCount.mockRejectedValueOnce(new Error("x"));
    render(<AdminSidebar locale="en" />);
    await flush();
    expect(screen.queryByLabelText(/unread/)).toBeNull();
  });
});

describe("CustomerSidebar", () => {
  beforeEach(() => {
    setAuth({ isAuthenticated: true, user: mkUser() });
    h.pathname = "/en/dashboard";
  });

  it("shows nav with message/notification badges and active state", async () => {
    h.notifCount.mockResolvedValue({ unreadCount: 2 });
    h.msgCount.mockResolvedValue({ unreadCount: 150 });
    render(<CustomerSidebar locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("150 unread")).toBeTruthy());
    expect(screen.getByText("99+")).toBeTruthy();
    const overview = screen.getAllByRole("link", { name: "dashboard" });
    expect(overview.every((l) => l.getAttribute("aria-current") === "page")).toBe(true);
    expect(screen.getAllByRole("link", { name: /trips/ })[0].getAttribute("aria-current")).toBeNull();
    await act(async () => {
      h.streamCb!();
    });
    expect(h.notifCount).toHaveBeenCalledTimes(2);
  });

  it("switches language from the sidebar", async () => {
    h.pathname = "/en/dashboard/trips";
    render(<CustomerSidebar locale="en" />);
    await flush();
    const langBtn = screen.getByRole("button", { name: /English/ });
    expect(langBtn.getAttribute("aria-haspopup")).toBe("listbox");
    fireEvent.click(langBtn);
    const listbox = screen.getByRole("listbox", { name: "Select language" });
    expect(within(listbox).getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.click(within(listbox).getByRole("button", { name: "English" }));
    expect(h.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(langBtn);
    fireEvent.click(screen.getByRole("button", { name: "தமிழ்" }));
    expect(h.push).toHaveBeenCalledWith("/ta/dashboard/trips");
    fireEvent.click(langBtn);
    fireEvent.click(langBtn.parentElement!.querySelector(".fixed.inset-0")!);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("collapses with notification dot and opens the account menu", async () => {
    h.notifCount.mockResolvedValue({ unreadCount: 5 });
    h.msgCount.mockResolvedValue({ unreadCount: 1 });
    const { container } = render(<CustomerSidebar locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("1 unread")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByRole("button", { name: /English/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: "messages" })[0].getAttribute("title")).toBe("messages");
    const pill = screen.getAllByRole("button", { name: "Kamal Perera — open account menu" })[0];
    expect(container.querySelector("aside .h-2\\.5")).toBeTruthy();
    fireEvent.click(pill);
    expect(screen.getByText("5")).toBeTruthy();
    for (const name of ["profile", "settings"]) {
      fireEvent.click(screen.getAllByRole("link", { name })[0]);
      expect(pill.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(pill);
    }
    fireEvent.click(screen.getAllByRole("link", { name: /notifications/ })[0]);
    fireEvent.click(pill);
    fireEvent.click(pill.parentElement!.querySelector(".fixed.inset-0")!);
    fireEvent.click(pill);
    fireEvent.pointerDown(document.body);
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(pill);
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    expect(h.replace).toHaveBeenCalledWith("/en");
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
  });

  it("shows 99+ notifications in the account menu", async () => {
    h.notifCount.mockResolvedValue({ unreadCount: 300 });
    render(<CustomerSidebar locale="en" />);
    await flush();
    fireEvent.click(screen.getAllByRole("button", { name: /open account menu/ })[0]);
    expect(screen.getAllByText("99+").length).toBeGreaterThan(0);
  });

  it("drives the mobile account menu and closes on navigation", async () => {
    h.msgCount.mockResolvedValue({ unreadCount: 7 });
    const { rerender } = render(<CustomerSidebar locale="en" />);
    await flush();
    const trigger = screen.getAllByRole("button", { name: /open account menu/ })[1];
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "profile" });
    expect(within(menu).getByText("kamal@example.lk")).toBeTruthy();
    expect(within(menu).getByText("7")).toBeTruthy();
    expect(within(menu).getAllByRole("menuitem").length).toBe(7);
    fireEvent.click(within(menu).getByRole("menuitem", { name: /reviews/ }));
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menu").parentElement!.querySelector(".fixed.inset-0")!);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    h.pathname = "/en/dashboard/bookings";
    rerender(<CustomerSidebar locale="en" />);
    await flush();
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "logout" }));
    expect(h.auth.logout).toHaveBeenCalled();
  });

  it("handles missing user, avatars and failed counts", async () => {
    h.notifCount.mockRejectedValue(new Error("x"));
    h.msgCount.mockRejectedValue(new Error("y"));
    setAuth({ user: null });
    const { unmount, container } = render(<CustomerSidebar locale="en" />);
    await flush();
    expect(screen.getAllByRole("button", { name: "Account — open account menu" }).length).toBe(2);
    expect(screen.getByText("U")).toBeTruthy();
    await act(async () => {
      h.streamCb!();
    });
    unmount();
    setAuth({ user: mkUser({ avatar: "/c.png" }) });
    const r = render(<CustomerSidebar locale="en" />);
    await flush();
    expect(r.container.querySelectorAll('img[src="/c.png"]').length).toBe(2);
    expect(container).toBeTruthy();
  });

  it("ignores counts resolved after unmount", async () => {
    let rn!: (v: any) => void;
    let rm!: (v: any) => void;
    h.notifCount.mockReturnValueOnce(new Promise((r) => (rn = r)));
    h.msgCount.mockReturnValueOnce(new Promise((r) => (rm = r)));
    const { unmount } = render(<CustomerSidebar locale="en" />);
    unmount();
    await act(async () => {
      rn({ unreadCount: 3 });
      rm(null);
    });
    expect(screen.queryByText("3")).toBeNull();
  });
});

describe("OwnerSidebar", () => {
  beforeEach(() => {
    setAuth({ isAuthenticated: true, user: mkUser({ role: "VEHICLE_OWNER", firstName: "Sunil", lastName: "Fernando" }) });
    h.pathname = "/en/owner/quotations/sent";
  });

  it("keeps incoming quotations inactive on the sent sub-page", async () => {
    render(<OwnerSidebar locale="en" />);
    await flush();
    const quotations = screen.getAllByRole("link", { name: "items.quotations" });
    expect(quotations.every((l) => l.getAttribute("aria-current") === null)).toBe(true);
    expect(screen.getByRole("link", { name: "items.sentQuotes" }).getAttribute("aria-current")).toBe("page");
  });

  it("marks quotations active on the list page and dashboard exact-match", async () => {
    h.pathname = "/en/owner/quotations";
    const { rerender } = render(<OwnerSidebar locale="en" />);
    await flush();
    expect(screen.getAllByRole("link", { name: "items.quotations" })[0].getAttribute("aria-current")).toBe("page");
    h.pathname = "/en/owner/dashboard";
    rerender(<OwnerSidebar locale="en" />);
    await flush();
    expect(screen.getAllByRole("link", { name: "items.dashboard" })[0].getAttribute("aria-current")).toBe("page");
  });

  it("shows badges, 99+, white badge on active item and stream refresh", async () => {
    h.pathname = "/en/owner/messages";
    h.notifCount.mockResolvedValueOnce({ unreadCount: 120 }).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("x"));
    h.msgCount.mockResolvedValue({ unreadCount: 2 });
    render(<OwnerSidebar locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("2 unread")).toBeTruthy());
    expect(screen.getByLabelText("2 unread").className).toContain("bg-white");
    expect(screen.getByLabelText("120 unread").textContent).toBe("99+");
    await act(async () => {
      h.streamCb!();
    });
    expect(screen.queryByLabelText("120 unread")).toBeNull();
    await act(async () => {
      h.streamCb!();
    });
  });

  it("switches language and collapses with titles and dots", async () => {
    h.msgCount.mockResolvedValue({ unreadCount: 1 });
    const { container } = render(<OwnerSidebar locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("1 unread")).toBeTruthy());
    const langBtn = screen.getByRole("button", { name: /English/ });
    fireEvent.click(langBtn);
    fireEvent.click(screen.getByRole("button", { name: "සිංහල" }));
    expect(h.push).toHaveBeenCalledWith("/si/owner/quotations/sent");
    fireEvent.click(langBtn);
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("button", { name: "English" }));
    expect(h.push).toHaveBeenCalledTimes(1);
    fireEvent.click(langBtn);
    fireEvent.click(langBtn.parentElement!.querySelector(".fixed.inset-0")!);
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "collapseSidebar" }));
    expect(screen.getAllByRole("link", { name: "items.fleet" })[0].getAttribute("title")).toBe("items.fleet");
    expect(container.querySelector("aside .h-2.w-2")).toBeTruthy();
    expect(container.querySelector("aside .h-2\\.5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "expandSidebar" }));
  });

  it("opens the desktop account menu and its links/logout", async () => {
    render(<OwnerSidebar locale="en" />);
    await flush();
    const pill = screen.getAllByRole("button", { name: "Sunil Fernando — openAccountMenu" })[0];
    fireEvent.click(pill);
    fireEvent.click(screen.getByRole("link", { name: "profile" }));
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(pill);
    fireEvent.click(screen.getAllByRole("link", { name: "items.settings" })[0]);
    fireEvent.click(pill);
    fireEvent.click(pill.parentElement!.querySelector(".fixed.inset-0")!);
    fireEvent.click(pill);
    fireEvent.pointerDown(document.body);
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(pill);
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    expect(h.replace).toHaveBeenCalledWith("/en");
  });

  it("drives the mobile account menu", async () => {
    h.notifCount.mockResolvedValue({ unreadCount: 101 });
    const { container } = render(<OwnerSidebar locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("101 unread")).toBeTruthy());
    const trigger = screen.getAllByRole("button", { name: /openAccountMenu/ })[1];
    expect(trigger.querySelector(".h-2\\.5")).toBeTruthy();
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").length).toBe(12);
    expect(within(menu).getByText("99+")).toBeTruthy();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /items.drivers/ }));
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menu").parentElement!.querySelector(".fixed.inset-0")!);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "logout" }));
    expect(h.auth.logout).toHaveBeenCalled();
    expect(container).toBeTruthy();
  });

  it("handles missing user, avatars and late responses", async () => {
    setAuth({ user: null });
    h.params = {};
    const first = render(<OwnerSidebar locale="ta" />);
    await flush();
    expect(screen.getAllByRole("button", { name: "Owner — openAccountMenu" }).length).toBe(2);
    expect(screen.getByText("O")).toBeTruthy();
    expect(screen.getByRole("button", { name: /தமிழ்/ })).toBeTruthy();
    first.unmount();
    setAuth({ user: mkUser({ avatar: "/o.png" }) });
    let rn!: (v: any) => void;
    let rm!: (v: any) => void;
    h.notifCount.mockReturnValueOnce(new Promise((r) => (rn = r)));
    h.msgCount.mockReturnValueOnce(new Promise((r) => (rm = r)));
    const second = render(<OwnerSidebar locale="en" />);
    expect(second.container.querySelectorAll('img[src="/o.png"]').length).toBe(2);
    second.unmount();
    await act(async () => {
      rn({ unreadCount: 1 });
      rm({ unreadCount: 1 });
    });
    h.notifCount.mockRejectedValueOnce(new Error("a"));
    h.msgCount.mockRejectedValueOnce(new Error("b"));
    render(<OwnerSidebar locale="en" />);
    await flush();
    expect(screen.queryByLabelText(/unread/)).toBeNull();
  });

  it("labels the language list as a language picker", async () => {
    render(<OwnerSidebar locale="en" />);
    await flush();

    fireEvent.click(screen.getAllByRole("button", { name: /English/ })[0]);

    expect(screen.getByRole("listbox", { name: "selectLanguage" })).toBeTruthy();
  });
});
