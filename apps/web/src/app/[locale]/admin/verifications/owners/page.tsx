"use client";

import { CheckCircle2, Eye, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select } from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useOwnerVerifications } from "./hooks/useOwnerVerifications";

const ownerStatusOptions = [
  { value: "", label: "All owner statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "PENDING_VERIFICATION", label: "Pending Verification" },
];

const documentStatusOptions = [
  { value: "", label: "All document statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

const statusVariant = (status: string) => {
  if (status === "ACTIVE") return "success" as const;
  if (status === "SUSPENDED") return "danger" as const;
  if (status === "PENDING_VERIFICATION") return "warning" as const;
  return "secondary" as const;
};

const documentVariant = (status: string) => {
  if (status === "VERIFIED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "PENDING") return "warning" as const;
  return "secondary" as const;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "N/A";

const getHistoryMessage = (changes: Record<string, unknown> | null, fallback: string) => {
  if (!changes) {
    return fallback;
  }

  const candidate = changes.message;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate;
  }

  return fallback;
};

export default function AdminOwnerVerificationsPage() {
  const { prompt, dialogs } = useDialogPrompts();

  const {
    isLoading,
    isMutating,
    error,
    filters,
    queueData,
    selectedOwner,
    selectedHistory,
    setFilters,
    loadOwnerDetails,
    approveOwner,
    rejectOwner,
    requestResubmission,
    refetch,
  } = useOwnerVerifications();

  const owners = queueData?.items || [];
  const canGoPrev = (queueData?.page || 1) > 1;
  const canGoNext = queueData ? queueData.page < queueData.totalPages : false;

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Input
              label="Search owners"
              placeholder="Name, email, phone, NIC"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div>
            <Select
              label="Owner status"
              options={ownerStatusOptions}
              value={filters.status || ""}
              onChange={(value) =>
                setFilters({
                  status: (value || undefined) as
                    | "ACTIVE"
                    | "INACTIVE"
                    | "SUSPENDED"
                    | "PENDING_VERIFICATION"
                    | undefined,
                })
              }
            />
          </div>
          <div>
            <Select
              label="Document status"
              options={documentStatusOptions}
              value={filters.documentStatus || ""}
              onChange={(value) =>
                setFilters({
                  documentStatus: (value || undefined) as
                    | "PENDING"
                    | "VERIFIED"
                    | "REJECTED"
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
            <h2 className="text-base font-semibold text-foreground">Owner verification queue</h2>
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
          ) : owners.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No owners match these filters.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Owner</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Documents</th>
                    <th className="py-3">Vehicles</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((owner) => (
                    <tr key={owner.id} className="border-b border-border/70 align-top">
                      <td className="py-3">
                        <p className="font-medium text-foreground">
                          {owner.firstName} {owner.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{owner.email}</p>
                        <p className="text-xs text-muted-foreground">{owner.phone || "No phone"}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant={statusVariant(owner.status)}>{owner.status}</Badge>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Verified: {owner.isVerified ? "Yes" : "No"}
                        </p>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge size="sm" variant="warning">
                            Pending {owner.documentSummary.pending}
                          </Badge>
                          <Badge size="sm" variant="success">
                            Verified {owner.documentSummary.verified}
                          </Badge>
                          <Badge size="sm" variant="danger">
                            Rejected {owner.documentSummary.rejected}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">{owner._count.vehicles}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadOwnerDetails(owner.id)}
                            disabled={isMutating}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => {
                              void (async () => {
                                const note = await prompt({
                                  title: "Approve Owner Verification",
                                  message: "Optional approval note",
                                  defaultValue: "All verification checks passed.",
                                  confirmText: "Approve",
                                });

                                await approveOwner(owner.id, note?.trim() || undefined);
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void (async () => {
                                const reason = await prompt({
                                  title: "Reject Owner Verification",
                                  message: "Reason for rejection (minimum 3 characters)",
                                  defaultValue: "Submitted documents are incomplete.",
                                  minLength: 3,
                                  confirmText: "Reject",
                                });

                                if (!reason || reason.trim().length < 3) {
                                  return;
                                }

                                await rejectOwner(owner.id, reason.trim());
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void (async () => {
                                const reason = await prompt({
                                  title: "Request Owner Resubmission",
                                  message: "Reason for resubmission request (minimum 3 characters)",
                                  defaultValue:
                                    "Please upload a clearer NIC copy and updated profile photo.",
                                  minLength: 3,
                                  confirmText: "Send Request",
                                });

                                if (!reason || reason.trim().length < 3) {
                                  return;
                                }

                                await requestResubmission(owner.id, reason.trim());
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Resubmit
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
          <h3 className="text-base font-semibold text-foreground">Owner details</h3>
          {selectedOwner ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-medium text-foreground">
                  {selectedOwner.firstName} {selectedOwner.lastName}
                </p>
                <p className="text-muted-foreground">{selectedOwner.email}</p>
                <p className="text-muted-foreground">NIC: {selectedOwner.nicNumber || "N/A"}</p>
                <p className="text-muted-foreground">Status: {selectedOwner.status}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Verification summary
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="warning">Pending {selectedOwner.documentSummary.pending}</Badge>
                  <Badge variant="success">Verified {selectedOwner.documentSummary.verified}</Badge>
                  <Badge variant="danger">Rejected {selectedOwner.documentSummary.rejected}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last document: {formatDate(selectedOwner.documentSummary.latestDocumentAt)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Documents</p>
                <div className="mt-2 space-y-2">
                  {selectedOwner.documents.slice(0, 6).map((document) => (
                    <div
                      key={document.id}
                      className="rounded-lg border border-border bg-muted/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{document.type}</p>
                        <Badge size="sm" variant={documentVariant(document.status)}>
                          {document.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Uploaded: {formatDate(document.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent history</p>
                <div className="mt-2 space-y-2">
                  {(selectedHistory?.logs || []).slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-border bg-muted/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getHistoryMessage(log.changes, log.entityType)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Select an owner to inspect profile details, documents, and verification history.
            </p>
          )}
        </Card>
      </div>

      {dialogs}
    </div>
  );
}
