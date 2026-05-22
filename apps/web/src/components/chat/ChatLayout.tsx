"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChatList } from "./ChatList";
import { MessageThread } from "./MessageThread";
import { MessageInput } from "./MessageInput";
import { useChat } from "@/hooks";

interface ChatLayoutProps {
  emptyDescKey: "emptyListDesc" | "emptyListDescOwner";
  // When provided, a conversation for this booking is opened and selected on
  // mount — used by the "Message owner" entry point on the booking pages.
  initialBookingId?: string;
}

export function ChatLayout({ emptyDescKey, initialBookingId }: ChatLayoutProps) {
  const t = useTranslations("messages");
  const {
    conversations,
    conversationsLoading,
    conversationsError,
    conversationsHasMore,
    conversationsLoadingMore,
    loadMoreConversations,
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
    refresh,
  } = useChat({ initialBookingId });

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-base)] shadow-sm">
      <div
        className="flex items-center justify-between border-b border-[var(--color-border-default)] px-4 py-3"
        aria-live="polite"
      >
        <span
          className={`flex items-center gap-2 text-xs font-medium ${
            isConnected
              ? "text-[var(--color-success-text)]"
              : "text-[var(--color-text-tertiary)]"
          }`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isConnected
                ? "bg-[var(--color-success-text)]"
                : "bg-[var(--color-text-tertiary)]"
            }`}
            aria-hidden="true"
          />
          {isConnected ? t("connected") : t("offline")}
        </span>
      </div>

      <div className="grid h-[calc(100vh-260px)] min-h-[480px] grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside
          className={`border-r border-[var(--color-border-default)] ${
            activeConversationId ? "hidden md:flex md:flex-col" : "flex flex-col"
          }`}
        >
          <ChatList
            conversations={conversations}
            activeId={activeConversationId}
            loading={conversationsLoading}
            error={conversationsError}
            hasMore={conversationsHasMore}
            loadingMore={conversationsLoadingMore}
            emptyDescKey={emptyDescKey}
            onSelect={selectConversation}
            onRetry={() => void refresh()}
            onLoadMore={loadMoreConversations}
          />
        </aside>

        <section
          className={`flex flex-col ${
            activeConversationId ? "flex" : "hidden md:flex"
          }`}
        >
          <div className="flex-1 overflow-hidden">
            <MessageThread
              conversation={activeConversation}
              messages={activeMessages}
              currentUserId={currentUserId}
              loading={messagesLoading}
              error={messagesError}
              hasMoreMessages={messagesHasMore}
              loadingOlder={messagesLoadingOlder}
              onRetry={() =>
                activeConversationId &&
                selectConversation(activeConversationId)
              }
              onLoadOlder={loadOlderMessages}
            />
          </div>
          {activeConversationId && (
            <MessageInput
              disabled={!activeConversationId}
              onSend={sendMessage}
            />
          )}
        </section>
      </div>
    </div>
  );
}
