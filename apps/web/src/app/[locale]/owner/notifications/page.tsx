"use client";

import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { NotificationList } from "@/components/dashboard/NotificationList";
import { useOwnerGuard } from "@/hooks";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function OwnerNotificationsPage() {
  const t = useTranslations("dashboard");
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

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
      <div className="min-h-screen bg-muted/30 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t("notifications.title", { defaultValue: "Alerts & Notifications" })}
            </h1>
            <p className="text-gray-600">
              {t("notifications.subtitle", { defaultValue: "Stay updated on your fleet activity and bookings." })}
            </p>
          </div>
          
          <NotificationList />
        </div>
      </div>
    </MainLayout>
  );
}
