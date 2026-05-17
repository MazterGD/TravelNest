"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Eye,
  RefreshCw,
  Send,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select } from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useDisputeManagement } from "./hooks/useDisputeManagement";

const disputeStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "INVESTIGATING", label: "Investigating" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const disputePriorityOptions = [
  { value: "", label: "All priorities" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const disputeTypeOptions = [
  { value: "", label: "All dispute types" },
  { value: "BOOKING_QUALITY_ISSUE", label: "Booking quality issue" },
  { value: "CANCELLATION_DISPUTE", label: "Cancellation dispute" },
  { value: "PAYMENT_ISSUE", label: "Payment issue" },
  { value: "VEHICLE_CONDITION", label: "Vehicle condition" },
  { value: "BEHAVIOR_COMPLAINT", label: "Behavior complaint" },
  { value: "SERVICE_NOT_PROVIDED", label: "Service not provided" },
  { value: "OTHER", label: "Other" },
];

const statusVariant = (status: string) => {
  if (status === "OPEN" || status === "INVESTIGATING") return "warning" as const;
  if (status === "ESCALATED") return "danger" as const;
  if (status === "RESOLVED") return "success" as const;
  if (status === "CLOSED") return "secondary" as const;
  return "secondary" as const;
};

const priorityVariant = (priority: string) => {
  if (priority === "URGENT") return "danger" as const;
  if (priority === "HIGH") return "warning" as const;
  if (priority === "MEDIUM") return "info" as const;
  return "secondary" as const;
};

const formatDate = (value: string) => new Date(value).toLocaleString();

const truncate = (value: string, max = 120) =>
  value.length > max ? `${value.slice(0, max)}...` : value;

export default function AdminDisputesPage() {
  const { prompt, dialogs } = useDialogPrompts();

  const {
    isLoading,
    isMutating,
    error,
    filters,
    queueData,
    selectedDispute,
    setFilters,
    loadDisputeDetails,
    assignDispute,
    updatePriority,
    updateStatus,
    addMessage,
    resolveDispute,
    refetch,
  } = useDisputeManagement();

  const [messageDraft, setMessageDraft] = useState("");

  const disputes = queueData?.items || [];
  const canGoPrev = (queueData?.page || 1) > 1;
  const canGoNext = queueData ? queueData.page < queueData.totalPages : false;

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Input
              label="Search disputes"
              placeholder="Code, booking, user, subject"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div>
            <Select
              label="Status"
              options={disputeStatusOptions}
              value={filters.status || ""}
              onChange={(value) =>
                setFilters({
                  status: (value || undefined) as
                    | "OPEN"
                    | "INVESTIGATING"
                    | "RESOLVED"
                    | "CLOSED"
                    | "ESCALATED"
                    | undefined,
                })
              }
            />
          </div>
          <div>
            <Select
              label="Priority"
              options={disputePriorityOptions}
              value={filters.priority || ""}
              onChange={(value) =>
                setFilters({
                  priority: (value || undefined) as
                    | "LOW"
                    | "MEDIUM"
                    | "HIGH"
                    | "URGENT"
                    | undefined,
                })
              }
            />
          </div>
          <div>
            <Select
              label="Dispute type"
              options={disputeTypeOptions}
              value={filters.type || ""}
              onChange={(value) =>
                setFilters({
                  type: (value || undefined) as
                    | "BOOKING_QUALITY_ISSUE"
                    | "CANCELLATION_DISPUTE"
                    | "PAYMENT_ISSUE"
                    | "VEHICLE_CONDITION"
                    | "BEHAVIOR_COMPLAINT"
                    | "SERVICE_NOT_PROVIDED"
                    | "OTHER"
                    | undefined,
                })
              }
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="secondary" onClick={() => void refetch()}>
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

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Disputes queue</h2>
            {queueData && (
              <p className="text-sm text-muted-foreground">
                {(queueData.page - 1) * queueData.limit + 1}-
                {Math.min(queueData.total, queueData.page * queueData.limit)} of {queueData.total}
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : disputes.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No disputes match these filters.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[980px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Dispute</th>
                    <th className="py-3">Parties</th>
                    <th className="py-3">Booking</th>
                    <th className="py-3">Priority / Status</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((dispute) => (
                    <tr key={dispute.id} className="border-b border-border/70 align-top">
                      <td className="py-3">
                        <p className="font-medium text-foreground">{dispute.disputeCode}</p>
                        <p className="text-xs text-muted-foreground">{dispute.subject}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {truncate(dispute.description, 100)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Created: {formatDate(dispute.createdAt)}
                        </p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">
                          {dispute.raisedByUser.firstName} {dispute.raisedByUser.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">Against</p>
                        <p className="font-medium text-foreground">
                          {dispute.againstUser.firstName} {dispute.againstUser.lastName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Assignee: {dispute.assignedAdmin
                            ? `${dispute.assignedAdmin.firstName} ${dispute.assignedAdmin.lastName}`
                            : "Unassigned"}
                        </p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">{dispute.booking.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {dispute.booking.pickupLocation}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dispute.booking.dropoffLocation || "No dropoff"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          LKR {dispute.booking.totalAmount.toLocaleString()}
                        </p>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={priorityVariant(dispute.priority)}>{dispute.priority}</Badge>
                          <Badge variant={statusVariant(dispute.status)}>{dispute.status}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {dispute._count.messages} message(s)
                        </p>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadDisputeDetails(dispute.id)}
                            disabled={isMutating}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void (async () => {
                                const targetAdminId = await prompt({
                                  title: "Assign Dispute",
                                  message: "Enter admin user ID to assign",
                                  defaultValue: dispute.assignedTo || "",
                                  minLength: 1,
                                  confirmText: "Assign",
                                });

                                if (!targetAdminId || targetAdminId.trim().length === 0) {
                                  return;
                                }

                                const note = await prompt({
                                  title: "Assignment Note",
                                  message: "Optional assignment note",
                                  defaultValue: "Assigned for investigation",
                                  confirmText: "Continue",
                                });

                                await assignDispute(
                                  dispute.id,
                                  targetAdminId.trim(),
                                  note?.trim() || undefined,
                                );
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <UserPlus className="h-4 w-4" />
                            Assign
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void (async () => {
                                const resolution = await prompt({
                                  title: "Resolve Dispute",
                                  message: "Resolution summary (minimum 3 characters)",
                                  defaultValue: "Resolved after admin investigation.",
                                  minLength: 3,
                                  confirmText: "Continue",
                                });

                                if (!resolution || resolution.trim().length < 3) {
                                  return;
                                }

                                const resolutionType = await prompt({
                                  title: "Resolution Type",
                                  message: "Optional resolution type",
                                  defaultValue: "REFUND",
                                  confirmText: "Continue",
                                });

                                const amountRaw = await prompt({
                                  title: "Resolution Amount",
                                  message: "Resolution amount in LKR (optional)",
                                  type: "number",
                                  confirmText: "Apply",
                                });

                                const parsedAmount =
                                  amountRaw && amountRaw.trim().length > 0
                                    ? Number(amountRaw)
                                    : undefined;

                                await resolveDispute(
                                  dispute.id,
                                  resolution.trim(),
                                  resolutionType?.trim() || undefined,
                                  Number.isFinite(parsedAmount) ? parsedAmount : undefined,
                                );
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <ShieldAlert className="h-4 w-4" />
                            Resolve
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {queueData && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                disabled={!canGoPrev || isMutating}
                onClick={() => setFilters({ page: (queueData.page || 1) - 1 })}
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {queueData.page} of {queueData.totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={!canGoNext || isMutating}
                onClick={() => setFilters({ page: (queueData.page || 1) + 1 })}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Dispute details</h3>
          {selectedDispute ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={priorityVariant(selectedDispute.priority)}>
                    {selectedDispute.priority}
                  </Badge>
                  <Badge variant={statusVariant(selectedDispute.status)}>
                    {selectedDispute.status}
                  </Badge>
                </div>
                <p className="mt-2 font-medium text-foreground">{selectedDispute.disputeCode}</p>
                <p className="text-foreground">{selectedDispute.subject}</p>
                <p className="mt-1 text-muted-foreground">{selectedDispute.description}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Parties</p>
                <p className="mt-1 text-foreground">
                  Raised by: {selectedDispute.raisedByUser.firstName} {selectedDispute.raisedByUser.lastName}
                </p>
                <p className="text-foreground">
                  Against: {selectedDispute.againstUser.firstName} {selectedDispute.againstUser.lastName}
                </p>
                <p className="text-muted-foreground">
                  Assignee: {selectedDispute.assignedAdmin
                    ? `${selectedDispute.assignedAdmin.firstName} ${selectedDispute.assignedAdmin.lastName}`
                    : "Unassigned"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Booking context</p>
                <p className="mt-1 text-foreground">{selectedDispute.booking.id}</p>
                <p className="text-muted-foreground">{selectedDispute.booking.pickupLocation}</p>
                <p className="text-muted-foreground">{selectedDispute.booking.dropoffLocation || "No dropoff"}</p>
                <p className="text-muted-foreground">LKR {selectedDispute.booking.totalAmount.toLocaleString()}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Discussion</p>
                <div className="mt-2 max-h-[220px] space-y-2 overflow-y-auto">
                  {selectedDispute.messages.slice(-10).map((message) => (
                    <div key={message.id} className="rounded-lg border border-border bg-muted/60 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">
                          {message.sender.firstName} {message.sender.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(message.createdAt)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{message.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  label="Add internal note"
                  placeholder="Investigation update for internal team"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                />
                <Button
                  className="w-full"
                  onClick={() => {
                    if (messageDraft.trim().length < 3) {
                      return;
                    }

                    void addMessage(selectedDispute.id, messageDraft.trim(), true).then(() => {
                      setMessageDraft("");
                    });
                  }}
                  disabled={isMutating || messageDraft.trim().length < 3}
                >
                  <Send className="h-4 w-4" />
                  Add Internal Note
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    void (async () => {
                      const message = await prompt({
                        title: "Public Dispute Update",
                        message: "Public update message (minimum 3 characters)",
                        defaultValue: "Admin update: investigation is in progress.",
                        minLength: 3,
                        confirmText: "Post",
                      });

                      if (!message || message.trim().length < 3) {
                        return;
                      }

                      await addMessage(selectedDispute.id, message.trim(), false);
                    })();
                  }}
                  disabled={isMutating}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Post Public Update
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    void updateStatus(
                      selectedDispute.id,
                      "INVESTIGATING",
                      "Marked as investigating by admin",
                    )
                  }
                  disabled={isMutating}
                >
                  Investigate
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void updateStatus(
                      selectedDispute.id,
                      "CLOSED",
                      "Case closed by admin",
                    )
                  }
                  disabled={isMutating}
                >
                  Close
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void updatePriority(
                      selectedDispute.id,
                      "HIGH",
                      "Priority increased by admin",
                    )
                  }
                  disabled={isMutating}
                >
                  Mark High Priority
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void updateStatus(
                      selectedDispute.id,
                      "ESCALATED",
                      "Escalated for advanced review",
                    )
                  }
                  disabled={isMutating}
                >
                  Escalate
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Select a dispute to review full context, post updates, and resolve.
            </p>
          )}
        </Card>
      </div>

      {dialogs}
    </div>
  );
}
