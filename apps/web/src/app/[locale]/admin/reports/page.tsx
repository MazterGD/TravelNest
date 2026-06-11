"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  Download,
  Eye,
  Play,
  Plus,
  RefreshCw,
  ScrollText,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Badge,
  Button,
  Card,
  EmptySearchIcon,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonTable,
  Tabs,
  TextArea,
} from "@/components/ui";
import {
  type AdminReportFormat,
  type AdminReportFrequency,
  type AdminReportType,
  type AdminScheduledReport,
} from "@/lib/api";
import { useDialogPrompts } from "@/hooks";
import { useReportsGenerator } from "./hooks/useReportsGenerator";

// ─── Static option lists ──────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "USERS", label: "Users" },
  { value: "BOOKINGS", label: "Bookings" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "AUDIT", label: "Audit" },
  { value: "DISPUTES", label: "Disputes" },
  { value: "VERIFICATIONS", label: "Verifications" },
  { value: "SYSTEM", label: "System" },
];

const FREQUENCY_OPTIONS = [
  { value: "", label: "All schedules" },
  { value: "ON_DEMAND", label: "On demand" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const FORMAT_OPTIONS = [
  { value: "", label: "All formats" },
  { value: "CSV", label: "CSV" },
  { value: "PDF", label: "PDF" },
  { value: "EXCEL", label: "Excel" },
];

const CREATE_TYPE_OPTIONS = TYPE_OPTIONS.slice(1);
const CREATE_FREQUENCY_OPTIONS = FREQUENCY_OPTIONS.slice(1);
const CREATE_FORMAT_OPTIONS = FORMAT_OPTIONS.slice(1);

const STATUS_FILTERS = [
  { label: "All", value: undefined as boolean | undefined },
  { label: "Active", value: true },
  { label: "Archived", value: false },
];

const ROWS_PER_PAGE_OPTIONS = [
  { value: "10", label: "10 rows" },
  { value: "20", label: "20 rows" },
  { value: "50", label: "50 rows" },
];

// ─── Label maps ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  USERS: "Users",
  BOOKINGS: "Bookings",
  FINANCIAL: "Financial",
  OPERATIONS: "Operations",
  AUDIT: "Audit",
  DISPUTES: "Disputes",
  VERIFICATIONS: "Verifications",
  SYSTEM: "System",
};

const FREQUENCY_LABEL: Record<string, string> = {
  ON_DEMAND: "On demand",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

const RUN_STATUS_BADGE: Record<
  string,
  "success" | "danger" | "warning" | "info" | "secondary"
> = {
  SUCCESS: "success",
  FAILED: "danger",
  RUNNING: "info",
  QUEUED: "warning",
  CANCELLED: "secondary",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateConfigJson(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}") return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "Configuration must be a JSON object";
    }
    return null;
  } catch {
    return "Invalid JSON — check your syntax";
  }
}

function parseConfigJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const DEFAULT_CREATE_FORM = {
  name: "",
  description: "",
  type: "OPERATIONS" as AdminReportType,
  frequency: "ON_DEMAND" as AdminReportFrequency,
  format: "CSV" as AdminReportFormat,
  config: "{}",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const { confirm, dialogs } = useDialogPrompts();

  const {
    isLoading,
    isMutating,
    error,
    filters,
    reportsData,
    selectedReport,
    setFilters,
    selectReport,
    createReport,
    updateReport,
    runReport,
    exportReport,
    archiveReport,
    refetch,
  } = useReportsGenerator();

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [configError, setConfigError] = useState<string | null>(null);

  // Detail modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const reports = reportsData?.items ?? [];
  const canGoPrev = (reportsData?.page ?? 1) > 1;
  const canGoNext = reportsData ? reportsData.page < reportsData.totalPages : false;

  const totalSummary = useMemo(() => {
    if (!reportsData) return "";
    const start = (reportsData.page - 1) * reportsData.limit + 1;
    const end = Math.min(reportsData.total, reportsData.page * reportsData.limit);
    return `${start}–${end} of ${reportsData.total.toLocaleString()}`;
  }, [reportsData]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleViewReport = (report: AdminScheduledReport) => {
    selectReport(report);
    setEditName(report.name);
    setEditDescription(report.description ?? "");
    setEditIsActive(report.isActive);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    selectReport(null);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateForm(DEFAULT_CREATE_FORM);
    setConfigError(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateConfigJson(createForm.config);
    if (validationError) {
      setConfigError(validationError);
      return;
    }
    if (createForm.name.trim().length < 2) return;

    const created = await createReport({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      reportType: createForm.type,
      frequency: createForm.frequency,
      format: createForm.format,
      configuration: parseConfigJson(createForm.config),
    });

    if (created) {
      closeCreate();
      handleViewReport(created);
    }
  };

  const handleSave = async () => {
    if (!selectedReport) return;
    const updated = await updateReport(selectedReport.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      isActive: editIsActive,
    });
    if (updated) {
      selectReport(updated);
      setEditName(updated.name);
      setEditDescription(updated.description ?? "");
      setEditIsActive(updated.isActive);
    }
  };

  const handleRun = async (report: AdminScheduledReport) => {
    const approved = await confirm({
      title: "Run Report Now",
      message: `Generate "${report.name}" immediately on demand?`,
      confirmText: "Run Now",
    });
    if (approved) await runReport(report.id, report.format);
  };

  const handleArchive = async (report: AdminScheduledReport) => {
    const approved = await confirm({
      title: "Archive Report",
      message: `"${report.name}" will be deactivated. Run history is preserved.`,
      confirmText: "Archive",
      variant: "danger",
    });
    if (approved) {
      await archiveReport(report.id);
      if (isDetailOpen) closeDetail();
    }
  };

  // ── Detail modal tab panels ────────────────────────────────────────────────

  const overviewPanel = selectedReport && (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            {selectedReport.name}
          </p>
          {selectedReport.description && (
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              {selectedReport.description}
            </p>
          )}
        </div>
        <Badge variant={selectedReport.isActive ? "success" : "secondary"} dot>
          {selectedReport.isActive ? "Active" : "Archived"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <div>
          <p className="text-xs text-[var(--color-text-tertiary)]">Total runs</p>
          <p className="mt-0.5 text-xl font-bold text-[var(--color-text-primary)]">
            {selectedReport._count?.runs ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-tertiary)]">Format</p>
          <p className="mt-0.5 text-xl font-bold text-[var(--color-text-primary)]">
            {selectedReport.format}
          </p>
        </div>
      </div>

      <dl className="divide-y divide-[var(--color-border-default)] text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Report type</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {TYPE_LABEL[selectedReport.reportType] ?? selectedReport.reportType}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Frequency</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {FREQUENCY_LABEL[selectedReport.frequency] ?? selectedReport.frequency}
          </dd>
        </div>
        {selectedReport.cronExpression && (
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-text-tertiary)]">Cron expression</dt>
            <dd className="font-mono text-xs text-[var(--color-text-primary)]">
              {selectedReport.cronExpression}
            </dd>
          </div>
        )}
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Timezone</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {selectedReport.timezone}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Last run</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {selectedReport.lastRunAt
              ? new Date(selectedReport.lastRunAt).toLocaleString("en-GB")
              : "Never"}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Next run</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {selectedReport.nextRunAt
              ? new Date(selectedReport.nextRunAt).toLocaleString("en-GB")
              : "Not scheduled"}
          </dd>
        </div>
        {selectedReport.recipients.length > 0 && (
          <div className="flex justify-between gap-4 py-2">
            <dt className="shrink-0 text-[var(--color-text-tertiary)]">Recipients</dt>
            <dd className="text-right font-medium text-[var(--color-text-primary)]">
              {selectedReport.recipients.join(", ")}
            </dd>
          </div>
        )}
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Created</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {new Date(selectedReport.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleRun(selectedReport)}
          disabled={isMutating}
        >
          <Play className="h-4 w-4" />
          Run Now
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void exportReport(selectedReport.id, selectedReport.format)}
          disabled={isMutating}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
        {selectedReport.isActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleArchive(selectedReport)}
            disabled={isMutating}
            className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        )}
      </div>
    </div>
  );

  const editPanel = selectedReport && (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Update this report&apos;s name, description, or activation status.
      </p>
      <div className="space-y-3">
        <Input
          label="Name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
        />
        <Input
          label="Description"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
        />
        <Select
          label="Status"
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Archived" },
          ]}
          value={String(editIsActive)}
          onChange={(v) => setEditIsActive(v === "true")}
        />
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => void handleSave()}
          isLoading={isMutating}
          disabled={isMutating || editName.trim().length < 2}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );

  const runHistoryPanel = selectedReport && (
    <div className="space-y-3">
      {!selectedReport.runs || selectedReport.runs.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No run history available"
          description={
            selectedReport._count?.runs
              ? `${selectedReport._count.runs} run(s) recorded. Detailed history requires a dedicated endpoint.`
              : "This report has not been run yet. Use Run Now to generate it on demand."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Started
                </th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Source
                </th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Rows
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-default)]">
              {selectedReport.runs.map((run) => (
                <tr key={run.id} className="hover:bg-[var(--color-bg-surface)]">
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {new Date(run.startedAt).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={RUN_STATUS_BADGE[run.status] ?? "secondary"} dot>
                      {run.status.charAt(0) + run.status.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {run.triggerSource.charAt(0) + run.triggerSource.slice(1).toLowerCase()}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">
                    {run.rowCount?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const detailTabs = selectedReport
    ? [
        {
          id: "overview",
          label: "Overview",
          icon: <ScrollText className="h-4 w-4" />,
          badge: selectedReport._count?.runs,
          content: overviewPanel,
        },
        {
          id: "edit",
          label: "Edit",
          icon: <Settings2 className="h-4 w-4" />,
          content: editPanel,
        },
        {
          id: "history",
          label: "Run History",
          icon: <CalendarClock className="h-4 w-4" />,
          content: runHistoryPanel,
        },
      ]
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Reports</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage and run scheduled data reports across the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading || isMutating}
            aria-label="Refresh report list"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Report
          </Button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((sf) => {
          const isActive = filters.isActive === sf.value;
          return (
            <button
              key={String(sf.value ?? "all")}
              type="button"
              onClick={() => setFilters({ isActive: sf.value, page: 1 })}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2",
                isActive
                  ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)]",
              )}
            >
              {sf.label}
              {isActive && reportsData && (
                <span className="ml-1.5 text-xs tabular-nums">
                  ({reportsData.total.toLocaleString()})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card className="bg-[var(--color-bg-base)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search reports"
              placeholder="Name or description"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-[170px]">
            <Select
              label="Type"
              options={TYPE_OPTIONS}
              value={filters.reportType ?? ""}
              onChange={(v) =>
                setFilters({ reportType: (v || undefined) as AdminReportType | undefined })
              }
            />
          </div>
          <div className="w-full sm:w-[170px]">
            <Select
              label="Schedule"
              options={FREQUENCY_OPTIONS}
              value={filters.frequency ?? ""}
              onChange={(v) =>
                setFilters({ frequency: (v || undefined) as AdminReportFrequency | undefined })
              }
            />
          </div>
          <div className="w-full sm:w-[140px]">
            <Select
              label="Format"
              options={FORMAT_OPTIONS}
              value={filters.format ?? ""}
              onChange={(v) =>
                setFilters({ format: (v || undefined) as AdminReportFormat | undefined })
              }
            />
          </div>
          <div className="w-full sm:w-[120px]">
            <Select
              label="Per page"
              options={ROWS_PER_PAGE_OPTIONS}
              value={String(filters.limit ?? 20)}
              onChange={(v) => setFilters({ limit: Number(v), page: 1 })}
            />
          </div>
        </div>
      </Card>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-error-text)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--color-error-text)]">
                Could not load reports.
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
                {error} — Try refreshing the page or check your connection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reports table */}
      <Card className="overflow-hidden bg-[var(--color-bg-base)] p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Scheduled Reports
          </h2>
          {reportsData && (
            <span className="text-sm text-[var(--color-text-secondary)]">{totalSummary}</span>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 pb-6">
            <SkeletonTable rows={10} cols={5} />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No reports found"
            description="Try adjusting your filters, or create a new report to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-auto text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Report
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Schedule
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Last Run
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="transition-colors hover:bg-[var(--color-bg-surface)]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {report.name}
                      </p>
                      {report.description && (
                        <p className="mt-0.5 max-w-[240px] truncate text-xs text-[var(--color-text-tertiary)]">
                          {report.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="secondary">
                        {TYPE_LABEL[report.reportType] ?? report.reportType}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {FREQUENCY_LABEL[report.frequency] ?? report.frequency}
                      </p>
                      {report.nextRunAt && (
                        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                          Next:{" "}
                          {new Date(report.nextRunAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {report.lastRunAt ? (
                        <span className="text-[var(--color-text-secondary)]">
                          {new Date(report.lastRunAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={report.isActive ? "success" : "secondary"} dot>
                        {report.isActive ? "Active" : "Archived"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewReport(report)}
                          aria-label={`View details for ${report.name}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleRun(report)}
                          disabled={isMutating}
                          aria-label={`Run ${report.name} now`}
                        >
                          <Play className="h-4 w-4 text-[var(--color-text-secondary)]" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void exportReport(report.id, report.format)}
                          disabled={isMutating}
                          aria-label={`Export ${report.name}`}
                        >
                          <Download className="h-4 w-4 text-[var(--color-text-secondary)]" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleArchive(report)}
                          disabled={isMutating || !report.isActive}
                          aria-label={`Archive ${report.name}`}
                          className={
                            report.isActive
                              ? "text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                              : ""
                          }
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {reportsData && reportsData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isMutating}
              onClick={() => setFilters({ page: (reportsData.page ?? 1) - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page {reportsData.page} of {reportsData.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={!canGoNext || isMutating}
              onClick={() => setFilters({ page: (reportsData.page ?? 1) + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Create Report Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreate}
        title="Create Scheduled Report"
        size="sm"
      >
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Configure a new report definition. Reports can be run on demand or on a schedule.
        </p>
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
          <Input
            label="Name"
            placeholder="e.g. Monthly Booking Summary"
            value={createForm.name}
            onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <Input
            label="Description (optional)"
            value={createForm.description}
            onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Report type"
              options={CREATE_TYPE_OPTIONS}
              value={createForm.type}
              onChange={(v) =>
                setCreateForm((p) => ({ ...p, type: (v || "OPERATIONS") as AdminReportType }))
              }
            />
            <Select
              label="Frequency"
              options={CREATE_FREQUENCY_OPTIONS}
              value={createForm.frequency}
              onChange={(v) =>
                setCreateForm((p) => ({
                  ...p,
                  frequency: (v || "ON_DEMAND") as AdminReportFrequency,
                }))
              }
            />
          </div>
          <Select
            label="Format"
            options={CREATE_FORMAT_OPTIONS}
            value={createForm.format}
            onChange={(v) =>
              setCreateForm((p) => ({ ...p, format: (v || "CSV") as AdminReportFormat }))
            }
          />
          <div>
            <TextArea
              label="Configuration JSON"
              rows={4}
              value={createForm.config}
              onChange={(e) => {
                const val = e.target.value;
                setCreateForm((p) => ({ ...p, config: val }));
                setConfigError(validateConfigJson(val));
              }}
            />
            {configError && (
              <p className="mt-1 text-xs text-[var(--color-error-text)]">{configError}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isMutating}
              disabled={isMutating || !!configError || createForm.name.trim().length < 2}
            >
              <Plus className="h-4 w-4" />
              Create Report
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Report Detail Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetail}
        title={selectedReport?.name ?? "Report Details"}
        size="full"
      >
        {selectedReport ? (
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto">
            <Tabs
              tabs={detailTabs}
              defaultTab="overview"
              variant="default"
              contentClassName="pb-2"
            />
          </div>
        ) : (
          <p className="py-6 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        )}
      </Modal>

      {dialogs}
    </div>
  );
}
