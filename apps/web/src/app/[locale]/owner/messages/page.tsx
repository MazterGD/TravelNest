"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { ChatLayout } from "@/components/chat";
import { useOwnerGuard } from "@/hooks";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function OwnerMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string | string[] }>;
}) {
  const t = useTranslations("messages");
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  // `?booking=<id>` arrives from the "Message customer" entry point on the
  // owner booking pages — open (or create) that booking's conversation.
  const { booking } = use(searchParams);
  const initialBookingId = typeof booking === "string" ? booking : undefined;

  if (guardLoading || !isAuthorized) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  return (
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg-surface)] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col">
          <div className="mb-6 shrink-0">
            <h1 className="mb-2 text-3xl font-bold text-[var(--color-text-primary)]">
              {t("title")}
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              {t("ownerSubtitle")}
            </p>
          </div>

          <div className="min-h-0 flex-1 pb-8">
            <ChatLayout
              emptyDescKey="emptyListDescOwner"
              initialBookingId={initialBookingId}
              bookingBasePath="/owner/bookings"
            />
          </div>
        </div>
      </div>
  );
}
