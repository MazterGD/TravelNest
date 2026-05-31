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
      <div className="min-h-screen bg-[var(--color-bg-surface)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <h1 className="mb-2 text-3xl font-bold text-[var(--color-text-primary)]">
              {t("title")}
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              {t("ownerSubtitle")}
            </p>
          </div>

          <ChatLayout
            emptyDescKey="emptyListDescOwner"
            initialBookingId={initialBookingId}
          />
        </div>
      </div>
  );
}
