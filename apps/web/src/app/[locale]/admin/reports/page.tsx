"use client";

import { useState } from "react";
import { Download, Play, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select, TextArea } from "@/components/ui";
import {
  type AdminReportFormat,
  type AdminReportFrequency,
  type AdminReportType,
} from "@/lib/api";
import { useReportsGenerator } from "./hooks/useReportsGenerator";

const reportTypeOptions = [
  { value: "USERS", label: "Users" },
  { value: "BOOKINGS", label: "Bookings" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "AUDIT", label: "Audit" },
  { value: "DISPUTES", label: "Disputes" },
  { value: "VERIFICATIONS", label: "Verifications" },
  { value: "SYSTEM", label: "System" },
];

const frequencyOptions = [
  { value: "ON_DEMAND", label: "On demand" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const formatOptions = [
  { value: "CSV", label: "CSV" },
  { value: "PDF", label: "PDF" },
  { value: "EXCEL", label: "Excel" },
];

export default function AdminReportsPage() {
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

  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState<AdminReportType>("OPERATIONS");
  const [frequencyDraft, setFrequencyDraft] = useState<AdminReportFrequency>("ON_DEMAND");
  const [formatDraft, setFormatDraft] = useState<AdminReportFormat>("CSV");
  const [configDraft, setConfigDraft] = useState("{}");

  const reports = reportsData?.items || [];

  const parseConfig = () => {
    try {
      const parsed = JSON.parse(configDraft);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const onCreate = async () => {
    if (nameDraft.trim().length < 2) {
      return;
    }

    const created = await createReport({
      name: nameDraft.trim(),
      description: descriptionDraft.trim() || undefined,
      reportType: typeDraft,
      frequency: frequencyDraft,
      format: formatDraft,
      configuration: parseConfig(),
    });

    if (created) {
      setNameDraft("");
      setDescriptionDraft("");
      setConfigDraft("{}");
      selectReport(created);
    }
  };

  const onSaveSelected = async () => {
    if (!selectedReport) {
      return;
    }

    await updateReport(selectedReport.id, {
      name: selectedReport.name,
      description: selectedReport.description || undefined,
      isActive: selectedReport.isActive,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Input
              label="Search reports"
              placeholder="Name, description"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <Select
            label="Type"
            options={[{ value: "", label: "All" }, ...reportTypeOptions]}
            value={filters.reportType || ""}
            onChange={(value) =>
              setFilters({ reportType: (value || undefined) as AdminReportType | undefined })
            }
          />
          <Select
            label="Frequency"
            options={[{ value: "", label: "All" }, ...frequencyOptions]}
            value={filters.frequency || ""}
            onChange={(value) =>
              setFilters({
                frequency: (value || undefined) as AdminReportFrequency | undefined,
              })
            }
          />
          <Select
            label="Format"
            options={[{ value: "", label: "All" }, ...formatOptions]}
            value={filters.format || ""}
            onChange={(value) =>
              setFilters({ format: (value || undefined) as AdminReportFormat | undefined })
            }
          />
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

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Scheduled reports</h2>
            <p className="text-sm text-muted-foreground">{reportsData?.total || 0} reports</p>
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : reports.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No reports found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Name</th>
                    <th className="py-3">Type</th>
                    <th className="py-3">Schedule</th>
                    <th className="py-3">Last Run</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-border/70">
                      <td className="py-3">
                        <p className="font-medium text-foreground">{report.name}</p>
                        <p className="text-xs text-muted-foreground">{report.description || "No description"}</p>
                      </td>
                      <td className="py-3 text-foreground">{report.reportType}</td>
                      <td className="py-3 text-foreground">{report.frequency}</td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {report.lastRunAt ? new Date(report.lastRunAt).toLocaleString() : "Never"}
                      </td>
                      <td className="py-3">
                        <Badge variant={report.isActive ? "success" : "secondary"}>
                          {report.isActive ? "Active" : "Archived"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => selectReport(report)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void runReport(report.id, report.format)}
                            disabled={isMutating}
                          >
                            <Play className="h-4 w-4" />
                            Run
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void exportReport(report.id, report.format)}
                            disabled={isMutating}
                          >
                            <Download className="h-4 w-4" />
                            Export
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void archiveReport(report.id)}
                            disabled={isMutating || !report.isActive}
                          >
                            <Trash2 className="h-4 w-4" />
                            Archive
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="bg-background">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">Create report</h3>
              <Button size="sm" onClick={() => void onCreate()} disabled={isMutating}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <Input label="Name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
              <Input
                label="Description"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
              />
              <Select
                label="Report type"
                options={reportTypeOptions}
                value={typeDraft}
                onChange={(value) => setTypeDraft((value || "OPERATIONS") as AdminReportType)}
              />
              <Select
                label="Frequency"
                options={frequencyOptions}
                value={frequencyDraft}
                onChange={(value) =>
                  setFrequencyDraft((value || "ON_DEMAND") as AdminReportFrequency)
                }
              />
              <Select
                label="Format"
                options={formatOptions}
                value={formatDraft}
                onChange={(value) => setFormatDraft((value || "CSV") as AdminReportFormat)}
              />
              <TextArea
                label="Configuration JSON"
                rows={4}
                value={configDraft}
                onChange={(event) => setConfigDraft(event.target.value)}
              />
            </div>
          </Card>

          <Card className="bg-background">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">Selected report</h3>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onSaveSelected()}
                disabled={!selectedReport || isMutating}
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>

            {!selectedReport ? (
              <p className="mt-4 text-sm text-muted-foreground">Select a report to inspect details.</p>
            ) : (
              <div className="mt-4 space-y-2 text-sm">
                <p className="font-semibold text-foreground">{selectedReport.name}</p>
                <p className="text-muted-foreground">Type: {selectedReport.reportType}</p>
                <p className="text-muted-foreground">Format: {selectedReport.format}</p>
                <p className="text-muted-foreground">Frequency: {selectedReport.frequency}</p>
                <p className="text-muted-foreground">
                  Next run: {selectedReport.nextRunAt ? new Date(selectedReport.nextRunAt).toLocaleString() : "Not scheduled"}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
