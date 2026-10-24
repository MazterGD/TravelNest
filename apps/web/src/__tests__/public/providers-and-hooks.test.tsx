/**
 * Toast and error-boundary providers plus the generic hooks built on them:
 * API error handling, async state, forms, utility hooks and the live
 * notification stream.
 */
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const subscribeMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/realtime/notificationSocket", () => ({
  subscribeToNotifications: subscribeMock,
}));

import { ToastProvider, useToast } from "@/components/providers/ToastProvider";
import { ErrorBoundary, withErrorBoundary } from "@/components/providers/ErrorBoundary";
import { ClientErrorBoundary } from "@/components/providers/ClientErrorBoundary";
import { ErrorFallback } from "@/components/providers/ErrorFallback";
import {
  useClickOutside,
  useDebounce,
  useLocalStorage,
  useMediaQuery,
  usePrevious,
  useToggle,
  useWindowSize,
} from "@/hooks/useUtils";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { ApiError } from "@/lib/api";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ToastProvider", () => {
  function Buttons() {
    const t = useToast();
    return (
      <div>
        <button onClick={() => t.success("Saved", "All good")}>s</button>
        <button onClick={() => t.error("Oops")}>e</button>
        <button onClick={() => t.warning("Careful")}>w</button>
        <button onClick={() => t.info("FYI")}>i</button>
        <button onClick={() => t.addToast({ type: "info", title: "Sticky", duration: 0, dismissible: false })}>
          sticky
        </button>
        <button onClick={() => t.clearAll()}>clear</button>
      </div>
    );
  }

  it("shows, auto-dismisses, manually dismisses and clears toasts", () => {
    vi.useFakeTimers();
    render(<Buttons />, { wrapper });
    expect(screen.queryByRole("region")).toBeNull();

    fireEvent.click(screen.getByText("s"));
    fireEvent.click(screen.getByText("e"));
    fireEvent.click(screen.getByText("w"));
    fireEvent.click(screen.getByText("i"));
    fireEvent.click(screen.getByText("sticky"));
    expect(screen.getAllByRole("alert").length).toBe(5);
    expect(screen.getByText("All good")).toBeTruthy();
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getAllByLabelText("Dismiss notification").length).toBe(4);

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.getByText("Oops")).toBeTruthy();

    fireEvent.click(screen.getAllByLabelText("Dismiss notification")[0]);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Oops")).toBeNull();

    fireEvent.click(screen.getByText("clear"));
    expect(screen.queryByText("Sticky")).toBeNull();
  });

  it("throws when used outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used within a ToastProvider",
    );
  });
});

describe("ErrorBoundary", () => {
  let shouldThrow = true;
  function Bomb() {
    if (shouldThrow) throw new Error("kaboom");
    return <p>recovered</p>;
  }

  beforeEach(() => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders the default fallback and resets", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(onError.mock.calls[0][0].message).toBe("kaboom");
    shouldThrow = false;
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("recovered")).toBeTruthy();
  });

  it("supports node and render-function fallbacks and the HOC", () => {
    render(
      <ErrorBoundary fallback={<p>static fallback</p>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("static fallback")).toBeTruthy();

    const Wrapped = withErrorBoundary(Bomb, (err) => <p>fn: {err.message}</p>);
    expect(Wrapped.displayName).toBe("WithErrorBoundary(Bomb)");
    render(<Wrapped />);
    expect(screen.getByText("fn: kaboom")).toBeTruthy();

    const Anon = withErrorBoundary((() => null) as any);
    expect(Anon.displayName).toMatch(/^WithErrorBoundary\(/);
    const Named = withErrorBoundary(Object.assign(() => null, { displayName: "Nice" }));
    expect(Named.displayName).toBe("WithErrorBoundary(Nice)");
  });

  it("uses the full-page fallback in ClientErrorBoundary", () => {
    render(
      <ClientErrorBoundary>
        <Bomb />
      </ClientErrorBoundary>,
    );
    expect(screen.getByText("Go to Home")).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("recovered")).toBeTruthy();
  });

  it("shows error details only in development and links home", () => {
    vi.stubEnv("NODE_ENV", "development");
    const reset = vi.fn();
    render(<ErrorFallback error={new Error("detail msg")} reset={reset} />);
    expect(screen.getByText("Error Details (Development)")).toBeTruthy();
    fireEvent.click(screen.getByText("Go to Home"));
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalled();
  });
});

describe("utility hooks", () => {
  it("useDebounce delays value updates", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("b");
    const d = renderHook(() => useDebounce(1));
    expect(d.result.current).toBe(1);
  });

  it("useLocalStorage reads, writes, supports updaters and survives bad data", () => {
    localStorage.setItem("k", JSON.stringify(5));
    const { result } = renderHook(() => useLocalStorage("k", 0));
    expect(result.current[0]).toBe(5);
    act(() => result.current[1]((p) => p + 1));
    expect(localStorage.getItem("k")).toBe("6");
    act(() => result.current[1](10));
    expect(result.current[0]).toBe(10);

    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("bad", "{oops");
    expect(renderHook(() => useLocalStorage("bad", "init")).result.current[0]).toBe("init");
    expect(renderHook(() => useLocalStorage("missing", "init")).result.current[0]).toBe("init");

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const w = renderHook(() => useLocalStorage("q", 1));
    act(() => w.result.current[1](2));
    expect(err).toHaveBeenCalledTimes(2);
  });

  it("useClickOutside fires only for outside clicks", () => {
    const cb = vi.fn();
    function Box() {
      const ref = useClickOutside<HTMLDivElement>(cb);
      return (
        <div>
          <div ref={ref}>inside</div>
          <span>outside</span>
        </div>
      );
    }
    const { unmount } = render(<Box />);
    fireEvent.mouseDown(screen.getByText("inside"));
    expect(cb).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(cb).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("useWindowSize follows resize events", () => {
    const { result } = renderHook(() => useWindowSize());
    act(() => {
      (window as any).innerWidth = 375;
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.width).toBe(375);
  });

  it("useMediaQuery subscribes to matchMedia changes", () => {
    const listeners: Array<() => void> = [];
    let matches = false;
    const mql = {
      get matches() {
        return matches;
      },
      addEventListener: (_: string, l: () => void) => listeners.push(l),
      removeEventListener: vi.fn(),
    };
    (window as any).matchMedia = vi.fn(() => mql);
    const { result, unmount } = renderHook(() => useMediaQuery("(min-width: 640px)"));
    expect(result.current).toBe(false);
    act(() => {
      matches = true;
      listeners.forEach((l) => l());
    });
    expect(result.current).toBe(true);
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });

  it("usePrevious and useToggle", () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), {
      initialProps: { v: 1 },
    });
    expect(result.current).toBeUndefined();
    rerender({ v: 2 });
    expect(result.current).toBe(1);

    const t = renderHook(() => useToggle());
    expect(t.result.current[0]).toBe(false);
    act(() => t.result.current[1]());
    expect(t.result.current[0]).toBe(true);
  });
});

describe("useNotificationStream", () => {
  it("subscribes once and always calls the latest callback", () => {
    const unsub = vi.fn();
    subscribeMock.mockReturnValue(unsub);
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ cb }) => useNotificationStream(cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    subscribeMock.mock.calls[0][0]();
    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});
