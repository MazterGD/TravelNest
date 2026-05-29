"use client";

import { useMemo } from "react";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAdminGuard } from "@/hooks";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const ROUTE_KEYS: Array<{ match: RegExp; key: string }> = [
  { match: /\/admin\/dashboard(?:\/|$)/, key: "dashboard" },
  { match: /\/admin\/users(?:\/|$)/, key: "users" },
  { match: /\/admin\/bookings(?:\/|$)/, key: "bookings" },
  { match: /\/admin\/analytics(?:\/|$)/, key: "analytics" },
  { match: /\/admin\/disputes(?:\/|$)/, key: "disputes" },
  { match: /\/admin\/financial(?:\/|$)/, key: "financial" },
  { match: /\/admin\/settings(?:\/|$)/, key: "settings" },
  { match: /\/admin\/content(?:\/|$)/, key: "content" },
  { match: /\/admin\/amenities(?:\/|$)/, key: "amenities" },
  { match: /\/admin\/notifications(?:\/|$)/, key: "notifications" },
  { match: /\/admin\/audit-logs(?:\/|$)/, key: "auditLogs" },
  { match: /\/admin\/reports(?:\/|$)/, key: "reports" },
  { match: /\/admin\/profile(?:\/|$)/, key: "profile" },
  { match: /\/admin\/verifications\/owners(?:\/|$)/, key: "ownerVerifications" },
  { match: /\/admin\/verifications\/vehicles(?:\/|$)/, key: "vehicleVerifications" },
  { match: /\/admin\/reviews\/moderation(?:\/|$)/, key: "reviewModeration" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("adminNav");
  const tShell = useTranslations("adminShell");
  const { isLoading, isAuthorized } = useAdminGuard();

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
    <div className="flex min-h-screen bg-[var(--color-bg-surface)]">
      <AdminSidebar locale={locale} />

      <div className="flex flex-1 min-w-0 flex-col">
        <header className="hidden md:block sticky top-0 z-20 border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg-base)]/80">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-1 px-6 py-4 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {tShell("breadcrumbRoot")}
            </p>
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
              {t(`items.${pageKey}`)}
            </h1>
          </div>
        </header>

        <main className="flex-1 px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1280px]">
            <div className="md:hidden mb-4">
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
      </div>
    </div>
  );
}
