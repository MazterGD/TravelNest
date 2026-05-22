"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { vehicleService, landingContentService, ApiError } from "@/lib/api";
import {
  Plus,
  Search,
  Star,
  Edit,
  Eye,
  ArrowLeft,
  Filter,
  Bus,
  LayoutGrid,
  List,
  MoreVertical,
  ToggleRight,
  ToggleLeft,
  Trash,
  Calendar,
  X,
  AlertCircle,
} from "lucide-react";

type VehicleStatus = "all" | "active" | "inactive" | "pending";
type VehicleActiveStatus = "active" | "inactive" | "pending";
type ViewMode = "grid" | "table";
type SortBy = "recent" | "rating" | "bookings" | "capacity";

interface FleetVehicle {
  id: string;
  images: string[];
  photos?: { url: string; isPrimary: boolean }[];
  licensePlate: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  seats: number;
  rating?: number;
  totalBookings?: number;
  isActive: boolean;
  isAvailable: boolean;
  acType: string;
}

const getVehicleImageUrl = (vehicle: FleetVehicle): string | null => {
  // Prefer VehiclePhoto relation (Supabase uploads), fall back to legacy images[].
  const primary = vehicle.photos?.find((p) => p.isPrimary);
  const first = vehicle.photos?.[0];
  return primary?.url ?? first?.url ?? vehicle.images?.[0] ?? null;
};

export default function FleetManagementPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations("fleetManagement");

  const [activeTab, setActiveTab] = useState<VehicleStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterCapacity, setFilterCapacity] = useState("");
  const [filterAcType, setFilterAcType] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);

  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchVehicles = useCallback(async () => {
    if (!user) return;
    setIsLoadingVehicles(true);
    setError(null);
    try {
      const response = await vehicleService.getMyVehicles();
      setVehicles((response?.vehicles ?? []) as FleetVehicle[]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errorLoad"));
      setVehicles([]);
    } finally {
      setIsLoadingVehicles(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (user && isAuthorized) fetchVehicles();
  }, [user, isAuthorized, fetchVehicles]);

  useEffect(() => {
    landingContentService
      .getPublicConfig()
      .then((r) => setVehicleTypeOptions(r.options.vehicleTypes ?? []))
      .catch(() => {});
  }, []);

  const getVehicleStatus = (v: FleetVehicle): VehicleActiveStatus => {
    if (!v.isActive) return "pending";
    if (!v.isAvailable) return "inactive";
    return "active";
  };

  const capacityBucket = (seats: number): string => {
    if (seats <= 20) return "0-20";
    if (seats <= 30) return "21-30";
    if (seats <= 45) return "31-45";
    return "45+";
  };

  const filteredVehicles = [...(Array.isArray(vehicles) ? vehicles : [])]
    .filter((v) => {
      const status = getVehicleStatus(v);
      if (activeTab !== "all" && status !== activeTab) return false;
      if (
        searchQuery &&
        !v.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !v.type.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !v.brand.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      if (filterType && v.type !== filterType) return false;
      if (filterCapacity && capacityBucket(v.seats) !== filterCapacity)
        return false;
      if (filterAcType && v.acType !== filterAcType) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "bookings")
        return (b.totalBookings ?? 0) - (a.totalBookings ?? 0);
      if (sortBy === "capacity") return b.seats - a.seats;
      return 0;
    });

  const tabCounts: Record<VehicleStatus, number> = {
    all: vehicles.length,
    active: vehicles.filter((v) => getVehicleStatus(v) === "active").length,
    inactive: vehicles.filter((v) => getVehicleStatus(v) === "inactive").length,
    pending: vehicles.filter((v) => getVehicleStatus(v) === "pending").length,
  };

  const TAB_LABELS: Record<VehicleStatus, string> = {
    all: t("tabAll"),
    active: t("tabActive"),
    inactive: t("tabInactive"),
    pending: t("tabPending"),
  };

  const STATUS_LABELS: Record<VehicleActiveStatus, string> = {
    active: t("statusActive"),
    inactive: t("statusInactive"),
    pending: t("statusPending"),
  };

  const statusBadgeClass = (status: VehicleActiveStatus): string => {
    if (status === "active")
      return "border border-success bg-[var(--color-success-bg)] text-success-foreground";
    if (status === "pending")
      return "border border-primary/30 bg-primary/10 text-primary";
    return "border border-border bg-muted text-muted-foreground";
  };

  const handleDelete = async (vehicleId: string) => {
    if (!window.confirm(t("confirmDelete"))) return;
    setDeletingId(vehicleId);
    setShowActionsMenu(null);
    try {
      await vehicleService.delete(vehicleId);
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
      setToast({ message: t("deleteSuccess"), type: "success" });
    } catch {
      setToast({ message: t("deleteError"), type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (vehicle: FleetVehicle) => {
    setTogglingId(vehicle.id);
    setShowActionsMenu(null);
    try {
      await vehicleService.toggleStatus(vehicle.id, !vehicle.isActive);
      await fetchVehicles();
      setToast({ message: t("toggleSuccess"), type: "success" });
    } catch {
      setToast({ message: t("toggleError"), type: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  if (guardLoading || !isAuthorized || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        {/* Toast notification */}
        {toast && (
          <div
            className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === "success"
                ? "border border-success bg-[var(--color-success-bg)] text-success-foreground"
                : "border border-error bg-[var(--color-error-bg)] text-error-foreground"
            }`}
          >
            {toast.message}
            <button
              onClick={() => setToast(null)}
              aria-label={t("close")}
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Page header */}
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-3 flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToDashboard")}
            </Link>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-heading-md font-semibold text-foreground">
                  {t("title")}
                </h1>
                <p className="mt-1 text-caption text-muted-foreground">
                  {filteredVehicles.length}{" "}
                  {filteredVehicles.length === 1
                    ? t("vehicle")
                    : t("vehicles")}
                </p>
              </div>
              <Link
                href={`/${locale}/owner/fleet/add`}
                className="flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-4 w-4" />
                {t("addVehicle")}
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Filter panel */}
          <div className="mb-8 rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {/* Status tabs */}
              <div className="flex flex-wrap gap-2">
                {(["all", "active", "inactive", "pending"] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`min-h-[44px] rounded-md px-3 py-2 text-sm font-medium transition-opacity ${
                        activeTab === tab
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {TAB_LABELS[tab]} ({tabCounts[tab]})
                    </button>
                  ),
                )}
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-1 rounded-md border border-border p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  aria-label={t("viewGrid")}
                  className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded p-2 transition-opacity ${
                    viewMode === "grid"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  aria-label={t("viewTable")}
                  className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded p-2 transition-opacity ${
                    viewMode === "table"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Search + filter toggle */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex min-h-[44px] items-center gap-2 rounded-md border px-3 text-sm font-medium transition-opacity ${
                  showFilters
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Filter className="h-4 w-4" />
                {t("filters")}
              </button>
            </div>

            {/* Advanced filters */}
            {showFilters && (
              <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("filterVehicleType")}
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t("allTypes")}</option>
                    {vehicleTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("filterCapacity")}
                  </label>
                  <select
                    value={filterCapacity}
                    onChange={(e) => setFilterCapacity(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t("allCapacities")}</option>
                    <option value="0-20">{t("capacity0to20")}</option>
                    <option value="21-30">{t("capacity21to30")}</option>
                    <option value="31-45">{t("capacity31to45")}</option>
                    <option value="45+">{t("capacity45plus")}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("filterAcType")}
                  </label>
                  <select
                    value={filterAcType}
                    onChange={(e) => setFilterAcType(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t("allAcTypes")}</option>
                    <option value="full-ac">{t("acTypeFull")}</option>
                    <option value="ac">{t("acTypeAc")}</option>
                    <option value="non-ac">{t("acTypeNonAc")}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("filterSortBy")}
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="recent">{t("sortRecent")}</option>
                    <option value="rating">{t("sortRating")}</option>
                    <option value="bookings">{t("sortBookings")}</option>
                    <option value="capacity">{t("sortCapacity")}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Main content area */}
          {isLoadingVehicles ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-error bg-[var(--color-error-bg)] p-8 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-error-foreground" />
              <p className="mb-3 text-sm text-error-foreground">{error}</p>
              <button
                onClick={fetchVehicles}
                className="text-sm font-medium text-error-foreground underline hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("errorRetry")}
              </button>
            </div>
          ) : filteredVehicles.length > 0 ? (
            viewMode === "grid" ? (
              /* ─── GRID VIEW ─── */
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVehicles.map((vehicle) => {
                  const status = getVehicleStatus(vehicle);
                  const isProcessing =
                    deletingId === vehicle.id || togglingId === vehicle.id;
                  return (
                    <div
                      key={vehicle.id}
                      className={`overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md ${
                        isProcessing ? "pointer-events-none opacity-60" : ""
                      }`}
                    >
                      {/* Vehicle image */}
                      <div className="relative h-48 bg-muted">
                        {getVehicleImageUrl(vehicle) ? (
                          <Image
                            src={getVehicleImageUrl(vehicle)!}
                            alt={vehicle.licensePlate}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Bus className="h-16 w-16 text-muted-foreground opacity-30" />
                          </div>
                        )}

                        {/* Status badge */}
                        <div className="absolute left-3 top-3">
                          <span
                            className={`rounded-sm px-2.5 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                        </div>

                        {/* Rating badge */}
                        {vehicle.rating != null && vehicle.rating > 0 && (
                          <div className="absolute right-12 top-3 flex items-center gap-1 rounded-sm bg-card/90 px-2 py-1">
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium text-foreground">
                              {vehicle.rating.toFixed(1)}
                            </span>
                          </div>
                        )}

                        {/* Actions menu button */}
                        <div className="absolute right-3 top-3">
                          <button
                            onClick={() =>
                              setShowActionsMenu(
                                showActionsMenu === vehicle.id
                                  ? null
                                  : vehicle.id,
                              )
                            }
                            aria-label="Vehicle actions"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>

                          {showActionsMenu === vehicle.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowActionsMenu(null)}
                              />
                              <div className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-md border border-border bg-card shadow-lg">
                                <Link
                                  href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                                >
                                  <Edit className="h-4 w-4" />
                                  {t("actionEdit")}
                                </Link>
                                <Link
                                  href={`/${locale}/owner/fleet/${vehicle.id}`}
                                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                                >
                                  <Eye className="h-4 w-4" />
                                  {t("actionView")}
                                </Link>
                                <Link
                                  href={`/${locale}/owner/fleet/${vehicle.id}/availability`}
                                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                                >
                                  <Calendar className="h-4 w-4" />
                                  {t("actionAvailability")}
                                </Link>
                                <button
                                  onClick={() => handleToggleStatus(vehicle)}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                                >
                                  {status !== "inactive" ? (
                                    <>
                                      <ToggleLeft className="h-4 w-4" />
                                      {t("actionDeactivate")}
                                    </>
                                  ) : (
                                    <>
                                      <ToggleRight className="h-4 w-4" />
                                      {t("actionActivate")}
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDelete(vehicle.id)}
                                  className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-sm text-error-foreground transition-colors hover:bg-[var(--color-error-bg)]"
                                >
                                  <Trash className="h-4 w-4" />
                                  {t("actionDelete")}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-4">
                        <h3 className="mb-0.5 text-sm font-semibold text-foreground">
                          {vehicle.licensePlate}
                        </h3>
                        <p className="mb-3 text-caption text-muted-foreground">
                          {vehicle.brand} {vehicle.model} • {vehicle.year}
                        </p>

                        {status !== "pending" && (
                          <div className="mb-4 grid grid-cols-3 gap-3 rounded-sm bg-muted p-3">
                            <div>
                              <div className="mb-0.5 text-xs text-muted-foreground">
                                {t("statCapacity")}
                              </div>
                              <div className="text-sm font-medium text-foreground">
                                {vehicle.seats}
                              </div>
                            </div>
                            <div>
                              <div className="mb-0.5 text-xs text-muted-foreground">
                                {t("statBookings")}
                              </div>
                              <div className="text-sm font-medium text-foreground">
                                {vehicle.totalBookings ?? 0}
                              </div>
                            </div>
                            <div>
                              <div className="mb-0.5 text-xs text-muted-foreground">
                                {t("statRating")}
                              </div>
                              <div className="text-sm font-medium text-foreground">
                                {vehicle.rating
                                  ? `${vehicle.rating.toFixed(1)}/5`
                                  : t("na")}
                              </div>
                            </div>
                          </div>
                        )}

                        {status === "pending" && (
                          <div className="mb-4 rounded-sm border border-border bg-muted p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              {t("pendingApproval")}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Link
                            href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Edit className="h-4 w-4" />
                            {t("actionEdit")}
                          </Link>
                          <Link
                            href={`/${locale}/owner/fleet/${vehicle.id}`}
                            className="flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-primary px-3 py-2.5 text-center text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {t("actionView")}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ─── TABLE VIEW ─── */
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                          {t("colVehicle")}
                        </th>
                        <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                          {t("colType")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                          {t("colCapacity")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                          {t("colStatus")}
                        </th>
                        <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                          {t("colRating")}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">
                          {t("colActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredVehicles.map((vehicle) => {
                        const status = getVehicleStatus(vehicle);
                        const isProcessing =
                          deletingId === vehicle.id ||
                          togglingId === vehicle.id;
                        return (
                          <tr
                            key={vehicle.id}
                            className={`transition-colors hover:bg-muted ${
                              isProcessing ? "opacity-60" : ""
                            }`}
                          >
                            <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted sm:h-12 sm:w-12">
                                  {getVehicleImageUrl(vehicle) ? (
                                    <Image
                                      src={getVehicleImageUrl(vehicle)!}
                                      alt={vehicle.licensePlate}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Bus className="h-5 w-5 text-muted-foreground opacity-40 sm:h-6 sm:w-6" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-foreground">
                                    {vehicle.licensePlate}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {vehicle.brand} {vehicle.model}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-muted-foreground sm:table-cell">
                              {vehicle.type}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground sm:px-6">
                              {vehicle.seats} {t("seats")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                              <span
                                className={`rounded-sm px-2.5 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
                              >
                                {STATUS_LABELS[status]}
                              </span>
                            </td>
                            <td className="hidden whitespace-nowrap px-6 py-4 md:table-cell">
                              {status !== "pending" && (
                                <div className="flex items-center gap-1 text-sm text-foreground">
                                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                  {vehicle.rating?.toFixed(1) ?? t("na")}
                                </div>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                                  aria-label={t("actionEdit")}
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Edit className="h-4 w-4" />
                                </Link>
                                <Link
                                  href={`/${locale}/owner/fleet/${vehicle.id}`}
                                  aria-label={t("actionView")}
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-primary transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Eye className="h-4 w-4" />
                                </Link>
                                <Link
                                  href={`/${locale}/owner/fleet/${vehicle.id}/availability`}
                                  aria-label={t("actionAvailability")}
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Calendar className="h-4 w-4" />
                                </Link>
                                <button
                                  onClick={() => handleToggleStatus(vehicle)}
                                  aria-label={
                                    status !== "inactive"
                                      ? t("actionDeactivate")
                                      : t("actionActivate")
                                  }
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {status !== "inactive" ? (
                                    <ToggleLeft className="h-4 w-4" />
                                  ) : (
                                    <ToggleRight className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDelete(vehicle.id)}
                                  aria-label={t("actionDelete")}
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-error-foreground transition-colors hover:bg-[var(--color-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Trash className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            /* ─── EMPTY STATE ─── */
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <div className="mx-auto max-w-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Bus className="h-8 w-8 text-muted-foreground opacity-50" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {t("emptyTitle")}
                </h3>
                <p className="mb-6 text-caption text-muted-foreground">
                  {activeTab === "all"
                    ? t("emptyDescAll")
                    : t("emptyDescFiltered", {
                        status: STATUS_LABELS[activeTab as VehicleActiveStatus],
                      })}
                </p>
                {filterType || filterCapacity || filterAcType || searchQuery || activeTab !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType("");
                      setFilterCapacity("");
                      setFilterAcType("");
                      setSearchQuery("");
                      setActiveTab("all");
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-card px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" />
                    {t("resetFilters")}
                  </button>
                ) : (
                  <Link
                    href={`/${locale}/owner/fleet/add`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-4 w-4" />
                    {t("addFirstVehicle")}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
