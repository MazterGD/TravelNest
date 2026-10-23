/**
 * ApiClient: response unwrapping, error mapping, CSRF handling, token refresh
 * (reactive on TOKEN_EXPIRED and proactive on a timer) and uploads.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API = "http://localhost:5000/api/v1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Module state (refresh queue, cached CSRF token) must not leak across tests.
const load = async () => {
  vi.resetModules();
  const client = await import("@/lib/api/client");
  const storage = await import("@/lib/auth-storage");
  return { ...client, storage };
};

const jwt = (exp: number) =>
  `h.${btoa(JSON.stringify({ exp })).replace(/=+$/, "")}.s`;

let fetchMock: any;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  // Any fetch not explicitly stubbed fails instead of reaching a real server.
  fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => Promise.reject(new Error("unexpected fetch")));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const headersOf = (call: number) =>
  (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<string, string>;

describe("ApiError", () => {
  it("classifies auth and validation errors", async () => {
    const { ApiError } = await load();
    const auth = new ApiError(401, "no");
    expect(auth.code).toBe("UNKNOWN_ERROR");
    expect(auth.isStatus(401)).toBe(true);
    expect(auth.isAuthError()).toBe(true);
    expect(new ApiError(200, "x", "TOKEN_EXPIRED").isAuthError()).toBe(true);
    expect(auth.isValidationError()).toBe(false);
    expect(auth.getValidationErrors()).toEqual({});

    const v = new ApiError(
      400,
      "bad",
      "VALIDATION_ERROR",
      [{ field: "email", message: "Invalid" }],
      { timestamp: "t", requestId: "r" },
    );
    expect(v.getValidationErrors()).toEqual({ email: "Invalid" });
    expect(v.requestId).toBe("r");
    expect(new ApiError(422, "x", "C", "not-array").getValidationErrors()).toEqual({});
    expect(v instanceof ApiError).toBe(true);
  });
});

describe("api requests", () => {
  it("unwraps data and sends JSON, auth and tracing headers", async () => {
    const { api, storage } = await load();
    storage.setAccessToken("tok");
    fetchMock.mockResolvedValueOnce(json({ success: true, data: { a: 1 } }));

    const res = await api.get("/things", { cache: "no-store", tags: ["t"] });

    expect(res).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe(`${API}/things`);
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.next).toEqual({ tags: ["t"] });
    expect(init.body).toBeUndefined();
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["X-Request-ID"]).toMatch(/^web_/);
  });

  it("returns an empty object for 204 responses", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api.get("/x")).toEqual({});
  });

  it("sends the cookie CSRF token and body on mutations", async () => {
    const { api } = await load();
    document.cookie = "csrf-token=abc%20123";
    fetchMock.mockImplementation(async () => json({ success: true, data: 1 }));

    await api.post("/p", { x: 1 });
    await api.put("/p", { y: 2 });
    await api.patch("/p");

    expect(headersOf(0)["x-csrf-token"]).toBe("abc 123");
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe('{"x":1}');
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("PUT");
    expect((fetchMock.mock.calls[2][1] as RequestInit).body).toBeUndefined();
  });

  it("fetches and caches a CSRF token when the cookie is unreadable", async () => {
    const { api } = await load();
    fetchMock
      .mockResolvedValueOnce(json({ data: { csrfToken: "from-api" } }))
      .mockResolvedValueOnce(json({ success: true, data: 1 }))
      .mockResolvedValueOnce(json({ success: true, data: 2 }));

    await api.post("/a", {}, { skipAuth: true });
    await api.post("/b", {}, { skipAuth: true });

    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/auth/csrf-token`);
    expect(headersOf(1)["x-csrf-token"]).toBe("from-api");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(headersOf(2)["x-csrf-token"]).toBe("from-api");
  });

  it("proceeds without CSRF when the token endpoint fails", async () => {
    const { api } = await load();
    fetchMock
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(json({ success: true, data: 1 }));
    await api.post("/a");
    expect(headersOf(1)["x-csrf-token"]).toBeUndefined();
  });

  it("refreshes a stale CSRF token once on a 403 CSRF error", async () => {
    const { api } = await load();
    fetchMock
      .mockResolvedValueOnce(json({ data: { csrfToken: "old" } }))
      .mockResolvedValueOnce(
        json({ success: false, error: { message: "Invalid CSRF token" } }, 403),
      )
      .mockResolvedValueOnce(json({ data: { csrfToken: "new" } }))
      .mockResolvedValueOnce(json({ success: true, data: "ok" }));

    expect(await api.post("/a")).toBe("ok");
    expect(headersOf(3)["x-csrf-token"]).toBe("new");
  });

  it("maps API error bodies to ApiError with defaults", async () => {
    const { api, ApiError } = await load();
    fetchMock.mockResolvedValueOnce(
      json(
        {
          success: false,
          error: { message: "Nope", code: "FORBIDDEN", details: [1] },
          meta: { requestId: "rq" },
        },
        403,
      ),
    );
    const err: any = await api.get("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Nope");
    expect(err.code).toBe("FORBIDDEN");
    expect(err.requestId).toBe("rq");

    fetchMock.mockResolvedValueOnce(json({ success: false }, 500));
    const err2: any = await api.get("/x").catch((e: unknown) => e);
    expect(err2.message).toBe("An error occurred");
    expect(err2.code).toBe("UNKNOWN_ERROR");
  });

  it("maps timeouts, network failures and unknown errors", async () => {
    const { api } = await load();
    const abort = new Error("aborted");
    abort.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abort);
    await expect(api.get("/x")).rejects.toMatchObject({ status: 408, code: "REQUEST_TIMEOUT" });

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api.get("/x")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });

    fetchMock.mockRejectedValueOnce(new Error("boom"));
    await expect(api.get("/x")).rejects.toMatchObject({ status: 500, message: "boom" });

    fetchMock.mockRejectedValueOnce("weird");
    await expect(api.get("/x")).rejects.toMatchObject({
      message: "An unexpected error occurred",
    });
  });

  it("aborts requests that exceed the timeout", async () => {
    const { api } = await load();
    fetchMock.mockImplementationOnce(
      (_url: unknown, init: unknown) =>
        new Promise((_res, rej) => {
          (init as RequestInit).signal!.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            rej(e);
          });
        }),
    );
    await expect(api.get("/slow", { timeout: 5 })).rejects.toMatchObject({ status: 408 });
  });
});

describe("token refresh", () => {
  it("refreshes on TOKEN_EXPIRED and retries with the new token", async () => {
    const { api, storage } = await load();
    storage.setAccessToken("old");
    fetchMock
      .mockResolvedValueOnce(
        json({ success: false, error: { code: "TOKEN_EXPIRED", message: "exp" } }, 401),
      )
      .mockResolvedValueOnce(json({ data: { accessToken: "new" } }))
      .mockResolvedValueOnce(json({ success: true, data: "done" }));

    expect(await api.get("/me")).toBe("done");
    expect(fetchMock.mock.calls[1][0]).toBe(`${API}/auth/refresh-token`);
    expect(headersOf(2).Authorization).toBe("Bearer new");
    expect(storage.getAccessToken()).toBe("new");
  });

  it("queues concurrent requests behind a single refresh", async () => {
    const { api, storage } = await load();
    storage.setAccessToken("old");
    let releaseRefresh: (r: Response) => void = () => {};
    fetchMock.mockImplementation(async (url: unknown, init: unknown) => {
      const auth = ((init as RequestInit)?.headers as any)?.Authorization;
      if (String(url).endsWith("/auth/refresh-token")) {
        return new Promise<Response>((r) => (releaseRefresh = r));
      }
      if (auth === "Bearer old") {
        return json({ success: false, error: { code: "TOKEN_EXPIRED" } }, 401);
      }
      return json({ success: true, data: String(url) });
    });

    const p1 = api.get("/one");
    const p2 = api.get("/two");
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((c: any[]) => String(c[0]).endsWith("refresh-token")).length,
      ).toBe(1),
    );
    await new Promise((r) => setTimeout(r, 0));
    releaseRefresh(json({ data: { accessToken: "new" } }));
    expect(await p1).toBe(`${API}/one`);
    expect(await p2).toBe(`${API}/two`);
  });

  it("signs out and rejects queued requests when the refresh fails", async () => {
    const { api, storage } = await load();
    storage.setAccessToken("old");
    localStorage.setItem(storage.AUTH_STORAGE_KEY, "{}");
    const onAuthError = vi.fn();
    window.addEventListener("auth:error", onAuthError);
    fetchMock
      .mockResolvedValueOnce(json({ success: false, error: { code: "TOKEN_EXPIRED" } }, 401))
      .mockResolvedValueOnce(json({ data: {} }));

    await expect(api.get("/me")).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
    expect(onAuthError).toHaveBeenCalled();
    expect(storage.getAccessToken()).toBeNull();
    expect(localStorage.getItem(storage.AUTH_STORAGE_KEY)).toBeNull();
    window.removeEventListener("auth:error", onAuthError);
  });

  it("does not refresh for skipAuth requests", async () => {
    const { api } = await load();
    document.cookie = "csrf-token=c";
    fetchMock.mockResolvedValueOnce(
      json({ success: false, error: { code: "TOKEN_EXPIRED" } }, 401),
    );
    await expect(api.post("/auth/login", {}, { skipAuth: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock.mock.calls.some((c: any[]) => String(c[0]).includes("refresh-token"))).toBe(false);
  });

  it("proactively refreshes tokens close to expiry and stops without a token", async () => {
    const { api, storage } = await load();
    vi.useFakeTimers();
    storage.setAccessToken(jwt(Math.floor(Date.now() / 1000) + 60));
    fetchMock.mockImplementation(async () =>
      json({ data: { accessToken: jwt(Math.floor(Date.now() / 1000) + 3600) } }),
    );

    api.startTokenRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    storage.setAccessToken(null);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    api.stopTokenRefresh();
  });

  it("treats undecodable tokens as expiring and reports refresh failures", async () => {
    const { api, storage } = await load();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onAuthError = vi.fn();
    window.addEventListener("auth:error", onAuthError);
    storage.setAccessToken("not-a-jwt");
    fetchMock.mockResolvedValueOnce(json({}, 401));

    api.startTokenRefresh();
    await vi.waitFor(() => expect(onAuthError).toHaveBeenCalled());
    window.removeEventListener("auth:error", onAuthError);

    storage.setAccessToken("a.%%%.c");
    fetchMock.mockResolvedValueOnce(json({ data: { accessToken: "n" } }));
    api.startTokenRefresh();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    api.stopTokenRefresh();
  });
});

describe("authHeaders and upload", () => {
  it("returns only auth for GET and resumes a persisted session", async () => {
    const { api, storage } = await load();
    expect(await api.authHeaders()).toEqual({});
    localStorage.setItem(
      storage.AUTH_STORAGE_KEY,
      JSON.stringify({ state: { isAuthenticated: true } }),
    );
    fetchMock.mockResolvedValueOnce(json({ data: { accessToken: "resumed" } }));
    expect(await api.authHeaders("GET")).toEqual({ Authorization: "Bearer resumed" });
  });

  it("fetches a CSRF token for mutating raw requests and reports a failed resume", async () => {
    const { api, storage } = await load();
    localStorage.setItem(
      storage.AUTH_STORAGE_KEY,
      JSON.stringify({ state: { isAuthenticated: true } }),
    );
    const onAuthError = vi.fn();
    window.addEventListener("auth:error", onAuthError);
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ data: { csrfToken: "c9" } }));

    expect(await api.authHeaders("DELETE")).toEqual({ "x-csrf-token": "c9" });
    expect(onAuthError).toHaveBeenCalled();
    window.removeEventListener("auth:error", onAuthError);

    fetchMock.mockResolvedValueOnce(json({ data: {} }));
    vi.resetModules();
    const fresh = await import("@/lib/api/client");
    expect(await fresh.api.authHeaders("POST")).toEqual({});
  });

  it("uploads form data with auth and CSRF and maps failures", async () => {
    const { api, storage } = await load();
    storage.setAccessToken("tok");
    document.cookie = "csrf-token=c1";
    const fd = new FormData();
    fd.append("f", "v");
    fetchMock.mockResolvedValueOnce(json({ success: true, data: { url: "u" } }));
    expect(await api.upload("/up", fd)).toEqual({ url: "u" });
    const init = fetchMock.mock.calls[0][1] as any;
    expect(init.body).toBe(fd);
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["x-csrf-token"]).toBe("c1");
    expect(init.headers["Content-Type"]).toBeUndefined();

    fetchMock.mockResolvedValueOnce(json({ success: false }, 413));
    await expect(api.upload("/up", fd, { skipAuth: true })).rejects.toMatchObject({
      status: 413,
      code: "UPLOAD_ERROR",
      message: "Upload failed",
    });

    fetchMock.mockResolvedValueOnce(
      json({ success: false, error: { message: "Too big", code: "SIZE" } }, 413),
    );
    await expect(api.upload("/up", fd)).rejects.toMatchObject({ code: "SIZE" });
  });

  it("uploads without auth headers when signed out", async () => {
    const { api } = await load();
    fetchMock
      .mockResolvedValueOnce(json({ data: {} }))
      .mockResolvedValueOnce(json({ success: true, data: 1 }));
    await api.upload("/up", new FormData());
    expect(headersOf(1).Authorization).toBeUndefined();
    expect(headersOf(1)["x-csrf-token"]).toBeUndefined();
  });
});
