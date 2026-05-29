"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Calendar,
  Globe,
  Map,
  RefreshCw,
  Save,
  Shield,
  Wrench,
} from "lucide-react";
import {
  Button,
  Card,
  Input,
  LoadingSpinner,
  Select,
  TextArea,
} from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type {
  AdminPlatformSettings,
  AdminPlatformSettingsUpdateInput,
} from "@/lib/api";
import { usePlatformSettings } from "./hooks/usePlatformSettings";

const ring =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

type GeneralForm = {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  defaultLocale: string;
  defaultCurrency: string;
};

type NotificationForm = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
};

type PaymentForm = {
  provider: string;
  settlementWindowDays: number;
};

type BookingForm = {
  autoCancelUnpaidHours: number;
  refundWindowHours: number;
};

type SecurityForm = {
  requireStrongPasswords: boolean;
  sessionTimeoutMinutes: number;
};

type MapForm = {
  defaultCountry: string;
  defaultCity: string;
};

type DraftState = {
  general: GeneralForm;
  notification: NotificationForm;
  payment: PaymentForm;
  booking: BookingForm;
  security: SecurityForm;
  map: MapForm;
  maintenanceMode: boolean;
  maintenanceMessage: string;
};

type TabId =
  | "general"
  | "notifications"
  | "payment"
  | "booking"
  | "security"
  | "map";

const DEFAULTS: DraftState = {
  general: {
    platformName: "TravelNest",
    supportEmail: "support@travelnest.lk",
    supportPhone: "+94 11 234 5678",
    defaultLocale: "en",
    defaultCurrency: "LKR",
  },
  notification: {
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
  },
  payment: {
    provider: "payhere",
    settlementWindowDays: 7,
  },
  booking: {
    autoCancelUnpaidHours: 24,
    refundWindowHours: 48,
  },
  security: {
    requireStrongPasswords: true,
    sessionTimeoutMinutes: 60,
  },
  map: {
    defaultCountry: "LK",
    defaultCity: "Colombo",
  },
  maintenanceMode: false,
  maintenanceMessage: "",
};

const readString = (
  source: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string,
): string => {
  const value = source?.[key];
  return typeof value === "string" ? value : fallback;
};

const readNumber = (
  source: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
): number => {
  const value = source?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

const readBoolean = (
  source: Record<string, unknown> | null | undefined,
  key: string,
  fallback: boolean,
): boolean => {
  const value = source?.[key];
  return typeof value === "boolean" ? value : fallback;
};

const formatTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-LK", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return null;
  }
};

const deriveDraft = (settings: AdminPlatformSettings): DraftState => ({
  general: {
    platformName: readString(
      settings.generalSettings,
      "platformName",
      DEFAULTS.general.platformName,
    ),
    supportEmail: readString(
      settings.generalSettings,
      "supportEmail",
      DEFAULTS.general.supportEmail,
    ),
    supportPhone: readString(
      settings.generalSettings,
      "supportPhone",
      DEFAULTS.general.supportPhone,
    ),
    defaultLocale: readString(
      settings.generalSettings,
      "defaultLocale",
      DEFAULTS.general.defaultLocale,
    ),
    defaultCurrency: readString(
      settings.generalSettings,
      "defaultCurrency",
      DEFAULTS.general.defaultCurrency,
    ),
  },
  notification: {
    emailEnabled: readBoolean(
      settings.notificationSettings,
      "emailEnabled",
      DEFAULTS.notification.emailEnabled,
    ),
    smsEnabled: readBoolean(
      settings.notificationSettings,
      "smsEnabled",
      DEFAULTS.notification.smsEnabled,
    ),
    inAppEnabled: readBoolean(
      settings.notificationSettings,
      "inAppEnabled",
      DEFAULTS.notification.inAppEnabled,
    ),
  },
  payment: {
    provider: readString(
      settings.paymentSettings,
      "provider",
      DEFAULTS.payment.provider,
    ),
    settlementWindowDays: readNumber(
      settings.paymentSettings,
      "settlementWindowDays",
      DEFAULTS.payment.settlementWindowDays,
    ),
  },
  booking: {
    autoCancelUnpaidHours: readNumber(
      settings.bookingSettings,
      "autoCancelUnpaidHours",
      DEFAULTS.booking.autoCancelUnpaidHours,
    ),
    refundWindowHours: readNumber(
      settings.bookingSettings,
      "refundWindowHours",
      DEFAULTS.booking.refundWindowHours,
    ),
  },
  security: {
    requireStrongPasswords: readBoolean(
      settings.securitySettings,
      "requireStrongPasswords",
      DEFAULTS.security.requireStrongPasswords,
    ),
    sessionTimeoutMinutes: readNumber(
      settings.securitySettings,
      "sessionTimeoutMinutes",
      DEFAULTS.security.sessionTimeoutMinutes,
    ),
  },
  map: {
    defaultCountry: readString(
      settings.mapSettings,
      "defaultCountry",
      DEFAULTS.map.defaultCountry,
    ),
    defaultCity: readString(
      settings.mapSettings,
      "defaultCity",
      DEFAULTS.map.defaultCity,
    ),
  },
  maintenanceMode: settings.maintenanceMode ?? false,
  maintenanceMessage: settings.maintenanceMessage ?? "",
});

interface FieldRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const FieldRow = ({ label, description, children }: FieldRowProps) => (
  <div className="grid gap-2 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] sm:items-start sm:gap-6">
    <div>
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
        {label}
      </p>
      {description && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
    </div>
    <div>{children}</div>
  </div>
);

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

const Toggle = ({
  checked,
  onChange,
  label,
  description,
  disabled,
}: ToggleProps) => (
  <label
    className={cn(
      "flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-base)] p-4 transition-colors",
      "hover:border-[var(--color-action-primary)]/40",
      disabled && "cursor-not-allowed opacity-60",
    )}
  >
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
        {label}
      </p>
      {description && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
    </div>
    <span className="relative inline-flex shrink-0 items-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "block h-6 w-11 rounded-full border transition-colors",
          "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]",
          "peer-checked:border-[var(--color-action-primary)] peer-checked:bg-[var(--color-action-primary)]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-action-focus)] peer-focus-visible:ring-offset-2",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </span>
  </label>
);

interface SettingsFormProps {
  settings: AdminPlatformSettings;
  isSaving: boolean;
  serverError: string | null;
  onSave: (payload: AdminPlatformSettingsUpdateInput) => Promise<void>;
  onReload: () => Promise<void>;
}

function SettingsForm({
  settings,
  isSaving,
  serverError,
  onSave,
  onReload,
}: SettingsFormProps) {
  const t = useTranslations("adminSettings");

  const initial = useMemo(() => deriveDraft(settings), [settings]);
  const [draft, setDraft] = useState<DraftState>(initial);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [formError, setFormError] = useState<string | null>(null);
  const [successPing, setSuccessPing] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  const lastUpdatedAt = formatTimestamp(settings.updatedAt);
  const updatedBy = settings.updatedByAdmin
    ? `${settings.updatedByAdmin.firstName} ${settings.updatedByAdmin.lastName}`.trim()
    : null;

  const tabs: Array<{ id: TabId; label: string; icon: typeof Globe }> = [
    { id: "general", label: t("tabs.general"), icon: Globe },
    { id: "notifications", label: t("tabs.notifications"), icon: Bell },
    { id: "payment", label: t("tabs.payment"), icon: Banknote },
    { id: "booking", label: t("tabs.booking"), icon: Calendar },
    { id: "security", label: t("tabs.security"), icon: Shield },
    { id: "map", label: t("tabs.map"), icon: Map },
  ];

  const validateAndSave = async () => {
    setFormError(null);

    if (draft.general.platformName.trim().length === 0) {
      setFormError(t("errors.platformNameRequired"));
      setActiveTab("general");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.general.supportEmail)) {
      setFormError(t("errors.supportEmailInvalid"));
      setActiveTab("general");
      return;
    }
    if (
      draft.payment.settlementWindowDays < 1 ||
      draft.payment.settlementWindowDays > 60
    ) {
      setFormError(t("errors.settlementWindowRange"));
      setActiveTab("payment");
      return;
    }
    if (
      draft.booking.autoCancelUnpaidHours < 1 ||
      draft.booking.refundWindowHours < 0
    ) {
      setFormError(t("errors.bookingHoursInvalid"));
      setActiveTab("booking");
      return;
    }
    if (
      draft.security.sessionTimeoutMinutes < 5 ||
      draft.security.sessionTimeoutMinutes > 1440
    ) {
      setFormError(t("errors.sessionTimeoutRange"));
      setActiveTab("security");
      return;
    }
    if (draft.maintenanceMode && draft.maintenanceMessage.length > 1000) {
      setFormError(t("errors.maintenanceMessageTooLong"));
      return;
    }

    const merged: AdminPlatformSettingsUpdateInput = {
      generalSettings: {
        ...(settings.generalSettings ?? {}),
        ...draft.general,
      },
      notificationSettings: {
        ...(settings.notificationSettings ?? {}),
        ...draft.notification,
      },
      paymentSettings: {
        ...(settings.paymentSettings ?? {}),
        ...draft.payment,
      },
      bookingSettings: {
        ...(settings.bookingSettings ?? {}),
        ...draft.booking,
      },
      securitySettings: {
        ...(settings.securitySettings ?? {}),
        ...draft.security,
      },
      mapSettings: {
        ...(settings.mapSettings ?? {}),
        ...draft.map,
      },
      maintenanceMode: draft.maintenanceMode,
      maintenanceMessage: draft.maintenanceMessage.trim(),
    };

    try {
      await onSave(merged);
      setSuccessPing(true);
      window.setTimeout(() => setSuccessPing(false), 2500);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : t("errors.saveFailed"),
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[var(--color-bg-base)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {t("title")}
              </h2>
              {isDirty && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-action-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-action-primary)]">
                  {t("badges.unsaved")}
                </span>
              )}
              {successPing && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-success-text)]">
                  {t("badges.saved")}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("subtitle")}
            </p>
            {(updatedBy || lastUpdatedAt) && (
              <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
                {t("lastUpdated", {
                  by: updatedBy ?? t("lastUpdatedUnknown"),
                  at: lastUpdatedAt ?? "—",
                })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(initial);
                setFormError(null);
              }}
              disabled={!isDirty || isSaving}
            >
              {t("actions.revert")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void onReload()}
              disabled={isSaving}
            >
              <RefreshCw className="h-4 w-4" />
              {t("actions.reload")}
            </Button>
            <Button
              onClick={() => void validateAndSave()}
              disabled={!isDirty || isSaving}
            >
              <Save className="h-4 w-4" />
              {isSaving ? t("actions.saving") : t("actions.save")}
            </Button>
          </div>
        </div>
      </Card>

      {(formError || serverError) && (
        <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)] py-4">
          <p className="text-sm font-medium text-[var(--color-error-text)]">
            {formError || serverError}
          </p>
        </Card>
      )}

      <Card
        className={cn(
          "bg-[var(--color-bg-base)]",
          draft.maintenanceMode &&
            "border-[var(--color-error-border)] bg-[var(--color-error-bg)]",
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                draft.maintenanceMode
                  ? "bg-[var(--color-error-border)] text-white"
                  : "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]",
              )}
            >
              <Wrench className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("maintenance.title")}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t("maintenance.description")}
              </p>
              {draft.maintenanceMode && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-2 py-1 text-xs font-medium text-[var(--color-error-text)]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("maintenance.activeWarning")}
                </p>
              )}
            </div>
          </div>
          <label className="inline-flex items-center gap-3 self-start">
            <span className="relative inline-flex shrink-0 items-center">
              <input
                type="checkbox"
                checked={draft.maintenanceMode}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    maintenanceMode: event.target.checked,
                  }))
                }
                className="peer sr-only"
                aria-label={t("maintenance.toggleLabel")}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "block h-6 w-11 rounded-full border transition-colors",
                  "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]",
                  "peer-checked:border-[var(--color-error-border)] peer-checked:bg-[var(--color-error-border)]",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-action-focus)] peer-focus-visible:ring-offset-2",
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  draft.maintenanceMode ? "translate-x-5" : "translate-x-0",
                )}
              />
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {draft.maintenanceMode
                ? t("maintenance.statusOn")
                : t("maintenance.statusOff")}
            </span>
          </label>
        </div>
        {draft.maintenanceMode && (
          <div className="mt-4">
            <TextArea
              label={t("maintenance.messageLabel")}
              placeholder={t("maintenance.messagePlaceholder")}
              value={draft.maintenanceMessage}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  maintenanceMessage: event.target.value,
                }))
              }
              rows={3}
              maxLength={1000}
              helperText={t("maintenance.messageHelp", {
                count: draft.maintenanceMessage.length,
              })}
            />
          </div>
        )}
      </Card>

      <Card className="bg-[var(--color-bg-base)]">
        <div
          role="tablist"
          aria-label={t("tabs.ariaLabel")}
          className="flex flex-wrap gap-1 border-b border-[var(--color-border-default)] pb-3"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  ring,
                  active
                    ? "bg-[var(--color-action-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          className="mt-6 space-y-6"
        >
          {activeTab === "general" && (
            <>
              <FieldRow
                label={t("general.platformName.label")}
                description={t("general.platformName.help")}
              >
                <Input
                  value={draft.general.platformName}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      general: {
                        ...prev.general,
                        platformName: event.target.value,
                      },
                    }))
                  }
                  maxLength={120}
                />
              </FieldRow>

              <FieldRow
                label={t("general.supportEmail.label")}
                description={t("general.supportEmail.help")}
              >
                <Input
                  type="email"
                  value={draft.general.supportEmail}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      general: {
                        ...prev.general,
                        supportEmail: event.target.value,
                      },
                    }))
                  }
                />
              </FieldRow>

              <FieldRow
                label={t("general.supportPhone.label")}
                description={t("general.supportPhone.help")}
              >
                <Input
                  type="tel"
                  value={draft.general.supportPhone}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      general: {
                        ...prev.general,
                        supportPhone: event.target.value,
                      },
                    }))
                  }
                />
              </FieldRow>

              <FieldRow
                label={t("general.defaultLocale.label")}
                description={t("general.defaultLocale.help")}
              >
                <Select
                  value={draft.general.defaultLocale}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      general: { ...prev.general, defaultLocale: value },
                    }))
                  }
                  options={[
                    { value: "en", label: "English (en)" },
                    { value: "si", label: "සිංහල (si)" },
                    { value: "ta", label: "தமிழ் (ta)" },
                  ]}
                />
              </FieldRow>

              <FieldRow
                label={t("general.defaultCurrency.label")}
                description={t("general.defaultCurrency.help")}
              >
                <Select
                  value={draft.general.defaultCurrency}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      general: { ...prev.general, defaultCurrency: value },
                    }))
                  }
                  options={[
                    { value: "LKR", label: "Sri Lankan Rupee (LKR)" },
                    { value: "USD", label: "US Dollar (USD)" },
                  ]}
                />
              </FieldRow>
            </>
          )}

          {activeTab === "notifications" && (
            <div className="grid gap-3 lg:grid-cols-3">
              <Toggle
                checked={draft.notification.emailEnabled}
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    notification: { ...prev.notification, emailEnabled: next },
                  }))
                }
                label={t("notifications.email.label")}
                description={t("notifications.email.help")}
              />
              <Toggle
                checked={draft.notification.smsEnabled}
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    notification: { ...prev.notification, smsEnabled: next },
                  }))
                }
                label={t("notifications.sms.label")}
                description={t("notifications.sms.help")}
              />
              <Toggle
                checked={draft.notification.inAppEnabled}
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    notification: { ...prev.notification, inAppEnabled: next },
                  }))
                }
                label={t("notifications.inApp.label")}
                description={t("notifications.inApp.help")}
              />
            </div>
          )}

          {activeTab === "payment" && (
            <>
              <FieldRow
                label={t("payment.provider.label")}
                description={t("payment.provider.help")}
              >
                <Select
                  value={draft.payment.provider}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      payment: { ...prev.payment, provider: value },
                    }))
                  }
                  options={[
                    { value: "payhere", label: "PayHere (default)" },
                    { value: "bank_transfer", label: "Bank Transfer" },
                  ]}
                />
              </FieldRow>

              <FieldRow
                label={t("payment.settlementWindow.label")}
                description={t("payment.settlementWindow.help")}
              >
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={draft.payment.settlementWindowDays}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      payment: {
                        ...prev.payment,
                        settlementWindowDays:
                          Number(event.target.value) ||
                          DEFAULTS.payment.settlementWindowDays,
                      },
                    }))
                  }
                />
              </FieldRow>
            </>
          )}

          {activeTab === "booking" && (
            <>
              <FieldRow
                label={t("booking.autoCancel.label")}
                description={t("booking.autoCancel.help")}
              >
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={draft.booking.autoCancelUnpaidHours}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      booking: {
                        ...prev.booking,
                        autoCancelUnpaidHours:
                          Number(event.target.value) ||
                          DEFAULTS.booking.autoCancelUnpaidHours,
                      },
                    }))
                  }
                />
              </FieldRow>

              <FieldRow
                label={t("booking.refundWindow.label")}
                description={t("booking.refundWindow.help")}
              >
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={draft.booking.refundWindowHours}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      booking: {
                        ...prev.booking,
                        refundWindowHours:
                          Number(event.target.value) ||
                          DEFAULTS.booking.refundWindowHours,
                      },
                    }))
                  }
                />
              </FieldRow>
            </>
          )}

          {activeTab === "security" && (
            <>
              <Toggle
                checked={draft.security.requireStrongPasswords}
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    security: { ...prev.security, requireStrongPasswords: next },
                  }))
                }
                label={t("security.strongPasswords.label")}
                description={t("security.strongPasswords.help")}
              />
              <FieldRow
                label={t("security.sessionTimeout.label")}
                description={t("security.sessionTimeout.help")}
              >
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  value={draft.security.sessionTimeoutMinutes}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      security: {
                        ...prev.security,
                        sessionTimeoutMinutes:
                          Number(event.target.value) ||
                          DEFAULTS.security.sessionTimeoutMinutes,
                      },
                    }))
                  }
                />
              </FieldRow>
            </>
          )}

          {activeTab === "map" && (
            <>
              <FieldRow
                label={t("map.country.label")}
                description={t("map.country.help")}
              >
                <Input
                  value={draft.map.defaultCountry}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      map: { ...prev.map, defaultCountry: event.target.value },
                    }))
                  }
                  maxLength={6}
                />
              </FieldRow>
              <FieldRow
                label={t("map.city.label")}
                description={t("map.city.help")}
              >
                <Input
                  value={draft.map.defaultCity}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      map: { ...prev.map, defaultCity: event.target.value },
                    }))
                  }
                  maxLength={80}
                />
              </FieldRow>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function AdminSettingsPage() {
  const {
    isLoading,
    isSaving,
    error,
    settings,
    updateSettings,
    refresh,
  } = usePlatformSettings();

  if (isLoading && !settings) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)] py-4">
        <p className="text-sm font-medium text-[var(--color-error-text)]">
          {error || "Unable to load platform settings."}
        </p>
      </Card>
    );
  }

  // The `key` here remounts the form whenever the server returns a new
  // updatedAt, so initial form state can be derived from props without
  // calling setState inside an effect.
  return (
    <SettingsForm
      key={settings.updatedAt ?? settings.id}
      settings={settings}
      isSaving={isSaving}
      serverError={error}
      onSave={updateSettings}
      onReload={refresh}
    />
  );
}
