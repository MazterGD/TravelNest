"use client";

import { useMemo } from "react";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui";
import { OwnerSidebar } from "@/components/layout/OwnerSidebar";
import { useOwnerGuard } from "@/hooks";
import { Footer } from "@/components/layout/Footer";

interface OwnerLayoutProps {
  children: React.ReactNode;
}

const ROUTE_KEYS: Array<{ match: RegExp; key: string }> = [
  { match: /\/owner\/dashboard(?:\/|$)/, key: "dashboard" },
  { match: /\/owner\/quotations\/sent(?:\/|$)/, key: "sentQuotes" },
  { match: /\/owner\/quotations(?:\/|$)/, key: "quotations" },
  { match: /\/owner\/bookings(?:\/|$)/, key: "bookings" },
  { match: /\/owner\/fleet(?:\/|$)/, key: "fleet" },
  { match: /\/owner\/packages(?:\/|$)/, key: "packages" },
  { match: /\/owner\/analytics(?:\/|$)/, key: "analytics" },
  { match: /\/owner\/earnings(?:\/|$)/, key: "earnings" },
  { match: /\/owner\/reviews(?:\/|$)/, key: "reviews" },
  { match: /\/owner\/messages(?:\/|$)/, key: "messages" },
  { match: /\/owner\/notifications(?:\/|$)/, key: "notifications" },
  { match: /\/owner\/profile(?:\/|$)/, key: "profile" },
  { match: /\/owner\/settings(?:\/|$)/, key: "settings" },
];

export default function OwnerLayout({ children }: OwnerLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("ownerNav");
  const tShell = useTranslations("ownerShell");
  const { isLoading, isAuthorized } = useOwnerGuard();

  const pageKey = useMemo(() => {
    const match = ROUTE_KEYS.find((entry) => entry.match.test(pathname));
    return match?.key ?? "dashboard";
  }, [pathname]);

  if (isLoading || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-[var(--color-bg-surface)]">
      <OwnerSidebar locale={locale} />

      <div className="flex flex-1 min-w-0 flex-col">
        <main className="flex-1 pb-20 md:pb-12">
          <div className="mx-auto w-full max-w-[1280px]">
            <div className="md:hidden mb-4 px-4 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {tShell("breadcrumbRoot")}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
                {t(`items.${pageKey}`)}
              </h1>
            </div>

            {children}
          </div>
        </main>
        {/* Footer is desktop-only on the owner portal. */}
        <div className="hidden md:block">
          <Footer />
        </div>
      </div>
    </div>
  );
}
