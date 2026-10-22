"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOwnerGuard } from "@/hooks";
import { LoadingSpinner } from "@/components/ui";
import { driverService, type DriverSummary } from "@/lib/api/services";
import {
  UserCheck,
  Plus,
  Phone,
  Edit2,
  Trash2,
  BarChart3,
  CheckCircle,
  XCircle,
  Car,
  AlertCircle,
} from "lucide-react";

export default function DriversPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations("ownerDrivers");
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await driverService.list();
      setDrivers(res.drivers);
    } catch (err: any) {
      setError(err.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!guardLoading && isAuthorized) load();
  }, [guardLoading, isAuthorized]);

  const handleDelete = async (driver: DriverSummary) => {
    if (!confirm(t("deleteConfirm", { name: driver.name }))) return;
    try {
      setDeletingId(driver.id);
      setDeleteError(null);
      await driverService.delete(driver.id);
      setDrivers((prev) => prev.filter((d) => d.id !== driver.id));
    } catch (err: any) {
      setDeleteError(err.message || t("deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  const activeDrivers = drivers.filter((d) => d.status === "ACTIVE");
  const totalTrips = drivers.reduce((s, d) => s + d.totalTrips, 0);
  const onTrip = drivers.reduce((s, d) => s + d.activeTrips, 0);

  if (guardLoading || !isAuthorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-action-primary)]/10">
                <UserCheck className="h-5 w-5 text-[var(--color-action-primary)]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("subtitle")}
                </p>
              </div>
            </div>
            <Link
              href={`/${locale}/owner/drivers/add`}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              <Plus className="h-4 w-4" />
              {t("addDriver")}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Analytics summary */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: t("statTotal"),
              value: drivers.length,
              icon: UserCheck,
              color: "text-[var(--color-action-primary)]",
              bg: "bg-[var(--color-action-primary)]/10",
            },
            {
              label: t("statActive"),
              value: activeDrivers.length,
              icon: CheckCircle,
              color: "text-[var(--color-success-text)]",
              bg: "bg-[var(--color-success-bg)]",
            },
            {
              label: t("statTotalTrips"),
              value: totalTrips,
              icon: Car,
              color: "text-[var(--color-text-secondary)]",
              bg: "bg-[var(--color-bg-surface)]",
            },
            {
              label: t("statOnTrip"),
              value: onTrip,
              icon: BarChart3,
              color: "text-[var(--color-action-primary)]",
              bg: "bg-[var(--color-action-primary)]/10",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-4"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}
                >
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>

        {deleteError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-text)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {deleteError}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <div className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-8 text-center text-sm text-[var(--color-error-text)]">
            {error}
          </div>
        ) : drivers.length === 0 ? (
          <div className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-12 text-center">
            <UserCheck className="mx-auto mb-4 h-12 w-12 text-[var(--color-text-tertiary)]" />
            <p className="mb-2 text-lg font-medium text-[var(--color-text-primary)]">
              {t("emptyTitle")}
            </p>
            <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
              {t("emptyDesc")}
            </p>
            <Link
              href={`/${locale}/owner/drivers/add`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              <Plus className="h-4 w-4" />
              {t("addDriver")}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-5"
              >
                {/* Avatar + name */}
                <div className="mb-4 flex items-center gap-3">
                  {driver.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={driver.photoUrl}
                      alt={driver.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-action-primary)]/10 text-lg font-bold text-[var(--color-action-primary)]">
                      {driver.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--color-text-primary)]">
                      {driver.name}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${
                        driver.status === "ACTIVE"
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                          : "bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {driver.status === "ACTIVE" ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {driver.status === "ACTIVE" ? t("statusActive") : t("statusInactive")}
                    </span>
                  </div>
                </div>

                {/* Phone */}
                <a
                  href={`tel:${driver.phone}`}
                  className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {driver.phone}
                </a>

                {/* Stats */}
                <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-[var(--color-bg-surface)] p-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">
                      {driver.totalTrips}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {t("totalTrips")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-[var(--color-action-primary)]">
                      {driver.activeTrips}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {t("activeTrips")}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/${locale}/owner/drivers/${driver.id}/edit`}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
                  >
                    <Edit2 className="h-4 w-4" />
                    {t("edit")}
                  </Link>
                  <button
                    onClick={() => handleDelete(driver)}
                    disabled={deletingId === driver.id}
                    aria-label={t("deleteAriaLabel", { name: driver.name })}
                    className="flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--color-error-border)] px-3 py-2 text-sm font-medium text-[var(--color-error-text)] transition-colors hover:bg-[var(--color-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error-border)] disabled:opacity-50"
                  >
                    {deletingId === driver.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
