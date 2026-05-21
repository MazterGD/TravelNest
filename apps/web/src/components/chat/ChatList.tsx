"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Search, MessageSquare, User } from "lucide-react";
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
  emptyDescKey: "emptyListDesc" | "emptyListDescOwner";
  onSelect: (id: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
}

export function ChatList({
  conversations,
  activeId,
  loading,
  error,
  hasMore,
  loadingMore,
  emptyDescKey,
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
      const name = `${c.counterpart.firstName} ${c.counterpart.lastName}`.toLowerCase();
      const route = `${c.booking.pickupLocation} ${c.booking.dropoffLocation ?? ""}`.toLowerCase();
      return name.includes(q) || route.includes(q);
    });
  }, [conversations, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border-default)] p-4">
        <label className="relative flex items-center">
          <Search
            className="absolute left-3 h-5 w-5 text-[var(--color-text-tertiary)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-base)] py-3 pl-11 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
            aria-label={t("searchPlaceholder")}
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
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
              className="min-h-[44px] rounded-md bg-[var(--color-action-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
            >
              {t("retry")}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageSquare
              className="h-10 w-10 text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            />
            <p className="text-base font-medium text-[var(--color-text-primary)]">
              {search.trim() ? t("noSearchResults") : t("emptyListTitle")}
            </p>
            <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
              {search.trim() ? t("noSearchResultsDesc") : t(emptyDescKey)}
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col">
              {filtered.map((c) => {
                const isActive = c.id === activeId;
                const initials =
                  (c.counterpart.firstName?.[0] ?? "") +
                  (c.counterpart.lastName?.[0] ?? "");
                const previewText = c.lastMessage?.content ?? "";
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className={`flex w-full min-h-[72px] items-start gap-3 border-b border-[var(--color-border-default)] p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)] ${
                        isActive
                          ? "bg-[var(--color-bg-surface)]"
                          : "bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)]"
                      }`}
                    >
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-bg-surface)] text-sm font-semibold text-[var(--color-text-secondary)]">
                        {c.counterpart.avatar ? (
                          <Image
                            src={c.counterpart.avatar}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : initials ? (
                          <span aria-hidden="true">{initials.toUpperCase()}</span>
                        ) : (
                          <User
                            className="h-6 w-6 text-[var(--color-text-tertiary)]"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                            {c.counterpart.firstName} {c.counterpart.lastName}
                          </p>
                          <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
                            {formatListPreviewTime(
                              c.lastMessageAt,
                              locale,
                              t("yesterdayLabel"),
                            )}
                          </span>
                        </div>
                        <p className="truncate text-xs text-[var(--color-text-secondary)]">
                          {c.booking.vehicle.name} ·{" "}
                          {t(`status.${c.booking.status as "PENDING"}`)}
                        </p>
                        <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
                          {previewText}
                        </p>
                      </div>

                      {c.unreadCount > 0 && (
                        <span
                          className="ml-2 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[var(--color-action-primary)] px-2 text-xs font-semibold text-[var(--color-primary-foreground)]"
                          aria-label={t("unreadBadge", { count: c.unreadCount })}
                        >
                          {c.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {hasMore && !search.trim() && (
              <div className="p-3">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="w-full min-h-[44px] rounded-md border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] disabled:opacity-60"
                >
                  {loadingMore ? t("loadingMore") : t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
