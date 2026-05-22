"use client";

import { useTranslations } from "next-intl";
import { DashboardLayoutClient } from "../DashboardLayoutClient";
import { NotificationList } from "@/components/dashboard/NotificationList";
import type { Notification } from "@/lib/api";

interface CustomerNotificationsPageProps {
  params: {
    locale: string;
  };
}

export default function CustomerNotificationsPage({
  params: { locale },
}: CustomerNotificationsPageProps) {
  const t = useTranslations("dashboard.notifications");

  // Deep-link a notification to its related record. Honours explicit ids in
  // the `data` payload, otherwise falls back to the relevant list page.
  const resolveHref = (notification: Notification): string | null => {
    const data = (notification.data ?? {}) as Record<string, unknown>;
    const bookingId =
      typeof data.bookingId === "string" ? data.bookingId : null;
    const quotationId =
      typeof data.quotationId === "string" ? data.quotationId : null;
    const base = `/${locale}/dashboard`;

    if (bookingId) return `${base}/bookings/${bookingId}`;
    if (quotationId) return `${base}/quotations`;

    switch (notification.category) {
      case "Bookings":
      case "Payments":
        return `${base}/bookings`;
      case "Quotations":
        return `${base}/quotations`;
      case "Reviews":
        return `${base}/reviews`;
      default:
        return null;
    }
  };

  return (
    <DashboardLayoutClient locale={locale}>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8 space-y-8">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          {t("title")}
        </h1>
        <p className="text-[var(--color-text-secondary)]">{t("subtitle")}</p>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8 space-y-8">
        <NotificationList
          settingsHref={`/${locale}/dashboard/settings`}
          resolveHref={resolveHref}
        />
      </div>
    </DashboardLayoutClient>
  );
}
