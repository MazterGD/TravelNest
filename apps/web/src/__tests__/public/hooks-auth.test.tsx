/**
 * Authentication hooks: session bootstrap and auth actions (useAuth), route
 * guards with redirects (useAuthGuard, useProtectedRoute).
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const nav = vi.hoisted(() => ({ params: { locale: "en" } as Record<string, string>, pathname: "/en/dashboard/trips" }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => nav.params,
  usePathname: () => nav.pathname,
}));

const authService = vi.hoisted(() => ({
  refreshToken: vi.fn(),
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));
const userService = vi.hoisted(() => ({ updatePersonalInfo: vi.fn() }));
const apiStub = vi.hoisted(() => ({ startTokenRefresh: vi.fn(), stopTokenRefresh: vi.fn() }));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { authService, userService, api: apiStub, ApiError };
});

import {
  useAdminGuard,
  useAuthGuard,
  useAuthRequired,
  useCustomerGuard,
  useGuestGuard,
  useOwnerGuard,
} from "@/hooks/useAuthGuard";
import {
  useAdminRoute,
  useCustomerRoute,
  useOwnerOrAdminRoute,
  useProtectedRoute,
  useVehicleOwnerRoute,
} from "@/hooks/useProtectedRoute";
import { useAuthStore } from "@/store";
import { ApiError } from "@/lib/api/client";
import { AUTH_STORAGE_KEY } from "@/lib/auth-storage";
import { UserRole, type User } from "@/types";

const customer = { id: "c1", role: UserRole.CUSTOMER, isVerified: true } as User;
const owner = { id: "o1", role: UserRole.VEHICLE_OWNER, isVerified: true } as User;

const setAuth = (user: User | null, isLoading = false) =>
  useAuthStore.setState({ user, isAuthenticated: !!user, isLoading });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  nav.params = { locale: "en" };
  setAuth(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAuthGuard", () => {
  it("waits while auth is loading", () => {
    setAuth(null, true);
    const { result } = renderHook(() => useAuthRequired());
    expect(result.current).toEqual({ isLoading: true, isAuthorized: false });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends signed-out users to login and authorizes signed-in users", async () => {
    nav.params = {};
    const { result } = renderHook(() => useAuthRequired());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/login"));
    expect(result.current.isAuthorized).toBe(false);

    act(() => setAuth(customer));
    await waitFor(() => expect(result.current.isAuthorized).toBe(true));
  });

  it("bounces signed-in users away from guest pages", async () => {
    setAuth(owner);
    renderHook(() => useGuestGuard());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/owner/dashboard"));

    router.replace.mockClear();
    renderHook(() => useAuthGuard({ type: "guest", redirectTo: "/en/custom" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/custom"));

    setAuth(null);
    const { result } = renderHook(() => useGuestGuard());
    expect(result.current.isAuthorized).toBe(true);
  });

  it("enforces roles and holds unverified owners", async () => {
    setAuth(customer);
    const admin = renderHook(() => useAdminGuard());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/dashboard"));
    expect(admin.result.current.isAuthorized).toBe(false);

    expect(renderHook(() => useCustomerGuard()).result.current.isAuthorized).toBe(true);

    router.replace.mockClear();
    setAuth({ ...owner, isVerified: false });
    renderHook(() => useOwnerGuard());
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/en/owner/pending-approval"),
    );

    router.replace.mockClear();
    setAuth(null);
    renderHook(() => useAuthGuard({ type: "role", redirectTo: "/en/x" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/x"));

    setAuth(owner);
    const anyRole = renderHook(() => useAuthGuard({ type: "role" }));
    expect(anyRole.result.current.isAuthorized).toBe(true);
  });
});

describe("useProtectedRoute", () => {
  it("waits for auth and then redirects to login with a return URL", () => {
    setAuth(null, true);
    renderHook(() => useProtectedRoute());
    expect(router.replace).not.toHaveBeenCalled();

    setAuth(null);
    nav.params = {};
    renderHook(() => useProtectedRoute());
    expect(router.replace).toHaveBeenCalledWith(
      "/en/login?returnUrl=%2Fen%2Fdashboard%2Ftrips",
    );

    renderHook(() => useProtectedRoute({ redirectTo: "/si/login" }));
    expect(router.replace).toHaveBeenLastCalledWith(
      "/si/login?returnUrl=%2Fen%2Fdashboard%2Ftrips",
    );

    window.history.pushState({}, "", "/en/dashboard/packages?book=pkg1");
    renderHook(() => useProtectedRoute());
    expect(router.replace).toHaveBeenLastCalledWith(
      "/en/login?returnUrl=%2Fen%2Fdashboard%2Ftrips%3Fbook%3Dpkg1",
    );
    window.history.pushState({}, "", "/");
  });

  it("authorizes matching roles and redirects the wrong role", () => {
    setAuth(customer);
    const ok = renderHook(() => useCustomerRoute());
    expect(ok.result.current).toMatchObject({ isAuthorized: true, user: customer });
    expect(router.replace).not.toHaveBeenCalled();

    const any = renderHook(() => useProtectedRoute());
    expect(any.result.current.isAuthorized).toBe(true);

    const admin = renderHook(() => useAdminRoute());
    expect(admin.result.current.isAuthorized).toBe(false);
    expect(router.replace).toHaveBeenLastCalledWith("/");

    renderHook(() => useVehicleOwnerRoute());
    expect(router.replace).toHaveBeenLastCalledWith("/dashboard");
    renderHook(() => useOwnerOrAdminRoute());
    expect(router.replace).toHaveBeenLastCalledWith("/dashboard");
  });
});
