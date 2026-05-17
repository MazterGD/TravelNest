"use client";

import { useTranslations } from "next-intl";
import { DashboardLayoutClient } from "../DashboardLayoutClient";
import { NotificationList } from "@/components/dashboard/NotificationList";

interface CustomerNotificationsPageProps {
  params: {
    locale: string;
  };
}

export default function CustomerNotificationsPage({ params: { locale } }: CustomerNotificationsPageProps) {
  const t = useTranslations("dashboard");

  return (
    <DashboardLayoutClient locale={locale}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t("notifications.title", { defaultValue: "My Notifications" })}
        </h1>
        <p className="text-gray-600">
          {t("notifications.subtitle", { defaultValue: "Stay updated on your bookings and account activity." })}
        </p>
      </div>
      
      <NotificationList />
    </DashboardLayoutClient>
  );
}
