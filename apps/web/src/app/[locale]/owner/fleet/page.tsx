"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LoadingSpinner,
  Badge,
  ConfirmDialog,
  EmptyState,
  EmptyBoxIcon,
  EmptySearchIcon,
} from "@/components/ui";
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
  Calendar,
  X,
  AlertCircle,
  Clock,
  ToggleRight,
  ToggleLeft,
  Trash,
} from "lucide-react";

type VehicleStatus = "all" | "active" | "inactive" | "pending";
type VehicleActiveStatus = "active" | "unavailable" | "inactive" | "pending";
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
  averageRating?: number;
  totalBookings?: number;
  isActive: boolean;
  isAvailable: boolean;
  acType: string;
}

const getVehicleImageUrl = (vehicle: FleetVehicle): string | null => {
  const primary = vehicle.photos?.find((p) => p.isPrimary);
  const first = vehicle.photos?.[0];
  return primary?.url ?? first?.url ?? vehicle.images?.[0] ?? null;
};

const getVehicleStatus = (v: FleetVehicle): VehicleActiveStatus => {
  if (v.isActive && v.isAvailable) return "active";
  if (v.isActive && !v.isAvailable) return "unavailable";
  if (!v.isActive && v.isAvailable) return "pending";
  return "inactive";
};

// Maps detailed status to the 4-tab filter
const getTabFromStatus = (s: VehicleActiveStatus): VehicleStatus => {
  if (s === "active") return "active";
  if (s === "pending") return "pending";
  return "inactive"; // both "unavailable" and "inactive" fall under the inactive tab
};

const statusToBadgeVariant = (
  status: VehicleActiveStatus,
): "success" | "info" | "secondary" | "warning" => {
  if (status === "active") return "success";
  if (status === "pending") return "info";
  if (status === "unavailable") return "warning";
  return "secondary";
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{
    vehicleId: string;
    status: VehicleActiveStatus;
  } | null>(null);

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

  const capacityBucket = (seats: number): string => {
    if (seats <= 20) return "0-20";
    if (seats <= 30) return "21-30";
    if (seats <= 45) return "31-45";
    return "45+";
  };

  const filteredVehicles = [...(Array.isArray(vehicles) ? vehicles : [])]
    .filter((v) => {
      const status = getVehicleStatus(v);
      if (activeTab !== "all" && getTabFromStatus(status) !== activeTab) return false;
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
      if (sortBy === "rating") return (b.averageRating ?? 0) - (a.averageRating ?? 0);
      if (sortBy === "bookings")
        return (b.totalBookings ?? 0) - (a.totalBookings ?? 0);
      if (sortBy === "capacity") return b.seats - a.seats;
      return 0;
    });

  const tabCounts: Record<VehicleStatus, number> = {
    all: vehicles.length,
    active: vehicles.filter((v) => getVehicleStatus(v) === "active").length,
    inactive: vehicles.filter((v) => getTabFromStatus(getVehicleStatus(v)) === "inactive").length,
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
    unavailable: t("statusUnavailable"),
  };

  // Toggle dialog metadata based on current vehicle status
  const getToggleDialogProps = (status: VehicleActiveStatus) => {
    switch (status) {
      case "active":
        return {
          title: t("confirmPauseTitle"),
          message: t("confirmPauseMsg"),
          confirmText: t("actionPause"),
          variant: "warning" as const,
        };
      case "unavailable":
        return {
          title: t("confirmResumeTitle"),
          message: t("confirmResumeMsg"),
          confirmText: t("actionResume"),
          variant: "info" as const,
        };
      case "inactive":
        return {
          title: t("confirmRequestActivationTitle"),
          message: t("confirmRequestActivationMsg"),
          confirmText: t("actionRequestActivation"),
          variant: "info" as const,
        };
      case "pending":
        return {
          title: t("confirmCancelRequestTitle"),
          message: t("confirmCancelRequestMsg"),
          confirmText: t("actionCancelRequest"),
          variant: "warning" as const,
        };
    }
  };

  const handleDelete = useCallback(
    async (vehicleId: string) => {
      setDeletingId(vehicleId);
      try {
        await vehicleService.delete(vehicleId);
        setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
        setToast({ message: t("deleteSuccess"), type: "success" });
      } catch {
        setToast({ message: t("deleteError"), type: "error" });
      } finally {
        setDeletingId(null);
        setConfirmDelete(null);
      }
    },
    [t],
  );

  const handleToggleStatus = useCallback(
    async (vehicleId: string, status: VehicleActiveStatus) => {
      setTogglingId(vehicleId);
      setConfirmToggle(null);
      try {
        switch (status) {
          case "active":
            await vehicleService.setAvailability(vehicleId, false);
            setToast({ message: t("pauseSuccess"), type: "success" });
            break;
          case "unavailable":
            await vehicleService.setAvailability(vehicleId, true);
            setToast({ message: t("resumeSuccess"), type: "success" });
            break;
          case "inactive":
            await vehicleService.requestActivation(vehicleId);
            setToast({ message: t("activationRequestSent"), type: "success" });
            break;
          case "pending":
            await vehicleService.cancelActivation(vehicleId);
            setToast({ message: t("activationRequestCancelled"), type: "success" });
            break;
        }
        await fetchVehicles();
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : t("toggleError");
        setToast({ message: msg, type: "error" });
      } finally {
        setTogglingId(null);
      }
    },
    [fetchVehicles, t],
  );

  const hasActiveFilters =
    filterType || filterCapacity || filterAcType || searchQuery || activeTab !== "all";

  if (guardLoading || !isAuthorized || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface)]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "border border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
              : "border border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
          }`}
        >
          {toast.message}
          <button
            onClick={() => setToast(null)}
            aria-label={t("close")}
            className="rounded-lg p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Page header */}
      <header className="border-b border-[var(--color-border-default)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={`/${locale}/owner/dashboard`}
            className="mb-3 flex w-fit items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToDashboard")}
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-heading-md font-semibold text-[var(--color-text-primary)]">
                {t("title")}
              </h1>
              <p className="mt-1 text-caption text-[var(--color-text-secondary)]">
                {vehicles.length}{" "}
                {vehicles.length === 1 ? t("vehicle") : t("vehicles")}
              </p>
            </div>
            <Link
              href={`/${locale}/owner/fleet/add`}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" />
              {t("addVehicle")}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Pending activation request banner */}
        {!isLoadingVehicles && tabCounts.pending > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="flex-1 text-body text-[var(--color-text-primary)]">
              <strong className="font-medium">{tabCounts.pending}</strong>{" "}
              {tabCounts.pending === 1 ? t("vehicle") : t("vehicles")}{" "}
              {t("pendingActivationAlert")}
            </p>
            <button
              onClick={() => setActiveTab("pending")}
              className="shrink-0 text-caption font-medium text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("actionView")}
            </button>
          </div>
        )}

        {/* Filter panel */}
        <div className="mb-8 rounded-[20px] border border-[var(--color-border-default)] bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {/* Status tabs */}
            <div className="flex flex-wrap gap-2">
              {(["all", "active", "inactive", "pending"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`min-h-[44px] rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-primary text-white"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                    }`}
                  >
                    {TAB_LABELS[tab]} ({tabCounts[tab]})
                  </button>
                ),
              )}
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border-default)] p-1">
              <button
                onClick={() => setViewMode("grid")}
                aria-label={t("viewGrid")}
                className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                aria-label={t("viewTable")}
                className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-2 transition-colors ${
                  viewMode === "table"
                    ? "bg-primary text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search + filter toggle */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border-default)] bg-white py-2.5 pl-10 pr-3 text-body text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
                showFilters
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
              }`}
            >
              <Filter className="h-4 w-4" />
              {t("filters")}
            </button>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="mt-4 grid gap-4 border-t border-[var(--color-border-default)] pt-4 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-caption font-medium text-[var(--color-text-primary)]">
                  {t("filterVehicleType")}
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-body text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <label className="mb-1.5 block text-caption font-medium text-[var(--color-text-primary)]">
                  {t("filterCapacity")}
                </label>
                <select
                  value={filterCapacity}
                  onChange={(e) => setFilterCapacity(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-body text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t("allCapacities")}</option>
                  <option value="0-20">{t("capacity0to20")}</option>
                  <option value="21-30">{t("capacity21to30")}</option>
                  <option value="31-45">{t("capacity31to45")}</option>
                  <option value="45+">{t("capacity45plus")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-caption font-medium text-[var(--color-text-primary)]">
                  {t("filterAcType")}
                </label>
                <select
                  value={filterAcType}
                  onChange={(e) => setFilterAcType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-body text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t("allAcTypes")}</option>
                  <option value="full-ac">{t("acTypeFull")}</option>
                  <option value="ac">{t("acTypeAc")}</option>
                  <option value="non-ac">{t("acTypeNonAc")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-caption font-medium text-[var(--color-text-primary)]">
                  {t("filterSortBy")}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-body text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-[var(--color-error-text)]" />
            <p className="mb-3 text-body text-[var(--color-error-text)]">{error}</p>
            <button
              onClick={fetchVehicles}
              className="text-sm font-medium text-[var(--color-error-text)] underline hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                const imageUrl = getVehicleImageUrl(vehicle);
                const isProcessing =
                  deletingId === vehicle.id || togglingId === vehicle.id;
                return (
                  <article
                    key={vehicle.id}
                    className={`overflow-hidden rounded-[20px] border border-[var(--color-border-default)] bg-white transition-shadow hover:shadow-md ${
                      isProcessing ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {/* Vehicle image */}
                    <div className="relative aspect-video bg-[var(--color-bg-surface)]">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={vehicle.licensePlate}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Bus className="h-14 w-14 text-[var(--color-text-tertiary)]" />
                        </div>
                      )}

                      {/* Status badge */}
                      <div className="absolute left-3 top-3">
                        <Badge
                          variant={statusToBadgeVariant(status)}
                          dot
                          size="sm"
                        >
                          {STATUS_LABELS[status]}
                        </Badge>
                      </div>

                      {/* Rating badge */}
                      {(vehicle.averageRating ?? 0) > 0 && (
                        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 shadow-sm">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium text-[var(--color-text-primary)]">
                            {vehicle.averageRating!.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-4">
                      <h3 className="text-body font-semibold text-[var(--color-text-primary)]">
                        {vehicle.licensePlate}
                      </h3>
                      <p className="mt-0.5 text-caption text-[var(--color-text-secondary)]">
                        {vehicle.brand} {vehicle.model} • {vehicle.year}
                      </p>

                      {/* Stats row — only for verified vehicles */}
                      {status !== "pending" ? (
                        <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--color-border-default)] rounded-xl border border-[var(--color-border-default)]">
                          <div className="px-3 py-2 text-center">
                            <p className="text-xs text-[var(--color-text-tertiary)]">
                              {t("statCapacity")}
                            </p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {vehicle.seats}
                            </p>
                          </div>
                          <div className="px-3 py-2 text-center">
                            <p className="text-xs text-[var(--color-text-tertiary)]">
                              {t("statBookings")}
                            </p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {vehicle.totalBookings ?? 0}
                            </p>
                          </div>
                          <div className="px-3 py-2 text-center">
                            <p className="text-xs text-[var(--color-text-tertiary)]">
                              {t("statRating")}
                            </p>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {vehicle.averageRating
                                ? `${vehicle.averageRating.toFixed(1)}/5`
                                : t("na")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2">
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("pendingApproval")}
                          </p>
                        </div>
                      )}

                      {/* Primary actions */}
                      <div className="mt-4 flex gap-2">
                        <Link
                          href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border-default)] bg-white px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Edit className="h-4 w-4" />
                          {t("actionEdit")}
                        </Link>
                        <Link
                          href={`/${locale}/owner/fleet/${vehicle.id}`}
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Eye className="h-4 w-4" />
                          {t("actionView")}
                        </Link>
                      </div>

                      {/* Secondary actions */}
                      <div className="mt-2 flex items-center justify-end gap-1 border-t border-[var(--color-border-default)] pt-2">
                        <Link
                          href={`/${locale}/owner/fleet/${vehicle.id}/availability`}
                          aria-label={t("actionAvailability")}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Calendar className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => setConfirmToggle({ vehicleId: vehicle.id, status })}
                          aria-label={
                            status === "active" ? t("actionPause")
                              : status === "unavailable" ? t("actionResume")
                              : status === "inactive" ? t("actionRequestActivation")
                              : t("actionCancelRequest")
                          }
                          disabled={togglingId === vehicle.id}
                          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                            status === "active" || status === "pending"
                              ? "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                              : "text-primary hover:bg-primary/10"
                          }`}
                        >
                          {status === "active" ? (
                            <ToggleLeft className="h-4 w-4" />
                          ) : status === "unavailable" || status === "inactive" ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(vehicle.id)}
                          aria-label={t("actionDelete")}
                          disabled={deletingId === vehicle.id}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--color-error-text)] transition-colors hover:bg-[var(--color-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* ─── TABLE VIEW ─── */
            <div className="overflow-hidden rounded-[20px] border border-[var(--color-border-default)] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] sm:px-6">
                        {t("colVehicle")}
                      </th>
                      <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] sm:table-cell">
                        {t("colType")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] sm:px-6">
                        {t("colCapacity")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] sm:px-6">
                        {t("colStatus")}
                      </th>
                      <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] md:table-cell">
                        {t("colRating")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] sm:px-6">
                        {t("colActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-default)]">
                    {filteredVehicles.map((vehicle) => {
                      const status = getVehicleStatus(vehicle);
                      const imageUrl = getVehicleImageUrl(vehicle);
                      const isProcessing =
                        deletingId === vehicle.id || togglingId === vehicle.id;
                      return (
                        <tr
                          key={vehicle.id}
                          className={`transition-colors hover:bg-[var(--color-bg-surface)] ${
                            isProcessing ? "opacity-60" : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="relative h-10 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-surface)]">
                                {imageUrl ? (
                                  <Image
                                    src={imageUrl}
                                    alt={vehicle.licensePlate}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Bus className="h-5 w-5 text-[var(--color-text-tertiary)]" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-body font-medium text-[var(--color-text-primary)]">
                                  {vehicle.licensePlate}
                                </div>
                                <div className="text-caption text-[var(--color-text-secondary)]">
                                  {vehicle.brand} {vehicle.model}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="hidden whitespace-nowrap px-6 py-4 text-body text-[var(--color-text-secondary)] sm:table-cell">
                            {vehicle.type}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-body text-[var(--color-text-secondary)] sm:px-6">
                            {vehicle.seats} {t("seats")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                            <Badge
                              variant={statusToBadgeVariant(status)}
                              dot
                              size="sm"
                            >
                              {STATUS_LABELS[status]}
                            </Badge>
                          </td>
                          <td className="hidden whitespace-nowrap px-6 py-4 md:table-cell">
                            {status !== "pending" && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                <span className="text-body text-[var(--color-text-primary)]">
                                  {vehicle.averageRating?.toFixed(1) ?? t("na")}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                                aria-label={t("actionEdit")}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                              <Link
                                href={`/${locale}/owner/fleet/${vehicle.id}`}
                                aria-label={t("actionView")}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-primary transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                              <Link
                                href={`/${locale}/owner/fleet/${vehicle.id}/availability`}
                                aria-label={t("actionAvailability")}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Calendar className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => setConfirmToggle({ vehicleId: vehicle.id, status })}
                                aria-label={
                                  status === "active" ? t("actionPause")
                                    : status === "unavailable" ? t("actionResume")
                                    : status === "inactive" ? t("actionRequestActivation")
                                    : t("actionCancelRequest")
                                }
                                disabled={togglingId === vehicle.id}
                                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                                  status === "active" || status === "pending"
                                    ? "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                                    : "text-primary hover:bg-primary/10"
                                }`}
                              >
                                {status === "active" ? (
                                  <ToggleLeft className="h-4 w-4" />
                                ) : status === "unavailable" || status === "inactive" ? (
                                  <ToggleRight className="h-4 w-4" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(vehicle.id)}
                                aria-label={t("actionDelete")}
                                disabled={deletingId === vehicle.id}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--color-error-text)] transition-colors hover:bg-[var(--color-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
          <div className="rounded-[20px] border border-[var(--color-border-default)] bg-white">
            <EmptyState
              icon={
                hasActiveFilters ? (
                  <EmptySearchIcon className="h-12 w-12 text-[var(--color-text-tertiary)]" />
                ) : (
                  <EmptyBoxIcon className="h-12 w-12 text-[var(--color-text-tertiary)]" />
                )
              }
              title={t("emptyTitle")}
              description={
                activeTab === "all"
                  ? t("emptyDescAll")
                  : t("emptyDescFiltered", {
                      status: TAB_LABELS[activeTab],
                    })
              }
              action={
                hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType("");
                      setFilterCapacity("");
                      setFilterAcType("");
                      setSearchQuery("");
                      setActiveTab("all");
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" />
                    {t("resetFilters")}
                  </button>
                ) : (
                  <Link
                    href={`/${locale}/owner/fleet/add`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-4 w-4" />
                    {t("addFirstVehicle")}
                  </Link>
                )
              }
            />
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await handleDelete(confirmDelete);
        }}
        title={t("confirmDeleteTitle")}
        message={t("confirmDelete")}
        confirmText={t("actionDelete")}
        isLoading={deletingId !== null}
        variant="danger"
      />

      {/* Toggle status confirmation dialog (adapts per vehicle state) */}
      {confirmToggle && (() => {
        const props = getToggleDialogProps(confirmToggle.status);
        return (
          <ConfirmDialog
            isOpen
            onClose={() => setConfirmToggle(null)}
            onConfirm={() => handleToggleStatus(confirmToggle.vehicleId, confirmToggle.status)}
            title={props.title}
            message={props.message}
            confirmText={props.confirmText}
            isLoading={togglingId !== null}
            variant={props.variant}
          />
        );
      })()}
    </div>
  );
}
