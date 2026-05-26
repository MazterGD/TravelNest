"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

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
    <div className="flex h-full flex-col overflow-hidden rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] shadow-sm">
      {/* Two-pane chat layout. The status indicator lives on the conversation
          header (right pane) rather than a separate strip so we keep the
          interface dense — every pixel of the chat container is functional. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_1fr]">
        {/* Left pane: conversation list. Hidden on mobile when a chat is open
            so the thread can use the full width — the back button in the
            thread header returns the user here. */}
        <aside
          className={`min-h-0 border-[var(--color-border-default)] md:border-r ${
            activeConversationId ? "hidden md:flex md:flex-col" : "flex flex-col"
          }`}
          aria-label={t("conversationsListLabel", {
            defaultValue: "Conversations",
          })}
        >
          <ChatList
            conversations={conversations}
            activeId={activeConversationId}
            loading={conversationsLoading}
            error={conversationsError}
            hasMore={conversationsHasMore}
            loadingMore={conversationsLoadingMore}
            emptyDescKey={emptyDescKey}
            isConnected={isConnected}
            onSelect={selectConversation}
            onRetry={() => void refresh()}
            onLoadMore={loadMoreConversations}
          />
        </aside>

        {/* Right pane: thread + input. Always flex column so the input docks
            at the bottom regardless of message volume. */}
        <section
          className={`min-h-0 flex-col ${
            activeConversationId ? "flex" : "hidden md:flex"
          }`}
          aria-label={t("threadLabel", { defaultValue: "Message thread" })}
        >
          {activeConversationId ? (
            <button
              type="button"
              onClick={() => selectConversation(null)}
              className={`flex shrink-0 items-center gap-1 border-b border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] md:hidden ${focusRing}`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t("backToList", { defaultValue: "Back to chats" })}
            </button>
          ) : null}

          <div className="min-h-0 flex-1">
            <MessageThread
              conversation={activeConversation}
              messages={activeMessages}
              currentUserId={currentUserId}
              loading={messagesLoading}
              error={messagesError}
              hasMoreMessages={messagesHasMore}
              loadingOlder={messagesLoadingOlder}
              isConnected={isConnected}
              onRetry={() =>
                activeConversationId &&
                selectConversation(activeConversationId)
              }
              onLoadOlder={loadOlderMessages}
            />
          </div>
          {activeConversationId ? (
            <MessageInput
              disabled={!activeConversationId}
              onSend={sendMessage}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
