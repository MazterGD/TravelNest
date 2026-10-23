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

import { useAuth } from "@/hooks/useAuth";
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

describe("useAuth bootstrap", () => {
  it("does nothing without a persisted session", async () => {
    renderHook(() => useAuth());
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it("resumes a persisted session through the refresh cookie", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ state: { isAuthenticated: true } }));
    authService.refreshToken.mockResolvedValue({ accessToken: "fresh" });
    authService.me.mockResolvedValue({ user: customer });

    const { result, unmount } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.user?.id).toBe("c1"));
    expect(result.current.token).toBe("fresh");
    expect(apiStub.startTokenRefresh).toHaveBeenCalled();
    unmount();
    expect(apiStub.stopTokenRefresh).toHaveBeenCalled();
  });

  it("clears the session when the refresh fails", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ state: { isAuthenticated: true } }));
    authService.refreshToken.mockRejectedValue(new Error("expired"));
    setAuth(customer);

    renderHook(() => useAuth());

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    // The store re-persists its signed-out state after the blob is cleared.
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "{}");
    expect(stored.state?.isAuthenticated ?? false).toBe(false);
    expect(apiStub.stopTokenRefresh).toHaveBeenCalled();
  });

  it("signs out and redirects to login on a global auth:error", async () => {
    setAuth(customer);
    renderHook(() => useAuth());
    act(() => {
      window.dispatchEvent(new CustomEvent("auth:error"));
    });
    expect(useAuthStore.getState().user).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/en/login?session=expired");
  });
});

describe("useAuth actions", () => {
  const validation = new ApiError(422, "Invalid", "VALIDATION_ERROR", [
    { field: "email", message: "Bad email" },
  ]);

  it("logs in and registers, starting token refresh", async () => {
    authService.login.mockResolvedValue({ user: customer, accessToken: "t1" });
    authService.register.mockResolvedValue({ user: owner, accessToken: "t2" });
    const { result } = renderHook(() => useAuth());

    let res: any;
    await act(async () => {
      res = await result.current.login({ email: "a@b.lk", password: "p" });
    });
    expect(res).toEqual({ success: true });
    expect(useAuthStore.getState().user?.id).toBe("c1");

    await act(async () => {
      res = await result.current.register({ registrationToken: "r" } as any);
    });
    expect(res).toEqual({ success: true });
    expect(authService.register).toHaveBeenCalledWith({ registrationToken: "r" });
    expect(apiStub.startTokenRefresh).toHaveBeenCalledTimes(2);
  });

  it("returns structured errors for API, generic and unknown failures", async () => {
    const { result } = renderHook(() => useAuth());
    const cases: Array<[keyof typeof authService, () => Promise<any>, string]> = [
      ["login", () => result.current.login({} as any), "Login failed"],
      ["register", () => result.current.register({} as any), "Registration failed"],
      ["changePassword", () => result.current.changePassword("a", "b"), "Password change failed"],
      ["forgotPassword", () => result.current.forgotPassword("a@b.lk"), "Request failed"],
      ["resetPassword", () => result.current.resetPassword("tok", "pw"), "Reset failed"],
    ];

    for (const [method, call, fallback] of cases) {
      authService[method].mockRejectedValueOnce(validation);
      let res: any;
      await act(async () => {
        res = await call();
      });
      expect(res).toMatchObject({ success: false, error: "Invalid", code: "VALIDATION_ERROR" });

      authService[method].mockRejectedValueOnce(new ApiError(401, "Nope", "INVALID_CREDENTIALS"));
      await act(async () => {
        res = await call();
      });
      expect(res.validationErrors).toBeUndefined();

      authService[method].mockRejectedValueOnce(new Error("boom"));
      await act(async () => {
        res = await call();
      });
      expect(res).toEqual({ success: false, error: "boom" });

      authService[method].mockRejectedValueOnce("??");
      await act(async () => {
        res = await call();
      });
      expect(res).toEqual({ success: false, error: fallback });

      authService[method].mockResolvedValueOnce({});
      await act(async () => {
        res = await call();
      });
      expect(res.success).toBe(true);
    }

    authService.login.mockRejectedValueOnce(validation);
    let res: any;
    await act(async () => {
      res = await result.current.login({} as any);
    });
    expect(res.validationErrors).toEqual({ email: "Bad email" });
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("updates the profile only when signed in", async () => {
    const { result, rerender } = renderHook(() => useAuth());
    let res: any;
    await act(async () => {
      res = await result.current.updateProfile({ firstName: "X" });
    });
    expect(res).toEqual({ success: false, error: "Not authenticated", code: "UNAUTHORIZED" });

    act(() => setAuth(customer));
    rerender();
    userService.updatePersonalInfo.mockResolvedValueOnce({ ...customer, firstName: "X" });
    await act(async () => {
      res = await result.current.updateProfile({ firstName: "X" });
    });
    expect(res.success).toBe(true);
    expect(useAuthStore.getState().user?.firstName).toBe("X");

    for (const [err, expected] of [
      [new ApiError(422, "Invalid", "VALIDATION_ERROR", [{ field: "f", message: "m" }]), { validationErrors: { f: "m" } }],
      [new ApiError(500, "Server", "INTERNAL_ERROR"), { error: "Server", validationErrors: undefined }],
      [new Error("plain"), { error: "plain" }],
      [42, { error: "Update failed" }],
    ] as const) {
      userService.updatePersonalInfo.mockRejectedValueOnce(err);
      await act(async () => {
        res = await result.current.updateProfile({ firstName: "Y" });
      });
      expect(res).toMatchObject({ success: false, ...expected });
    }
  });

  it("logs out even when the API call fails and drops cached API responses", async () => {
    const cacheDelete = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { delete: cacheDelete });
    setAuth(customer);
    authService.logout.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(cacheDelete).toHaveBeenCalledWith("cross-origin");
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("logs out without the Cache API", async () => {
    vi.stubGlobal("caches", undefined);
    authService.logout.mockResolvedValueOnce({});
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.logout();
    });
    expect(router.push).toHaveBeenCalledWith("/");
  });
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
