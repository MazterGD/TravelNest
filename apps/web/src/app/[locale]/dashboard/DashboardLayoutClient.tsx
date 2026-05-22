"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_NAME } from "@/constants";
import { useCustomerGuard, useNotificationStream } from "@/hooks";
import { useAuthStore } from "@/store";
import { messageService, notificationService } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui";

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  locale: string;
}

export function DashboardLayoutClient({
  children,
  locale,
}: DashboardLayoutClientProps) {
  const t = useTranslations("navigation");
  const tMsg = useTranslations("messages");
  const tNotif = useTranslations("dashboard.notifications");
  const pathname = usePathname();
  const router = useRouter();

  // Protect this route - only customers can access
  const { isLoading: guardLoading, isAuthorized } = useCustomerGuard();
  const { user, logout } = useAuthStore();
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState(0);

  // Surface unread notifications in the header bell. Re-polled on navigation
  // and refreshed live whenever the API emits a `notification:new` event.
  const refreshNotificationsUnread = useCallback(async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setNotificationsUnread(data?.unreadCount ?? 0);
    } catch {
      // A failed unread poll just leaves the badge hidden.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await messageService.getUnreadCount();
        if (!cancelled) setMessagesUnread(data?.unreadCount ?? 0);
      } catch {
        // A failed unread poll just leaves the badge hidden.
      }
    })();
    void (async () => {
      try {
        const data = await notificationService.getUnreadCount();
        if (!cancelled) setNotificationsUnread(data?.unreadCount ?? 0);
      } catch {
        // A failed unread poll just leaves the badge hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useNotificationStream(() => {
    void refreshNotificationsUnread();
  });

  const handleLogout = () => {
    logout();
    router.push(`/${locale}`);
  };

  const navItems = [
    {
      href: `/${locale}/dashboard`,
      label: t("dashboard"),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      href: `/${locale}/dashboard/quotations`,
      label: t("quotations"),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      href: `/${locale}/dashboard/bookings`,
      label: t("bookings"),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      href: `/${locale}/dashboard/messages`,
      label: t("messages"),
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      href: `/${locale}/dashboard/reviews`,
      label: t("reviews"),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ),
    },
    {
      href: `/${locale}/dashboard/notifications`,
      label: t("notifications", { defaultValue: "Notifications" }),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
    },
    {
      href: `/${locale}/dashboard/profile`,
      label: t("profile"),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      href: `/${locale}/dashboard/settings`,
      label: t("settings", { defaultValue: "Settings" }),
      icon: (
        <svg 
          className="w-5 h-5"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
          />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === `/${locale}/dashboard`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  // Show loading while checking auth state
  if (guardLoading || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href={`/${locale}`} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="font-bold text-lg text-foreground">
                {APP_NAME}
              </span>
            </Link>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <Link
                href={`/${locale}/dashboard/notifications`}
                className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
                title={t("notifications", { defaultValue: "Notifications" })}
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
                {notificationsUnread > 0 && (
                  <span
                    className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-error-border)] px-1.5 text-xs font-semibold text-[var(--color-primary-foreground)]"
                    aria-label={tNotif("unreadBadge", {
                      count: notificationsUnread,
                    })}
                  >
                    {notificationsUnread > 99 ? "99+" : notificationsUnread}
                  </span>
                )}
              </Link>

              {/* Profile Dropdown */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {user?.firstName?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-foreground">
                    {user?.firstName}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
                  title={t("logout", { defaultValue: "Logout" })}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-64 min-h-[calc(100vh-4rem)] bg-background border-r border-border">
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const showMessagesBadge =
                  item.href.endsWith("/dashboard/messages") &&
                  messagesUnread > 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        isActive(item.href)
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                      {showMessagesBadge && (
                        <span
                          className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-error-border)] px-1.5 text-xs font-semibold text-[var(--color-primary-foreground)]"
                          aria-label={tMsg("unreadBadge", {
                            count: messagesUnread,
                          })}
                        >
                          {messagesUnread > 99 ? "99+" : messagesUnread}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">{t("backToHome")}</span>
            </Link>
          </div>
        </aside>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border">
          <div className="flex items-center justify-around py-2">
            {navItems.slice(0, 5).map((item) => {
              const showMessagesBadge =
                item.href.endsWith("/dashboard/messages") &&
                messagesUnread > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                    isActive(item.href)
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="relative">
                    {item.icon}
                    {showMessagesBadge && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--color-error-border)]"
                      />
                    )}
                  </span>
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
