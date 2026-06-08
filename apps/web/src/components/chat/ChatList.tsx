"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquare, Search, User } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ConversationSummary } from "@/lib/api";
import { formatListPreviewTime } from "./formatters";

interface ChatListProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  isConnected: boolean;
  emptyDescKey: "emptyListDesc" | "emptyListDescOwner";
  unreadOnly: boolean;
  onToggleUnread: () => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

export function ChatList({
  conversations,
  activeId,
  loading,
  error,
  hasMore,
  loadingMore,
  isConnected,
  emptyDescKey,
  unreadOnly,
  onToggleUnread,
  onSelect,
  onRetry,
  onLoadMore,
}: ChatListProps) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name =
        `${c.counterpart.firstName} ${c.counterpart.lastName}`.toLowerCase();
      const route =
        `${c.booking.pickupLocation} ${c.booking.dropoffLocation ?? ""}`.toLowerCase();
      const vehicle = (c.booking.vehicle?.name ?? "").toLowerCase();
      return name.includes(q) || route.includes(q) || vehicle.includes(q);
    });
  }, [conversations, search]);

  return (
    <div className="flex h-full flex-col">
      {/* List header — search + connection status */}
      <div className="shrink-0 border-b border-[var(--color-border-default)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("conversationsListLabel", { defaultValue: "Conversations" })}
          </h2>
          <span
            className="inline-flex items-center gap-4 text-xs font-medium text-[var(--color-text-secondary)]"
            aria-live="polite"
            title={isConnected ? t("connected") : t("offline")}
          >
            <button
            type="button"
            onClick={onToggleUnread}
            aria-pressed={unreadOnly}
            className={`min-h-[44px] rounded-lg px-3 text-xs font-medium transition-colors ${focusRing} ${
              unreadOnly
                ? "bg-[var(--color-action-primary)] text-white"
                : "border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
            }`}
          >
            {t("filterUnread")}
          </button>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isConnected
                  ? "bg-[var(--color-success-border)]"
                  : "bg-[var(--color-text-tertiary)]"
              }`}
              aria-hidden="true"
            />
            <span className="sr-only">
              {isConnected ? t("connected") : t("offline")}
            </span>
          </span>
        </div>
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-text-tertiary)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className={`w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-base)] focus:bg-[var(--color-bg-base)] ${focusRing}`}
            aria-label={t("searchPlaceholder")}
          />
        </label>
      </div>

      {/* Scrollable list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
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
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-surface)]">
              <MessageSquare
                className="h-6 w-6 text-[var(--color-text-tertiary)]"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {search.trim()
                ? t("noSearchResults")
                : unreadOnly
                  ? t("noUnreadTitle")
                  : t("emptyListTitle")}
            </p>
            <p className="max-w-xs text-xs text-[var(--color-text-secondary)]">
              {search.trim()
                ? t("noSearchResultsDesc")
                : unreadOnly
                  ? t("noUnreadDesc")
                  : t(emptyDescKey)}
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col" role="list">
              {filtered.map((c) => {
                const isActive = c.id === activeId;
                const initials =
                  (c.counterpart.firstName?.[0] ?? "") +
                  (c.counterpart.lastName?.[0] ?? "");
                const previewText = c.lastMessage?.content ?? "";
                const hasUnread = c.unreadCount > 0;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`flex w-full min-h-[72px] items-start gap-3 border-b border-[var(--color-border-default)] px-4 py-3 text-left transition-colors ${focusRing} focus-visible:ring-inset ${
                        isActive
                          ? "bg-[var(--color-bg-surface)] border-l-[3px] border-l-[var(--color-action-primary)] pl-[13px]"
                          : "bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)] border-l-[3px] border-l-transparent"
                      }`}
                    >
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-bg-surface)] text-sm font-semibold text-[var(--color-text-secondary)]">
                        {c.counterpart.avatar ? (
                          <Image
                            src={c.counterpart.avatar}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : initials.trim() ? (
                          <span aria-hidden="true">
                            {initials.toUpperCase()}
                          </span>
                        ) : (
                          <User
                            className="h-5 w-5 text-[var(--color-text-tertiary)]"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p
                            className={`truncate text-sm ${
                              hasUnread
                                ? "font-semibold text-[var(--color-text-primary)]"
                                : "font-medium text-[var(--color-text-primary)]"
                            }`}
                          >
                            {c.counterpart.firstName} {c.counterpart.lastName}
                          </p>
                          <span
                            className={`shrink-0 text-[11px] ${
                              hasUnread
                                ? "font-medium text-[var(--color-action-primary)]"
                                : "text-[var(--color-text-tertiary)]"
                            }`}
                          >
                            {formatListPreviewTime(
                              c.lastMessageAt,
                              locale,
                              t("yesterdayLabel"),
                            )}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                          {c.booking.vehicle.name} ·{" "}
                          {t(`status.${c.booking.status as "PENDING"}`)}
                        </p>
                        <p
                          className={`mt-1 truncate text-xs ${
                            hasUnread
                              ? "font-medium text-[var(--color-text-primary)]"
                              : "text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {previewText || (
                            <span className="italic text-[var(--color-text-tertiary)]">
                              {t("emptyThreadTitle")}
                            </span>
                          )}
                        </p>
                      </div>

                      {hasUnread ? (
                        <span
                          className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-action-primary)] px-1.5 text-[11px] font-semibold text-white"
                          aria-label={t("unreadBadge", {
                            count: c.unreadCount,
                          })}
                        >
                          {c.unreadCount > 99 ? "99+" : c.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {hasMore && !search.trim() ? (
              <div className="p-3">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className={`w-full min-h-[44px] rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] disabled:opacity-60 ${focusRing}`}
                >
                  {loadingMore ? t("loadingMore") : t("loadMore")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
