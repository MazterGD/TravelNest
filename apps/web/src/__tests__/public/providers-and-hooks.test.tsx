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
import { getErrorMessage, useApiErrorHandler } from "@/hooks/useApiErrorHandler";
import { useAsync, useFetch, useMutation } from "@/hooks/useAsync";
import { useForm } from "@/hooks/useForm";
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

describe("useApiErrorHandler", () => {
  it("maps codes to friendly messages with fallbacks", () => {
    expect(getErrorMessage("NETWORK_ERROR")).toMatch(/Unable to connect/);
    expect(getErrorMessage("NOPE", "server said")).toBe("server said");
    expect(getErrorMessage("NOPE")).toBe("An unexpected error occurred");
  });

  it("toasts friendly, validation and generic errors and calls onError", () => {
    const onError = vi.fn();
    const { result } = renderHook(
      () => ({ h: useApiErrorHandler({ onError, ignoreErrorCodes: ["IGNORED"] }), t: useToast() }),
      { wrapper },
    );

    act(() => result.current.h.handleError(new ApiError(0, "x", "NETWORK_ERROR"), "Loading"));
    expect(result.current.t.toasts[0]).toMatchObject({
      title: "Error: Loading",
      message: expect.stringMatching(/Unable to connect/),
    });

    act(() =>
      result.current.h.handleError(
        new ApiError(422, "bad", "VALIDATION_ERROR", [
          { field: "a", message: "A is bad" },
          { field: "b", message: "B is bad" },
        ]),
      ),
    );
    expect(result.current.t.toasts[1].message).toBe("A is bad, B is bad");

    act(() => result.current.h.handleError(new ApiError(422, "bad", "VALIDATION_ERROR")));
    expect(result.current.t.toasts[2].message).toBe("Please check the form for errors");

    act(() => result.current.h.handleError(new Error("plain")));
    expect(result.current.t.toasts[3]).toMatchObject({ title: "Error", message: "plain" });

    act(() => result.current.h.handleError("str"));
    expect(result.current.t.toasts[4].message).toBe("An unexpected error occurred");

    act(() => result.current.h.handleError(new ApiError(400, "x", "IGNORED")));
    act(() => result.current.h.handleError(null));
    expect(result.current.t.toasts.length).toBe(5);
    expect(onError).toHaveBeenCalledTimes(5);
  });

  it("logs in development, can skip toasts and wraps async functions", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(
      () => ({ h: useApiErrorHandler({ showToast: false }), t: useToast() }),
      { wrapper },
    );
    const wrapped = result.current.h.withErrorHandling(async (n: number) => {
      if (n < 0) throw new ApiError(500, "neg", "INTERNAL_ERROR");
      return n * 2;
    }, "Doubling");

    expect(await wrapped(2)).toBe(4);
    let out: number | null = 0;
    await act(async () => {
      out = await wrapped(-1);
    });
    expect(out).toBeNull();
    expect(result.current.t.toasts.length).toBe(0);
    expect(log.mock.calls[0][0]).toBe("[API Error]");
  });
});

describe("useAsync family", () => {
  it("tracks success, error, reset and setData", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    let fail = false;
    const fn = vi.fn(async (x: number) => {
      if (fail) throw new Error("bad");
      return x + 1;
    });
    const { result } = renderHook(() => useAsync<number, [number]>(fn, { onSuccess, onError }));
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      expect(await result.current.execute(1)).toBe(2);
    });
    expect(result.current.data).toBe(2);
    expect(result.current.isSuccess).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith(2);

    fail = true;
    await act(async () => {
      expect(await result.current.execute(1)).toBeNull();
    });
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("bad");
    expect(onError).toHaveBeenCalled();

    act(() => result.current.setData(9));
    expect(result.current.data).toBe(9);
    act(() => result.current.reset());
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("keeps ApiErrors, wraps non-errors and ignores concurrent runs", async () => {
    const apiErr = new ApiError(404, "nf", "RESOURCE_NOT_FOUND");
    const { result } = renderHook(() => useAsync(() => Promise.reject(apiErr)));
    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.error).toBe(apiErr);

    const { result: r2 } = renderHook(() => useAsync(() => Promise.reject("x")));
    await act(async () => {
      await r2.current.execute();
    });
    expect(r2.current.error?.message).toBe("An error occurred");

    let resolve: (v: number) => void = () => {};
    const slow = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const { result: r3 } = renderHook(() => useAsync(slow));
    let first: Promise<unknown>;
    await act(async () => {
      first = r3.current.execute();
      expect(await r3.current.execute()).toBeNull();
      resolve(5);
      await first;
    });
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("does not update state after unmount", async () => {
    let resolve: (v: number) => void = () => {};
    let reject: (e: Error) => void = () => {};
    const onSuccess = vi.fn();
    const ok = renderHook(() =>
      useAsync(() => new Promise<number>((r) => (resolve = r)), { onSuccess }),
    );
    const p = ok.result.current.execute();
    ok.unmount();
    resolve(1);
    expect(await p).toBe(1);
    expect(onSuccess).not.toHaveBeenCalled();

    const onError = vi.fn();
    const bad = renderHook(() =>
      useAsync(() => new Promise<number>((_r, j) => (reject = j)), { onError }),
    );
    const p2 = bad.result.current.execute();
    bad.unmount();
    reject(new Error("late"));
    expect(await p2).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("useFetch runs immediately and on an interval; useMutation exposes mutate", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => "data");
    const { result, unmount } = renderHook(() =>
      useFetch(fetcher, { refetchInterval: 1000 }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).toBe("data");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    unmount();

    renderHook(() => useFetch(fetcher));
    const m = renderHook(() => useMutation(async (x: number) => x * 3));
    await act(async () => {
      expect(await m.result.current.mutate(2)).toBe(6);
    });
    expect(m.result.current.mutateAsync).toBe(m.result.current.mutate);
  });
});

describe("useForm", () => {
  const schema = z.object({
    name: z.string().min(2, "Too short"),
    email: z.string().email("Bad email").min(5, "Also short"),
  });

  it("validates, reports first error per field, submits and resets", async () => {
    const onSubmit = vi.fn();
    const initial = { name: "", email: "x" };
    const { result } = renderHook(() =>
      useForm({ schema, initialValues: initial, onSubmit }),
    );

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toEqual({ name: "Too short", email: "Bad email" });

    act(() =>
      result.current.getFieldProps("name").onChange({ target: { value: "Nimal" } } as any),
    );
    expect(result.current.errors.name).toBeUndefined();
    act(() => result.current.setValues({ email: "nimal@x.lk" }));
    expect(result.current.getFieldProps("email").value).toBe("nimal@x.lk");

    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledWith({ name: "Nimal", email: "nimal@x.lk" });
    expect(result.current.isSubmitting).toBe(false);

    act(() => result.current.reset());
    expect(result.current.values).toBe(initial);
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
