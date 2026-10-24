/**
 * Admin shell: guard-gated layout with route-derived mobile title, and the
 * server redirect pages for /admin, /admin/reviews and /admin/verifications.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pathname: "/en/admin/users",
  guard: { isLoading: false, isAuthorized: true },
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useParams: () => ({ locale: "si" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (...args: unknown[]) => state.redirect(...args),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/hooks", () => ({
  useAdminGuard: () => state.guard,
}));

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: ({ locale }: { locale: string }) => <nav data-testid="sidebar">{locale}</nav>,
}));

vi.mock("@/components/ui", () => ({
  LoadingSpinner: () => <div data-testid="spinner" />,
}));

import AdminLayout from "@/app/[locale]/admin/layout";
import AdminRootPage from "@/app/[locale]/admin/page";
import AdminReviewsRootPage from "@/app/[locale]/admin/reviews/page";
import AdminVerificationsRootPage from "@/app/[locale]/admin/verifications/page";

describe("AdminLayout", () => {
  beforeEach(() => {
    state.guard = { isLoading: false, isAuthorized: true };
    state.pathname = "/en/admin/users";
  });

  it("shows a spinner while the guard is loading", () => {
    state.guard = { isLoading: true, isAuthorized: false };
    render(<AdminLayout>child</AdminLayout>);
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(screen.queryByText("child")).toBeNull();
  });

  it("shows a spinner when the user is not authorised", () => {
    state.guard = { isLoading: false, isAuthorized: false };
    render(<AdminLayout>child</AdminLayout>);
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(screen.queryByTestId("sidebar")).toBeNull();
  });

  it.each([
    ["/en/admin/users", "items.users"],
    ["/en/admin/verifications/vehicles/abc", "items.vehicleVerifications"],
    ["/en/admin/reviews/moderation", "items.reviewModeration"],
    ["/en/admin/audit-logs", "items.auditLogs"],
    ["/en/admin/unknown", "items.dashboard"],
  ])("renders children with the page title for %s", (path: string, key: string) => {
    state.pathname = path;
    render(<AdminLayout>child content</AdminLayout>);
    expect(screen.getByText("child content")).toBeTruthy();
    expect(screen.getByText(key)).toBeTruthy();
    expect(screen.getByTestId("sidebar").textContent).toBe("si");
    expect(screen.getByText("breadcrumbRoot")).toBeTruthy();
  });
});

describe("admin redirect pages", () => {
  beforeEach(() => state.redirect.mockClear());

  it("redirects /admin to the dashboard", async () => {
    await AdminRootPage({ params: Promise.resolve({ locale: "ta" }) });
    expect(state.redirect).toHaveBeenCalledWith("/ta/admin/dashboard");
  });

  it("redirects /admin/reviews to moderation", async () => {
    await AdminReviewsRootPage({ params: Promise.resolve({ locale: "en" }) });
    expect(state.redirect).toHaveBeenCalledWith("/en/admin/reviews/moderation");
  });

  it("redirects /admin/verifications to owner verifications", async () => {
    await AdminVerificationsRootPage({ params: Promise.resolve({ locale: "si" }) });
    expect(state.redirect).toHaveBeenCalledWith("/si/admin/verifications/owners");
  });
});
