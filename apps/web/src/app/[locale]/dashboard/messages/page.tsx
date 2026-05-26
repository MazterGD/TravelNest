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
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col px-4 py-6 md:h-[calc(100vh-2rem)] md:px-6 md:py-8 lg:px-8">
        <header className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t("subtitle")}
          </p>
        </header>

        <div className="min-h-0 flex-1">
          <ChatLayout
            emptyDescKey="emptyListDesc"
            initialBookingId={initialBookingId}
          />
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
