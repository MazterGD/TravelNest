/**
 * Component tests for the booking-scoped chat UI: formatters, ChatList,
 * MessageThread, MessageInput and the ChatLayout shell (useChat mocked).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ chat: {} as any }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks", () => ({ useChat: () => h.chat }));

import {
  formatListPreviewTime,
  formatMessageTime,
  formatTripDateRange,
} from "@/components/chat/formatters";
import { ChatLayout, ChatList, MessageInput, MessageThread } from "@/components/chat";

const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const conv = (over: any = {}): any => ({
  id: "c1",
  bookingId: "b1",
  counterpart: { id: "u2", firstName: "Nimal", lastName: "Perera", avatar: null },
  booking: {
    pickupLocation: "Colombo",
    dropoffLocation: "Kandy",
    vehicle: { name: "Lanka Coach" },
    status: "CONFIRMED",
    startDate: "2026-11-01T00:00:00Z",
    endDate: "2026-11-03T00:00:00Z",
  },
  lastMessage: { content: "See you soon" },
  lastMessageAt: daysAgo(0).toISOString(),
  unreadCount: 0,
  ...over,
});

beforeEach(() => {
  (Element.prototype as any).scrollIntoView = vi.fn();
  (window as any).matchMedia = vi.fn(() => ({ matches: false }));
});

describe("chat formatters", () => {
  it("formats message time and trip ranges", () => {
    expect(formatMessageTime(new Date(2026, 0, 1, 9, 5), "en")).toMatch(/9:05/);
    expect(formatMessageTime("2026-01-01T09:05:00", "en")).toMatch(/9:05/);
    expect(formatTripDateRange("2026-11-01T12:00:00", new Date(2026, 10, 3, 12), "en")).toBe(
      "Nov 1 – Nov 3",
    );
  });

  it("buckets list preview times", () => {
    expect(formatListPreviewTime(null, "en", "Yesterday")).toBe("");
    expect(formatListPreviewTime(daysAgo(0, 0).toISOString(), "en", "Yesterday")).toMatch(/\d:\d\d/);
    expect(formatListPreviewTime(daysAgo(1), "en", "Yesterday")).toBe("Yesterday");
    const threeDays = daysAgo(3);
    expect(formatListPreviewTime(threeDays, "en", "Y")).toBe(
      new Intl.DateTimeFormat("en", { weekday: "short" }).format(threeDays),
    );
    const old = daysAgo(40);
    expect(formatListPreviewTime(old, "en", "Y")).toBe(
      new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(old),
    );
  });
});

describe("ChatList", () => {
  const baseProps = () => ({
    conversations: [] as any[],
    activeId: null as string | null,
    loading: false,
    error: null as string | null,
    hasMore: false,
    loadingMore: false,
    isConnected: true,
    emptyDescKey: "emptyListDesc" as const,
    unreadOnly: false,
    onToggleUnread: vi.fn(),
    onSelect: vi.fn(),
    onRetry: vi.fn(),
    onLoadMore: vi.fn(),
  });

  it("shows a spinner while loading the first page", () => {
    const { container } = render(<ChatList {...baseProps()} loading />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.getAllByText("connected").length).toBeGreaterThan(0);
  });

  it("shows an error with retry", () => {
    const p = baseProps();
    render(<ChatList {...p} error="boom" isConnected={false} />);
    expect(screen.getByText("loadError")).toBeTruthy();
    expect(screen.getAllByText("offline").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(p.onRetry).toHaveBeenCalled();
  });

  it("shows empty, unread-empty and owner empty copy and toggles the unread filter", () => {
    const p = baseProps();
    const { rerender } = render(<ChatList {...p} />);
    expect(screen.getByText("emptyListTitle")).toBeTruthy();
    expect(screen.getByText("emptyListDesc")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "filterUnread" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(p.onToggleUnread).toHaveBeenCalled();
    rerender(<ChatList {...p} unreadOnly emptyDescKey="emptyListDescOwner" />);
    expect(screen.getByText("noUnreadTitle")).toBeTruthy();
    expect(screen.getByText("noUnreadDesc")).toBeTruthy();
    expect(screen.getByRole("button", { name: "filterUnread" }).getAttribute("aria-pressed")).toBe("true");
    rerender(<ChatList {...p} emptyDescKey="emptyListDescOwner" />);
    expect(screen.getByText("emptyListDescOwner")).toBeTruthy();
  });

  it("renders rows with avatar/initials/fallback, unread badge, active state and selection", () => {
    const p = baseProps();
    const conversations = [
      conv({ unreadCount: 3 }),
      conv({ id: "c2", counterpart: { firstName: "Sunil", lastName: "Silva", avatar: "/s.png" }, unreadCount: 150, lastMessage: null }),
      conv({ id: "c3", counterpart: { firstName: "", lastName: "" }, booking: { ...conv().booking, vehicle: { name: "Mini Bus" }, dropoffLocation: null } }),
    ];
    const { container } = render(<ChatList {...p} conversations={conversations} activeId="c2" hasMore />);
    expect(screen.getByText("NP")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/s.png");
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("99+")).toBeTruthy();
    expect(screen.getAllByText("emptyThreadTitle").length).toBe(1);
    expect(screen.getAllByText("See you soon").length).toBe(2);
    const rows = screen.getAllByRole("listitem").map((li) => li.querySelector("button")!);
    expect(rows[1].getAttribute("aria-current")).toBe("true");
    expect(rows[0].getAttribute("aria-current")).toBeNull();
    fireEvent.click(rows[2]);
    expect(p.onSelect).toHaveBeenCalledWith("c3");
    fireEvent.click(screen.getByRole("button", { name: "loadMore" }));
    expect(p.onLoadMore).toHaveBeenCalled();
  });

  it("filters by name, route and vehicle and hides load-more while searching", () => {
    const p = baseProps();
    const conversations = [
      conv(),
      conv({ id: "c2", counterpart: { firstName: "Sunil", lastName: "Silva" }, booking: { ...conv().booking, pickupLocation: "Galle", dropoffLocation: null, vehicle: { name: "Rosa" } } }),
      conv({ id: "c3", counterpart: { firstName: "Amal", lastName: "X" }, booking: { ...conv().booking, pickupLocation: "Jaffna", vehicle: { name: undefined } } }),
    ];
    render(<ChatList {...p} conversations={conversations} hasMore loadingMore />);
    expect((screen.getByRole("button", { name: "loadingMore" }) as HTMLButtonElement).disabled).toBe(true);
    const search = screen.getByRole("searchbox", { name: "searchPlaceholder" });
    fireEvent.change(search, { target: { value: "sunil" } });
    expect(screen.getAllByRole("listitem").length).toBe(1);
    expect(screen.queryByRole("button", { name: "loadingMore" })).toBeNull();
    fireEvent.change(search, { target: { value: "jaffna" } });
    expect(screen.getAllByRole("listitem").length).toBe(1);
    fireEvent.change(search, { target: { value: "rosa" } });
    expect(screen.getAllByRole("listitem").length).toBe(1);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("noSearchResults")).toBeTruthy();
    expect(screen.getByText("noSearchResultsDesc")).toBeTruthy();
  });
});

describe("MessageThread", () => {
  const props = (over: any = {}) => ({
    conversation: conv(),
    messages: [] as any[],
    currentUserId: "me",
    loading: false,
    error: null,
    hasMoreMessages: false,
    loadingOlder: false,
    isConnected: true,
    onRetry: vi.fn(),
    onLoadOlder: vi.fn(),
    ...over,
  });

  it("shows the no-selection state", () => {
    render(<MessageThread {...props({ conversation: null })} />);
    expect(screen.getByText("noSelectionTitle")).toBeTruthy();
    expect(screen.getByText("noSelectionDesc")).toBeTruthy();
  });

  it("renders header, booking link and status badge, plus loading/error/empty states", () => {
    const p = props({ bookingHref: "/en/dashboard/bookings/b1" });
    const { rerender, container } = render(<MessageThread {...p} loading />);
    expect(screen.getByText("Nimal Perera")).toBeTruthy();
    expect(screen.getByText("NP")).toBeTruthy();
    expect(screen.getByText(/Lanka Coach/)).toBeTruthy();
    expect(screen.getByText("status.CONFIRMED").className).toContain("bg-success-bg");
    expect(screen.getByRole("link", { name: "viewBooking" }).getAttribute("href")).toBe("/en/dashboard/bookings/b1");
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    rerender(<MessageThread {...p} error="x" />);
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(p.onRetry).toHaveBeenCalled();
    rerender(<MessageThread {...p} />);
    expect(screen.getByText("emptyThreadTitle")).toBeTruthy();
    expect(screen.getByText("emptyThreadDesc")).toBeTruthy();
  });

  it.each([
    ["ONGOING", "text-primary"],
    ["PENDING", "bg-muted"],
    ["CANCELLED", "bg-error-bg"],
    ["COMPLETED", "bg-muted"],
    ["", "bg-muted"],
  ])("maps booking status %s to a badge variant", (status: any, cls: any) => {
    const c = conv({ booking: { ...conv().booking, status } });
    render(<MessageThread {...props({ conversation: c })} />);
    expect(screen.getByText(`status.${status}`).className).toContain(cls);
  });

  it("falls back to avatar image or unknown-user name", () => {
    const c = conv({ counterpart: { firstName: null, lastName: null, avatar: "/a.png" } });
    const { container } = render(<MessageThread {...props({ conversation: c })} />);
    expect(screen.getByText("unknownUser")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/a.png");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("groups messages by day with read/delivered/pending ticks and loads older", () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    lastYear.setHours(12, 0, 0, 0);
    const messages = [
      { id: "m0", senderId: "u2", content: "Old hello", createdAt: lastYear.toISOString() },
      { id: "m1", senderId: "u2", content: "Hi there", createdAt: daysAgo(1).toISOString() },
      { id: "m2", senderId: "me", content: "Read one", createdAt: daysAgo(0, 10).toISOString(), readAt: "x" },
      { id: "m3", senderId: "me", content: "Delivered one", createdAt: daysAgo(0, 11).toISOString() },
      { id: "m4", senderId: "me", content: "Pending one", createdAt: daysAgo(0, 12).toISOString(), pending: true },
      { id: "m5", senderId: "u2", content: "Reply", createdAt: daysAgo(0, 13).toISOString() },
    ];
    const p = props({ messages, hasMoreMessages: true });
    const { rerender } = render(<MessageThread {...p} />);
    expect(screen.getByText("today")).toBeTruthy();
    expect(screen.getByText("yesterdayLabel")).toBeTruthy();
    expect(screen.getByText(String(lastYear.getFullYear()), { exact: false })).toBeTruthy();
    expect(screen.getByLabelText("messageReadByYou")).toBeTruthy();
    expect(screen.getByLabelText("messageDelivered")).toBeTruthy();
    expect(screen.getByLabelText("messagePending")).toBeTruthy();
    const pendingBubble = screen.getByText("Pending one").parentElement!;
    expect(pendingBubble.className).toContain("opacity-60");
    expect(pendingBubble.className).toContain("rounded-tr-md");
    expect(screen.getByText("Read one").parentElement!.className).toContain("rounded-br-md");
    expect(screen.getByText("Reply").parentElement!.closest("li")!.className).toContain("justify-start");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "end" });
    fireEvent.click(screen.getByRole("button", { name: "loadOlder" }));
    expect(p.onLoadOlder).toHaveBeenCalled();
    (window as any).matchMedia = vi.fn(() => ({ matches: true }));
    rerender(
      <MessageThread
        {...p}
        loadingOlder
        messages={[...messages, { id: "m6", senderId: "u2", content: "More", createdAt: daysAgo(0, 14).toISOString() }]}
      />,
    );
    expect((screen.getByRole("button", { name: "loadingOlder" }) as HTMLButtonElement).disabled).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: "auto", block: "end" });
  });

  it("labels a same-year older day by weekday", () => {
    const d = daysAgo(3);
    render(<MessageThread {...props({ messages: [{ id: "x", senderId: "u2", content: "c", createdAt: d.toISOString() }] })} />);
    expect(
      screen.getByText(d.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })),
    ).toBeTruthy();
  });
});

describe("MessageInput", () => {
  afterEach(() => vi.useRealTimers());

  it("validates empty input and clears the error on typing", async () => {
    const onSend = vi.fn();
    const { container } = render(<MessageInput disabled={false} onSend={onSend} />);
    const send = screen.getByRole("button", { name: "send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(screen.getByRole("alert").textContent).toBe("validation.empty");
    const ta = screen.getByLabelText("inputPlaceholder");
    expect(ta.getAttribute("aria-invalid")).toBe("true");
    expect(ta.getAttribute("aria-describedby")).toBe("chat-input-error");
    fireEvent.change(ta, { target: { value: "  " } });
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(ta, { target: { value: "hi" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends trimmed text on Enter, clears and refocuses", async () => {
    const frames: Array<(t: number) => void> = [];
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: any) => {
      frames.push(cb);
      return 0;
    });
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput disabled={false} onSend={onSend} />);
    const ta = screen.getByLabelText("inputPlaceholder") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "  Hello  " } });
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(ta, { key: "a" });
    await act(async () => {
      fireEvent.keyDown(ta, { key: "Enter" });
    });
    expect(onSend).toHaveBeenCalledWith("Hello");
    expect(ta.value).toBe("");
    act(() => frames.forEach((cb) => cb(0)));
    expect(document.activeElement).toBe(ta);
    rafSpy.mockRestore();
  });

  it("shows a spinner while sending and a sendFailed error on rejection", async () => {
    let reject!: (e: unknown) => void;
    const onSend = vi.fn(() => new Promise<void>((_, rej) => (reject = rej)));
    const { container } = render(<MessageInput disabled={false} onSend={onSend} />);
    const ta = screen.getByLabelText("inputPlaceholder") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "yo" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "send" }));
    });
    expect(ta.disabled).toBe(true);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
    await act(async () => {
      reject(new Error("net"));
    });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("validation.sendFailed"));
    expect(ta.value).toBe("yo");
  });

  it("shows the counter, warns near the limit and rejects overlong messages", async () => {
    const onSend = vi.fn();
    render(<MessageInput disabled={false} onSend={onSend} />);
    const ta = screen.getByLabelText("inputPlaceholder");
    fireEvent.change(ta, { target: { value: "a".repeat(1850) } });
    expect(screen.getByText("150").className).toContain("text-tertiary");
    fireEvent.change(ta, { target: { value: "a".repeat(1980) } });
    expect(screen.getByText("20").className).toContain("error-text");
    fireEvent.change(ta, { target: { value: "a".repeat(2050) } });
    expect(screen.getByText("-50")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(ta, { key: "Enter" });
    });
    expect(screen.getByRole("alert").textContent).toBe("validation.tooLong");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", async () => {
    const onSend = vi.fn();
    const { container } = render(<MessageInput disabled onSend={onSend} />);
    const ta = screen.getByLabelText("inputPlaceholder") as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
      fireEvent.keyDown(ta, { key: "Enter" });
    });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ChatLayout", () => {
  const chatState = (over: any = {}) => ({
    conversations: [conv()],
    conversationsLoading: false,
    conversationsError: null,
    conversationsHasMore: false,
    conversationsLoadingMore: false,
    loadMoreConversations: vi.fn(),
    unreadOnly: false,
    setUnreadOnly: vi.fn(),
    activeConversationId: null,
    activeMessages: [],
    messagesLoading: false,
    messagesError: null,
    messagesHasMore: false,
    messagesLoadingOlder: false,
    loadOlderMessages: vi.fn(),
    currentUserId: "me",
    isConnected: true,
    selectConversation: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...over,
  });

  it("shows the list and no-selection thread when nothing is active", () => {
    h.chat = chatState({ conversationsError: "e" });
    render(<ChatLayout emptyDescKey="emptyListDesc" bookingBasePath="/dashboard/bookings" />);
    expect(screen.getByRole("complementary", { name: "conversationsListLabel" }).className).toContain("flex flex-col");
    expect(screen.getByText("noSelectionTitle")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(h.chat.refresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "filterUnread" }));
    expect(h.chat.setUnreadOnly).toHaveBeenCalledWith(true);
  });

  it("opens the active conversation with back button, booking link, retry and composer", async () => {
    h.chat = chatState({ activeConversationId: "c1", messagesError: "e", unreadOnly: true });
    render(<ChatLayout emptyDescKey="emptyListDescOwner" bookingBasePath="/owner/bookings" />);
    expect(screen.getByRole("complementary").className).toContain("hidden md:flex");
    expect(screen.getByRole("link", { name: "viewBooking" }).getAttribute("href")).toBe("/en/owner/bookings/b1");
    fireEvent.click(screen.getByRole("button", { name: "backToList" }));
    expect(h.chat.selectConversation).toHaveBeenCalledWith(null);
    const retries = screen.getAllByRole("button", { name: "retry" });
    fireEvent.click(retries[retries.length - 1]);
    expect(h.chat.selectConversation).toHaveBeenCalledWith("c1");
    fireEvent.click(screen.getByRole("button", { name: "filterUnread" }));
    expect(h.chat.setUnreadOnly).toHaveBeenCalledWith(false);
    fireEvent.change(screen.getByLabelText("inputPlaceholder"), { target: { value: "Hello" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "send" }));
    });
    expect(h.chat.sendMessage).toHaveBeenCalledWith("Hello");
  });

  it("omits the booking link without a base path or matching conversation", () => {
    h.chat = chatState({ activeConversationId: "missing" });
    render(<ChatLayout emptyDescKey="emptyListDesc" bookingBasePath="/x" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("noSelectionTitle")).toBeTruthy();
  });
});
