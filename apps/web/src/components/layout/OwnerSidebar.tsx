"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Bus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  FileText,
  Gauge,
  Globe,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Send,
  ShieldAlert,
  Star,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/store";
import { useNotificationStream } from "@/hooks";
import { authService, api, messageService, notificationService } from "@/lib/api";
import { APP_NAME, LOCALE_LABELS } from "@/constants";

interface OwnerSidebarProps {
  locale: string;
}

const ring =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

type OwnerNavItem = {
  id: string;
  label: string;
  href: string;
  icon: typeof Gauge;
  exact?: boolean;
  badge?: number;
};

type OwnerNavGroup = {
  id: string;
  label: string;
  items: OwnerNavItem[];
};

export function OwnerSidebar({ locale }: OwnerSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("ownerNav");
  const tCommon = useTranslations("navigation");
  const { user, logout } = useAuthStore();

  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const currentLocale = (params.locale as string) || locale;
  const locales = ["en", "si", "ta"] as const;

  // ── Unread polling ─────────────────────────────────────────────────────────

  const refreshUnread = useCallback(async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setNotificationsUnread(data?.unreadCount ?? 0);
    } catch {
      // Failed poll leaves badge hidden.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const n = await notificationService.getUnreadCount();
        if (!cancelled) setNotificationsUnread(n?.unreadCount ?? 0);
      } catch {}
    })();
    void (async () => {
      try {
        const m = await messageService.getUnreadCount();
        if (!cancelled) setMessagesUnread(m?.unreadCount ?? 0);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useNotificationStream(() => {
    void refreshUnread();
  });

  // ── Close menus on outside click ───────────────────────────────────────────

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLogout = () => {
    setUserMenuOpen(false);
    authService.logout().catch(() => {});
    logout();
    localStorage.removeItem("travenest-auth");
    api.stopTokenRefresh();
    window.location.replace(`/${currentLocale}`);
  };

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === currentLocale) {
      setLangOpen(false);
      return;
    }
    const newPathname = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPathname);
    setLangOpen(false);
  };

  // ── Grouped navigation ─────────────────────────────────────────────────────

  const groups: OwnerNavGroup[] = [
    {
      id: "overview",
      label: t("groups.overview"),
      items: [
        {
          id: "dashboard",
          label: t("items.dashboard"),
          href: `/${locale}/owner/dashboard`,
          icon: Gauge,
          exact: true,
        },
      ],
    },
    {
      id: "operations",
      label: t("groups.operations"),
      items: [
        {
          id: "quotations",
          label: t("items.quotations"),
          href: `/${locale}/owner/quotations`,
          icon: FileText,
        },
        {
          id: "sent-quotes",
          label: t("items.sentQuotes"),
          href: `/${locale}/owner/quotations/sent`,
          icon: Send,
        },
        {
          id: "bookings",
          label: t("items.bookings"),
          href: `/${locale}/owner/bookings`,
          icon: Calendar,
        },
      ],
    },
    {
      id: "fleet",
      label: t("groups.fleet"),
      items: [
        {
          id: "fleet",
          label: t("items.fleet"),
          href: `/${locale}/owner/fleet`,
          icon: Bus,
        },
        {
          id: "packages",
          label: t("items.packages"),
          href: `/${locale}/owner/packages`,
          icon: Package,
        },
      ],
    },
    {
      id: "insights",
      label: t("groups.insights"),
      items: [
        {
          id: "analytics",
          label: t("items.analytics"),
          href: `/${locale}/owner/analytics`,
          icon: BarChart3,
        },
        {
          id: "earnings",
          label: t("items.earnings"),
          href: `/${locale}/owner/earnings`,
          icon: Coins,
        },
        {
          id: "reviews",
          label: t("items.reviews"),
          href: `/${locale}/owner/reviews`,
          icon: Star,
        },
      ],
    },
    {
      id: "communication",
      label: t("groups.communication"),
      items: [
        {
          id: "messages",
          label: t("items.messages"),
          href: `/${locale}/owner/messages`,
          icon: MessageSquare,
          badge: messagesUnread,
        },
        {
          id: "notifications",
          label: t("items.notifications"),
          href: `/${locale}/owner/notifications`,
          icon: Bell,
          badge: notificationsUnread,
        },
        {
          id: "disputes",
          label: t("items.disputes"),
          href: `/${locale}/owner/disputes`,
          icon: ShieldAlert,
        },
      ],
    },
  ];

  // "quotations" (incoming requests) must not stay active when on /sent sub-pages.
  const isActive = (item: OwnerNavItem) => {
    if (item.exact) return pathname === item.href;
    if (item.id === "quotations") {
      return (
        pathname.startsWith(item.href) &&
        !pathname.startsWith(`${item.href}/sent`)
      );
    }
    return pathname.startsWith(item.href);
  };

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ── Shared inner content ───────────────────────────────────────────────────

  const renderBrand = (collapsed: boolean) => (
    <div
      className={cn(
        "flex items-center border-b border-[var(--color-border-default)]",
        collapsed
          ? "justify-center gap-1.5 px-1 py-[18px]"
          : "justify-between px-4 py-[18px]",
      )}
    >
      {collapsed ? (
        <>
          <Link
            href={`/${locale}/owner/dashboard`}
            aria-label={APP_NAME}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-primary)] text-white font-bold text-sm select-none",
              ring,
            )}
          >
            T
          </Link>
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            aria-label={t("expandSidebar")}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors",
              ring,
            )}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <Link
            href={`/${locale}/owner/dashboard`}
            className={cn("inline-flex items-center gap-2.5 rounded-lg", ring)}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-primary)] text-white font-bold text-sm select-none">
              T
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-[15px] text-[var(--color-text-primary)] whitespace-nowrap">
                {APP_NAME}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                {t("badge")}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label={t("collapseSidebar")}
            className={cn(
              "hidden md:flex h-7 w-7 items-center justify-center rounded-lg",
              "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors",
              ring,
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );

  const renderNav = (collapsed: boolean, onItemClick?: () => void) => (
    <nav
      className="flex-1 overflow-y-auto px-2 py-3"
      aria-label={t("primaryNavLabel")}
    >
      <ul className="space-y-4" role="list">
        {groups.map((group) => (
          <li key={group.id}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                const badge = item.badge ?? 0;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onItemClick}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
                        collapsed ? "justify-center px-0" : "px-3",
                        ring,
                        active
                          ? "bg-[var(--color-action-primary)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        {collapsed && badge > 0 && (
                          <span
                            aria-hidden="true"
                            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-error-border)]"
                          />
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {badge > 0 && (
                            <span
                              className={cn(
                                "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                                active
                                  ? "bg-white text-[var(--color-action-primary)]"
                                  : "bg-[var(--color-error-border)] text-white",
                              )}
                              aria-label={`${badge} unread`}
                            >
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );

  const renderFooter = (collapsed: boolean, onItemClick?: () => void) => (
    <div className="px-2 pb-5 pt-3 space-y-0.5 border-t border-[var(--color-border-default)]">
      {/* Language switcher — hidden when collapsed */}
      {!collapsed && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen(!langOpen)}
            aria-expanded={langOpen}
            aria-haspopup="listbox"
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
              "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
              ring,
            )}
          >
            <Globe className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left truncate">
              {LOCALE_LABELS[currentLocale as keyof typeof LOCALE_LABELS]}
            </span>
            <ChevronUp
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                !langOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>

          {langOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                aria-hidden="true"
                onClick={() => setLangOpen(false)}
              />
              <ul
                role="listbox"
                aria-label={t("openMenu")}
                className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] shadow-lg overflow-hidden"
              >
                {locales.map((loc) => (
                  <li key={loc} role="option" aria-selected={loc === currentLocale}>
                    <button
                      type="button"
                      onClick={() => handleLocaleChange(loc)}
                      className={cn(
                        "flex w-full items-center px-4 py-3 text-sm font-medium transition-colors",
                        loc === currentLocale
                          ? "bg-[var(--color-action-primary)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      {LOCALE_LABELS[loc]}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* User pill + dropdown */}
      <div ref={userMenuRef} className="relative">
        {userMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              aria-hidden="true"
              onClick={() => setUserMenuOpen(false)}
            />
            <div
              className={cn(
                "absolute z-50 mx-3 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] shadow-lg overflow-hidden",
                collapsed
                  ? "bottom-2 left-full ml-2 w-52"
                  : "bottom-full left-0 right-0 mb-2",
              )}
            >
              <div className="p-1.5">
                <Link
                  href={`/${locale}/owner/profile`}
                  onClick={() => {
                    setUserMenuOpen(false);
                    onItemClick?.();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
                    ring,
                  )}
                >
                  <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {tCommon("profile")}
                </Link>

                <div className="my-1 h-px bg-[var(--color-border-default)]" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    "text-[var(--color-text-secondary)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error-text)]",
                    ring,
                  )}
                >
                  <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {tCommon("logout")}
                </button>
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
          aria-label={`${displayName || "Owner"} — ${t("openAccountMenu")}`}
          className={cn(
            "flex w-full items-center gap-3 rounded-[20px] border transition-colors",
            "bg-[var(--color-bg-surface)] border-[var(--color-border-default)]",
            "hover:border-[var(--color-action-primary)]/40 hover:bg-[var(--color-bg-base)]",
            collapsed ? "justify-center p-1.5" : "px-3 py-2.5",
            ring,
          )}
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-action-primary)] text-white text-xs font-semibold select-none overflow-hidden">
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt={displayName}
                className="h-9 w-9 object-cover"
              />
            ) : (
              initials || "O"
            )}
            {isCollapsed && (notificationsUnread > 0 || messagesUnread > 0) && (
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-bg-base)] bg-[var(--color-error-border)]"
              />
            )}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                  {displayName || "—"}
                </p>
                <p className="text-[11px] text-[var(--color-text-tertiary)] truncate leading-tight mt-0.5 inline-flex items-center gap-1">
                  <Bus className="h-3 w-3" aria-hidden="true" />
                  {user?.email ?? ""}
                </p>
              </div>
              <ChevronUp
                className={cn(
                  "h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200",
                  !userMenuOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 shrink-0",
          "bg-[var(--color-bg-base)] border-r border-[var(--color-border-default)]",
          "transition-[width] duration-200 ease-in-out overflow-hidden",
          isCollapsed ? "w-16" : "w-64",
        )}
        aria-label={t("sidebarLabel")}
      >
        {renderBrand(isCollapsed)}
        {renderNav(isCollapsed)}
        {renderFooter(isCollapsed)}
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────────────────── */}
      <div
        className={cn(
          "md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3",
          "bg-[var(--color-bg-base)] border-b border-[var(--color-border-default)]",
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t("openMenu")}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors",
            ring,
          )}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link
          href={`/${locale}/owner/dashboard`}
          className={cn("inline-flex items-center gap-2 rounded-lg", ring)}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-primary)] text-white font-bold text-xs select-none">
            T
          </div>
          <span className="font-bold text-sm text-[var(--color-text-primary)]">
            {APP_NAME}{" "}
            <span className="text-[var(--color-text-tertiary)] font-medium">
              · {t("badge")}
            </span>
          </span>
        </Link>
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-action-primary)] text-white text-xs font-semibold select-none">
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={displayName}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            initials || "O"
          )}
          {(notificationsUnread > 0 || messagesUnread > 0) && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-bg-base)] bg-[var(--color-error-border)]"
            />
          )}
        </div>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[var(--color-text-primary)]/40"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={cn(
              "relative flex h-full w-72 max-w-[85%] flex-col",
              "bg-[var(--color-bg-base)] border-r border-[var(--color-border-default)] shadow-xl",
            )}
            aria-label={t("sidebarLabel")}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-4 py-[18px]">
              <Link
                href={`/${locale}/owner/dashboard`}
                className={cn("inline-flex items-center gap-2.5 rounded-lg", ring)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-primary)] text-white font-bold text-sm select-none">
                  T
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-bold text-[15px] text-[var(--color-text-primary)] whitespace-nowrap">
                    {APP_NAME}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    {t("badge")}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t("closeMenu")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors",
                  ring,
                )}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {renderNav(false, () => setMobileOpen(false))}
            {renderFooter(false, () => setMobileOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}
