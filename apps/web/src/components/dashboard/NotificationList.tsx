"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Bell,
  Check,
  Trash2,
  Info,
  CalendarCheck,
  Star,
  CreditCard,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Settings,
  Filter,
  X,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDialogPrompts, useNotificationStream } from "@/hooks";
import {
  notificationService,
  ApiError,
  type Notification,
  type NotificationCategory,
  type NotificationListResponse,
} from "@/lib/api";

type TabKey = "all" | NotificationCategory;

const CATEGORY_TABS: TabKey[] = [
  "all",
  "Bookings",
  "Payments",
  "Quotations",
  "Reviews",
  "System",
];

const PAGE_LIMIT = 20;

const getNotificationIcon = (category: string, type: string) => {
  if (category === "Bookings")
    return (
      <CalendarCheck
        className="w-5 h-5 text-[var(--color-action-primary)]"
        aria-hidden="true"
      />
    );
  if (category === "Payments")
    return (
      <CreditCard
        className="w-5 h-5 text-[var(--color-success-text)]"
        aria-hidden="true"
      />
    );
  if (category === "Reviews")
    return (
      <Star
        className="w-5 h-5 text-[var(--color-action-primary)]"
        aria-hidden="true"
      />
    );
  if (category === "Quotations")
    return (
      <Info
        className="w-5 h-5 text-[var(--color-action-primary)]"
        aria-hidden="true"
      />
    );
  if (type === "error" || type === "warning")
    return (
      <AlertTriangle
        className="w-5 h-5 text-[var(--color-error-text)]"
        aria-hidden="true"
      />
    );
  return (
    <Info
      className="w-5 h-5 text-[var(--color-text-secondary)]"
      aria-hidden="true"
    />
  );
};

const getIconBackground = (category: string, type: string) => {
  if (category === "Payments") return "bg-[var(--color-success-bg)]";
  if (category === "Bookings" || category === "Reviews" || category === "Quotations")
    return "bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]";
  if (type === "error" || type === "warning")
    return "bg-[var(--color-error-bg)]";
  return "bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]";
};

interface NotificationListProps {
  settingsHref?: string;
  /**
   * Optional per-portal deep-link resolver. When supplied and it returns a
   * non-null path, clicking a row navigates there in addition to marking it
   * read. Owner Portal passes nothing, so its rows keep the mark-read-only
   * behaviour — keeps this shared component portal-agnostic.
   */
  resolveHref?: (notification: Notification) => string | null;
}

export function NotificationList({
  settingsHref,
  resolveHref,
}: NotificationListProps = {}) {
  const t = useTranslations("dashboard.notifications");
  const locale = useLocale();
  const router = useRouter();
  const { confirm, dialogs } = useDialogPrompts();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
      }),
    [locale],
  );

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = (await notificationService.getAll({
        page,
        limit: PAGE_LIMIT,
        category: activeTab === "all" ? undefined : activeTab,
        unreadOnly: unreadOnly || undefined,
      })) as NotificationListResponse;

      setNotifications(response.notifications ?? []);
      setTotalPages(response.pagination?.totalPages ?? 1);
      setTotal(response.pagination?.total ?? 0);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("loadError"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, activeTab, unreadOnly, t]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Live refresh — the backend emits `notification:new` to the user's socket
  // room whenever any module creates a notification for them.
  useNotificationStream(() => {
    void fetchNotifications();
  });

  // next-intl's `t` is keyed to the static message tree; event keys arrive at
  // runtime inside `data._i18n`, so a string-keyed view of `t` is needed.
  const translate = t as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;

  const renderContent = (
    notification: Notification,
  ): { title: string; message: string } => {
    const i18n = notification.data?._i18n as
      | {
          titleKey: string;
          messageKey: string;
          params?: Record<string, string | number>;
        }
      | undefined;
    if (i18n?.titleKey && i18n?.messageKey) {
      return {
        title: translate(i18n.titleKey, i18n.params),
        message: translate(i18n.messageKey, i18n.params),
      };
    }
    return { title: notification.title, message: notification.message };
  };

  const handleTabChange = (tab: TabKey) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1);
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % CATEGORY_TABS.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + CATEGORY_TABS.length) % CATEGORY_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = CATEGORY_TABS.length - 1;
    else return;
    e.preventDefault();
    handleTabChange(CATEGORY_TABS[next]);
    tabRefs.current[next]?.focus();
  };

  const toggleUnreadOnly = () => {
    setUnreadOnly((prev) => !prev);
    setPage(1);
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch {
      setActionError(t("actionError"));
    }
  };

  const markAllAsRead = async () => {
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    if (unreadCount === 0) return;
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      // Re-sync: the backend marked every page read, not just this one.
      await fetchNotifications();
    } catch {
      setActionError(t("actionError"));
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await notificationService.delete(id);
      const remaining = notifications.filter((n) => n.id !== id);
      setNotifications(remaining);
      setTotal((prev) => Math.max(0, prev - 1));
      // Emptying a page beyond the first would otherwise strand the user on a
      // blank page with no pagination controls — step back one page.
      if (remaining.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch {
      setActionError(t("actionError"));
    }
  };

  const clearAll = async () => {
    if (notifications.length === 0) return;
    const confirmed = await confirm({
      title: t("clearAllTitle"),
      message: t("clearAllConfirm"),
      confirmText: t("clearAll"),
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      setIsClearing(true);
      await notificationService.deleteAll();
      setNotifications([]);
      setTotal(0);
      setTotalPages(1);
      setPage(1);
    } catch {
      setActionError(t("actionError"));
    } finally {
      setIsClearing(false);
    }
  };

  const handleRowActivate = (notification: Notification, href: string | null) => {
    if (!notification.isRead) {
      void markAsRead(notification.id);
    }
    if (href) {
      router.push(href);
    }
  };

  const hasUnread = notifications.some((n) => !n.isRead);
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const showingTo = Math.min(total, page * PAGE_LIMIT);

  return (
    <>
      <div className="bg-[var(--color-bg-base)] rounded-lg border border-[var(--color-border-default)] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
            <Bell
              className="w-5 h-5 text-[var(--color-action-primary)]"
              aria-hidden="true"
            />
            {t("listTitle")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {settingsHref && (
              <Link
                href={settingsHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-action-primary)] px-3 h-11 min-w-[44px] rounded-md border border-[var(--color-border-default)] hover:border-[var(--color-action-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("settingsLink")}</span>
              </Link>
            )}
            {hasUnread && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-action-primary)] px-3 h-11 min-w-[44px] rounded-md bg-[var(--color-bg-base)] border border-[var(--color-action-primary)] hover:bg-[var(--color-action-primary)] hover:text-[var(--color-primary-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("markAllRead")}</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                disabled={isClearing}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-error-text)] px-3 h-11 min-w-[44px] rounded-md border border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error-border)] focus-visible:ring-offset-2"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("clearAll")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs + Unread filter */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-default)] px-4 sm:px-6 bg-[var(--color-bg-base)]">
          <div
            role="tablist"
            aria-label={t("title")}
            className="flex gap-1 overflow-x-auto"
          >
            {CATEGORY_TABS.map((tab, index) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  tabIndex={isActive ? 0 : -1}
                  aria-selected={isActive}
                  aria-controls="notifications-panel"
                  onClick={() => handleTabChange(tab)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className={`whitespace-nowrap px-3 sm:px-4 h-11 min-w-[44px] text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2 ${
                    isActive
                      ? "border-[var(--color-action-primary)] text-[var(--color-action-primary)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {t(`tabs.${tab}`)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={toggleUnreadOnly}
            aria-pressed={unreadOnly}
            className={`flex-shrink-0 inline-flex items-center gap-2 h-11 min-w-[44px] px-3 text-sm font-medium rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2 ${
              unreadOnly
                ? "border-[var(--color-action-primary)] text-[var(--color-action-primary)] bg-[var(--color-bg-surface)]"
                : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Filter className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("unreadOnly")}</span>
          </button>
        </div>

        {/* Body */}
        <div id="notifications-panel" role="tabpanel">
          {actionError && (
            <div
              role="alert"
              className="m-4 sm:m-6 mb-0 p-4 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] flex items-center justify-between gap-3"
            >
              <p className="text-sm">{actionError}</p>
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label={t("dismiss")}
                className="p-2 w-11 h-11 rounded-md flex items-center justify-center hover:bg-[var(--color-error-border)]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error-border)] focus-visible:ring-offset-2"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {error ? (
            <div
              role="alert"
              className="m-4 sm:m-6 p-4 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm">{error}</p>
              <button
                type="button"
                onClick={fetchNotifications}
                className="text-sm font-medium underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error-border)] focus-visible:ring-offset-2 rounded-sm"
              >
                {t("retry")}
              </button>
            </div>
          ) : isLoading && notifications.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-[var(--color-bg-surface)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--color-border-default)]">
                <Bell
                  className="w-6 h-6 text-[var(--color-text-tertiary)]"
                  aria-hidden="true"
                />
              </div>
              <p className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                {unreadOnly ? t("emptyUnread") : t("empty")}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {unreadOnly ? t("emptyUnreadDesc") : t("emptyDesc")}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border-default)]">
              {notifications.map((notification) => {
                const isUnread = !notification.isRead;
                const href = resolveHref?.(notification) ?? null;
                const isInteractive = isUnread || href !== null;
                const { title, message } = renderContent(notification);
                return (
                  <li
                    key={notification.id}
                    className={`p-4 sm:p-6 transition-colors flex gap-4 hover:bg-[var(--color-bg-surface)] ${
                      isUnread
                        ? "bg-[var(--color-bg-surface)]/50"
                        : "bg-[var(--color-bg-base)]"
                    }`}
                  >
                    <div
                      role={isInteractive ? "button" : undefined}
                      tabIndex={isInteractive ? 0 : undefined}
                      onClick={
                        isInteractive
                          ? () => handleRowActivate(notification, href)
                          : undefined
                      }
                      onKeyDown={
                        isInteractive
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleRowActivate(notification, href);
                              }
                            }
                          : undefined
                      }
                      className={`flex flex-1 gap-4 min-w-0 rounded-md ${
                        isInteractive
                          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                          : ""
                      }`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        <div
                          className={`w-10 h-10 rounded-md flex items-center justify-center ${getIconBackground(
                            notification.category,
                            notification.type,
                          )}`}
                        >
                          {getNotificationIcon(
                            notification.category,
                            notification.type,
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h3
                            className={`text-base font-semibold truncate ${
                              isUnread
                                ? "text-[var(--color-text-primary)]"
                                : "text-[var(--color-text-secondary)]"
                            }`}
                          >
                            {title}
                          </h3>
                          <time
                            dateTime={notification.createdAt}
                            className="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap pt-1"
                          >
                            {dateFormatter.format(
                              new Date(notification.createdAt),
                            )}
                          </time>
                        </div>
                        <p
                          className={`text-sm break-words ${
                            isUnread
                              ? "text-[var(--color-text-primary)]"
                              : "text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {message}
                        </p>
                        <span className="mt-2 inline-block px-2 py-1 rounded-sm text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                          {t(`tabs.${notification.category}` as const)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-start">
                      <button
                        type="button"
                        onClick={() => deleteNotification(notification.id)}
                        aria-label={t("delete")}
                        className="p-2 w-11 h-11 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error-border)] focus-visible:ring-offset-2 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination Footer */}
          {!error && notifications.length > 0 && (
            <div className="p-4 sm:p-6 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)] flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("pagination.showing", {
                  count: `${showingFrom}–${showingTo}`,
                  total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="inline-flex items-center gap-1 h-11 min-w-[44px] px-3 text-sm font-medium rounded-md border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-default)] disabled:hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {t("pagination.previous")}
                  </span>
                </button>
                <span className="text-sm text-[var(--color-text-secondary)] px-2">
                  {t("pagination.pageOf", { page, totalPages })}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="inline-flex items-center gap-1 h-11 min-w-[44px] px-3 text-sm font-medium rounded-md border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-default)] disabled:hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2"
                >
                  <span className="hidden sm:inline">
                    {t("pagination.next")}
                  </span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {dialogs}
    </>
  );
}
