/**
 * Access-token handling (WEB-1, WEB-5): the token lives in memory only, a
 * persisted session is resumed through the refresh cookie, and requests
 * waiting on a failed refresh are rejected instead of hanging.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import {
  AUTH_STORAGE_KEY,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth-storage";
import { useAuthStore } from "@/store/authStore";
import { UserRole, type User } from "@/types";

const API = "http://localhost:5000/api/v1";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const persistSession = () =>
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ state: { user: { id: "u1" }, isAuthenticated: true } }),
  );

describe("access token storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAccessToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the token in memory and out of web storage", () => {
    useAuthStore
      .getState()
      .login({ id: "u1", role: UserRole.CUSTOMER } as User, "secret-token");

    expect(getAccessToken()).toBe("secret-token");
    const persisted = localStorage.getItem(AUTH_STORAGE_KEY) ?? "";
    expect(persisted).not.toContain("secret-token");
    expect(JSON.parse(persisted).state.isAuthenticated).toBe(true);

    useAuthStore.getState().logout();
    expect(getAccessToken()).toBeNull();
  });

  it("resumes a persisted session through the refresh cookie", async () => {
    persistSession();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: "fresh-token" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ok: 1 } }));

    await api.get("/bookings/my-bookings");

    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/auth/refresh-token`);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${API}/bookings/my-bookings`);
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer fresh-token",
    );
  });

  it("gives raw downloads the token and CSRF header for POST exports", async () => {
    setAccessToken("download-token");
    document.cookie = "csrf-token=csrf-123";

    const headers = await api.authHeaders("POST");

    expect(headers).toEqual({
      Authorization: "Bearer download-token",
      "x-csrf-token": "csrf-123",
    });
    document.cookie = "csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("signals a sign-out when the session cannot be resumed", async () => {
    persistSession();
    const onAuthError = vi.fn();
    window.addEventListener("auth:error", onAuthError);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, error: { code: "UNAUTHORIZED", message: "No token" } },
          401,
        ),
      );

    await expect(api.get("/bookings/my-bookings")).rejects.toMatchObject({
      status: 401,
    });
    expect(onAuthError).toHaveBeenCalled();
    window.removeEventListener("auth:error", onAuthError);
  });
});
