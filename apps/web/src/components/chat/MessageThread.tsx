"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Check, CheckCheck, MessageCirclePlus } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ChatMessage, ConversationSummary } from "@/lib/api";
import { formatMessageTime, formatTripDateRange } from "./formatters";

interface MessageThreadProps {
  conversation: ConversationSummary | null;
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  error: string | null;
  hasMoreMessages: boolean;
  loadingOlder: boolean;
  onRetry: () => void;
  onLoadOlder: () => void;
}

export function MessageThread({
  conversation,
  messages,
  currentUserId,
  loading,
  error,
  hasMoreMessages,
  loadingOlder,
  onRetry,
  onLoadOlder,
}: MessageThreadProps) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const endRef = useRef<HTMLDivElement | null>(null);

  // Keyed on the last message id (not message count) so prepending older
  // history does not yank the view back to the bottom.
  const lastMessageId =
    messages.length > 0 ? messages[messages.length - 1].id : null;

  useEffect(() => {
    // Honour the OS reduced-motion setting (design system §6) without a
    // motion library — `motion/react` is not a dependency of this project.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [lastMessageId, conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <MessageCirclePlus
          className="h-12 w-12 text-[var(--color-text-tertiary)]"
          aria-hidden="true"
        />
        <p className="text-base font-medium text-[var(--color-text-primary)]">
          {t("noSelectionTitle")}
        </p>
        <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
          {t("noSelectionDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-bg-surface)] text-sm font-semibold text-[var(--color-text-secondary)]">
            {conversation.counterpart.avatar ? (
              <Image
                src={conversation.counterpart.avatar}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : (
              <span aria-hidden="true">
                {(conversation.counterpart.firstName?.[0] ?? "").toUpperCase()}
                {(conversation.counterpart.lastName?.[0] ?? "").toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {conversation.counterpart.firstName}{" "}
              {conversation.counterpart.lastName}
            </p>
            <p className="truncate text-xs text-[var(--color-text-secondary)]">
              {conversation.booking.vehicle.name} ·{" "}
              {formatTripDateRange(
                conversation.booking.startDate,
                conversation.booking.endDate,
                locale,
              )}
            </p>
          </div>
          <span className="shrink-0 rounded-sm bg-[var(--color-bg-surface)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
            {t(`status.${conversation.booking.status as "PENDING"}`)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[var(--color-bg-surface)] p-4">
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("loadError")}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-[44px] rounded-md bg-[var(--color-action-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
            >
              {t("retry")}
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-base font-medium text-[var(--color-text-primary)]">
              {t("emptyThreadTitle")}
            </p>
            <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
              {t("emptyThreadDesc")}
            </p>
          </div>
        ) : (
          <>
            {hasMoreMessages && (
              <div className="flex justify-center pb-3">
                <button
                  type="button"
                  onClick={onLoadOlder}
                  disabled={loadingOlder}
                  className="min-h-[44px] rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] disabled:opacity-60"
                >
                  {loadingOlder ? t("loadingOlder") : t("loadOlder")}
                </button>
              </div>
            )}
            <ul
              className="flex flex-col gap-2"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((m) => {
                const isMine = m.senderId === currentUserId;
                const isPending = m.pending === true;
                return (
                  <li
                    key={m.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-md px-3 py-2 text-sm transition-opacity ${
                        isMine
                          ? "bg-[var(--color-action-primary)] text-[var(--color-primary-foreground)]"
                          : "border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)]"
                      } ${isPending ? "opacity-60" : "opacity-100"}`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {m.content}
                      </p>
                      <div
                        className={`mt-1 flex items-center gap-1 text-xs ${
                          isMine
                            ? "text-[var(--color-primary-foreground)]/80"
                            : "text-[var(--color-text-tertiary)]"
                        }`}
                      >
                        <span>{formatMessageTime(m.createdAt, locale)}</span>
                        {isMine &&
                          (isPending ? null : m.readAt ? (
                            <CheckCheck
                              className="h-3.5 w-3.5"
                              aria-label={t("messageReadByYou")}
                            />
                          ) : (
                            <Check
                              className="h-3.5 w-3.5"
                              aria-label={t("messageDelivered")}
                            />
                          ))}
                      </div>
                    </div>
                  </li>
                );
              })}
              <div ref={endRef} aria-hidden="true" />
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
