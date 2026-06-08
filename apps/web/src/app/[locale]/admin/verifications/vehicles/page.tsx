"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ExternalLink,
  FileText,
  History,
  Loader2,
  RefreshCw,
  UserCog,
  XCircle,
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
} from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useVehicleVerifications } from "./hooks/useVehicleVerifications";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const VERIFICATION_BADGE_VARIANT = {
  VERIFIED: "success",
  REJECTED: "danger",
  PENDING: "warning",
  MISSING_DOCUMENTS: "secondary",
  ACTIVATION_REQUEST: "info",
} as const;

const VERIFICATION_LABEL: Record<string, string> = {
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  PENDING: "Pending",
  MISSING_DOCUMENTS: "No Documents",
  ACTIVATION_REQUEST: "Activation Request",
};

const DOC_BADGE_VARIANT = {
  VERIFIED: "success",
  REJECTED: "danger",
  PENDING: "warning",
} as const;

function vehicleInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";

const getHistoryMessage = (changes: Record<string, unknown> | null, fallback: string) => {
  if (!changes) return fallback;
  const candidate = changes.message;
  if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  return fallback;
};

// Derives verification state from the document summary on AdminVehicleVerificationDetails
// (the detail object has no verificationState field — only items in the queue list do).
function deriveVerificationState(summary: {
  pending: number;
  verified: number;
  rejected: number;
}): keyof typeof VERIFICATION_BADGE_VARIANT {
  if (summary.pending > 0) return "PENDING";
  if (summary.rejected > 0) return "REJECTED";
  if (summary.verified > 0) return "VERIFIED";
  return "MISSING_DOCUMENTS";
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminVehicleVerificationsPage() {
  const { prompt, dialogs } = useDialogPrompts();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
    approveDocument,
    rejectDocument,
    approveVehicle,
    rejectVehicle,
    refetch,
  } = useVehicleVerifications();

  const vehicles = queueData?.items ?? [];
  const canGoPrev = (queueData?.page ?? 1) > 1;
  const canGoNext = queueData ? queueData.page < queueData.totalPages : false;

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleViewVehicle = async (vehicleId: string) => {
    await loadVehicleDetails(vehicleId);
    setIsDetailOpen(true);
  };

  const closeDetailModal = () => setIsDetailOpen(false);

  const handleApproveDoc = async (documentId: string) => {
    await approveDocument(documentId);
  };

  const handleRejectDoc = async (documentId: string) => {
    const reason = await prompt({
      title: "Reject Document",
      message: "Reason for rejection (minimum 3 characters)",
      defaultValue: "Document is outdated or illegible. Please resubmit.",
      minLength: 3,
      confirmText: "Reject",
    });
    if (!reason || reason.trim().length < 3) return;
    await rejectDocument(documentId, reason.trim());
  };

  const handleApproveVehicle = async (vehicleId: string) => {
    await approveVehicle(vehicleId);
    closeDetailModal();
  };

  const handleRejectVehicle = async (vehicleId: string) => {
    const reason = await prompt({
      title: "Reject Activation Request",
      message: "Reason for rejection (minimum 3 characters)",
      defaultValue: "Please ensure your documents are up to date and resubmit.",
      minLength: 3,
      confirmText: "Reject",
    });
    if (!reason || reason.trim().length < 3) return;
    await rejectVehicle(vehicleId, reason.trim());
    closeDetailModal();
  };

  // ── Detail modal tab panels ──────────────────────────────────────────────────

  const overviewPanel = selectedVehicle && (() => {
    const state = deriveVerificationState(selectedVehicle.documentSummary);
    return (
      <div className="space-y-4">
        {/* Identity header */}
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-[var(--color-action-primary)]"
          >
            {vehicleInitials(selectedVehicle.name)}
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--color-text-primary)]">
              {selectedVehicle.name}
            </p>
            <p className="font-mono text-sm text-[var(--color-text-secondary)]">
              {selectedVehicle.licensePlate}
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              {selectedVehicle.brand} {selectedVehicle.model}
            </p>
            <Badge
              variant={VERIFICATION_BADGE_VARIANT[state]}
              dot
              className="mt-2"
            >
              {VERIFICATION_LABEL[state]}
            </Badge>
          </div>
        </div>

        {/* Document summary quick stats */}
        <div className="grid grid-cols-3 gap-3 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-primary)]">
              {selectedVehicle.documentSummary.pending}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-primary)]">
              {selectedVehicle.documentSummary.verified}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Verified</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-primary)]">
              {selectedVehicle.documentSummary.rejected}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Rejected</p>
          </div>
        </div>

        {/* Meta */}
        <dl className="divide-y divide-[var(--color-border-default)] text-sm">
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-text-tertiary)]">Owner</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {selectedVehicle.owner.firstName} {selectedVehicle.owner.lastName}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-text-tertiary)]">Owner email</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {selectedVehicle.owner.email}
            </dd>
          </div>
          {selectedVehicle.location && (
            <div className="flex justify-between py-2">
              <dt className="text-[var(--color-text-tertiary)]">Location</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {selectedVehicle.location}
              </dd>
            </div>
          )}
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-text-tertiary)]">Active listing</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {selectedVehicle.isActive ? "Yes" : "No"}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-text-tertiary)]">Last document</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {formatDate(selectedVehicle.documentSummary.latestDocumentAt)}
            </dd>
          </div>
        </dl>

        {selectedVehicle.documents.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-tertiary)]">
            No documents submitted. Go to the Documents tab to review once uploaded.
          </p>
        )}

        {/* Quick approve/reject for activation requests */}
        {state === "ACTIVATION_REQUEST" && (
          <div className="mt-2 flex gap-2 border-t border-[var(--color-border-default)] pt-4">
            <Button
              variant="secondary"
              className="flex-1 text-[var(--color-success-text)] hover:bg-[var(--color-success-bg)]"
              onClick={() => void handleApproveVehicle(selectedVehicle.id)}
              disabled={isMutating}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Approve Activation
            </Button>
            <Button
              variant="secondary"
              className="flex-1 text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
              onClick={() => void handleRejectVehicle(selectedVehicle.id)}
              disabled={isMutating}
            >
              <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          </div>
        )}
      </div>
    );
  })();

  const documentsPanel = selectedVehicle && (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Approve or reject each document individually. When all documents are approved the
        vehicle is automatically activated.
      </p>
      {selectedVehicle.documents.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No documents found"
          description="This vehicle has no submitted documents yet."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Document</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Uploaded</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">File</th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-default)]">
              {selectedVehicle.documents.map((document) => (
                <tr key={document.id} className="hover:bg-[var(--color-bg-surface)]">
                  {/* Document type + file name + rejection reason */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {document.type}
                    </p>
                    <p className="mt-0.5 max-w-[180px] truncate text-xs text-[var(--color-text-tertiary)]">
                      {document.fileName}
                    </p>
                    {document.rejectionReason && (
                      <p className="mt-1 text-xs text-[var(--color-error-text)]">
                        {document.rejectionReason}
                      </p>
                    )}
                  </td>

                  {/* Verification status */}
                  <td className="px-4 py-3">
                    <Badge
                      size="sm"
                      variant={DOC_BADGE_VARIANT[document.status as keyof typeof DOC_BADGE_VARIANT] ?? "secondary"}
                      dot
                    >
                      {document.status}
                    </Badge>
                  </td>

                  {/* Upload date */}
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {formatDate(document.createdAt)}
                  </td>

                  {/* Open-in-new-tab link */}
                  <td className="px-4 py-3">
                    {document.url ? (
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${document.fileName} in a new tab`}
                        className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-[var(--color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-text-tertiary)]">Unavailable</span>
                    )}
                  </td>

                  {/* Per-document approve / reject */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleApproveDoc(document.id)}
                        disabled={isMutating || document.status === "VERIFIED"}
                        aria-label={`Approve ${document.type}`}
                        className="text-[var(--color-success-text)] hover:bg-[var(--color-success-bg)]"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleRejectDoc(document.id)}
                        disabled={isMutating || document.status === "REJECTED"}
                        aria-label={`Reject ${document.type}`}
                        className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const historyPanel = (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Recent audit log entries for this vehicle&apos;s verification workflow.
      </p>
      {selectedHistory?.logs?.length ? (
        <ul className="divide-y divide-[var(--color-border-default)] overflow-hidden rounded-xl border border-[var(--color-border-default)]">
          {selectedHistory.logs.map((log) => (
            <li
              key={log.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-bg-surface)]"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-action-primary)]/40"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {log.action}{" "}
                  <span className="font-normal text-[var(--color-text-tertiary)]">
                    on {log.entityType}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {getHistoryMessage(log.changes, "")}
                </p>
              </div>
              <span className="whitespace-nowrap text-xs text-[var(--color-text-tertiary)]">
                {new Date(log.createdAt).toLocaleDateString("en-GB")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No history found"
          description="No audit log entries exist for this vehicle's verification yet."
        />
      )}
    </div>
  );

  const detailTabs = [
    {
      id: "overview",
      label: "Overview",
      icon: <UserCog className="h-4 w-4" />,
      content: overviewPanel,
    },
    {
      id: "documents",
      label: "Documents",
      icon: <FileText className="h-4 w-4" />,
      badge: selectedVehicle?.documentSummary.pending || undefined,
      content: documentsPanel,
    },
    {
      id: "history",
      label: "History",
      icon: <History className="h-4 w-4" />,
      content: historyPanel,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Screen-reader live region for loading state */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isLoading ? "Loading vehicle verifications…" : ""}
      </div>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Vehicle Verifications
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Vehicles pending document review. Approve or reject each document individually.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading || isMutating}
          aria-label="Refresh verification queue"
        >
          <RefreshCw
            className={cn("h-4 w-4", isLoading && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* Filter bar */}
      <Card className="bg-[var(--color-bg-base)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search vehicles"
              placeholder="Name, plate, brand, model, or owner"
              value={filters.search ?? ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Select
              label="State"
              options={[
                { value: "", label: "All pending" },
                { value: "ACTIVATION_REQUEST", label: "Activation requests" },
                { value: "PENDING", label: "Has pending docs" },
                { value: "MISSING_DOCUMENTS", label: "No documents" },
              ]}
              value={filters.verificationState ?? ""}
              onChange={(value) =>
                setFilters({
                  verificationState: (value || undefined) as
                    | "PENDING"
                    | "MISSING_DOCUMENTS"
                    | "ACTIVATION_REQUEST"
                    | undefined,
                })
              }
            />
          </div>
          <div className="w-full sm:w-[130px]">
            <Select
              label="Per page"
              options={[
                { value: "10", label: "10 rows" },
                { value: "20", label: "20 rows" },
                { value: "50", label: "50 rows" },
                { value: "100", label: "100 rows" },
              ]}
              value={String(filters.limit ?? 20)}
              onChange={(value) => setFilters({ limit: Number(value), page: 1 })}
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
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--color-error-text)]">
                Could not load vehicle verifications.
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
                {error} — Try refreshing the page or check your connection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Verification queue table */}
      <Card className="overflow-hidden bg-[var(--color-bg-base)] p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Pending queue
          </h2>
          {queueData && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {(queueData.page - 1) * queueData.limit + 1}–
              {Math.min(queueData.total, queueData.page * queueData.limit)} of{" "}
              {queueData.total.toLocaleString()}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 pb-6">
            <SkeletonTable rows={10} cols={4} />
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No vehicles pending review"
            description="All vehicles have been processed, or none match your search."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] table-auto text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Vehicle</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Owner</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">State</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Documents</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {vehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className="transition-colors hover:bg-[var(--color-bg-surface)]"
                  >
                    {/* Vehicle identity */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-[var(--color-action-primary)]"
                        >
                          {vehicleInitials(vehicle.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--color-text-primary)]">
                            {vehicle.name}
                          </p>
                          <p className="font-mono text-xs text-[var(--color-text-tertiary)]">
                            {vehicle.licensePlate}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {vehicle.owner.firstName} {vehicle.owner.lastName}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {vehicle.owner.email}
                      </p>
                    </td>

                    {/* Verification state */}
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          VERIFICATION_BADGE_VARIANT[
                            vehicle.verificationState as keyof typeof VERIFICATION_BADGE_VARIANT
                          ] ?? "secondary"
                        }
                        dot
                      >
                        {VERIFICATION_LABEL[vehicle.verificationState] ?? vehicle.verificationState}
                      </Badge>
                    </td>

                    {/* Document summary — only render non-zero counts */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {vehicle.documentSummary.pending > 0 && (
                          <Badge size="sm" variant="warning">
                            {vehicle.documentSummary.pending} pending
                          </Badge>
                        )}
                        {vehicle.documentSummary.verified > 0 && (
                          <Badge size="sm" variant="success">
                            {vehicle.documentSummary.verified} verified
                          </Badge>
                        )}
                        {vehicle.documentSummary.rejected > 0 && (
                          <Badge size="sm" variant="danger">
                            {vehicle.documentSummary.rejected} rejected
                          </Badge>
                        )}
                        {vehicle.documentSummary.pending === 0 &&
                          vehicle.documentSummary.verified === 0 &&
                          vehicle.documentSummary.rejected === 0 && (
                            <span className="text-xs text-[var(--color-text-tertiary)]">None</span>
                          )}
                      </div>
                    </td>

                    {/* Actions: view detail always; approve/reject for activation requests */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {vehicle.verificationState === "ACTIVATION_REQUEST" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleApproveVehicle(vehicle.id)}
                              disabled={isMutating}
                              aria-label={`Approve activation for ${vehicle.name}`}
                              className="text-[var(--color-success-text)] hover:bg-[var(--color-success-bg)]"
                            >
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleRejectVehicle(vehicle.id)}
                              disabled={isMutating}
                              aria-label={`Reject activation for ${vehicle.name}`}
                              className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                            >
                              <XCircle className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleViewVehicle(vehicle.id)}
                          disabled={isMutating}
                          aria-label={`Review details for ${vehicle.name}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
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
        {queueData && (
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isMutating}
              onClick={() => setFilters({ page: (queueData.page ?? 1) - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page {queueData.page} of {queueData.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={!canGoNext || isMutating}
              onClick={() => setFilters({ page: (queueData.page ?? 1) + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Vehicle detail modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        title={selectedVehicle ? selectedVehicle.name : "Vehicle Details"}
        size="full"
      >
        {selectedVehicle ? (
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto">
            <Tabs
              tabs={detailTabs}
              defaultTab="documents"
              variant="default"
              contentClassName="pb-2"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-text-tertiary)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading vehicle details…
          </div>
        )}
      </Modal>

      {dialogs}
    </div>
  );
}
