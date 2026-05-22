"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner } from "@/components/ui";
import { useAmenitiesManagement } from "./hooks/useAmenitiesManagement";

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
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Input
              label="Search amenities"
              placeholder="Code, name, description"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex h-11 w-full items-center gap-2 rounded-xl border border-border px-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(filters.includeInactive)}
                onChange={(event) => setFilters({ includeInactive: event.target.checked })}
                className="h-4 w-4 rounded border border-border"
              />
              Include inactive
            </label>
          </div>
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

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Amenities table</h2>
            <p className="text-sm text-muted-foreground">{amenities.length} item(s)</p>
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : amenities.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No amenities match the current filters.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">Code</th>
                    <th className="py-3">Name</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Sort</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {amenities.map((amenity) => (
                    <tr key={amenity.id} className="border-b border-border/70">
                      <td className="py-3 font-mono text-xs text-foreground">{amenity.code}</td>
                      <td className="py-3">
                        <p className="font-medium text-foreground">{amenity.name}</p>
                        <p className="text-xs text-muted-foreground">{amenity.description || "No description"}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant={amenity.isActive ? "success" : "secondary"}>
                          {amenity.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 text-foreground">{amenity.sortOrder}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => selectAmenity(amenity)}
                            disabled={isMutating}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void archiveAmenity(amenity.id)}
                            disabled={isMutating}
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
              <h3 className="text-base font-semibold text-foreground">Create amenity</h3>
              <Button size="sm" onClick={() => void addAmenity()} disabled={isMutating}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
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
            </div>
          </Card>

          <Card className="bg-background">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">Edit selection</h3>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void saveSelectedAmenity()}
                disabled={!selectedAmenity || isMutating}
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>

            {!selectedAmenity ? (
              <p className="mt-4 text-sm text-muted-foreground">
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
                <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedActiveDraft}
                    onChange={(event) => setSelectedActiveDraft(event.target.checked)}
                    className="h-4 w-4 rounded border border-border"
                  />
                  Active amenity
                </label>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
