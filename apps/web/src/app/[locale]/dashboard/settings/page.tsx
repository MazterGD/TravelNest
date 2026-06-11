"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useParams, usePathname, useRouter } from "next/navigation";
import { DashboardLayoutClient } from "../DashboardLayoutClient";
import { Card, CardContent, CardHeader, CardTitle, Button, LoadingSpinner } from "@/components/ui";
import { Lock, Bell, Globe } from "lucide-react";
import { authService, ApiError } from "@/lib/api";
import { LOCALE_LABELS } from "@/constants";

const ring =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

export default function CustomerSettingsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("dashboard.settings");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [, startTransition] = useTransition();

  const currentLocale = (params.locale as string) || locale;
  const locales = ["en", "si", "ta"] as const;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    startTransition(() => {
      const newPathname = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
      router.push(newPathname);
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t("errors.passwordMismatch", { defaultValue: "New passwords do not match." }));
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError(t("errors.unexpected", { defaultValue: "An unexpected error occurred while changing your password." }));
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const inputClass = `w-full px-4 py-2 border border-[var(--color-border-default)] rounded-xl text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-base)] ${ring} transition-colors`;
  const selectClass = `border border-[var(--color-border-default)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-base)] ${ring} transition-colors`;

  return (
    <DashboardLayoutClient locale={locale}>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8 space-y-2">
        <h1 className="text-[var(--color-text-primary)] font-bold" style={{ fontSize: "1.875rem" }}>
          {t("title")}
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm">
          {t("subtitle")}
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8">
        {/* Security / Password */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                <Lock className="w-5 h-5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                {t("changePassword")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-[var(--color-error-bg)] text-[var(--color-error-text)] text-sm rounded-xl border border-[var(--color-error-border)]">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-[var(--color-success-bg)] text-[var(--color-success-text)] text-sm rounded-xl border border-[var(--color-success-border)]">
                    {t("passwordChanged")}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("currentPassword")}
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("newPassword")}
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("confirmNewPassword")}
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}>
                    {isChangingPassword ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                    {t("updatePassword")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Regional Preferences */}
          <Card>
            <CardHeader className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                <Globe className="w-5 h-5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                {t("regional")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)]">{t("language")}</h4>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{t("languageDescription")}</p>
                </div>
                <select
                  value={currentLocale}
                  onChange={(e) => handleLocaleChange(e.target.value)}
                  className={selectClass}
                  aria-label={t("language")}
                >
                  {locales.map((loc) => (
                    <option key={loc} value={loc}>
                      {LOCALE_LABELS[loc]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-[var(--color-border-default)]">
                <div>
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)]">{t("currency")}</h4>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{t("currencyDescription")}</p>
                </div>
                <select className={selectClass} aria-label={t("currency")}>
                  <option value="LKR">LKR (Rs)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-8">
          <Card>
            <CardHeader className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                <Bell className="w-5 h-5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                {t("notifications")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)]">{t("emailNotifications")}</h4>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{t("emailNotificationsDesc")}</p>
                </div>
                <label className="relative inline-flex shrink-0 items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    aria-label={t("emailNotifications")}
                  />
                  <div className="w-11 h-6 bg-[var(--color-border-default)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-action-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--color-border-default)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-action-primary)]" />
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
