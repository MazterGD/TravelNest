"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Coins,
  FileText,
  Gauge,
  LogOut,
  Menu,
  Package,
  Settings,
  Shield,
  ShieldCheck,
  Star,
  Truck,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/store";
import { useNotificationStream } from "@/hooks";
import { authService, api, notificationService } from "@/lib/api";
import { APP_NAME } from "@/constants";

interface AdminSidebarProps {
  locale: string;
}

const ring =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

type AdminNavItem = {
  id: string;
  label: string;
  href: string;
  icon: typeof Gauge;
  exact?: boolean;
  badge?: number;
};

type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export function AdminSidebar({ locale }: AdminSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations("adminNav");
  const tCommon = useTranslations("navigation");
  const { user, logout } = useAuthStore();

  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const currentLocale = (params.locale as string) || locale;

  // ── Unread notification polling ────────────────────────────────────────────

  const refreshUnread = useCallback(async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setNotificationsUnread(data?.unreadCount ?? 0);
    } catch {
      // Failed poll just leaves the badge hidden.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const n = await notificationService.getUnreadCount();
        if (!cancelled) setNotificationsUnread(n?.unreadCount ?? 0);
      } catch {
        // Failed poll just leaves the badge hidden.
      }
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

  // Mobile drawer closes via onClick handlers on the nav links rather than
  // a pathname effect, so we don't trigger a cascading render on every route.

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLogout = () => {
    setUserMenuOpen(false);
    authService.logout().catch(() => {});
    logout();
    localStorage.removeItem("travenest-auth");
    api.stopTokenRefresh();
    window.location.replace(`/${currentLocale}`);
  };

  // ── Grouped navigation ─────────────────────────────────────────────────────

  const groups: AdminNavGroup[] = [
    {
      id: "overview",
      label: t("groups.overview"),
      items: [
        {
          id: "dashboard",
          label: t("items.dashboard"),
          href: `/${locale}/admin/dashboard`,
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
          id: "users",
          label: t("items.users"),
          href: `/${locale}/admin/users`,
          icon: Users,
        },
        {
          id: "bookings",
          label: t("items.bookings"),
          href: `/${locale}/admin/bookings`,
          icon: Calendar,
        },
        {
          id: "disputes",
          label: t("items.disputes"),
          href: `/${locale}/admin/disputes`,
          icon: AlertTriangle,
        },
      ],
    },
    {
      id: "trust",
      label: t("groups.trust"),
      items: [
        {
          id: "owner-verifications",
          label: t("items.ownerVerifications"),
          href: `/${locale}/admin/verifications/owners`,
          icon: ShieldCheck,
        },
        {
          id: "vehicle-verifications",
          label: t("items.vehicleVerifications"),
          href: `/${locale}/admin/verifications/vehicles`,
          icon: Truck,
        },
        {
          id: "review-moderation",
          label: t("items.reviewModeration"),
          href: `/${locale}/admin/reviews/moderation`,
          icon: Star,
        },
      ],
    },
    {
      id: "finance",
      label: t("groups.finance"),
      items: [
        {
          id: "financial",
          label: t("items.financial"),
          href: `/${locale}/admin/financial`,
          icon: Coins,
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
          href: `/${locale}/admin/analytics`,
          icon: BarChart3,
        },
        {
          id: "reports",
          label: t("items.reports"),
          href: `/${locale}/admin/reports`,
          icon: FileText,
        },
      ],
    },
    {
      id: "catalog",
      label: t("groups.catalog"),
      items: [
        {
          id: "content",
          label: t("items.content"),
          href: `/${locale}/admin/content`,
          icon: ClipboardList,
        },
        {
          id: "amenities",
          label: t("items.amenities"),
          href: `/${locale}/admin/amenities`,
          icon: Package,
        },
      ],
    },
    {
      id: "system",
      label: t("groups.system"),
      items: [
        {
          id: "settings",
          label: t("items.settings"),
          href: `/${locale}/admin/settings`,
          icon: Settings,
        },
        {
          id: "notifications",
          label: t("items.notifications"),
          href: `/${locale}/admin/notifications`,
          icon: Bell,
          badge: notificationsUnread,
        },
        {
          id: "audit-logs",
          label: t("items.auditLogs"),
          href: `/${locale}/admin/audit-logs`,
          icon: Activity,
        },
      ],
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

  // ── Shared inner content (used by both desktop rail and mobile drawer) ─────

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
            href={`/${locale}/admin/dashboard`}
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
            href={`/${locale}/admin/dashboard`}
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
                const active = isActive(item.href, item.exact);
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
    <div
      ref={userMenuRef}
      className="relative px-2 pb-5 pt-3 border-t border-[var(--color-border-default)]"
    >
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
                href={`/${locale}/admin/profile`}
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
          aria-label={`${displayName || "Admin"} — ${t("openAccountMenu")}`}
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
              initials || "A"
            )}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                  {displayName || "—"}
                </p>
                <p className="text-[11px] text-[var(--color-text-tertiary)] truncate leading-tight mt-0.5 inline-flex items-center gap-1">
                  <Shield className="h-3 w-3" aria-hidden="true" />
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

      {/* ── Mobile top bar (only menu trigger + brand, no global header) ─── */}
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
          href={`/${locale}/admin/dashboard`}
          className={cn("inline-flex items-center gap-2 rounded-lg", ring)}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-primary)] text-white font-bold text-xs select-none">
            T
          </div>
          <span className="font-bold text-sm text-[var(--color-text-primary)]">
            {APP_NAME} <span className="text-[var(--color-text-tertiary)] font-medium">· {t("badge")}</span>
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
            initials || "A"
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
                href={`/${locale}/admin/dashboard`}
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
