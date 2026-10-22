"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOwnerGuard } from "@/hooks";
import { LoadingSpinner } from "@/components/ui";
import { driverService } from "@/lib/api/services";
import { ArrowLeft, Edit2, AlertCircle } from "lucide-react";

export default function EditDriverPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const router = useRouter();
  const t = useTranslations("ownerDrivers");
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guardLoading || !isAuthorized) return;
    const fetchDriver = async () => {
      try {
        const res = await driverService.getOne(id);
        const d = res.driver;
        setName(d.name);
        setPhone(d.phone);
        setStatus(d.status);
      } catch (err: any) {
        setError(err.message || t("loadError"));
      } finally {
        setLoading(false);
      }
    };
    fetchDriver();
  }, [guardLoading, isAuthorized, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await driverService.update(id, {
        name: name.trim(),
        phone: phone.trim(),
        status,
      });
      router.push(`/${locale}/owner/drivers`);
    } catch (err: any) {
      setError(err.message || t("saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (guardLoading || !isAuthorized || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface)]">
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-base)]">
        <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
          <Link
            href={`/${locale}/owner/drivers`}
            className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToDrivers")}
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-action-primary)]/10">
              <Edit2 className="h-5 w-5 text-[var(--color-action-primary)]" />
            </div>
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
              {t("editTitle")}
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-6"
        >
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-text)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]"
              >
                {t("fieldName")} <span className="text-[var(--color-error-text)]">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("fieldNamePlaceholder")}
                className="min-h-[44px] w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]"
              >
                {t("fieldPhone")} <span className="text-[var(--color-error-text)]">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("fieldPhonePlaceholder")}
                className="min-h-[44px] w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
              />
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {t("fieldPhoneHint")}
              </p>
            </div>

            <div>
              <label
                htmlFor="status"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]"
              >
                {t("fieldStatus")}
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                className="min-h-[44px] w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
              >
                <option value="ACTIVE">{t("statusActive")}</option>
                <option value="INACTIVE">{t("statusInactive")}</option>
              </select>
              {status === "INACTIVE" && (
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  {t("inactiveHint")}
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Link
              href={`/${locale}/owner/drivers`}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]"
            >
              {t("cancel")}
            </Link>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !phone.trim()}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] disabled:opacity-50"
            >
              {submitting ? <LoadingSpinner size="sm" /> : null}
              {submitting ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
