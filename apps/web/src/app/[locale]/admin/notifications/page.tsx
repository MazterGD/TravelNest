"use client";

import { useMemo, useState } from "react";
import { Activity, Megaphone, RefreshCw, Send, Repeat } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select, TextArea } from "@/components/ui";
import {
  type AdminNotificationTargetRole,
  type AdminPlatformNotificationChannel,
  type AdminPlatformNotificationStatus,
} from "@/lib/api";
import { useNotificationsManagement } from "./hooks/useNotificationsManagement";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const channelOptions = [
  { value: "", label: "All channels" },
  { value: "IN_APP", label: "In-app" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
];

const targetRoleOptions = [
  { value: "", label: "All roles" },
  { value: "CUSTOMER", label: "Customers" },
  { value: "VEHICLE_OWNER", label: "Vehicle owners" },
  { value: "ADMIN", label: "Admins" },
];

const notificationStatusVariant = (status: string) => {
  if (status === "SENT") return "success" as const;
  if (status === "SCHEDULED") return "warning" as const;
  if (status === "FAILED" || status === "CANCELLED") return "danger" as const;
  return "secondary" as const;
};

const parseMetadata = (value: string): Record<string, unknown> | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export default function AdminNotificationsPage() {
  const {
    isLoading,
    isMutating,
    error,
    filters,
    notificationsData,
    selectedAnalytics,
    setFilters,
    loadAnalytics,
    createNotification,
    resendNotification,
    refetch,
  } = useNotificationsManagement();

  const [titleDraft, setTitleDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState("ANNOUNCEMENT");
  const [channelDraft, setChannelDraft] = useState<AdminPlatformNotificationChannel>("IN_APP");
  const [targetRoleDraft, setTargetRoleDraft] = useState<AdminNotificationTargetRole | "">("");
  const [targetUserIdsDraft, setTargetUserIdsDraft] = useState("");
  const [scheduledForDraft, setScheduledForDraft] = useState("");
  const [metadataDraft, setMetadataDraft] = useState('{"source":"admin-console"}');

  const notifications = notificationsData?.items || [];

  const summary = useMemo(() => {
    if (!notificationsData) {
      return "";
    }

    const start = (notificationsData.page - 1) * notificationsData.limit + 1;
    const end = Math.min(
      notificationsData.total,
      notificationsData.page * notificationsData.limit,
    );

    return `${start}-${end} of ${notificationsData.total}`;
  }, [notificationsData]);

  const sendNotification = async () => {
    if (titleDraft.trim().length < 2 || messageDraft.trim().length < 5) {
      return;
    }

    const response = await createNotification({
      title: titleDraft.trim(),
      message: messageDraft.trim(),
      type: typeDraft.trim() || "ANNOUNCEMENT",
      channel: channelDraft,
      targetRole: targetRoleDraft || undefined,
      targetUserIds: targetUserIdsDraft
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      scheduledFor: scheduledForDraft ? new Date(scheduledForDraft).toISOString() : undefined,
      metadata: parseMetadata(metadataDraft),
    });

    if (response) {
      setTitleDraft("");
      setMessageDraft("");
      setTargetUserIdsDraft("");
      setScheduledForDraft("");
      await loadAnalytics(response.notification.id);
    }
  };

  const canGoPrev = (notificationsData?.page || 1) > 1;
  const canGoNext = notificationsData
    ? notificationsData.page < notificationsData.totalPages
    : false;

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Input
              label="Search history"
              placeholder="Title, message, type"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div>
            <Select
              label="Status"
              options={statusOptions}
              value={filters.status || ""}
              onChange={(value) =>
                setFilters({
                  status: (value || undefined) as AdminPlatformNotificationStatus | undefined,
                })
              }
            />
          </div>
          <div>
            <Select
              label="Channel"
              options={channelOptions}
              value={filters.channel || ""}
              onChange={(value) =>
                setFilters({
                  channel: (value || undefined) as
                    | AdminPlatformNotificationChannel
                    | undefined,
                })
              }
            />
          </div>
          <div>
            <Select
              label="Target role"
              options={targetRoleOptions}
              value={filters.targetRole || ""}
              onChange={(value) =>
                setFilters({
                  targetRole: (value || undefined) as AdminNotificationTargetRole | undefined,
                })
              }
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => void refetch()}
              disabled={isLoading || isMutating}
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Compose notification</h2>
            <Button onClick={() => void sendNotification()} disabled={isMutating}>
              <Send className="h-4 w-4" />
              Publish
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              label="Title"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
            <Input
              label="Type"
              value={typeDraft}
              onChange={(event) => setTypeDraft(event.target.value)}
            />
            <div>
              <Select
                label="Channel"
                options={channelOptions.filter((option) => option.value !== "")}
                value={channelDraft}
                onChange={(value) =>
                  setChannelDraft((value || "IN_APP") as AdminPlatformNotificationChannel)
                }
              />
            </div>
            <div>
              <Select
                label="Target role"
                options={targetRoleOptions}
                value={targetRoleDraft}
                onChange={(value) =>
                  setTargetRoleDraft((value || "") as AdminNotificationTargetRole | "")
                }
              />
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Message"
                rows={5}
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
              />
            </div>
            <Input
              label="Target user IDs (comma separated)"
              placeholder="usr_1, usr_2"
              value={targetUserIdsDraft}
              onChange={(event) => setTargetUserIdsDraft(event.target.value)}
            />
            <Input
              label="Schedule at (optional)"
              type="datetime-local"
              value={scheduledForDraft}
              onChange={(event) => setScheduledForDraft(event.target.value)}
            />
            <div className="md:col-span-2">
              <TextArea
                label="Metadata JSON"
                rows={4}
                value={metadataDraft}
                onChange={(event) => setMetadataDraft(event.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="bg-background">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Delivery analytics</h3>
          </div>

          {!selectedAnalytics ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Select a notification from history to inspect open and delivery rates.
            </p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border border-border bg-muted/50 p-3">
                <p className="font-semibold text-foreground">
                  {selectedAnalytics.notification.title}
                </p>
                <p className="text-muted-foreground">
                  {selectedAnalytics.notification.type} | {selectedAnalytics.notification.channel}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Targeted</p>
                  <p className="text-lg font-semibold text-foreground">
                    {selectedAnalytics.metrics.targetedRecipients}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Delivered</p>
                  <p className="text-lg font-semibold text-foreground">
                    {selectedAnalytics.metrics.delivered}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Read</p>
                  <p className="text-lg font-semibold text-foreground">
                    {selectedAnalytics.metrics.reads}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Open rate</p>
                  <p className="text-lg font-semibold text-foreground">
                    {selectedAnalytics.metrics.openRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="bg-background">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Sent notifications</h2>
          {notificationsData && <p className="text-sm text-muted-foreground">{summary}</p>}
        </div>

        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No notifications found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] table-auto text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-3">Notification</th>
                  <th className="py-3">Audience</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Sent</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notification) => (
                  <tr key={notification.id} className="border-b border-border/70 align-top">
                    <td className="py-3">
                      <p className="font-medium text-foreground">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">{notification.type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {notification.message.slice(0, 110)}
                      </p>
                    </td>
                    <td className="py-3">
                      <p className="text-foreground">{notification.targetRole || "ALL_ACTIVE_USERS"}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.targetUserIds.length} direct user(s)
                      </p>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={notificationStatusVariant(notification.status)}>
                          {notification.status}
                        </Badge>
                        <Badge variant="info">{notification.channel}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Resends: {notification._count?.resends || 0}
                      </p>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {notification.sentAt
                        ? new Date(notification.sentAt).toLocaleString()
                        : notification.scheduledFor
                          ? `Scheduled ${new Date(notification.scheduledFor).toLocaleString()}`
                          : "Not sent"}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void loadAnalytics(notification.id)}
                          disabled={isMutating}
                        >
                          <Activity className="h-4 w-4" />
                          Analytics
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void resendNotification(notification.id, {
                              message: `${notification.message} (resent)`,
                            })
                          }
                          disabled={isMutating}
                        >
                          <Repeat className="h-4 w-4" />
                          Resend
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {notificationsData && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isMutating}
              onClick={() => setFilters({ page: (notificationsData.page || 1) - 1 })}
            >
              Previous
            </Button>
            <p className="text-sm text-muted-foreground">
              Page {notificationsData.page} of {notificationsData.totalPages}
            </p>
            <Button
              variant="secondary"
              disabled={!canGoNext || isMutating}
              onClick={() => setFilters({ page: (notificationsData.page || 1) + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
