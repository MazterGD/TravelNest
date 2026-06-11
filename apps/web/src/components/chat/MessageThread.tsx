"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Check, CheckCheck, ExternalLink, MessageCirclePlus } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui";
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
  isConnected: boolean;
  bookingHref?: string;
  onRetry: () => void;
  onLoadOlder: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

const bookingStatusVariant = (
  status: string,
): "info" | "success" | "warning" | "danger" | "secondary" => {
  switch ((status || "").toUpperCase()) {
    case "CONFIRMED":
      return "success";
    case "ONGOING":
      return "info";
    case "PENDING":
      return "warning";
    case "CANCELLED":
      return "danger";
    case "COMPLETED":
    default:
      return "secondary";
  }
};

// Groups messages by calendar day for date dividers — keeps long threads
// scannable by giving the eye a clear anchor for "yesterday vs today vs
// last week" without parsing every timestamp.
function groupMessagesByDay(
  messages: ChatMessage[],
  locale: string,
  todayLabel: string,
  yesterdayLabel: string,
): Array<{ key: string; label: string; messages: ChatMessage[] }> {
  if (messages.length === 0) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, { label: string; messages: ChatMessage[] }>();
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const dayKey = d.toISOString().slice(0, 10);
    if (!groups.has(dayKey)) {
      const messageDay = new Date(d);
      messageDay.setHours(0, 0, 0, 0);
      let label: string;
      if (messageDay.getTime() === today.getTime()) {
        label = todayLabel;
      } else if (messageDay.getTime() === yesterday.getTime()) {
        label = yesterdayLabel;
      } else {
        label = d.toLocaleDateString(locale, {
          weekday: "long",
          month: "short",
          day: "numeric",
          year:
            messageDay.getFullYear() === today.getFullYear()
              ? undefined
              : "numeric",
        });
      }
      groups.set(dayKey, { label, messages: [] });
    }
    groups.get(dayKey)!.messages.push(m);
  }
  return Array.from(groups.entries()).map(([key, value]) => ({
    key,
    ...value,
  }));
}

export function MessageThread({
  conversation,
  messages,
  currentUserId,
  loading,
  error,
  hasMoreMessages,
  loadingOlder,
  bookingHref,
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
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [lastMessageId, conversation?.id]);

  const grouped = useMemo(
    () =>
      groupMessagesByDay(
        messages,
        locale,
        t("today", { defaultValue: "Today" }),
        t("yesterdayLabel"),
      ),
    [messages, locale, t],
  );

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-surface)]">
          <MessageCirclePlus
            className="h-7 w-7 text-[var(--color-action-primary)]"
            aria-hidden="true"
          />
        </div>
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          {t("noSelectionTitle")}
        </p>
        <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
          {t("noSelectionDesc")}
        </p>
      </div>
    );
  }

  const counterpart = conversation.counterpart;
  const counterpartName =
    `${counterpart.firstName ?? ""} ${counterpart.lastName ?? ""}`.trim() ||
    t("unknownUser", { defaultValue: "Unknown user" });

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <header
        className="flex shrink-0 items-start gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 py-3"
        aria-labelledby="chat-counterpart-name"
      >
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-bg-surface)] text-sm font-semibold text-[var(--color-text-secondary)]">
          {counterpart.avatar ? (
            <Image
              src={counterpart.avatar}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <span aria-hidden="true">
              {(counterpart.firstName?.[0] ?? "").toUpperCase()}
              {(counterpart.lastName?.[0] ?? "").toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            id="chat-counterpart-name"
            className="truncate text-sm font-semibold text-[var(--color-text-primary)]"
          >
            {counterpartName}
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
        <Badge variant={bookingStatusVariant(conversation.booking.status)}>
          {t(`status.${conversation.booking.status as "PENDING"}`)}
        </Badge>
        {bookingHref ? (
          <Link
            href={bookingHref}
            className={`shrink-0 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-action-primary)] ${focusRing}`}
            aria-label={t("viewBooking")}
          >
            <ExternalLink className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      {/* Scrollable message area */}
      <div
        className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-bg-surface)] p-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={t("threadLabel", { defaultValue: "Message thread" })}
      >
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
              className={`min-h-[44px] rounded-xl bg-[var(--color-action-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] ${focusRing}`}
            >
              {t("retry")}
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("emptyThreadTitle")}
            </p>
            <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
              {t("emptyThreadDesc")}
            </p>
          </div>
        ) : (
          <>
            {hasMoreMessages ? (
              <div className="flex justify-center pb-3">
                <button
                  type="button"
                  onClick={onLoadOlder}
                  disabled={loadingOlder}
                  className={`min-h-[36px] rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] disabled:opacity-60 ${focusRing}`}
                >
                  {loadingOlder ? t("loadingOlder") : t("loadOlder")}
                </button>
              </div>
            ) : null}

            <div className="space-y-4">
              {grouped.map((group) => (
                <div key={group.key}>
                  <div className="mb-3 flex items-center gap-3" aria-hidden="false">
                    <span className="h-px flex-1 bg-[var(--color-border-default)]" />
                    <span className="rounded-full bg-[var(--color-bg-base)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-tertiary)]">
                      {group.label}
                    </span>
                    <span className="h-px flex-1 bg-[var(--color-border-default)]" />
                  </div>

                  <ul className="flex flex-col gap-2" role="list">
                    {group.messages.map((m, idx) => {
                      const isMine = m.senderId === currentUserId;
                      const isPending = m.pending === true;
                      const prev =
                        idx > 0 ? group.messages[idx - 1] : null;
                      const sameSenderAsPrev =
                        prev && prev.senderId === m.senderId;
                      const next =
                        idx < group.messages.length - 1
                          ? group.messages[idx + 1]
                          : null;
                      const sameSenderAsNext =
                        next && next.senderId === m.senderId;

                      const cornerClasses = isMine
                        ? `rounded-2xl ${
                            sameSenderAsPrev ? "rounded-tr-md" : ""
                          } ${sameSenderAsNext ? "rounded-br-md" : ""}`
                        : `rounded-2xl ${
                            sameSenderAsPrev ? "rounded-tl-md" : ""
                          } ${sameSenderAsNext ? "rounded-bl-md" : ""}`;

                      return (
                        <li
                          key={m.id}
                          className={`flex ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[75%] px-3.5 py-2 text-sm shadow-sm transition-opacity ${cornerClasses} ${
                              isMine
                                ? "bg-[var(--color-action-primary)] text-white"
                                : "border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)]"
                            } ${isPending ? "opacity-60" : "opacity-100"}`}
                          >
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {m.content}
                            </p>
                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
                                isMine
                                  ? "text-white/80"
                                  : "text-[var(--color-text-tertiary)]"
                              }`}
                            >
                              <span>
                                {formatMessageTime(m.createdAt, locale)}
                              </span>
                              {isMine &&
                                (isPending ? (
                                  <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" aria-label={t("messagePending", { defaultValue: "Sending" })} />
                                ) : m.readAt ? (
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
                  </ul>
                </div>
              ))}
              <div ref={endRef} aria-hidden="true" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
