"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui";
import { useOwnerGuard } from "@/hooks";
import { vehicleService, tripPackageService, ApiError } from "@/lib/api";
import type { TripPackage, Vehicle } from "@/types";
import { TripPackageForm } from "@/components/features/owner/TripPackageForm";
import { ArrowLeft } from 'lucide-react';

export default function EditTripPackagePage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations("ownerPackages");
  const id = params.id as string;
  const router = useRouter();
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tripPackage, setTripPackage] = useState<TripPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [vehicleResponse, packageResponse] = await Promise.all([
          vehicleService.getMyVehicles(),
          tripPackageService.getById(id),
        ]);
        setVehicles(vehicleResponse.vehicles || []);
        setTripPackage(packageResponse.tripPackage);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError(t("errors.details"));
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthorized && id) {
      loadData();
    }
  }, [isAuthorized, id]);

  const handleSubmit = async (data: {
    vehicleId: string;
    title: string;
    description?: string;
    startLocation: string;
    endLocation: string;
    durationDays: number;
    price: number;
    minPassengers: number;
    maxPassengers: number;
    isActive: boolean;
  }) => {
    setIsSaving(true);
    try {
      await tripPackageService.update(id, data);
      router.push(`/${locale}/owner/packages`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.update"));
    } finally {
      setIsSaving(false);
    }
  };

  if (guardLoading || !isAuthorized) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-[var(--color-bg-surface)]">
        <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
          <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/packages`}
              className="mb-3 flex min-h-[44px] items-center gap-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("backToPackages")}
            </Link>
            <h1 className="text-heading-md font-semibold text-[var(--color-text-primary)]">
              {t("editTitle")}
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {error && (
            <div role="alert" className="mb-6 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : tripPackage ? (
            <TripPackageForm
              vehicles={vehicles}
              initialData={tripPackage}
              isLoading={isSaving}
              onSubmit={handleSubmit}
            />
          ) : (
            <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-10 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">{t("notFound")}</p>
            </div>
          )}
        </div>
      </div>
  );
}
