"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ListChecks, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Badge,
  Button,
  Card,
  EmptySearchIcon,
  EmptyState,
  Input,
  Select,
  SkeletonTable,
} from "@/components/ui";
import { useAmenitiesManagement } from "./hooks/useAmenitiesManagement";

const PER_PAGE_OPTIONS = [
  { value: "10", label: "10 rows" },
  { value: "20", label: "20 rows" },
  { value: "50", label: "50 rows" },
];

const SCOPE_FILTERS = [
  { label: "Active only", value: false },
  { label: "Include inactive", value: true },
];

export default function AdminAmenitiesPage() {
  const {
    isLoading,
    isMutating,
    error,
    filters,
    amenitiesData,
    selectedAmenity,
    setFilters,
    selectAmenity,
    createAmenity,
    updateAmenity,
    archiveAmenity,
    refetch,
  } = useAmenitiesManagement();

  const [codeDraft, setCodeDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const [selectedNameDraft, setSelectedNameDraft] = useState("");
  const [selectedDescriptionDraft, setSelectedDescriptionDraft] = useState("");
  const [selectedIconDraft, setSelectedIconDraft] = useState("");
  const [selectedSortOrderDraft, setSelectedSortOrderDraft] = useState("0");
  const [selectedActiveDraft, setSelectedActiveDraft] = useState(true);

  useEffect(() => {
    if (!selectedAmenity) {
      setSelectedNameDraft("");
      setSelectedDescriptionDraft("");
      setSelectedIconDraft("");
      setSelectedSortOrderDraft("0");
      setSelectedActiveDraft(true);
      return;
    }

    setSelectedNameDraft(selectedAmenity.name);
    setSelectedDescriptionDraft(selectedAmenity.description || "");
    setSelectedIconDraft(selectedAmenity.icon || "");
    setSelectedSortOrderDraft(String(selectedAmenity.sortOrder));
    setSelectedActiveDraft(selectedAmenity.isActive);
  }, [selectedAmenity]);

  const amenities = amenitiesData?.items || [];
  const canGoPrev = (amenitiesData?.page ?? 1) > 1;
  const canGoNext = amenitiesData ? amenitiesData.page < amenitiesData.totalPages : false;

  const codeIsValid =
    codeDraft.trim().toUpperCase().replace(/\s+/g, "_").length >= 2 &&
    nameDraft.trim().length >= 2;

  const addAmenity = async () => {
    const normalizedCode = codeDraft.trim().toUpperCase().replace(/\s+/g, "_");
    if (normalizedCode.length < 2 || nameDraft.trim().length < 2) {
      return;
    }

    await createAmenity({
      code: normalizedCode,
      name: nameDraft.trim(),
      description: descriptionDraft.trim() || undefined,
      sortOrder: 0,
      isActive: true,
    });

    setCodeDraft("");
    setNameDraft("");
    setDescriptionDraft("");
  };

  const saveSelectedAmenity = async () => {
    if (!selectedAmenity) {
      return;
    }

    const sortOrder = Number(selectedSortOrderDraft);

    await updateAmenity(selectedAmenity.id, {
      name: selectedNameDraft.trim(),
      description: selectedDescriptionDraft.trim() || undefined,
      icon: selectedIconDraft.trim() || undefined,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive: selectedActiveDraft,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Amenities
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage the amenity catalogue shown across vehicle listings and search filters.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading || isMutating}
          aria-label="Refresh amenities"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Scope pills */}
      <div className="flex flex-wrap gap-2">
        {SCOPE_FILTERS.map((sf) => {
          const isActive = Boolean(filters.includeInactive) === sf.value;
          return (
            <button
              key={String(sf.value)}
              type="button"
              onClick={() => setFilters({ includeInactive: sf.value, page: 1 })}
              aria-pressed={isActive}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2",
                isActive
                  ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)]",
              )}
            >
              {sf.label}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card className="bg-[var(--color-bg-base)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search amenities"
              placeholder="Code, name or description"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div className="w-full sm:w-[140px]">
            <Select
              label="Per page"
              options={PER_PAGE_OPTIONS}
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
          <p className="text-sm font-semibold text-[var(--color-error-text)]">
            Could not load amenities.
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
            {error} — Try refreshing the page.
          </p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        {/* Amenities table */}
        <Card className="overflow-hidden bg-[var(--color-bg-base)] p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Amenities catalogue
            </h2>
            {amenitiesData && (
              <span className="text-sm text-[var(--color-text-secondary)]">
                {amenitiesData.total.toLocaleString()} item(s)
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="px-6 pb-6">
              <SkeletonTable rows={filters.limit ?? 10} cols={4} />
            </div>
          ) : amenities.length === 0 ? (
            <EmptyState
              icon={<EmptySearchIcon />}
              title="No amenities found"
              description="Adjust your search or create a new amenity to get started."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                    <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Amenity
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Sort
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-default)]">
                  {amenities.map((amenity) => (
                    <tr
                      key={amenity.id}
                      className={cn(
                        "transition-colors hover:bg-[var(--color-bg-surface)]",
                        selectedAmenity?.id === amenity.id && "bg-[var(--color-action-primary)]/5",
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {amenity.name}
                          </p>
                          <code className="rounded-lg bg-[var(--color-bg-surface)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
                            {amenity.code}
                          </code>
                        </div>
                        <p className="mt-0.5 max-w-[320px] truncate text-xs text-[var(--color-text-tertiary)]">
                          {amenity.description || "No description"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={amenity.isActive ? "success" : "secondary"} dot>
                          {amenity.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 tabular-nums text-[var(--color-text-secondary)]">
                        {amenity.sortOrder}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => selectAmenity(amenity)}
                            disabled={isMutating}
                            aria-label={`Edit ${amenity.name}`}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void archiveAmenity(amenity.id)}
                            disabled={isMutating || !amenity.isActive}
                            aria-label={`Archive ${amenity.name}`}
                            className={
                              amenity.isActive
                                ? "text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                                : ""
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {amenitiesData && amenitiesData.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
              <Button
                variant="secondary"
                disabled={!canGoPrev || isMutating}
                onClick={() => setFilters({ page: (amenitiesData.page ?? 1) - 1 })}
              >
                Previous
              </Button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                Page {amenitiesData.page} of {amenitiesData.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={!canGoNext || isMutating}
                onClick={() => setFilters({ page: (amenitiesData.page ?? 1) + 1 })}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        {/* Create + edit panel */}
        <div className="space-y-6">
          <Card className="bg-[var(--color-bg-base)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                <Plus className="h-4 w-4 text-[var(--color-action-primary)]" />
                Create amenity
              </h3>
            </div>
            <div className="mt-4 space-y-3">
              <Input
                label="Code"
                placeholder="WIFI"
                value={codeDraft}
                onChange={(event) => setCodeDraft(event.target.value)}
              />
              <Input
                label="Name"
                placeholder="Wi-Fi"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
              />
              <Input
                label="Description"
                placeholder="Internet access available on board"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
              />
              <Button
                className="w-full"
                onClick={() => void addAmenity()}
                disabled={isMutating || !codeIsValid}
              >
                <Plus className="h-4 w-4" />
                Add amenity
              </Button>
            </div>
          </Card>

          <Card className="bg-[var(--color-bg-base)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                <ListChecks className="h-4 w-4 text-[var(--color-action-primary)]" />
                Edit selection
              </h3>
              {selectedAmenity && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => selectAmenity(null)}
                  disabled={isMutating}
                >
                  Clear
                </Button>
              )}
            </div>

            {!selectedAmenity ? (
              <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                Select an amenity from the table to edit it.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <Input label="Code" value={selectedAmenity.code} disabled />
                <Input
                  label="Name"
                  value={selectedNameDraft}
                  onChange={(event) => setSelectedNameDraft(event.target.value)}
                />
                <Input
                  label="Description"
                  value={selectedDescriptionDraft}
                  onChange={(event) => setSelectedDescriptionDraft(event.target.value)}
                />
                <Input
                  label="Icon"
                  placeholder="wifi"
                  value={selectedIconDraft}
                  onChange={(event) => setSelectedIconDraft(event.target.value)}
                />
                <Input
                  label="Sort order"
                  type="number"
                  value={selectedSortOrderDraft}
                  onChange={(event) => setSelectedSortOrderDraft(event.target.value)}
                />
                <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={selectedActiveDraft}
                    onChange={(event) => setSelectedActiveDraft(event.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--color-border-default)]"
                  />
                  Active amenity
                </label>
                <Button
                  className="w-full"
                  onClick={() => void saveSelectedAmenity()}
                  disabled={isMutating || selectedNameDraft.trim().length < 2}
                >
                  <Save className="h-4 w-4" />
                  Save changes
                </Button>
                {!selectedActiveDraft && (
                  <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Inactive amenities are hidden from listings and filters.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
