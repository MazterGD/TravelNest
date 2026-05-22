"use client";

import { useTranslations } from "next-intl";
import { DashboardLayoutClient } from "../DashboardLayoutClient";
import { ChatLayout } from "@/components/chat";

interface CustomerMessagesPageProps {
  params: {
    locale: string;
  };
  searchParams?: {
    booking?: string | string[];
  };
}

export default function CustomerMessagesPage({
  params: { locale },
  searchParams,
}: CustomerMessagesPageProps) {
  const t = useTranslations("messages");

  // `?booking=<id>` arrives from the "Message owner" entry point — open (or
  // create) that booking's conversation and select it on load.
  const bookingParam = searchParams?.booking;
  const initialBookingId =
    typeof bookingParam === "string" ? bookingParam : undefined;

  return (
    <DashboardLayoutClient locale={locale}>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-bold text-[var(--color-text-primary)]">
          {t("title")}
        </h1>
        <p className="text-[var(--color-text-secondary)]">{t("subtitle")}</p>
      </div>

      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 space-y-8">
        <ChatLayout
          emptyDescKey="emptyListDesc"
          initialBookingId={initialBookingId}
        />
      </div>
    </DashboardLayoutClient>
  );
}
