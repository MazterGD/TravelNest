"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Globe,
  Home,
  LogOut,
  MapPin,
  MessageSquare,
  Route,
  Settings,
  Star,
  User,
  Bus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/store";
import { useNotificationStream } from "@/hooks";
import { authService, api, messageService, notificationService } from "@/lib/api";
import { APP_NAME, LOCALE_LABELS } from "@/constants";

interface CustomerSidebarProps {
  locale: string;
}

const ring =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

export function CustomerSidebar({ locale }: CustomerSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("navigation");
  const { user, logout } = useAuthStore();

  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const currentLocale = (params.locale as string) || locale;
  const locales = ["en", "si", "ta"] as const;

  // ── Unread polling ─────────────────────────────────────────────────────────

  const refreshUnread = useCallback(async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setNotificationsUnread(data?.unreadCount ?? 0);
    } catch {}
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

  // ── Close user menu on outside click ───────────────────────────────────────

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
    // Hard navigation prevents auth guards on the current page from
    // racing to redirect to /login before the router push resolves.
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

  // ── Data ───────────────────────────────────────────────────────────────────

  const navItems = [
    {
      id: "overview",
      label: t("dashboard"),
      href: `/${locale}/dashboard`,
      icon: Home,
      exact: true,
    },
    {
      id: "trips",
      label: t("trips", { defaultValue: "Trips" }),
      href: `/${locale}/dashboard/trips`,
      icon: Route,
    },
    {
      id: "search",
      label: t("searchBuses", { defaultValue: "Search Buses" }),
      href: `/${locale}/dashboard/search`,
      icon: Bus,
    },
    {
      id: "packages",
      label: t("packages", { defaultValue: "Packages" }),
      href: `/${locale}/dashboard/packages`,
      icon: MapPin,
    },
    {
      id: "bookings",
      label: t("bookings"),
      href: `/${locale}/dashboard/bookings`,
      icon: Calendar,
    },
    {
      id: "messages",
      label: t("messages"),
      href: `/${locale}/dashboard/messages`,
      icon: MessageSquare,
      badge: messagesUnread,
    },
    {
      id: "reviews",
      label: t("reviews", { defaultValue: "Reviews" }),
      href: `/${locale}/dashboard/reviews`,
      icon: Star,
    },
  ];

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const mobileNavIds = ["overview", "bookings", "trips", "messages", "reviews"];
  const mobileNavItems = mobileNavIds
    .map((id) => navItems.find((item) => item.id === id))
    .filter(Boolean) as (typeof navItems)[number][];

  // ── Render ─────────────────────────────────────────────────────────────────

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
        aria-label="Customer portal navigation"
      >
        {/* Brand + collapse toggle */}
        <div
          className={cn(
            "flex items-center border-b border-[var(--color-border-default)]",
            isCollapsed
              ? "justify-center gap-1.5 px-1 py-[18px]"
              : "justify-between px-4 py-[18px]",
          )}
        >
          {isCollapsed ? (
            <>
              <Link
                href={`/${locale}`}
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
                aria-label="Expand sidebar"
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
                href={`/${locale}`}
                className={cn("inline-flex items-center gap-2.5 rounded-lg", ring)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-primary)] text-white font-bold text-sm select-none">
                  T
                </div>
                <span className="font-bold text-[15px] text-[var(--color-text-primary)] whitespace-nowrap">
                  {APP_NAME}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                aria-label="Collapse sidebar"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg",
                  "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors",
                  ring,
                )}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto px-2 py-3"
          aria-label="Main navigation"
        >
          <ul className="space-y-0.5" role="list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, "exact" in item ? item.exact : false);
              const badge = "badge" in item ? (item.badge as number) : 0;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
                      isCollapsed ? "justify-center px-0" : "px-3",
                      ring,
                      active
                        ? "bg-[var(--color-action-primary)] text-white"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
                    )}
                  >
                    <span className="relative shrink-0">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      {isCollapsed && badge > 0 && (
                        <span
                          aria-hidden="true"
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-error-border)]"
                        />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge > 0 && (
                          <span
                            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-error-border)] px-1.5 text-xs font-semibold text-white"
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
        </nav>

        {/* Footer: language + back to home */}
        <div
          className={cn(
            "px-2 py-2 space-y-0.5 border-t border-[var(--color-border-default)]",
          )}
        >
          {/* Language switcher — hidden when collapsed */}
          {!isCollapsed && (
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
                    aria-label="Select language"
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
        </div>

        {/* User pill + dropdown */}
        <div
          ref={userMenuRef}
          className={cn(
            "relative px-2 pb-5",
          )}
        >
          {/* Dropdown — anchors differently based on collapsed state */}
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
                  isCollapsed
                    ? // Collapsed: opens to the right of the sidebar
                      "bottom-2 left-full ml-2 w-52"
                    : // Expanded: opens above the pill, full-width
                      "bottom-full left-0 right-0 mb-2",
                )}
              >
                <div className="p-1.5">
                  <Link
                    href={`/${locale}/dashboard/profile`}
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
                      ring,
                    )}
                  >
                    <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t("profile")}
                  </Link>
                  <Link
                    href={`/${locale}/dashboard/settings`}
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
                      ring,
                    )}
                  >
                    <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t("settings", { defaultValue: "Settings" })}
                  </Link>
                  <Link
                    href={`/${locale}/dashboard/notifications`}
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
                      ring,
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t("notifications", { defaultValue: "Notifications" })}
                    </span>
                    {notificationsUnread > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-error-border)] px-1.5 text-xs font-semibold text-white">
                        {notificationsUnread > 99 ? "99+" : notificationsUnread}
                      </span>
                    )}
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
                    {t("logout")}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Pill button */}
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label={`${displayName || "Account"} — open account menu`}
            className={cn(
              "flex w-full items-center gap-3 rounded-[20px] border transition-colors",
              "bg-[var(--color-bg-surface)] border-[var(--color-border-default)]",
              "hover:border-[var(--color-action-primary)]/40 hover:bg-[var(--color-bg-base)]",
              isCollapsed ? "justify-center p-1.5" : "px-3 py-2.5",
              ring,
            )}
          >
            {/* Avatar */}
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-action-primary)] text-white text-xs font-semibold select-none overflow-hidden">
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="h-9 w-9 object-cover"
                />
              ) : (
                initials || "U"
              )}
              {/* Notification dot visible in collapsed state */}
              {isCollapsed && notificationsUnread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-bg-base)] bg-[var(--color-error-border)]"
                />
              )}
            </div>

            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                    {displayName || "—"}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] truncate leading-tight mt-0.5">
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
      </aside>

      {/* ── Mobile bottom navigation ─────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-base)] border-t border-[var(--color-border-default)]"
        aria-label="Customer navigation"
      >
        <div className="flex items-center justify-around py-1 px-2">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, "exact" in item ? item.exact : false);
            const badge = "badge" in item ? (item.badge as number) : 0;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] min-w-[44px] justify-center rounded-lg transition-colors",
                  ring,
                  active
                    ? "text-[var(--color-action-primary)]"
                    : "text-[var(--color-text-tertiary)]",
                )}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  {badge > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--color-error-border)]"
                    />
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
