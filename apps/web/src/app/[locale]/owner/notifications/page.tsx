"use client";

import { useLocale, useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { NotificationList } from "@/components/dashboard/NotificationList";
import { useOwnerGuard } from "@/hooks";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Notification } from "@/lib/api";

export default function OwnerNotificationsPage() {
  const t = useTranslations("dashboard.notifications");
  const locale = useLocale();
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  // Deep-link a notification to the relevant owner section. Owner routes are
  // list-level (no per-booking owner detail route), so this resolves to the
  // section landing page.
  const resolveHref = (notification: Notification): string | null => {
    const base = `/${locale}/owner`;
    switch (notification.category) {
      case "Bookings":
        return `${base}/bookings`;
      case "Payments":
        return `${base}/earnings`;
      case "Quotations":
        return `${base}/quotations`;
      case "Reviews":
        return `${base}/reviews`;
      default:
        return null;
    }
  };

  if (guardLoading || !isAuthorized) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-[var(--color-bg-surface)] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              {t("title")}
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              {t("subtitle")}
            </p>
          </div>

          <NotificationList
            settingsHref={`/${locale}/owner/profile`}
            resolveHref={resolveHref}
          />
        </div>
      </div>
    </MainLayout>
  );
}
