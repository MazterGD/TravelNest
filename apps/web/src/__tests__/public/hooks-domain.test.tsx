/**
 * Domain hooks: bookings and quotations (store-backed API actions), the
 * realtime chat hook and the promise-based prompt/confirm dialogs.
 */
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

type Handler = (...args: any[]) => void;
const socket = vi.hoisted(() => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  return {
    handlers,
    on: vi.fn((ev: string, h: (...args: any[]) => void) => {
      handlers[ev] = h;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
});
const ioMock = vi.hoisted(() => vi.fn(() => socket));
vi.mock("socket.io-client", () => ({ io: ioMock }));

const bookingService = vi.hoisted(() => ({
  getMyBookings: vi.fn(),
  getOwnerBookings: vi.fn(),
  getById: vi.fn(),
  cancel: vi.fn(),
  confirmBooking: vi.fn(),
  startTrip: vi.fn(),
  complete: vi.fn(),
}));
const paymentService = vi.hoisted(() => ({
  createPaymentIntent: vi.fn(),
  confirmPayment: vi.fn(),
}));
const messageService = vi.hoisted(() => ({
  listConversations: vi.fn(),
  listMessages: vi.fn(),
  markRead: vi.fn(),
  sendMessage: vi.fn(),
  openConversation: vi.fn(),
}));
const apiStub = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { bookingService, paymentService, messageService, api: apiStub, ApiError };
});

import { useChat } from "@/hooks/useChat";
import { useDialogPrompts } from "@/hooks/useDialogPrompts";
import { useAuthStore, useBookingStore, useQuotationStore } from "@/store";
import { ApiError } from "@/lib/api/client";
import { setAccessToken } from "@/lib/auth-storage";

beforeEach(() => {
  vi.clearAllMocks();
  useBookingStore.getState().reset();
  useQuotationStore.getState().reset();
});

describe("useChat", () => {
  const convo = (id: string, at: string | null, extra: Record<string, unknown> = {}) => ({
    id,
    lastMessageAt: at,
    lastMessage: null,
    unreadCount: 0,
    ...extra,
  });
  const page = (conversations: unknown[], p = 1, total = 1) => ({
    conversations,
    pagination: { page: p, totalPages: total },
  });
  const msgs = (messages: unknown[], p = 1, total = 1) => ({
    messages,
    pagination: { page: p, totalPages: total },
  });
  const msg = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    conversationId: "c1",
    senderId: "other",
    content: `m-${id}`,
    readAt: null,
    createdAt: "2026-06-03T10:00:00Z",
    ...extra,
  });

  beforeEach(() => {
    useAuthStore.setState({ user: { id: "me" } as any });
    for (const k of Object.keys(socket.handlers)) delete socket.handlers[k];
    messageService.markRead.mockResolvedValue({});
  });

  it("loads the first page of conversations, paginates and filters unread", async () => {
    messageService.listConversations
      .mockResolvedValueOnce(page([convo("c1", "2026-06-03")], 1, 2))
      .mockResolvedValueOnce(page([convo("c1", null), convo("c2", null)], 2, 2));
    const { result } = renderHook(() => useChat());

    await waitFor(() => expect(result.current.conversationsLoading).toBe(false));
    expect(messageService.listConversations).toHaveBeenCalledWith({ page: 1, limit: 6, unreadOnly: false });
    expect(result.current.conversationsHasMore).toBe(true);

    act(() => result.current.loadMoreConversations());
    await waitFor(() => expect(result.current.conversations.map((c) => c.id)).toEqual(["c1", "c2"]));
    expect(result.current.conversationsHasMore).toBe(false);
    act(() => result.current.loadMoreConversations());
    expect(messageService.listConversations).toHaveBeenCalledTimes(2);

    messageService.listConversations.mockResolvedValueOnce(page([]));
    act(() => result.current.setUnreadOnly(true));
    await waitFor(() =>
      expect(messageService.listConversations).toHaveBeenLastCalledWith({ page: 1, limit: 6, unreadOnly: true }),
    );
    expect(result.current.unreadOnly).toBe(true);
  });

  it("surfaces conversation load errors and keeps the list on pagination errors", async () => {
    messageService.listConversations.mockRejectedValueOnce(new Error("x"));
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversationsError).toBe("loadError"));

    messageService.listConversations.mockResolvedValueOnce(page([convo("c1", null)], 1, 3));
    await act(async () => {
      await result.current.refresh();
    });
    messageService.listConversations.mockRejectedValueOnce(new Error("x"));
    act(() => result.current.loadMoreConversations());
    await waitFor(() => expect(result.current.conversationsLoadingMore).toBe(false));
    expect(result.current.conversations.length).toBe(1);
    expect(result.current.conversationsHasMore).toBe(true);
  });

  it("selects a conversation, joins its room, loads messages and marks read", async () => {
    messageService.listConversations.mockResolvedValue(page([convo("c1", null, { unreadCount: 3 })]));
    messageService.listMessages
      .mockResolvedValueOnce(msgs([msg("m2")], 1, 2))
      .mockResolvedValueOnce(msgs([msg("m1"), msg("m2")], 2, 2));
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversations.length).toBe(1));

    act(() => result.current.selectConversation("c1"));
    const [ev, room, ack] = socket.emit.mock.calls[0];
    expect([ev, room]).toEqual(["conversation:join", "c1"]);
    ack(true);
    await waitFor(() => expect(result.current.messagesLoading).toBe(false));
    expect(result.current.activeMessages.map((m) => m.id)).toEqual(["m2"]);
    expect(messageService.markRead).toHaveBeenCalledWith("c1");
    expect(result.current.conversations[0].unreadCount).toBe(0);

    act(() => result.current.loadOlderMessages());
    await waitFor(() => expect(result.current.activeMessages.map((m) => m.id)).toEqual(["m1", "m2"]));
    expect(result.current.messagesHasMore).toBe(false);
    act(() => result.current.loadOlderMessages());
    expect(messageService.listMessages).toHaveBeenCalledTimes(2);

    socket.emit.mockClear();
    act(() => result.current.selectConversation("c1"));
    expect(socket.emit).not.toHaveBeenCalled();

    act(() => result.current.selectConversation(null));
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.messagesLoading).toBe(false);
    act(() => result.current.loadOlderMessages());
  });

  it("shows a message error when loading a thread fails and ignores stale loads", async () => {
    messageService.listConversations.mockResolvedValue(page([]));
    messageService.listMessages.mockRejectedValueOnce(new Error("x"));
    const { result } = renderHook(() => useChat());
    act(() => result.current.selectConversation("c1"));
    await waitFor(() => expect(result.current.messagesError).toBe("loadError"));

    let release: (v: unknown) => void = () => {};
    messageService.listMessages.mockImplementationOnce(() => new Promise((r) => (release = r)));
    act(() => result.current.selectConversation("c2"));
    act(() => result.current.selectConversation(null));
    await act(async () => {
      release(msgs([msg("late")]));
    });
    expect(result.current.activeMessages).toEqual([]);

    messageService.listMessages.mockResolvedValueOnce(msgs([msg("a")], 1, 3));
    act(() => result.current.selectConversation("c1"));
    await waitFor(() => expect(result.current.messagesHasMore).toBe(true));
    messageService.listMessages.mockRejectedValueOnce(new Error("x"));
    act(() => result.current.loadOlderMessages());
    await waitFor(() => expect(result.current.messagesLoadingOlder).toBe(false));
    expect(result.current.activeMessages.map((m) => m.id)).toEqual(["a"]);

    messageService.listMessages.mockImplementationOnce(() => new Promise((r) => (release = r)));
    act(() => result.current.loadOlderMessages());
    act(() => result.current.selectConversation(null));
    await act(async () => {
      release(msgs([msg("old")], 2, 3));
    });
    expect(result.current.activeMessages).toEqual([]);
  });

  it("sends optimistically, reconciles, and rolls back on failure", async () => {
    messageService.listConversations.mockResolvedValue(page([convo("c1", null)]));
    messageService.listMessages.mockResolvedValue(msgs([]));
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage("ignored, no active");
    });
    expect(messageService.sendMessage).not.toHaveBeenCalled();

    act(() => result.current.selectConversation("c1"));
    await waitFor(() => expect(result.current.messagesLoading).toBe(false));
    await act(async () => {
      await result.current.sendMessage("   ");
    });
    expect(messageService.sendMessage).not.toHaveBeenCalled();

    messageService.sendMessage.mockResolvedValueOnce({ message: msg("s1", { senderId: "me", content: "hi" }) });
    await act(async () => {
      await result.current.sendMessage(" hi ");
    });
    expect(messageService.sendMessage).toHaveBeenCalledWith("c1", "hi");
    expect(result.current.activeMessages.map((m) => m.id)).toEqual(["s1"]);
    expect(result.current.conversations[0].lastMessage?.id).toBe("s1");
    expect(result.current.conversations[0].unreadCount).toBe(0);

    // Socket echo arrives before the HTTP response: the optimistic copy is dropped.
    messageService.sendMessage.mockImplementationOnce(async () => {
      act(() => socket.handlers["message:new"](msg("s2", { senderId: "me", content: "yo" })));
      return { message: msg("s2", { senderId: "me", content: "yo" }) };
    });
    await act(async () => {
      await result.current.sendMessage("yo");
    });
    expect(result.current.activeMessages.map((m) => m.id)).toEqual(["s1", "s2"]);

    messageService.sendMessage.mockRejectedValueOnce(new Error("x"));
    await act(async () => {
      await expect(result.current.sendMessage("fail")).rejects.toThrow("send_failed");
    });
    expect(result.current.activeMessages.map((m) => m.id)).toEqual(["s1", "s2"]);
  });

  it("applies realtime events to the list and active thread", async () => {
    messageService.listConversations.mockResolvedValue(
      page([convo("c1", "2026-06-01"), convo("c2", "2026-06-02")]),
    );
    messageService.listMessages.mockResolvedValue(msgs([msg("m0", { senderId: "me" })]));
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversations.length).toBe(2));

    const on = socket.handlers as Record<string, Handler>;
    act(() => on.connect());
    expect(result.current.isConnected).toBe(true);
    act(() => on.disconnect());
    expect(result.current.isConnected).toBe(false);
    act(() => on.connect_error());

    act(() => on["message:new"](msg("x1", { conversationId: "c1", createdAt: "2026-06-05" })));
    expect(result.current.conversations.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result.current.conversations[0].unreadCount).toBe(1);
    act(() => on["message:new"](msg("x1", { conversationId: "c1", createdAt: "2026-06-05" })));
    expect(result.current.conversations[0].unreadCount).toBe(1);

    act(() =>
      on["conversation:updated"]({
        conversationId: "c2",
        lastMessage: { id: "x2", content: "hey", senderId: "me", createdAt: "2026-06-06" },
      }),
    );
    expect(result.current.conversations[0].id).toBe("c2");
    expect(result.current.conversations[0].unreadCount).toBe(0);

    messageService.listConversations.mockClear();
    act(() =>
      on["conversation:updated"]({
        conversationId: "unknown",
        lastMessage: { id: "y", content: "", senderId: "o", createdAt: "2026-06-07" },
      }),
    );
    expect(messageService.listConversations).toHaveBeenCalled();
    await waitFor(() => expect(result.current.conversationsLoading).toBe(false));

    act(() => result.current.selectConversation("c1"));
    await waitFor(() => expect(result.current.activeMessages.length).toBe(1));
    act(() => on["message:new"](msg("x3", { createdAt: "2026-06-08" })));
    expect(result.current.activeMessages.map((m) => m.id)).toEqual(["m0", "x3"]);
    act(() => on["message:new"](msg("x3")));
    expect(result.current.activeMessages.length).toBe(2);
    act(() => on["message:new"](msg("x4", { senderId: "me", content: "no optimistic" })));
    expect(result.current.activeMessages.length).toBe(3);

    act(() => on["messages:read"]({ conversationId: "c1", readerId: "other", readAt: "now" }));
    expect(result.current.activeMessages.find((m) => m.id === "m0")?.readAt).toBe("now");
    expect(result.current.activeMessages.find((m) => m.id === "x3")?.readAt).toBeNull();
    act(() => on["messages:read"]({ conversationId: "c2", readerId: "other", readAt: "later" }));
    expect(result.current.activeMessages.find((m) => m.id === "m0")?.readAt).toBe("now");
  });

  it("rejoins rooms on reconnect and passes the in-memory token", async () => {
    messageService.listConversations.mockResolvedValue(page([]));
    messageService.listMessages.mockResolvedValue(msgs([]));
    const { result, unmount } = renderHook(() => useChat());
    const opts = (ioMock.mock.calls.at(-1) as any[])[1];
    const cb = vi.fn();
    setAccessToken(null);
    opts.auth(cb);
    expect(cb).toHaveBeenLastCalledWith({});
    setAccessToken("tok");
    opts.auth(cb);
    expect(cb).toHaveBeenLastCalledWith({ token: "tok" });
    setAccessToken(null);

    act(() => result.current.selectConversation("c1"));
    socket.emit.mock.calls[0][2](false);
    socket.emit.mockClear();
    act(() => socket.handlers.connect());
    const [, room, ack] = socket.emit.mock.calls[0];
    expect(room).toBe("c1");
    ack(true);
    socket.emit.mockClear();
    act(() => socket.handlers.connect());
    expect(socket.emit).toHaveBeenCalledWith("conversation:join", "c1");

    unmount();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it("opens and selects the conversation for an initial booking", async () => {
    useAuthStore.setState({ user: null });
    messageService.listConversations.mockResolvedValue(page([convo("c1", "2026-06-01")]));
    messageService.listMessages.mockResolvedValue(msgs([]));
    messageService.openConversation.mockResolvedValueOnce({ conversation: convo("c9", "2026-06-09") });
    const { result } = renderHook(() => useChat({ initialBookingId: "b1" }));
    await waitFor(() => expect(result.current.activeConversationId).toBe("c9"));
    expect(messageService.openConversation).toHaveBeenCalledWith("b1");
    expect(result.current.currentUserId).toBe("");

    messageService.openConversation.mockResolvedValueOnce({ conversation: convo("c1", null) });
    const second = renderHook(() => useChat({ initialBookingId: "b2" }));
    await waitFor(() => expect(second.result.current.activeConversationId).toBe("c1"));

    messageService.openConversation.mockRejectedValueOnce(new Error("x"));
    const third = renderHook(() => useChat({ initialBookingId: "b3" }));
    await waitFor(() => expect(third.result.current.conversationsLoading).toBe(false));
    expect(third.result.current.activeConversationId).toBeNull();

    let release: (v: unknown) => void = () => {};
    messageService.openConversation.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const fourth = renderHook(() => useChat({ initialBookingId: "b4" }));
    fourth.unmount();
    await act(async () => {
      release({ conversation: convo("c4", null) });
    });
  });
});

describe("useDialogPrompts", () => {
  function Harness({ onResult }: { onResult: (v: unknown) => void }) {
    const { prompt, confirm, dialogs } = useDialogPrompts();
    return (
      <div>
        <button
          onClick={async () =>
            onResult(
              await prompt({
                title: "Reason?",
                message: "Tell us why",
                placeholder: "Type here",
                minLength: 5,
                variant: "danger",
              }),
            )
          }
        >
          open-prompt
        </button>
        <button onClick={async () => onResult(await prompt({ title: "Plain", defaultValue: "42", type: "number", confirmText: "Go", cancelText: "Stop" }))}>
          open-plain
        </button>
        <button onClick={async () => onResult(await confirm({ title: "Sure?", message: "Really" }))}>
          open-confirm
        </button>
        <button onClick={async () => onResult(await confirm({ title: "Warn", message: "M", variant: "warning", confirmText: "Yes", cancelText: "No" }))}>
          open-warn
        </button>
        {dialogs}
      </div>
    );
  }

  it("validates the minimum length and resolves the typed value", async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    fireEvent.click(screen.getByText("open-prompt"));
    expect(await screen.findByText("Tell us why")).toBeTruthy();

    fireEvent.click(screen.getByText("confirm"));
    expect(await screen.findByText("Minimum 5 characters required.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Type here"), { target: { value: "  long enough " } });
    expect(screen.queryByText("Minimum 5 characters required.")).toBeNull();
    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("  long enough "));
  });

  it("resolves null when the prompt is cancelled", async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    fireEvent.click(screen.getByText("open-plain"));
    expect((await screen.findByDisplayValue("42"))).toBeTruthy();
    fireEvent.click(screen.getByText("Stop"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(null));
    fireEvent.click(screen.getByText("open-plain"));
    fireEvent.click(await screen.findByText("Go"));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith("42"));
  });

  it("resolves confirm dialogs with true or false", async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    fireEvent.click(screen.getByText("open-confirm"));
    expect(await screen.findByText("Really")).toBeTruthy();
    const confirmButtons = screen.getAllByRole("button").filter((b) => /confirm/i.test(b.textContent ?? ""));
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));

    fireEvent.click(screen.getByText("open-warn"));
    fireEvent.click(await screen.findByText("No"));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));
  });
});
