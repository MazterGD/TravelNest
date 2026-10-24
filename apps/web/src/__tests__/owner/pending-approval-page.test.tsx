/**
 * Owner pending-approval page: auth/role redirects, the verification
 * timeline and registration details, reduced-motion handling and logout.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  store: {} as any,
  push: vi.fn(),
  logout: vi.fn(),
  reducedMotion: false,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: state.push, replace: vi.fn() }),
  usePathname: () => "/en/owner/pending-approval",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => state.t, useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("motion/react", () => ({
  useReducedMotion: () => state.reducedMotion,
  motion: { span: ({ initial, animate, transition, ...rest }: any) => <span data-testid="pulse" {...rest} /> },
}));
vi.mock("@/store", () => ({ useAuthStore: () => state.store }));

import PendingApprovalPage from "@/app/[locale]/owner/pending-approval/page";

const owner = {
  firstName: "Kamal",
  lastName: "Silva",
  email: "kamal@x.lk",
  role: "VEHICLE_OWNER",
  isVerified: false,
  createdAt: "2026-10-01T10:00:00.000Z",
};

describe("PendingApprovalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.reducedMotion = false;
    state.store = { user: owner, isAuthenticated: true, isLoading: false, logout: state.logout };
  });

  it("redirects unauthenticated visitors to login", () => {
    state.store = { user: null, isAuthenticated: false, isLoading: false, logout: state.logout };
    render(<PendingApprovalPage />);
    expect(state.push).toHaveBeenCalledWith("/en/login");
    expect(screen.queryByText("title")).toBeNull();
  });

  it("waits while auth is loading", () => {
    state.store = { user: null, isAuthenticated: false, isLoading: true, logout: state.logout };
    render(<PendingApprovalPage />);
    expect(state.push).not.toHaveBeenCalled();
  });

  it("sends verified owners to the dashboard and other roles to the customer dashboard", () => {
    state.store = { ...state.store, user: { ...owner, isVerified: true } };
    const { unmount } = render(<PendingApprovalPage />);
    expect(state.push).toHaveBeenCalledWith("/en/owner/dashboard");
    unmount();
    state.push.mockClear();
    state.store = { ...state.store, user: { ...owner, role: "CUSTOMER" } };
    render(<PendingApprovalPage />);
    expect(state.push).toHaveBeenCalledWith("/en/dashboard");
  });

  it("renders the timeline, details, restrictions and support links", () => {
    render(<PendingApprovalPage />);
    expect(state.push).not.toHaveBeenCalled();
    expect(screen.getByText("title")).toBeTruthy();
    expect(screen.getByTestId("pulse")).toBeTruthy();
    expect(screen.getByText("timeline.submittedTitle")).toBeTruthy();
    expect(screen.getByText("timeline.approvedTitle")).toBeTruthy();
    expect(screen.getByText("Kamal Silva")).toBeTruthy();
    expect(screen.getByText("kamal@x.lk")).toBeTruthy();
    expect(screen.getByText("restrictions.item5")).toBeTruthy();
    expect(screen.getByText("nextSteps.step4")).toBeTruthy();
    expect(screen.getByText("support.emailSupport").closest("a")?.getAttribute("href")).toBe("mailto:support@travenest.lk");
    expect(screen.getByText("footer.backHome").closest("a")?.getAttribute("href")).toBe("/en");
    expect(screen.getByText(/footer.submittedOn/)).toBeTruthy();
  });

  it("skips the pulse animation for reduced motion and logs out", () => {
    state.reducedMotion = true;
    render(<PendingApprovalPage />);
    expect(screen.queryByTestId("pulse")).toBeNull();
    fireEvent.click(screen.getByText("footer.logout"));
    expect(state.logout).toHaveBeenCalled();
    expect(state.push).toHaveBeenCalledWith("/en/login");
  });
});
