"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Button, Card, LoadingSpinner, TextArea } from "@/components/ui";
import { usePlatformSettings } from "./hooks/usePlatformSettings";

const prettyJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const parseJson = (value: string, label: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`${label}: ${reason}`);
  }
};

export default function AdminSettingsPage() {
  const { isLoading, isSaving, error, settings, updateSettings, refresh } =
    usePlatformSettings();

  const [generalDraft, setGeneralDraft] = useState("{}");
  const [notificationDraft, setNotificationDraft] = useState("{}");
  const [paymentDraft, setPaymentDraft] = useState("{}");
  const [bookingDraft, setBookingDraft] = useState("{}");
  const [securityDraft, setSecurityDraft] = useState("{}");
  const [mapDraft, setMapDraft] = useState("{}");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setGeneralDraft(prettyJson(settings.generalSettings));
    setNotificationDraft(prettyJson(settings.notificationSettings));
    setPaymentDraft(prettyJson(settings.paymentSettings));
    setBookingDraft(prettyJson(settings.bookingSettings));
    setSecurityDraft(prettyJson(settings.securitySettings));
    setMapDraft(prettyJson(settings.mapSettings));
    setMaintenanceMode(settings.maintenanceMode);
    setMaintenanceMessage(settings.maintenanceMessage || "");
    setFormError(null);
  }, [settings]);

  const saveAll = async () => {
    setFormError(null);

    try {
      await updateSettings({
        generalSettings: parseJson(generalDraft, "General settings"),
        notificationSettings: parseJson(notificationDraft, "Notification settings"),
        paymentSettings: parseJson(paymentDraft, "Payment settings"),
        bookingSettings: parseJson(bookingDraft, "Booking settings"),
        securitySettings: parseJson(securityDraft, "Security settings"),
        mapSettings: parseJson(mapDraft, "Map settings"),
        maintenanceMode,
        maintenanceMessage: maintenanceMessage.trim(),
      });
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : "Failed to save settings",
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">System settings</h2>
            <p className="text-sm text-muted-foreground">
              Configure platform-wide defaults for booking, payment, and notifications.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void refresh()} disabled={isLoading || isSaving}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <Button onClick={() => void saveAll()} disabled={isLoading || isSaving}>
              <Save className="h-4 w-4" />
              Save all
            </Button>
          </div>
        </div>
      </Card>

      {(error || formError) && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{formError || error}</p>
        </Card>
      )}

      {isLoading && !settings ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-background">
            <TextArea
              label="General settings JSON"
              value={generalDraft}
              onChange={(event) => setGeneralDraft(event.target.value)}
              rows={10}
            />
          </Card>

          <Card className="bg-background">
            <TextArea
              label="Notification settings JSON"
              value={notificationDraft}
              onChange={(event) => setNotificationDraft(event.target.value)}
              rows={10}
            />
          </Card>

          <Card className="bg-background">
            <TextArea
              label="Payment settings JSON"
              value={paymentDraft}
              onChange={(event) => setPaymentDraft(event.target.value)}
              rows={10}
            />
          </Card>

          <Card className="bg-background">
            <TextArea
              label="Booking settings JSON"
              value={bookingDraft}
              onChange={(event) => setBookingDraft(event.target.value)}
              rows={10}
            />
          </Card>

          <Card className="bg-background">
            <TextArea
              label="Security settings JSON"
              value={securityDraft}
              onChange={(event) => setSecurityDraft(event.target.value)}
              rows={10}
            />
          </Card>

          <Card className="bg-background">
            <TextArea
              label="Map settings JSON"
              value={mapDraft}
              onChange={(event) => setMapDraft(event.target.value)}
              rows={10}
            />
          </Card>

          <Card className="bg-background lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Maintenance mode</h3>
                <p className="text-sm text-muted-foreground">
                  Enable maintenance mode to display an interruption banner for end users.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(event) => setMaintenanceMode(event.target.checked)}
                  className="h-4 w-4 rounded border border-border"
                />
                Enable maintenance mode
              </label>
            </div>

            <div className="mt-4">
              <TextArea
                label="Maintenance message"
                placeholder="TravelNest is undergoing scheduled maintenance."
                value={maintenanceMessage}
                onChange={(event) => setMaintenanceMessage(event.target.value)}
                rows={4}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
