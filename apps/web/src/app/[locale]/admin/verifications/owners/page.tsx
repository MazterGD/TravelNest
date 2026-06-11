"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  History,
  Loader2,
  RefreshCw,
  UserCheck,
  UserCog,
  Users,
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
import { useOwnerVerifications } from "./hooks/useOwnerVerifications";

// ─── Option lists ──────────────────────────────────────────────────────────────

const rowsPerPageOptions = [
  { value: "10", label: "10 rows" },
  { value: "20", label: "20 rows" },
  { value: "50", label: "50 rows" },
];

// ─── Quick-filter pills ────────────────────────────────────────────────────────

const QUICK_FILTERS = [
  { label: "All Owners", value: undefined as string | undefined, icon: <Users className="h-4 w-4" /> },
  { label: "Pending Review", value: "PENDING_VERIFICATION", icon: <Clock className="h-4 w-4" /> },
  { label: "Active", value: "ACTIVE", icon: <UserCheck className="h-4 w-4" /> },
  { label: "Suspended", value: "SUSPENDED", icon: <XCircle className="h-4 w-4" /> },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE_VARIANT = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  PENDING_VERIFICATION: "warning",
  INACTIVE: "secondary",
} as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  PENDING_VERIFICATION: "Pending",
};

const DOC_BADGE_VARIANT = {
  VERIFIED: "success",
  REJECTED: "danger",
  PENDING: "warning",
} as const;

function ownerInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminOwnerVerificationsPage() {
  const { prompt, dialogs } = useDialogPrompts();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
    approveDocument,
    rejectDocument,
    refetch,
  } = useOwnerVerifications();

  const owners = queueData?.items ?? [];
  const canGoPrev = (queueData?.page ?? 1) > 1;
  const canGoNext = queueData ? queueData.page < queueData.totalPages : false;

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleViewOwner = async (ownerId: string) => {
    await loadOwnerDetails(ownerId);
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

  // ── Detail modal tab panels ──────────────────────────────────────────────────

  const overviewPanel = selectedOwner && (
    <div className="space-y-4">
      {/* Identity header */}
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-[var(--color-action-primary)]"
        >
          {ownerInitials(selectedOwner.firstName, selectedOwner.lastName)}
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            {selectedOwner.firstName} {selectedOwner.lastName}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">{selectedOwner.email}</p>
          {selectedOwner.phone && (
            <p className="text-sm text-[var(--color-text-tertiary)]">{selectedOwner.phone}</p>
          )}
          <Badge
            variant={
              STATUS_BADGE_VARIANT[selectedOwner.status as keyof typeof STATUS_BADGE_VARIANT] ??
              "secondary"
            }
            dot
            className="mt-2"
          >
            {STATUS_LABEL[selectedOwner.status] ?? selectedOwner.status}
          </Badge>
        </div>
      </div>

      {/* Document summary quick stats */}
      <div className="grid grid-cols-3 gap-3 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <div className="text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">
            {selectedOwner.documentSummary.pending}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Pending</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">
            {selectedOwner.documentSummary.verified}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Verified</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">
            {selectedOwner.documentSummary.rejected}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Rejected</p>
        </div>
      </div>

      {/* Meta */}
      <dl className="divide-y divide-[var(--color-border-default)] text-sm">
        {selectedOwner.nicNumber && (
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-text-tertiary)]">NIC</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {selectedOwner.nicNumber}
            </dd>
          </div>
        )}
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Identity verified</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {selectedOwner.isVerified ? "Yes" : "No"}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Last document</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {formatDate(selectedOwner.documentSummary.latestDocumentAt)}
          </dd>
        </div>
      </dl>

      <p className="text-center text-xs text-[var(--color-text-tertiary)]">
        Approve or reject documents individually in the Documents tab. When all documents are
        verified the account is automatically activated.
      </p>
    </div>
  );

  const documentsPanel = selectedOwner && (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Approve or reject each document individually. When all documents are approved the
        owner account is automatically activated.
      </p>
      {selectedOwner.documents.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No documents found"
          description="This owner has not submitted any documents yet."
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
              {selectedOwner.documents.map((document) => (
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
                      variant={
                        DOC_BADGE_VARIANT[document.status as keyof typeof DOC_BADGE_VARIANT] ??
                        "secondary"
                      }
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
        Recent audit log entries for this owner&apos;s verification workflow.
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
          description="No audit log entries exist for this owner's verification yet."
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
      badge: selectedOwner?.documentSummary.pending || undefined,
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
        {isLoading ? "Loading owner verifications…" : ""}
      </div>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Owner Verifications
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Review owner identity documents. Approve each document individually to activate an account.
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

      {/* Quick-filter status pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_FILTERS.map((qf) => {
          const isActive = filters.status === qf.value;
          return (
            <button
              key={qf.label}
              type="button"
              onClick={() =>
                setFilters({
                  status: qf.value as
                    | "ACTIVE"
                    | "INACTIVE"
                    | "SUSPENDED"
                    | "PENDING_VERIFICATION"
                    | undefined,
                })
              }
              className={cn(
                "rounded-[20px] border p-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2",
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
                {qf.icon}
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {qf.label}
              </p>
              {isActive && queueData && (
                <p className="mt-0.5 text-xl font-bold text-[var(--color-action-primary)]">
                  {queueData.total.toLocaleString()}
                </p>
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
              label="Search owners"
              placeholder="Name, email, phone, or NIC"
              value={filters.search ?? ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div className="w-full sm:w-[130px]">
            <Select
              label="Per page"
              options={rowsPerPageOptions}
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
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-error-text)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--color-error-text)]">
                Could not load owner verifications.
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
            Verification queue
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
        ) : owners.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No owners found"
            description="Try adjusting your search terms or switching to a different status filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] table-auto text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Owner</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Documents</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Vehicles</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {owners.map((owner) => (
                  <tr
                    key={owner.id}
                    className="transition-colors hover:bg-[var(--color-bg-surface)]"
                  >
                    {/* Owner identity */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-[var(--color-action-primary)]"
                        >
                          {ownerInitials(owner.firstName, owner.lastName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--color-text-primary)]">
                            {owner.firstName} {owner.lastName}
                          </p>
                          <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                            {owner.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Owner status */}
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          STATUS_BADGE_VARIANT[
                            owner.status as keyof typeof STATUS_BADGE_VARIANT
                          ] ?? "secondary"
                        }
                        dot
                      >
                        {STATUS_LABEL[owner.status] ?? owner.status}
                      </Badge>
                    </td>

                    {/* Document summary — only non-zero counts */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {owner.documentSummary.pending > 0 && (
                          <Badge size="sm" variant="warning">
                            {owner.documentSummary.pending} pending
                          </Badge>
                        )}
                        {owner.documentSummary.verified > 0 && (
                          <Badge size="sm" variant="success">
                            {owner.documentSummary.verified} verified
                          </Badge>
                        )}
                        {owner.documentSummary.rejected > 0 && (
                          <Badge size="sm" variant="danger">
                            {owner.documentSummary.rejected} rejected
                          </Badge>
                        )}
                        {owner.documentSummary.pending === 0 &&
                          owner.documentSummary.verified === 0 &&
                          owner.documentSummary.rejected === 0 && (
                            <span className="text-xs text-[var(--color-text-tertiary)]">None</span>
                          )}
                      </div>
                    </td>

                    {/* Vehicle count */}
                    <td className="px-4 py-4 tabular-nums text-[var(--color-text-secondary)]">
                      {owner._count.vehicles}
                    </td>

                    {/* View action only */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleViewOwner(owner.id)}
                          disabled={isMutating}
                          aria-label={`Review documents for ${owner.firstName} ${owner.lastName}`}
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

        {/* Pagination — only shown when there is more than one page */}
        {queueData && queueData.totalPages > 1 && (
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

      {/* ── Owner detail modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        title={
          selectedOwner
            ? `${selectedOwner.firstName} ${selectedOwner.lastName}`
            : "Owner Details"
        }
        size="full"
      >
        {selectedOwner ? (
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
            Loading owner details…
          </div>
        )}
      </Modal>

      {dialogs}
    </div>
  );
}
