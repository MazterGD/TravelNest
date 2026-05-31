"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Globe,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Badge,
  Button,
  Card,
  DatePicker,
  EmptySearchIcon,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonTable,
} from "@/components/ui";
import { useAuditLogs } from "./hooks/useAuditLogs";
import type { AdminAuditLog } from "@/lib/api";

// ── Option lists ─────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "APPROVE", label: "Approve" },
  { value: "REJECT", label: "Reject" },
  { value: "SUSPEND", label: "Suspend" },
  { value: "RESTORE", label: "Restore" },
  { value: "EXPORT", label: "Export" },
  { value: "VIEW", label: "View" },
];

const ENTITY_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "USER", label: "User" },
  { value: "BOOKING", label: "Booking" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "PAYMENT", label: "Payment" },
  { value: "SETTLEMENT", label: "Settlement" },
  { value: "VERIFICATION", label: "Verification" },
  { value: "REPORT", label: "Report" },
  { value: "NOTIFICATION", label: "Notification" },
];

const ROWS_PER_PAGE_OPTIONS = [
  { value: "20", label: "20 rows" },
  { value: "50", label: "50 rows" },
  { value: "100", label: "100 rows" },
];

// ── Quick-filter pills ───────────────────────────────────────────────────────

const STATUS_PILLS = [
  {
    label: "All activity",
    value: undefined as "success" | "failure" | undefined,
    icon: <Activity className="h-4 w-4" />,
  },
  {
    label: "Success",
    value: "success" as const,
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    label: "Failure",
    value: "failure" as const,
    icon: <XCircle className="h-4 w-4" />,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const relativeTime = (timestamp: string) => {
  const now = Date.now();
  const target = new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.floor((now - target) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  APPROVE: "Approve",
  REJECT: "Reject",
  SUSPEND: "Suspend",
  RESTORE: "Restore",
  EXPORT: "Export",
  VIEW: "View",
};

const ENTITY_LABELS: Record<string, string> = {
  USER: "User",
  BOOKING: "Booking",
  VEHICLE: "Vehicle",
  PAYMENT: "Payment",
  SETTLEMENT: "Settlement",
  VERIFICATION: "Verification",
  REPORT: "Report",
  NOTIFICATION: "Notification",
};

function adminInitials(log: AdminAuditLog) {
  return `${log.admin.firstName?.[0] ?? ""}${log.admin.lastName?.[0] ?? ""}`.toUpperCase();
}

// ── Log detail modal ─────────────────────────────────────────────────────────

interface LogDetailModalProps {
  log: AdminAuditLog;
  onClose: () => void;
}

function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  const isSuccess = log.status === "success";

  return (
    <Modal isOpen onClose={onClose} title="Log Details" size="md">
      <div className="space-y-4">
        {/* Status banner */}
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4",
            isSuccess
              ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]"
              : "border-[var(--color-error-border)] bg-[var(--color-error-bg)]",
          )}
        >
          {isSuccess ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-success-text)]"
              aria-hidden="true"
            />
          ) : (
            <XCircle
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
              aria-hidden="true"
            />
          )}
          <div>
            <p
              className={cn(
                "text-sm font-semibold",
                isSuccess
                  ? "text-[var(--color-success-text)]"
                  : "text-[var(--color-error-text)]",
              )}
            >
              {isSuccess ? "Operation succeeded" : "Operation failed"}
            </p>
            {log.errorMessage && (
              <p className="mt-0.5 text-xs text-[var(--color-error-text)]/80">
                {log.errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Action + entity */}
        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--color-text-tertiary)]">Action</dt>
              <dd>
                <span className="inline-flex items-center rounded-lg bg-[var(--color-bg-base)] px-2.5 py-1 text-xs font-bold text-[var(--color-text-primary)]">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--color-text-tertiary)]">Entity type</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {ENTITY_LABELS[log.entityType] ?? log.entityType}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-[var(--color-text-tertiary)]">Entity ID</dt>
              <dd className="max-w-[220px] break-all font-mono text-xs text-[var(--color-text-secondary)]">
                {log.entityId}
              </dd>
            </div>
          </dl>
        </div>

        {/* Admin */}
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-[var(--color-action-primary)]"
          >
            {adminInitials(log)}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {log.admin.firstName} {log.admin.lastName}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {log.admin.email}
              {log.admin.adminRole ? ` · ${log.admin.adminRole}` : ""}
            </p>
          </div>
        </div>

        {/* Meta row */}
        <dl className="divide-y divide-[var(--color-border-default)] rounded-xl border border-[var(--color-border-default)] text-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="flex items-center gap-2 text-[var(--color-text-tertiary)]">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Timestamp
            </dt>
            <dd className="text-[var(--color-text-primary)]">
              {new Date(log.createdAt).toLocaleString("en-GB")}
            </dd>
          </div>
          {log.ipAddress && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <dt className="flex items-center gap-2 text-[var(--color-text-tertiary)]">
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                IP Address
              </dt>
              <dd className="font-mono text-xs text-[var(--color-text-secondary)]">
                {log.ipAddress}
              </dd>
            </div>
          )}
          {log.userAgent && (
            <div className="flex items-start justify-between gap-4 px-4 py-2.5">
              <dt className="flex shrink-0 items-center gap-2 text-[var(--color-text-tertiary)]">
                <Server className="h-3.5 w-3.5" aria-hidden="true" />
                User Agent
              </dt>
              <dd className="max-w-[280px] break-words text-xs text-[var(--color-text-tertiary)]">
                {log.userAgent}
              </dd>
            </div>
          )}
        </dl>

        {/* Changes JSON */}
        {log.changes && Object.keys(log.changes).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Changes
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
              <pre className="text-xs text-[var(--color-text-primary)]">
                {JSON.stringify(log.changes, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

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

  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const logs = logsData?.logs ?? [];
  const pagination = logsData?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;
  const canGoPrev = (pagination?.page ?? 1) > 1;
  const canGoNext = pagination ? pagination.page < totalPages : false;

  const handleViewLog = (log: AdminAuditLog) => {
    selectLog(log);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    selectLog(null);
  };

  const clearFilters = () => {
    setFilters({
      action: undefined,
      entityType: undefined,
      entityId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      status: undefined,
      page: 1,
    });
  };

  const hasActiveFilters =
    filters.action ?? filters.entityType ?? filters.entityId ?? filters.dateFrom ?? filters.dateTo ?? filters.status;

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Audit Logs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Track every admin, owner, and customer action on the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
            aria-label="Refresh audit logs"
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => void exportCsv()}
            disabled={isExporting || isLoading}
            aria-label="Export audit logs as CSV"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Status quick-filter pills ────────────────────────────────────────── */}
      <div
        role="group"
        aria-label="Filter by status"
        className="grid grid-cols-3 gap-3"
      >
        {STATUS_PILLS.map((pill) => {
          const isActive = filters.status === pill.value;
          return (
            <button
              key={pill.label}
              type="button"
              onClick={() => setFilters({ status: pill.value })}
              aria-pressed={isActive}
              className={cn(
                "rounded-[20px] border p-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2",
                isActive
                  ? "border-[var(--color-action-primary)] bg-primary/5"
                  : "border-[var(--color-border-default)] bg-white hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)]",
              )}
            >
              <span
                className={
                  isActive
                    ? "text-[var(--color-action-primary)]"
                    : "text-[var(--color-text-tertiary)]"
                }
              >
                {pill.icon}
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {pill.label}
              </p>
              {isActive && pagination && (
                <p className="mt-0.5 text-xl font-bold text-[var(--color-action-primary)]">
                  {pagination.total.toLocaleString()}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <Card className="bg-[var(--color-bg-base)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Action"
            options={ACTION_OPTIONS}
            value={filters.action ?? ""}
            onChange={(v) => setFilters({ action: v || undefined })}
          />
          <Select
            label="Entity type"
            options={ENTITY_OPTIONS}
            value={filters.entityType ?? ""}
            onChange={(v) => setFilters({ entityType: v || undefined })}
          />
          <DatePicker
            label="From date"
            id="filter-date-from"
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters({ dateFrom: e.target.value || undefined })}
          />
          <DatePicker
            label="To date"
            id="filter-date-to"
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters({ dateTo: e.target.value || undefined })}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-[200px]">
            <Input
              label="Entity ID"
              placeholder="Filter by exact ID"
              value={filters.entityId ?? ""}
              onChange={(e) => setFilters({ entityId: e.target.value || undefined })}
            />
          </div>
          <div className="w-full sm:w-[130px]">
            <Select
              label="Per page"
              options={ROWS_PER_PAGE_OPTIONS}
              value={String(filters.limit ?? 20)}
              onChange={(v) => setFilters({ limit: Number(v), page: 1 })}
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="mb-0.5 text-[var(--color-text-tertiary)] sm:self-end"
            >
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--color-error-text)]">
                Could not load audit logs.
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
                {error} — Try refreshing or check your connection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Logs table ──────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden bg-[var(--color-bg-base)] p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Activity Log
          </h2>
          {pagination && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {pagination.total.toLocaleString()}{" "}
              {pagination.total === 1 ? "record" : "records"}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 pb-6">
            <SkeletonTable rows={filters.limit ?? 20} cols={5} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No audit logs found"
            description="Try adjusting your filters or date range to see results."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-auto text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Time
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Action
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Entity
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Admin
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-[var(--color-bg-surface)]"
                  >
                    {/* Time */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {new Date(log.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                        {new Date(log.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {relativeTime(log.createdAt)}
                      </p>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-lg bg-[var(--color-bg-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-primary)]">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>

                    {/* Entity */}
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {ENTITY_LABELS[log.entityType] ?? log.entityType}
                      </p>
                      <p className="mt-0.5 max-w-[140px] truncate font-mono text-xs text-[var(--color-text-tertiary)]">
                        {log.entityId}
                      </p>
                    </td>

                    {/* Admin */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          aria-hidden="true"
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-[var(--color-action-primary)]"
                        >
                          {adminInitials(log)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {log.admin.firstName} {log.admin.lastName}
                          </p>
                          <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                            {log.admin.adminRole ?? "Admin"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <Badge
                        variant={log.status === "success" ? "success" : "danger"}
                        dot
                      >
                        {log.status === "success" ? "Success" : "Failed"}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewLog(log)}
                        aria-label={`View details for ${ACTION_LABELS[log.action] ?? log.action} on ${ENTITY_LABELS[log.entityType] ?? log.entityType}`}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isLoading}
              onClick={() => setFilters({ page: pagination.page - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page {pagination.page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={!canGoNext || isLoading}
              onClick={() => setFilters({ page: pagination.page + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Log detail modal ────────────────────────────────────────────────── */}
      {isDetailOpen && selectedLog && (
        <LogDetailModal log={selectedLog} onClose={closeDetail} />
      )}
    </div>
  );
}
