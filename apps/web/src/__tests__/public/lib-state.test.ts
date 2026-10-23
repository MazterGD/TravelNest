/**
 * Client state: auth-storage persistence, zustand stores, the notification
 * socket singleton and the next-intl request config with English fallback.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const socketMock = vi.hoisted(() => ({
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
}));
const ioMock = vi.hoisted(() => vi.fn(() => socketMock));
vi.mock("socket.io-client", () => ({ io: ioMock }));
vi.mock("next-intl/server", () => ({
  getRequestConfig: (fn: unknown) => fn,
}));

import {
  AUTH_STORAGE_KEY,
  clearAuthRaw,
  hasPersistedSession,
  isRemembered,
  readAuthRaw,
  setAccessToken,
  setRemembered,
  writeAuthRaw,
} from "@/lib/auth-storage";
import { useAuthStore, useBookingStore, useQuotationStore } from "@/store";
import { subscribeToNotifications } from "@/lib/realtime/notificationSocket";
import requestConfig from "@/i18n/request";
import { UserRole, type User } from "@/types";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setAccessToken(null);
});

describe("auth-storage", () => {
  it("defaults to remembered and persists to localStorage", () => {
    expect(isRemembered()).toBe(true);
    writeAuthRaw("blob");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe("blob");
    expect(readAuthRaw()).toBe("blob");
  });

  it("moves the session to sessionStorage when remember-me is off", () => {
    writeAuthRaw("blob");
    setRemembered(false);
    expect(isRemembered()).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBe("blob");
    setRemembered(true);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe("blob");
    clearAuthRaw();
    expect(readAuthRaw()).toBeNull();
    setRemembered(false);
    expect(readAuthRaw()).toBeNull();
  });

  it("detects a persisted session and tolerates corrupt data", () => {
    expect(hasPersistedSession()).toBe(false);
    localStorage.setItem(AUTH_STORAGE_KEY, "{not json");
    expect(hasPersistedSession()).toBe(false);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ state: { isAuthenticated: true } }),
    );
    expect(hasPersistedSession()).toBe(true);
  });
});

describe("useAuthStore", () => {
  it("logs in, updates, checks roles and logs out", () => {
    const s = useAuthStore.getState();
    s.updateUser({ firstName: "x" });
    expect(useAuthStore.getState().user).toBeNull();

    s.login({ id: "u1", role: UserRole.ADMIN, firstName: "A" } as User, "tok");
    expect(useAuthStore.getState().isAdmin()).toBe(true);
    expect(useAuthStore.getState().isCustomer()).toBe(false);
    expect(useAuthStore.getState().isVehicleOwner()).toBe(false);
    s.updateUser({ firstName: "B" });
    expect(useAuthStore.getState().user?.firstName).toBe("B");

    s.setToken("t2");
    expect(useAuthStore.getState().token).toBe("t2");
    s.setUser(null);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    s.setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
    s.setHasHydrated(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
    s.logout();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("rehydrates from storage and clears it on removal", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        state: { user: { id: "u9", role: UserRole.CUSTOMER }, isAuthenticated: true },
        version: 0,
      }),
    );
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().user?.id).toBe("u9");
    expect(useAuthStore.getState()._hasHydrated).toBe(true);
    useAuthStore.persist.clearStorage();
    expect(readAuthRaw()).toBeNull();
  });
});

describe("useBookingStore", () => {
  it("manages bookings and splits upcoming from past", () => {
    const s = useBookingStore.getState();
    const future = { id: "f", startDate: "2999-01-01", endDate: "2999-01-02" } as any;
    const past = { id: "p", startDate: "2000-01-01", endDate: "2000-01-02" } as any;
    s.setBookings([past]);
    s.addBooking(future);
    expect(useBookingStore.getState().bookings.map((b) => b.id)).toEqual(["f", "p"]);
    s.updateBooking("p", { vehicleName: "Bus" });
    expect(useBookingStore.getState().bookings[1].vehicleName).toBe("Bus");
    expect(useBookingStore.getState().getUpcomingBookings().map((b) => b.id)).toEqual(["f"]);
    expect(useBookingStore.getState().getPastBookings().map((b) => b.id)).toEqual(["p"]);
    s.setActiveBooking(future);
    s.setLoading(true);
    s.setError("e");
    s.setStatusFilter("all");
    s.setDateFilter("past");
    expect(useBookingStore.getState().dateFilter).toBe("past");
    expect(useBookingStore.getState().error).toBe("e");
    s.reset();
    expect(useBookingStore.getState().bookings).toEqual([]);
    expect(useBookingStore.getState().activeBooking).toBeNull();
  });
});

describe("useQuotationStore", () => {
  it("manages requests and received quotations", () => {
    const s = useQuotationStore.getState();
    s.setRequests([{ id: "a" } as any]);
    s.addRequest({ id: "b" } as any);
    s.updateRequest("a", { status: "quoted" });
    expect(useQuotationStore.getState().requests.map((r) => r.id)).toEqual(["b", "a"]);
    expect(useQuotationStore.getState().requests[1].status).toBe("quoted");
    s.setActiveRequest({ id: "a" } as any);
    s.setReceivedQuotations([{ id: "q" } as any]);
    s.setSelectedQuotation({ id: "q" } as any);
    s.setLoading(true);
    s.setError("x");
    s.setRequestFilter("pending");
    s.setQuotationFilter("sent");
    expect(useQuotationStore.getState().quotationFilter).toBe("sent");
    s.reset();
    expect(useQuotationStore.getState().requests).toEqual([]);
    expect(useQuotationStore.getState().requestFilter).toBe("all");
  });
});

describe("notification socket", () => {
  it("shares one socket, fans out events and disconnects after the last unsubscribe", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeToNotifications(a);
    const unsubB = subscribeToNotifications(b);
    expect(ioMock).toHaveBeenCalledTimes(1);
    const [url, opts] = ioMock.mock.calls[0] as any[];
    expect(url).toBe("http://localhost:5000");
    expect(opts.withCredentials).toBe(true);

    const authCb = vi.fn();
    opts.auth(authCb);
    expect(authCb).toHaveBeenCalledWith({});
    setAccessToken("tok");
    opts.auth(authCb);
    expect(authCb).toHaveBeenLastCalledWith({ token: "tok" });

    const handler = socketMock.on.mock.calls[0][1];
    handler();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    expect(socketMock.disconnect).not.toHaveBeenCalled();
    unsubB();
    expect(socketMock.off).toHaveBeenCalledWith("notification:new", handler);
    expect(socketMock.disconnect).toHaveBeenCalledTimes(1);

    subscribeToNotifications(a)();
    expect(ioMock).toHaveBeenCalledTimes(2);
  });
});

describe("i18n request config", () => {
  const run = (locale: string | undefined) =>
    (requestConfig as any)({ requestLocale: Promise.resolve(locale) });

  it("serves English as-is and falls back to English for unknown locales", async () => {
    const en = await run("en");
    expect(en.locale).toBe("en");
    const unknown = await run("fr");
    expect(unknown.locale).toBe("en");
    const none = await run(undefined);
    expect(none.locale).toBe("en");
  });

  it("deep-merges English underneath Sinhala so missing keys fall back", async () => {
    const en = (await run("en")).messages;
    const si = await run("si");
    expect(si.locale).toBe("si");
    expect(Object.keys(si.messages).length).toBeGreaterThanOrEqual(
      Object.keys(en).length,
    );
    const ta = await run("ta");
    expect(ta.locale).toBe("ta");
  });
});
