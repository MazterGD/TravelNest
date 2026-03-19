"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect, useSyncExternalStore } from "react";
import { Menu, X, LogOut, User } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuthStore } from "@/store";
import { getDashboardUrl } from "@/lib/utils/getDashboardUrl";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Header() {
  const t = useTranslations("navigation");
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    router.push(`/${locale}`);
  };

  const showAuthenticatedUI =
    isHydrated && !isLoading && isAuthenticated && user;

  const homeUrl = showAuthenticatedUI
    ? getDashboardUrl(user, locale)
    : `/${locale}`;

  const navigation = [
    { name: t("home"), href: homeUrl },
    { name: t("search"), href: `/${locale}/search` },
    { name: t("howItWorks"), href: `/${locale}/how-it-works` },
    { name: t("about"), href: `/${locale}/about` },
    { name: t("contact"), href: `/${locale}/contact` },
  ];

  return (
    <header
      className={`sticky top-0 z-50 border-b border-border bg-white/95 shadow-sm backdrop-blur-md transition-all duration-300 ${
        scrolled ? "shadow-sm" : "shadow-none"
      }`}
    >
      <nav className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href={homeUrl} className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
                <span className="text-lg font-bold text-white">TN</span>
              </div>
              <span className="text-xl font-bold text-foreground">
                TravelNest
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <LanguageSwitcher />
            {showAuthenticatedUI ? (
              <>
                <Link
                  href={
                    user.role === "VEHICLE_OWNER"
                      ? `/${locale}/owner/profile`
                      : getDashboardUrl(user, locale)
                  }
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <User className="h-4 w-4" />
                  {user.firstName}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-xl border border-error-border bg-error-bg px-4 py-2 text-sm font-medium text-error-foreground hover:opacity-80 transition-opacity"
                >
                  <LogOut className="h-4 w-4" />
                  {t("logout", { defaultValue: "Logout" })}
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/${locale}/login`}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("login")}
                </Link>
                <Link
                  href={`/${locale}/register`}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-primary-hover"
                >
                  {t("register")}
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center space-x-2 md:hidden">
            <LanguageSwitcher />
            <button
              type="button"
              aria-label={t("openMenu")}
              className="inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border md:hidden">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block rounded-xl px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="border-t border-border pb-1 pt-4">
              {showAuthenticatedUI ? (
                <>
                  <Link
                    href={
                      user.role === "VEHICLE_OWNER"
                        ? `/${locale}/owner/profile`
                        : getDashboardUrl(user, locale)
                    }
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    {user.role === "VEHICLE_OWNER"
                      ? t("profile")
                      : t("dashboardFor", { name: user.firstName })}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout", { defaultValue: "Logout" })}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/${locale}/login`}
                    className="block rounded-xl px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("login")}
                  </Link>
                  <Link
                    href={`/${locale}/register`}
                    className="block rounded-xl px-3 py-2 text-base font-medium text-primary hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("register")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
