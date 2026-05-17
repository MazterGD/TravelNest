"use client";

import { Download, RefreshCw } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select } from "@/components/ui";
import { useAuditLogs } from "./hooks/useAuditLogs";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
];

export default function AdminAuditLogsPage() {
  const {
    isLoading,
    isExporting,
    error,
    filters,
    logsData,
    selectedLog,
    setFilters,
    selectLog,
    exportCsv,
    refetch,
  } = useAuditLogs();

  const logs = logsData?.logs || [];

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-5">
          <Input
            label="Action"
            placeholder="CREATE, UPDATE, DELETE"
            value={filters.action || ""}
            onChange={(event) => setFilters({ action: event.target.value })}
          />
          <Input
            label="Entity type"
            placeholder="USER, BOOKING, REPORT"
            value={filters.entityType || ""}
            onChange={(event) => setFilters({ entityType: event.target.value })}
          />
          <Input
            label="Entity ID"
            placeholder="Optional"
            value={filters.entityId || ""}
            onChange={(event) => setFilters({ entityId: event.target.value })}
          />
          <Select
            label="Status"
            options={statusOptions}
            value={filters.status || ""}
            onChange={(value) =>
              setFilters({ status: (value || undefined) as "success" | "failure" | undefined })
            }
          />
          <div className="flex items-end gap-2">
            <Button
              className="flex-1"
              variant="secondary"
              onClick={() => void refetch()}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <Button
              className="flex-1"
              onClick={() => void exportCsv()}
              disabled={isExporting || isLoading}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Activity log table</h2>
            <p className="text-sm text-muted-foreground">{logsData?.pagination.total || 0} records</p>
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : logs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No audit logs match the current filters.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Time</th>
                    <th className="py-3">Action</th>
                    <th className="py-3">Entity</th>
                    <th className="py-3">Admin</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/70">
                      <td className="py-3 text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 font-medium text-foreground">{log.action}</td>
                      <td className="py-3 text-foreground">
                        {log.entityType}
                        <p className="text-xs text-muted-foreground">{log.entityId}</p>
                      </td>
                      <td className="py-3 text-foreground">
                        {log.admin.firstName} {log.admin.lastName}
                        <p className="text-xs text-muted-foreground">{log.admin.email}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant={log.status === "success" ? "success" : "danger"}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Button size="sm" variant="secondary" onClick={() => selectLog(log)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="bg-background">
          <h3 className="text-base font-semibold text-foreground">Log details</h3>

          {!selectedLog ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Select a row from the activity table to inspect details.
            </p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">{selectedLog.action}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedLog.entityType} | {selectedLog.entityId}
                </p>
              </div>
              <p className="text-muted-foreground">
                Admin: {selectedLog.admin.firstName} {selectedLog.admin.lastName}
              </p>
              <p className="text-muted-foreground">Status: {selectedLog.status}</p>
              {selectedLog.errorMessage && (
                <p className="text-sm font-medium text-error-text">
                  Error: {selectedLog.errorMessage}
                </p>
              )}
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Changes</p>
                <pre className="overflow-x-auto text-xs text-foreground">
                  {JSON.stringify(selectedLog.changes || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
