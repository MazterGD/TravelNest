"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner, ConfirmDialog, Badge, CTAButton } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { tripPackageService, ApiError } from "@/lib/api";
import type { TripPackage } from "@/types";
import Image from "next/image";
import { ArrowLeft, Plus, MapPin, Users, Clock, Edit, Trash, Bus } from 'lucide-react';

const getPackageImageUrl = (vehicle?: { images?: string[]; photos?: Array<{ url: string; isPrimary: boolean }> } | null): string | null => {
  const primary = vehicle?.photos?.find((p) => p.isPrimary);
  return primary?.url ?? vehicle?.photos?.[0]?.url ?? vehicle?.images?.[0] ?? null;
};

export default function OwnerPackagesPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations("ownerPackages");
  const { user } = useAuthStore();
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [packages, setPackages] = useState<TripPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPackages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tripPackageService.getMyPackages();
      setPackages(response.packages || []);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t("errors.load"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAuthorized) {
      loadPackages();
    }
  }, [user, isAuthorized]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await tripPackageService.delete(deleteId);
      await loadPackages();
      setDeleteId(null);
    } catch (err) {
      setDeleteId(null);
      setError(err instanceof ApiError ? err.message : t("errors.delete"));
    } finally {
      setIsDeleting(false);
    }
  };

  if (guardLoading || !isAuthorized || !user) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[var(--color-bg-surface)]">
        <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-3 flex min-h-[44px] items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("backToDashboard")}
            </Link>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-heading-md font-semibold text-[var(--color-text-primary)]">
                  {t("title")}
                </h1>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                  {t("count", { count: packages.length })}
                </p>
              </div>
              <CTAButton
                href={`/${locale}/owner/packages/new`}
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                {t("addPackage")}
              </CTAButton>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {error && (
            <div role="alert" className="mb-6 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : packages.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {packages.map((item) => {
                const imageUrl = getPackageImageUrl(item.vehicle as any);
                return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-[20px] border border-[--color-border-default] bg-[var(--color-bg-base)]"
                >
                  {/* Vehicle photo */}
                  <div className="relative aspect-video bg-[--color-bg-surface]">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={item.vehicle?.name || t("vehicleFallback")}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Bus className="h-12 w-12 text-[--color-text-tertiary]" />
                      </div>
                    )}
                    <div className="absolute right-3 top-3">
                      <Badge variant={item.isActive ? "success" : "secondary"}>
                        {item.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[--color-text-primary]">
                        {item.title}
                      </h2>
                      <p className="text-sm text-[--color-text-secondary]">
                        {item.vehicle?.name || t("vehicleFallback")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-[--color-text-secondary]">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[--color-text-tertiary]" />
                      {item.startLocation} → {item.endLocation}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[--color-text-tertiary]" />
                      {t("days", { count: item.durationDays })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[--color-text-tertiary]" />
                      {t("passengers", { min: item.minPassengers, max: item.maxPassengers })}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-[--color-text-secondary]">{t("priceLabel")}</p>
                      <p className="text-lg font-semibold text-[--color-text-primary]">
                        LKR {item.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${locale}/owner/packages/${item.id}/edit`}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[--color-border-default] px-3 py-2 text-sm font-medium text-[--color-text-primary] hover:bg-[--color-bg-surface] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
                      >
                        <Edit className="h-4 w-4" aria-hidden="true" />
                        {t("edit")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteId(item.id)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[--color-error-border] px-3 py-2 text-sm font-medium text-[--color-error-text] hover:bg-[--color-error-bg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-action-focus]"
                      >
                        <Trash className="h-4 w-4" aria-hidden="true" />
                        {t("delete")}
                      </button>
                    </div>
                  </div>
                  </div>{/* end p-6 */}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-10 text-center">
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("empty")}</p>
              <CTAButton
                href={`/${locale}/owner/packages/new`}
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                {t("addPackage")}
              </CTAButton>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  );
}
