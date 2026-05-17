"use client";

import { CheckCircle2, Eye, RefreshCw, XCircle } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select } from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useVehicleVerifications } from "./hooks/useVehicleVerifications";

const documentStatusOptions = [
  { value: "", label: "All document statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

const statusVariant = (status: string) => {
  if (status === "VERIFIED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "PENDING") return "warning" as const;
  return "secondary" as const;
};

const vehicleStateVariant = (state: string) => {
  if (state === "VERIFIED") return "success" as const;
  if (state === "REJECTED") return "danger" as const;
  if (state === "PENDING") return "warning" as const;
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

export default function AdminVehicleVerificationsPage() {
  const { prompt, dialogs } = useDialogPrompts();

  const {
    isLoading,
    isMutating,
    error,
    filters,
    queueData,
    selectedVehicle,
    selectedHistory,
    setFilters,
    loadVehicleDetails,
    approveVehicle,
    rejectVehicle,
    refetch,
  } = useVehicleVerifications();

  const vehicles = queueData?.items || [];
  const canGoPrev = (queueData?.page || 1) > 1;
  const canGoNext = queueData ? queueData.page < queueData.totalPages : false;

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Input
              label="Search vehicles"
              placeholder="Name, plate, brand, model, owner"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
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
            <h2 className="text-base font-semibold text-foreground">Vehicle verification queue</h2>
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
          ) : vehicles.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No vehicles match these filters.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Vehicle</th>
                    <th className="py-3">Owner</th>
                    <th className="py-3">State</th>
                    <th className="py-3">Documents</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b border-border/70 align-top">
                      <td className="py-3">
                        <p className="font-medium text-foreground">{vehicle.name}</p>
                        <p className="text-xs text-muted-foreground">{vehicle.licensePlate}</p>
                        <p className="text-xs text-muted-foreground">
                          {vehicle.brand} {vehicle.model}
                        </p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">
                          {vehicle.owner.firstName} {vehicle.owner.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{vehicle.owner.email}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant={vehicleStateVariant(vehicle.verificationState)}>
                          {vehicle.verificationState}
                        </Badge>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Active: {vehicle.isActive ? "Yes" : "No"}
                        </p>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge size="sm" variant="warning">
                            Pending {vehicle.documentSummary.pending}
                          </Badge>
                          <Badge size="sm" variant="success">
                            Verified {vehicle.documentSummary.verified}
                          </Badge>
                          <Badge size="sm" variant="danger">
                            Rejected {vehicle.documentSummary.rejected}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadVehicleDetails(vehicle.id)}
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
                                  title: "Approve Vehicle Verification",
                                  message: "Optional approval note",
                                  defaultValue:
                                    "Vehicle listing requirements are satisfied.",
                                  confirmText: "Approve",
                                });

                                await approveVehicle(vehicle.id, note?.trim() || undefined);
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
                                  title: "Reject Vehicle Verification",
                                  message: "Reason for rejection (minimum 3 characters)",
                                  defaultValue:
                                    "Vehicle documents are outdated or incomplete.",
                                  minLength: 3,
                                  confirmText: "Reject",
                                });

                                if (!reason || reason.trim().length < 3) {
                                  return;
                                }

                                await rejectVehicle(vehicle.id, reason.trim());
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
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
          <h3 className="text-base font-semibold text-foreground">Vehicle details</h3>
          {selectedVehicle ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-medium text-foreground">{selectedVehicle.name}</p>
                <p className="text-muted-foreground">{selectedVehicle.licensePlate}</p>
                <p className="text-muted-foreground">{selectedVehicle.owner.email}</p>
                <p className="text-muted-foreground">Location: {selectedVehicle.location}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Document summary
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="warning">Pending {selectedVehicle.documentSummary.pending}</Badge>
                  <Badge variant="success">Verified {selectedVehicle.documentSummary.verified}</Badge>
                  <Badge variant="danger">Rejected {selectedVehicle.documentSummary.rejected}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last document: {formatDate(selectedVehicle.documentSummary.latestDocumentAt)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Documents</p>
                <div className="mt-2 space-y-2">
                  {selectedVehicle.documents.slice(0, 6).map((document) => (
                    <div
                      key={document.id}
                      className="rounded-lg border border-border bg-muted/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{document.type}</p>
                        <Badge size="sm" variant={statusVariant(document.status)}>
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
              Select a vehicle to inspect verification details, documents, and history.
            </p>
          )}
        </Card>
      </div>

      {dialogs}
    </div>
  );
}
