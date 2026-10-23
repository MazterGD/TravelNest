/**
 * Component tests for the shared dashboard NotificationList: loading/error/
 * empty states, category tabs (incl. arrow-key navigation), unread filter,
 * mark-read / delete / clear-all actions, deep links and pagination.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class ApiError extends Error {}
  // Stable like real next-intl: `t` is a useCallback dependency in the component.
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;
  return {
    ApiError,
    t,
    push: vi.fn(),
    confirm: vi.fn(),
    streamCb: null as null | (() => void),
    svc: {
      getAll: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      delete: vi.fn(),
      deleteAll: vi.fn(),
    },
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => h.t,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("next/link", () => ({ default: ({ children }: any) => <a>{children}</a> }));
vi.mock("@/hooks", () => ({
  useDialogPrompts: () => ({ confirm: h.confirm, dialogs: <div data-testid="dialogs" /> }),
  useNotificationStream: (cb: () => void) => {
    h.streamCb = cb;
  },
}));
vi.mock("@/lib/api", () => ({ ApiError: h.ApiError, notificationService: h.svc }));

import { NotificationList } from "@/components/dashboard/NotificationList";

const note = (over: any = {}) => ({
  id: "n1",
  title: "Booking confirmed",
  message: "Your trip is set",
  category: "Bookings",
  type: "info",
  isRead: false,
  createdAt: "2026-10-01T10:00:00Z",
  data: null,
  ...over,
});

const listResponse = (notifications: any[], pagination: any = { total: notifications.length, totalPages: 1 }) => ({
  notifications,
  pagination,
});

beforeEach(() => {
  h.push.mockReset();
  h.confirm.mockReset();
  h.streamCb = null;
  for (const fn of Object.values(h.svc)) fn.mockReset().mockResolvedValue(undefined);
});

const lastQuery = () => h.svc.getAll.mock.calls[h.svc.getAll.mock.calls.length - 1][0];

describe("NotificationList", () => {
  it("shows a spinner, then the empty state", async () => {
    let resolve!: (v: any) => void;
    h.svc.getAll.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { container } = render(<NotificationList />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.getByTestId("dialogs")).toBeTruthy();
    await act(async () => resolve({}));
    expect(screen.getByText("empty")).toBeTruthy();
    expect(screen.getByText("emptyDesc")).toBeTruthy();
    expect(lastQuery()).toEqual({ page: 1, limit: 20, category: undefined, unreadOnly: undefined });
    expect(screen.queryByRole("button", { name: "markAllRead" })).toBeNull();
    expect(screen.queryByRole("button", { name: "clearAll" })).toBeNull();
  });

  it("shows API and generic load errors with retry", async () => {
    h.svc.getAll
      .mockRejectedValueOnce(new h.ApiError("Server down"))
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce(listResponse([note()]));
    render(<NotificationList />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Server down"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "retry" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("loadError");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "retry" }));
    });
    expect(screen.getByText("Booking confirmed")).toBeTruthy();
  });

  it("renders rows with i18n content, icons per category and pagination text", async () => {
    h.svc.getAll.mockResolvedValue(
      listResponse(
        [
          note({ data: { _i18n: { titleKey: "events.t", messageKey: "events.m", params: { code: "B-1" } } } }),
          note({ id: "n2", category: "Payments", isRead: true, title: "Paid", data: { _i18n: { titleKey: "x" } } }),
          note({ id: "n3", category: "Reviews", title: "Review" }),
          note({ id: "n4", category: "Quotations", title: "Quote" }),
          note({ id: "n5", category: "System", type: "warning", title: "Warn" }),
          note({ id: "n6", category: "System", type: "error", title: "Err" }),
          note({ id: "n7", category: "System", type: "info", title: "Info", isRead: true }),
        ],
        { total: 47, totalPages: 3 },
      ),
    );
    const { container } = render(<NotificationList />);
    await waitFor(() => expect(screen.getByText('events.t:{"code":"B-1"}')).toBeTruthy());
    expect(screen.getByText('events.m:{"code":"B-1"}')).toBeTruthy();
    expect(screen.getByText("Paid")).toBeTruthy();
    expect(container.querySelectorAll(".bg-\\[var\\(--color-error-bg\\)\\]").length).toBe(2);
    expect(container.querySelector(".bg-\\[var\\(--color-success-bg\\)\\]")).toBeTruthy();
    expect(screen.getByText('pagination.showing:{"count":"1–20","total":47}')).toBeTruthy();
    expect(screen.getByText('pagination.pageOf:{"page":1,"totalPages":3}')).toBeTruthy();
    expect(screen.getByText("Paid").closest('[role="button"]')).toBeNull();
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe("2026-10-01T10:00:00Z");
  });

  it("switches tabs by click and arrow/Home/End keys, resetting to page 1", async () => {
    h.svc.getAll.mockResolvedValue(listResponse([]));
    render(<NotificationList />);
    await act(async () => {});
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(6);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("tabindex")).toBe("-1");
    await act(async () => {
      fireEvent.click(tabs[2]);
    });
    expect(lastQuery().category).toBe("Payments");
    const calls = h.svc.getAll.mock.calls.length;
    fireEvent.click(tabs[2]);
    expect(h.svc.getAll.mock.calls.length).toBe(calls);
    await act(async () => {
      fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
    });
    expect(lastQuery().category).toBe("Quotations");
    expect(document.activeElement).toBe(tabs[3]);
    await act(async () => {
      fireEvent.keyDown(tabs[3], { key: "ArrowLeft" });
    });
    expect(lastQuery().category).toBe("Payments");
    await act(async () => {
      fireEvent.keyDown(tabs[2], { key: "End" });
    });
    expect(lastQuery().category).toBe("System");
    await act(async () => {
      fireEvent.keyDown(tabs[5], { key: "ArrowRight" });
    });
    expect(lastQuery().category).toBeUndefined();
    await act(async () => {
      fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    });
    expect(lastQuery().category).toBe("System");
    await act(async () => {
      fireEvent.keyDown(tabs[5], { key: "Home" });
    });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    const before = h.svc.getAll.mock.calls.length;
    fireEvent.keyDown(tabs[0], { key: "a" });
    expect(h.svc.getAll.mock.calls.length).toBe(before);
  });

  it("filters unread only with its own empty copy", async () => {
    h.svc.getAll.mockResolvedValue(listResponse([]));
    render(<NotificationList />);
    await act(async () => {});
    const filter = screen.getByRole("button", { name: "unreadOnly" });
    expect(filter.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      fireEvent.click(filter);
    });
    expect(filter.getAttribute("aria-pressed")).toBe("true");
    expect(lastQuery().unreadOnly).toBe(true);
    expect(screen.getByText("emptyUnread")).toBeTruthy();
    expect(screen.getByText("emptyUnreadDesc")).toBeTruthy();
  });

  it("marks a row read on click/keyboard and deep-links when resolvable", async () => {
    h.svc.getAll.mockResolvedValue(
      listResponse([note(), note({ id: "n2", isRead: true, title: "Read linked" }), note({ id: "n3", title: "Third" })]),
    );
    const resolveHref = vi.fn((n: any) => (n.id === "n3" ? null : `/en/dashboard/bookings/${n.id}`));
    render(<NotificationList resolveHref={resolveHref} />);
    await waitFor(() => expect(screen.getByText("Booking confirmed")).toBeTruthy());
    const row1 = screen.getByText("Booking confirmed").closest('[role="button"]')!;
    await act(async () => {
      fireEvent.click(row1);
    });
    expect(h.svc.markAsRead).toHaveBeenCalledWith("n1");
    expect(h.push).toHaveBeenCalledWith("/en/dashboard/bookings/n1");
    const row2 = screen.getByText("Read linked").closest('[role="button"]')!;
    await act(async () => {
      fireEvent.keyDown(row2, { key: "Enter" });
    });
    expect(h.svc.markAsRead).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenLastCalledWith("/en/dashboard/bookings/n2");
    const row3 = screen.getByText("Third").closest('[role="button"]')!;
    fireEvent.keyDown(row3, { key: "x" });
    await act(async () => {
      fireEvent.keyDown(row3, { key: " " });
    });
    expect(h.svc.markAsRead).toHaveBeenLastCalledWith("n3");
    expect(h.push).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Third").closest('[role="button"]')).toBeNull();
  });

  it("shows a dismissible action error when marking read fails", async () => {
    h.svc.getAll.mockResolvedValue(listResponse([note()]));
    h.svc.markAsRead.mockRejectedValue(new Error("x"));
    render(<NotificationList />);
    await waitFor(() => expect(screen.getByText("Booking confirmed")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText("Booking confirmed").closest('[role="button"]')!);
    });
    expect(screen.getByRole("alert").textContent).toContain("actionError");
    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("marks all as read and re-syncs, or reports failure", async () => {
    h.svc.getAll.mockResolvedValue(listResponse([note(), note({ id: "n2" })]));
    h.svc.markAllAsRead.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("x"));
    render(<NotificationList />);
    await waitFor(() => expect(screen.getByRole("button", { name: "markAllRead" })).toBeTruthy());
    const calls = h.svc.getAll.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "markAllRead" }));
    });
    expect(h.svc.markAllAsRead).toHaveBeenCalledTimes(1);
    expect(h.svc.getAll.mock.calls.length).toBe(calls + 1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "markAllRead" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("actionError");
  });

  it("skips mark-all when nothing is unread", async () => {
    h.svc.getAll.mockResolvedValueOnce(listResponse([note()])).mockResolvedValue(listResponse([note({ isRead: true })]));
    render(<NotificationList />);
    await waitFor(() => expect(screen.getByRole("button", { name: "markAllRead" })).toBeTruthy());
    const btn = screen.getByRole("button", { name: "markAllRead" });
    h.svc.markAsRead.mockResolvedValue(undefined);
    await act(async () => {
      h.streamCb!();
    });
    fireEvent.click(btn);
    expect(h.svc.markAllAsRead).not.toHaveBeenCalled();
  });

  it("deletes a row, steps back a page when the page empties, and reports failures", async () => {
    h.svc.getAll.mockImplementation(async ({ page }: any) =>
      page === 2
        ? listResponse([note({ id: "p2", title: "Last on page 2" })], { total: 21, totalPages: 2 })
        : listResponse([note({ title: "Page 1 item" })], { total: 21, totalPages: 2 }),
    );
    render(<NotificationList />);
    await waitFor(() => expect(screen.getByText("Page 1 item")).toBeTruthy());
    const prev = screen.getByRole("button", { name: "pagination.previous" }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
    });
    expect(screen.getByText("Last on page 2")).toBeTruthy();
    expect((screen.getByRole("button", { name: "pagination.next" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('pagination.showing:{"count":"21–21","total":21}')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "delete" }));
    });
    expect(h.svc.delete).toHaveBeenCalledWith("p2");
    await waitFor(() => expect(screen.getByText("Page 1 item")).toBeTruthy());
    expect(lastQuery().page).toBe(1);
    h.svc.delete.mockRejectedValueOnce(new Error("x"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "delete" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("actionError");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "pagination.previous" }));
    });
    expect(lastQuery().page).toBe(1);
  });

  it("deletes the only row on page 1 without paging", async () => {
    h.svc.getAll.mockResolvedValue(listResponse([note()], { total: 1, totalPages: 1 }));
    render(<NotificationList />);
    await waitFor(() => expect(screen.getByText("Booking confirmed")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "delete" }));
    });
    expect(screen.getByText("empty")).toBeTruthy();
    expect(lastQuery().page).toBe(1);
  });

  it("clears all after confirmation, respects cancel and reports failure", async () => {
    h.svc.getAll.mockResolvedValue(listResponse([note()], { total: 5, totalPages: 1 }));
    h.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    h.svc.deleteAll.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(undefined);
    render(<NotificationList />);
    await waitFor(() => expect(screen.getByRole("button", { name: "clearAll" })).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "clearAll" }));
    });
    expect(h.confirm).toHaveBeenCalledWith({
      title: "clearAllTitle",
      message: "clearAllConfirm",
      confirmText: "clearAll",
      variant: "danger",
    });
    expect(h.svc.deleteAll).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "clearAll" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("actionError");
    expect(screen.getByText("Booking confirmed")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "clearAll" }));
    });
    expect(h.svc.deleteAll).toHaveBeenCalledTimes(2);
    expect(screen.getByText("empty")).toBeTruthy();
  });

  it("refreshes when a live notification arrives", async () => {
    h.svc.getAll.mockResolvedValueOnce(listResponse([])).mockResolvedValueOnce(listResponse([note({ title: "Fresh" })]));
    render(<NotificationList />);
    await act(async () => {});
    await act(async () => {
      h.streamCb!();
    });
    expect(screen.getByText("Fresh")).toBeTruthy();
  });
});
