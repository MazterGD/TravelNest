"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  messageService,
  type ChatMessage,
  type ConversationSummary,
} from "@/lib/api";
import { useAuthStore } from "@/store";

const SOCKET_BASE_URL = (() => {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
  // socket.io is mounted on the bare HTTP server, not under /api/v1
  return apiUrl.replace(/\/api\/v\d+\/?$/, "");
})();

const CONVERSATION_PAGE_SIZE = 6;
const MESSAGE_PAGE_SIZE = 30;

const getStoredAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("travenest-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
};

interface ConversationUpdatedPayload {
  conversationId: string;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
}

const sortByRecency = (
  list: ConversationSummary[],
): ConversationSummary[] =>
  [...list].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

// Idempotent on message id: applying the same message twice (e.g. from both the
// `message:new` room event and the `conversation:updated` inbox event) is a
// no-op, so the unread badge never double-counts.
const applyMessageToList = (
  list: ConversationSummary[],
  conversationId: string,
  message: { id: string; content: string; senderId: string; createdAt: string },
  viewerId: string,
  activeId: string | null,
): ConversationSummary[] => {
  let changed = false;
  const next = list.map((c) => {
    if (c.id !== conversationId || c.lastMessage?.id === message.id) return c;
    changed = true;
    const isOwn = message.senderId === viewerId;
    const isActive = activeId === conversationId;
    return {
      ...c,
      lastMessageAt: message.createdAt,
      lastMessage: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
      },
      unreadCount: isOwn || isActive ? c.unreadCount : c.unreadCount + 1,
    };
  });
  return changed ? sortByRecency(next) : list;
};

export interface UseChatOptions {
  // When set, a conversation is opened (or created) for this booking on mount
  // and auto-selected — the entry point used by "Message owner" links.
  initialBookingId?: string;
}

export interface UseChatState {
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  conversationsError: string | null;
  conversationsHasMore: boolean;
  conversationsLoadingMore: boolean;
  loadMoreConversations: () => void;
  unreadOnly: boolean;
  setUnreadOnly: (val: boolean) => void;
  activeConversationId: string | null;
  activeMessages: ChatMessage[];
  messagesLoading: boolean;
  messagesError: string | null;
  messagesHasMore: boolean;
  messagesLoadingOlder: boolean;
  loadOlderMessages: () => void;
  currentUserId: string;
  isConnected: boolean;
  selectConversation: (id: string | null) => void;
  sendMessage: (content: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useChat(options: UseChatOptions = {}): UseChatState {
  const { initialBookingId } = options;
  const { user } = useAuthStore();
  const currentUserId = user?.id ?? "";

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );
  const [conversationsHasMore, setConversationsHasMore] = useState(false);
  const [conversationsLoadingMore, setConversationsLoadingMore] =
    useState(false);

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [messagesLoadingOlder, setMessagesLoadingOlder] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const [unreadOnly, setUnreadOnlyState] = useState(false);
  const unreadOnlyRef = useRef(false);
  unreadOnlyRef.current = unreadOnly;

  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string>(currentUserId);
  const conversationsRef = useRef<ConversationSummary[]>([]);
  const conversationsPageRef = useRef(1);
  const messagesPageRef = useRef(1);
  // Joined rooms persist across selections so a counterpart's message in an
  // unfocused thread still updates the conversation-list preview, and so every
  // room can be re-joined after a socket reconnect.
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  activeIdRef.current = activeConversationId;
  currentUserIdRef.current = currentUserId;
  conversationsRef.current = conversations;

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    setConversationsError(null);
    try {
      const data = await messageService.listConversations({
        page: 1,
        limit: CONVERSATION_PAGE_SIZE,
        unreadOnly: unreadOnlyRef.current,
      });
      conversationsPageRef.current = 1;
      setConversations(data.conversations);
      setConversationsHasMore(
        data.pagination.page < data.pagination.totalPages,
      );
    } catch {
      setConversationsError("loadError");
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  const loadMoreConversations = useCallback(() => {
    if (conversationsLoadingMore || !conversationsHasMore) return;
    setConversationsLoadingMore(true);
    void (async () => {
      try {
        const nextPage = conversationsPageRef.current + 1;
        const data = await messageService.listConversations({
          page: nextPage,
          limit: CONVERSATION_PAGE_SIZE,
          unreadOnly: unreadOnlyRef.current,
        });
        conversationsPageRef.current = nextPage;
        setConversations((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [
            ...prev,
            ...data.conversations.filter((c) => !seen.has(c.id)),
          ];
        });
        setConversationsHasMore(
          data.pagination.page < data.pagination.totalPages,
        );
      } catch {
        // Keep the loaded list; hasMore stays true so the user can retry.
      } finally {
        setConversationsLoadingMore(false);
      }
    })();
  }, [conversationsLoadingMore, conversationsHasMore]);

  const setUnreadOnly = useCallback((val: boolean) => {
    setUnreadOnlyState(val);
    setConversations([]);
    conversationsPageRef.current = 1;
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, unreadOnly]);

  useEffect(() => {
    const token = getStoredAccessToken();
    const socket = io(SOCKET_BASE_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      // Re-join every room joined this session, not just the active one, so
      // background conversations keep receiving live updates after a reconnect.
      joinedRoomsRef.current.forEach((roomId) => {
        socket.emit("conversation:join", roomId);
      });
      const active = activeIdRef.current;
      if (active && !joinedRoomsRef.current.has(active)) {
        socket.emit("conversation:join", active, (ok: boolean) => {
          if (ok) joinedRoomsRef.current.add(active);
        });
      }
    });

    socket.on("disconnect", () => setIsConnected(false));
    socket.on("connect_error", () => setIsConnected(false));

    socket.on("message:new", (message: ChatMessage) => {
      const viewerId = currentUserIdRef.current;
      if (activeIdRef.current === message.conversationId) {
        setActiveMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          // Our own message echoed back over the socket — reconcile it with the
          // optimistic placeholder instead of appending a duplicate.
          if (message.senderId === viewerId) {
            const idx = prev.findIndex(
              (m) => m.pending && m.content === message.content,
            );
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = message;
              return next;
            }
          }
          return [...prev, message];
        });
      }
      setConversations((prev) =>
        applyMessageToList(
          prev,
          message.conversationId,
          message,
          viewerId,
          activeIdRef.current,
        ),
      );
    });

    socket.on(
      "conversation:updated",
      (payload: ConversationUpdatedPayload) => {
        const known = conversationsRef.current.some(
          (c) => c.id === payload.conversationId,
        );
        if (!known) {
          // A conversation the counterpart just created/messaged that isn't on
          // the loaded page — pull a fresh first page so it surfaces.
          void loadConversations();
          return;
        }
        setConversations((prev) =>
          applyMessageToList(
            prev,
            payload.conversationId,
            payload.lastMessage,
            currentUserIdRef.current,
            activeIdRef.current,
          ),
        );
      },
    );

    socket.on(
      "messages:read",
      (payload: {
        conversationId: string;
        readerId: string;
        readAt: string;
      }) => {
        if (activeIdRef.current === payload.conversationId) {
          setActiveMessages((prev) =>
            prev.map((m) =>
              m.senderId !== payload.readerId && !m.readAt
                ? { ...m, readAt: payload.readAt }
                : m,
            ),
          );
        }
      },
    );

    const joinedRooms = joinedRoomsRef.current;
    return () => {
      socket.disconnect();
      socketRef.current = null;
      joinedRooms.clear();
    };
  }, [loadConversations]);

  const selectConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
    activeIdRef.current = id;
    setActiveMessages([]);
    setMessagesError(null);
    setMessagesLoading(true);
    setMessagesHasMore(false);
    setMessagesLoadingOlder(false);
    messagesPageRef.current = 1;

    // Deselecting (mobile back button) — nothing else to do.
    if (id === null) {
      setMessagesLoading(false);
      return;
    }

    const socket = socketRef.current;
    if (socket && !joinedRoomsRef.current.has(id)) {
      socket.emit("conversation:join", id, (ok: boolean) => {
        if (ok) joinedRoomsRef.current.add(id);
      });
    }

    void (async () => {
      try {
        const data = await messageService.listMessages(id, {
          page: 1,
          limit: MESSAGE_PAGE_SIZE,
        });
        if (activeIdRef.current === id) {
          setActiveMessages(data.messages);
          setMessagesHasMore(
            data.pagination.page < data.pagination.totalPages,
          );
        }
        await messageService.markRead(id);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
        );
      } catch {
        if (activeIdRef.current === id) {
          setMessagesError("loadError");
        }
      } finally {
        if (activeIdRef.current === id) {
          setMessagesLoading(false);
        }
      }
    })();
  }, []);

  const loadOlderMessages = useCallback(() => {
    const id = activeIdRef.current;
    if (!id || messagesLoadingOlder || !messagesHasMore) return;
    setMessagesLoadingOlder(true);
    void (async () => {
      try {
        const nextPage = messagesPageRef.current + 1;
        const data = await messageService.listMessages(id, {
          page: nextPage,
          limit: MESSAGE_PAGE_SIZE,
        });
        if (activeIdRef.current !== id) return;
        messagesPageRef.current = nextPage;
        setActiveMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const older = data.messages.filter((m) => !seen.has(m.id));
          return [...older, ...prev];
        });
        setMessagesHasMore(data.pagination.page < data.pagination.totalPages);
      } catch {
        // Keep what we have; the control stays visible so the user can retry.
      } finally {
        if (activeIdRef.current === id) {
          setMessagesLoadingOlder(false);
        }
      }
    })();
  }, [messagesLoadingOlder, messagesHasMore]);

  const sendMessage = useCallback(async (content: string) => {
    const id = activeIdRef.current;
    if (!id) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      conversationId: id,
      senderId: currentUserIdRef.current,
      content: trimmed,
      readAt: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setActiveMessages((prev) => [...prev, optimistic]);

    try {
      const { message } = await messageService.sendMessage(id, trimmed);
      setActiveMessages((prev) => {
        // The socket echo may have already reconciled the optimistic copy.
        if (prev.some((m) => m.id === message.id)) {
          return prev.filter((m) => m.id !== optimisticId);
        }
        return prev.map((m) => (m.id === optimisticId ? message : m));
      });
      setConversations((prev) =>
        applyMessageToList(
          prev,
          id,
          message,
          currentUserIdRef.current,
          activeIdRef.current,
        ),
      );
    } catch {
      setActiveMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      throw new Error("send_failed");
    }
  }, []);

  useEffect(() => {
    if (!initialBookingId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { conversation } =
          await messageService.openConversation(initialBookingId);
        if (cancelled) return;
        setConversations((prev) =>
          prev.some((c) => c.id === conversation.id)
            ? prev
            : sortByRecency([conversation, ...prev]),
        );
        selectConversation(conversation.id);
      } catch {
        // If the conversation can't be opened the user still sees their list.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBookingId, selectConversation]);

  return {
    conversations,
    conversationsLoading,
    conversationsError,
    conversationsHasMore,
    conversationsLoadingMore,
    loadMoreConversations,
    unreadOnly,
    setUnreadOnly,
    activeConversationId,
    activeMessages,
    messagesLoading,
    messagesError,
    messagesHasMore,
    messagesLoadingOlder,
    loadOlderMessages,
    currentUserId,
    isConnected,
    selectConversation,
    sendMessage,
    refresh: loadConversations,
  };
}
