"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Car,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
  Users,
} from "lucide-react";
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
import { adminService, type AdminBookingRecord, type AdminOwnerDocument, type AdminVehicleRecord } from "@/lib/api";
import { useDialogPrompts } from "@/hooks";
import { useUserFilters } from "./hooks/useUserFilters";

// ─── Option lists ──────────────────────────────────────────────────────────────

const roleOptions = [
  { value: "", label: "All roles" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "VEHICLE_OWNER", label: "Vehicle Owner" },
  { value: "ADMIN", label: "Admin" },
];

const adminRoleOptions = [
  { value: "", label: "All admin roles" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "MODERATOR", label: "Moderator" },
  { value: "FINANCE_ADMIN", label: "Finance Admin" },
  { value: "SUPPORT_ADMIN", label: "Support Admin" },
];

const rowsPerPageOptions = [
  { value: "10", label: "10 rows" },
  { value: "25", label: "25 rows" },
  { value: "50", label: "50 rows" },
  { value: "100", label: "100 rows" },
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

const BOOKING_BADGE: Record<string, "success" | "danger" | "warning" | "info" | "secondary"> = {
  CONFIRMED: "success",
  COMPLETED: "success",
  ONGOING: "info",
  PENDING: "warning",
  CANCELLED: "danger",
};

function userInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

const DEFAULT_ADMIN_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  adminRole: "MODERATOR" as "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN",
};

// ─── Quick-filter pills ────────────────────────────────────────────────────────

const QUICK_FILTERS = [
  { label: "All Users", value: undefined as string | undefined, icon: <Users className="h-4 w-4" /> },
  { label: "Active", value: "ACTIVE", icon: <UserCheck className="h-4 w-4" /> },
  { label: "Pending", value: "PENDING_VERIFICATION", icon: <Clock className="h-4 w-4" /> },
  { label: "Suspended", value: "SUSPENDED", icon: <UserX className="h-4 w-4" /> },
  { label: "Inactive", value: "INACTIVE", icon: <UserX className="h-4 w-4" /> },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { locale } = useParams<{ locale: string }>();
  const { prompt, confirm, dialogs } = useDialogPrompts();

  const {
    isLoading,
    isMutating,
    error,
    usersData,
    filters,
    selectedUser,
    selectedUserActivity,
    setFilters,
    loadUserDetails,
    updateUserStatus,
    resetUserPassword,
    deleteUser,
    createAdmin,
    exportUsersCsv,
    refetch,
  } = useUserFilters();

  // Create admin modal
  const [adminForm, setAdminForm] = useState(DEFAULT_ADMIN_FORM);
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);

  // User detail modal + lazy-loaded sub-sections
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [userBookings, setUserBookings] = useState<AdminBookingRecord[] | null>(null);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [userVehicles, setUserVehicles] = useState<AdminVehicleRecord[] | null>(null);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [userDocuments, setUserDocuments] = useState<AdminOwnerDocument[] | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  // ── Derived state ────────────────────────────────────────────────────────────

  const users = usersData?.users ?? [];
  const canGoPrev = (usersData?.page ?? 1) > 1;
  const canGoNext = usersData ? usersData.page < usersData.totalPages : false;

  const totalSummary = useMemo(() => {
    if (!usersData) return "";
    const start = (usersData.page - 1) * usersData.limit + 1;
    const end = Math.min(usersData.total, usersData.page * usersData.limit);
    return `${start}–${end} of ${usersData.total.toLocaleString()}`;
  }, [usersData]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleViewUser = async (userId: string) => {
    // Reset stale sub-section data when switching to a new user
    setUserBookings(null);
    setUserVehicles(null);
    setUserDocuments(null);
    await loadUserDetails(userId);
    setIsDetailOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailOpen(false);
    setUserBookings(null);
    setUserVehicles(null);
    setUserDocuments(null);
  };

  const loadUserBookings = async (email: string) => {
    setIsLoadingBookings(true);
    try {
      const data = await adminService.getBookings({ search: email, limit: 10 });
      setUserBookings(data.bookings);
    } catch {
      setUserBookings([]);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const loadUserVehicles = async (userId: string) => {
    setIsLoadingVehicles(true);
    try {
      const data = await adminService.getAdminVehicles({ ownerId: userId, limit: 20 });
      setUserVehicles(data.vehicles);
    } catch {
      setUserVehicles([]);
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  const loadUserDocuments = async (userId: string) => {
    setIsLoadingDocuments(true);
    try {
      const data = await adminService.getOwnerVerificationById(userId);
      setUserDocuments(data.documents);
    } catch {
      setUserDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleSuspend = async (userId: string) => {
    const reason = await prompt({
      title: "Suspend User Account",
      message: "A reason is required. This user will immediately lose access to the platform.",
      placeholder: "e.g. Policy violation, suspicious activity",
      confirmText: "Suspend",
      minLength: 1,
      variant: "danger",
    });
    if (reason) {
      await updateUserStatus(userId, "SUSPENDED", reason);
    }
  };

  const handleDelete = async (userId: string) => {
    const approved = await confirm({
      title: "Permanently Delete Account",
      message:
        "This action cannot be undone. All associated data will be removed from the platform.",
      confirmText: "Delete",
      variant: "danger",
    });
    if (approved) {
      await deleteUser(userId);
      closeDetailModal();
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPassword = await prompt({
      title: "Reset User Password",
      message:
        "Enter a temporary password. The user should change it immediately after signing in.",
      placeholder: "Temporary password",
      type: "password",
      minLength: 8,
      confirmText: "Reset Password",
    });
    if (newPassword) {
      await resetUserPassword(userId, newPassword);
    }
  };

  const handleCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    await createAdmin({ ...adminForm, phone: adminForm.phone || undefined });
    setAdminForm(DEFAULT_ADMIN_FORM);
    setIsCreateAdminOpen(false);
  };

  const closeCreateAdmin = () => {
    setIsCreateAdminOpen(false);
    setAdminForm(DEFAULT_ADMIN_FORM);
  };

  // ─── User detail tab panels ────────────────────────────────────────────────

  const overviewPanel = selectedUser && (
    <div className="space-y-4">
      {/* Identity header */}
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-[var(--color-action-primary)] overflow-hidden">
          {selectedUser.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedUser.avatar}
              alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
              className="h-14 w-14 object-cover"
            />
          ) : (
            userInitials(selectedUser.firstName, selectedUser.lastName)
          )}
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            {selectedUser.firstName} {selectedUser.lastName}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">{selectedUser.email}</p>
          {selectedUser.phone && (
            <p className="text-sm text-[var(--color-text-tertiary)]">{selectedUser.phone}</p>
          )}
          <Badge
            variant={STATUS_BADGE_VARIANT[selectedUser.status as keyof typeof STATUS_BADGE_VARIANT] ?? "secondary"}
            dot
            className="mt-2"
          >
            {STATUS_LABEL[selectedUser.status] ?? selectedUser.status}
          </Badge>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <div className="text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">
            {selectedUser.role === "VEHICLE_OWNER"
              ? selectedUser.ownerBookingCount
              : selectedUser._count.bookings}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Bookings</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">
            {selectedUser.role === "VEHICLE_OWNER"
              ? selectedUser._count.vehicles
              : selectedUser._count.reviews}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {selectedUser.role === "VEHICLE_OWNER" ? "Vehicles" : "Reviews"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">{selectedUser._count.notifications}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Notifications</p>
        </div>
      </div>

      {/* Meta */}
      <dl className="divide-y divide-[var(--color-border-default)] text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Role</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {selectedUser.adminRole ?? selectedUser.role}
          </dd>
        </div>
        {selectedUser.city && (
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-text-tertiary)]">Location</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">
              {selectedUser.city}{selectedUser.district ? `, ${selectedUser.district}` : ""}
            </dd>
          </div>
        )}
        {selectedUser.baseLocation && (
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-text-tertiary)]">Base location</dt>
            <dd className="font-medium text-[var(--color-text-primary)]">{selectedUser.baseLocation}</dd>
          </div>
        )}
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Joined</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {new Date(selectedUser.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[var(--color-text-tertiary)]">Last updated</dt>
          <dd className="font-medium text-[var(--color-text-primary)]">
            {new Date(selectedUser.updatedAt).toLocaleString("en-GB")}
          </dd>
        </div>
      </dl>

      {/* Quick actions */}
      <div>
        <div className="flex flex-wrap gap-2 justify-center">
          {selectedUser.status !== "ACTIVE" ? (
            <></>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleSuspend(selectedUser.id)}
              disabled={isMutating}
            >
              <ShieldAlert className="h-4 w-4" />
              Suspend Account
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleResetPassword(selectedUser.id)}
            disabled={isMutating}
          >
            <KeyRound className="h-4 w-4" />
            Reset Password
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleDelete(selectedUser.id)}
            disabled={isMutating}
            className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );

  const bookingsPanel = selectedUser && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {selectedUser.role === "VEHICLE_OWNER"
            ? "Bookings where this owner's vehicles were chartered."
            : "Bookings where this user is the customer."}
        </p>
        <Link
          href={`/${locale}/admin/bookings?search=${encodeURIComponent(selectedUser.email)}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-action-primary)] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          View all bookings <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {userBookings === null ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-10">
          <BookOpen className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {selectedUser.role === "VEHICLE_OWNER"
              ? "Click below to fetch bookings made on this owner's vehicles."
              : "Click below to fetch this user's bookings from the database."}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadUserBookings(selectedUser.email)}
            disabled={isLoadingBookings}
          >
            {isLoadingBookings ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Load Bookings
          </Button>
        </div>
      ) : isLoadingBookings ? (
        <SkeletonTable rows={4} cols={4} />
      ) : userBookings.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No bookings found"
          description="This user has no bookings matching the search."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Route</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Vehicle</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Amount</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-default)]">
              {userBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-[var(--color-bg-surface)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text-primary)] truncate max-w-[180px]">
                      {booking.pickupLocation}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {new Date(booking.startDate).toLocaleDateString("en-GB")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {booking.vehicle?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={BOOKING_BADGE[booking.status] ?? "secondary"} dot>
                      {booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">
                    LKR {booking.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/bookings?search=${encodeURIComponent(booking.id)}`}
                      className="inline-flex items-center text-[var(--color-action-primary)] hover:underline text-xs"
                      aria-label={`Open booking ${booking.id} in admin bookings page`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const vehiclesPanel = selectedUser && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Vehicles registered under this owner&apos;s account.
        </p>
        <Link
          href={`/${locale}/admin/vehicles?search=${encodeURIComponent(selectedUser.email)}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-action-primary)] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          View all vehicles <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {userVehicles === null ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-10">
          <Car className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Click below to fetch this owner&apos;s registered vehicles.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadUserVehicles(selectedUser.id)}
            disabled={isLoadingVehicles}
          >
            {isLoadingVehicles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
            Load Vehicles
          </Button>
        </div>
      ) : isLoadingVehicles ? (
        <SkeletonTable rows={3} cols={4} />
      ) : userVehicles.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No vehicles found"
          description="This owner has no registered vehicles."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Vehicle</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Plate</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Type</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-default)]">
              {userVehicles.map((v) => (
                <tr key={v.id} className="hover:bg-[var(--color-bg-surface)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                    {v.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--color-text-secondary)]">
                    {v.licensePlate}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {v.type === "ORDINARY" ? "Ordinary" : v.type === "SEMI_LUXURY" ? "Semi Luxury" : v.type === "LUXURY_AC" ? "Luxury AC" : v.type}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={v.isActive ? "success" : "secondary"} dot>
                      {v.isActive ? "Active" : "Suspended"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/vehicles?search=${encodeURIComponent(v.licensePlate)}`}
                      className="inline-flex items-center text-[var(--color-action-primary)] hover:underline text-xs"
                      aria-label={`Open ${v.name} in admin vehicles page`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const activityPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Last 10 audit log entries for this user.
        </p>
        <Link
          href={`/${locale}/admin/audit-logs`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-action-primary)] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Full audit log <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {selectedUserActivity?.logs?.length ? (
        <ul className="divide-y divide-[var(--color-border-default)] rounded-xl border border-[var(--color-border-default)] overflow-hidden">
          {selectedUserActivity.logs.map((log) => (
            <li key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-bg-surface)]">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-action-primary)]/40" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {log.action}{" "}
                  <span className="font-normal text-[var(--color-text-tertiary)]">
                    on {log.entityType}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {new Date(log.createdAt).toLocaleString("en-GB")}
                </p>
              </div>
              <Badge
                variant={log.status === "success" ? "success" : "danger"}
                size="sm"
              >
                {log.status}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No activity found"
          description="No audit log entries exist for this user yet."
        />
      )}
    </div>
  );

  // Documents panel — only rendered for VEHICLE_OWNER role users
  const documentsPanel = selectedUser?.role === "VEHICLE_OWNER" && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Identity and ownership documents submitted by this owner.
        </p>
      </div>

      {userDocuments === null ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-10">
          <FileText className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Click below to fetch this owner&apos;s verification documents.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadUserDocuments(selectedUser.id)}
            disabled={isLoadingDocuments}
          >
            {isLoadingDocuments ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Load Documents
          </Button>
        </div>
      ) : isLoadingDocuments ? (
        <SkeletonTable rows={3} cols={4} />
      ) : userDocuments.length === 0 ? (
        <EmptyState
          icon={<EmptySearchIcon />}
          title="No documents found"
          description="This owner has not submitted any verification documents yet."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Document</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Uploaded</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-default)]">
              {userDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-[var(--color-bg-surface)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text-primary)]">{doc.type}</p>
                    <p className="mt-0.5 max-w-[180px] truncate text-xs text-[var(--color-text-tertiary)]">
                      {doc.fileName}
                    </p>
                    {doc.rejectionReason && (
                      <p className="mt-1 text-xs text-[var(--color-error-text)]">
                        {doc.rejectionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      size="sm"
                      variant={
                        doc.status === "VERIFIED"
                          ? "success"
                          : doc.status === "REJECTED"
                            ? "danger"
                            : "warning"
                      }
                      dot
                    >
                      {doc.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {new Date(doc.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${doc.fileName} in a new tab`}
                        className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-[var(--color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-text-tertiary)]">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Build tabs array — conditionally include Vehicles and Documents tabs for VEHICLE_OWNER role
  const detailTabs = [
    {
      id: "overview",
      label: "Overview",
      icon: <UserCog className="h-4 w-4" />,
      content: overviewPanel,
    },
    {
      id: "bookings",
      label: "Bookings",
      icon: <BookOpen className="h-4 w-4" />,
      badge: selectedUser?.role === "VEHICLE_OWNER"
        ? (selectedUser?.ownerBookingCount ?? undefined)
        : (selectedUser?._count.bookings ?? undefined),
      content: bookingsPanel,
    },
    ...(selectedUser?.role === "VEHICLE_OWNER"
      ? [
          {
            id: "vehicles",
            label: "Vehicles",
            icon: <Car className="h-4 w-4" />,
            badge: selectedUser?._count.vehicles ?? undefined,
            content: vehiclesPanel,
          },
          {
            id: "documents",
            label: "Documents",
            icon: <FileText className="h-4 w-4" />,
            content: documentsPanel,
          },
        ]
      : []),
    {
      id: "activity",
      label: "Activity",
      icon: <Activity className="h-4 w-4" />,
      content: activityPanel,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            User Management
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage platform users, review pending accounts, and add admin staff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading || isMutating}
            aria-label="Refresh user list"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void exportUsersCsv()}
            disabled={isMutating}
            aria-label="Export users as CSV"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setIsCreateAdminOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Admin
          </Button>
        </div>
      </div>

      {/* Quick-filter status pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
              className={[
                "rounded-[20px] border p-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2",
                isActive
                  ? "border-[var(--color-action-primary)] bg-primary/5"
                  : "border-[var(--color-border-default)] bg-white hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)]",
              ].join(" ")}
            >
              <span className={isActive ? "text-[var(--color-action-primary)]" : "text-[var(--color-text-tertiary)]"}>
                {qf.icon}
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {qf.label}
              </p>
              {isActive && usersData && (
                <p className="mt-0.5 text-xl font-bold text-[var(--color-action-primary)]">
                  {usersData.total.toLocaleString()}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card className="bg-background">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search users"
              placeholder="Name, email, or phone"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-[170px]">
            <Select
              label="Role"
              options={roleOptions}
              value={filters.role ?? ""}
              onChange={(v) =>
                setFilters({ role: (v || undefined) as "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN" | undefined })
              }
            />
          </div>
          {/* <div className="w-full sm:w-[190px]">
            <Select
              label="Admin role"
              options={adminRoleOptions}
              value={filters.adminRole ?? ""}
              onChange={(v) =>
                setFilters({
                  adminRole: (v || undefined) as
                    | "SUPER_ADMIN"
                    | "MODERATOR"
                    | "FINANCE_ADMIN"
                    | "SUPPORT_ADMIN"
                    | undefined,
                })
              }
            />
          </div> */}
          <div className="w-full sm:w-[130px]">
            <Select
              label="Per page"
              options={rowsPerPageOptions}
              value={String(filters.limit ?? 10)}
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
          <p className="text-sm font-semibold text-[var(--color-error-text)]">
            Could not load users.
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">
            {error} — Try refreshing the page or check your connection.
          </p>
        </div>
      )}

      {/* Users table */}
      <Card className="overflow-hidden bg-background p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Users</h2>
          {usersData && (
            <span className="text-sm text-[var(--color-text-secondary)]">{totalSummary}</span>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 pb-6">
            <SkeletonTable rows={filters.limit ?? 10} cols={5} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<EmptySearchIcon />}
            title="No users found"
            description="Try adjusting your search terms or removing a filter to see more results."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-auto text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">User</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Role</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Status</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Bookings</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Joined</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {users.map((user) => {
                  const statusVariant = STATUS_BADGE_VARIANT[user.status as keyof typeof STATUS_BADGE_VARIANT] ?? "secondary";
                  const roleLabel = user.adminRole ?? user.role;
                  return (
                    <tr key={user.id} className="transition-colors hover:bg-[var(--color-bg-surface)]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden="true"
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-[var(--color-action-primary)]"
                          >
                            {userInitials(user.firstName, user.lastName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--color-text-primary)]">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="truncate text-xs text-[var(--color-text-tertiary)]">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="secondary">{roleLabel}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant} dot>
                          {STATUS_LABEL[user.status] ?? user.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 tabular-nums text-[var(--color-text-secondary)]">
                        {user._count.bookings}
                      </td>
                      <td className="px-4 py-4 text-[var(--color-text-secondary)]">
                        {new Date(user.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleViewUser(user.id)}
                            disabled={isMutating}
                            aria-label={`View details for ${user.firstName} ${user.lastName}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {user.status !== "ACTIVE" ? (
                            <></>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleSuspend(user.id)}
                              disabled={isMutating}
                              aria-label={`Suspend ${user.firstName} ${user.lastName}`}
                            >
                              <ShieldAlert className="h-4 w-4 text-[var(--color-text-secondary)]" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleResetPassword(user.id)}
                            disabled={isMutating}
                            aria-label={`Reset password for ${user.firstName} ${user.lastName}`}
                          >
                            <KeyRound className="h-4 w-4 text-[var(--color-text-secondary)]" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDelete(user.id)}
                            disabled={isMutating}
                            aria-label={`Delete account for ${user.firstName} ${user.lastName}`}
                            className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination — shown only when there is more than one page */}
        {usersData && usersData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
            <Button
              variant="secondary"
              disabled={!canGoPrev || isMutating}
              onClick={() => setFilters({ page: (usersData.page ?? 1) - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page {usersData.page} of {usersData.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={!canGoNext || isMutating}
              onClick={() => setFilters({ page: (usersData.page ?? 1) + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Create Admin modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateAdminOpen}
        onClose={closeCreateAdmin}
        title="Create Admin Account"
        size="sm"
      >
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Add a moderator, finance admin, or support admin to the platform.
        </p>
        <form onSubmit={(e) => void handleCreateAdmin(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              value={adminForm.firstName}
              onChange={(e) => setAdminForm((p) => ({ ...p, firstName: e.target.value }))}
              required
            />
            <Input
              label="Last name"
              value={adminForm.lastName}
              onChange={(e) => setAdminForm((p) => ({ ...p, lastName: e.target.value }))}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={adminForm.email}
            onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <Input
            label="Temporary password"
            type="password"
            minLength={8}
            value={adminForm.password}
            onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))}
            required
          />
          <Input
            label="Phone (optional)"
            value={adminForm.phone}
            onChange={(e) => setAdminForm((p) => ({ ...p, phone: e.target.value }))}
          />
          <Select
            label="Admin role"
            options={adminRoleOptions.slice(1)}
            value={adminForm.adminRole}
            onChange={(v) =>
              setAdminForm((p) => ({ ...p, adminRole: v as typeof adminForm.adminRole }))
            }
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeCreateAdmin}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isMutating} disabled={isMutating}>
              <Plus className="h-4 w-4" />
              Create Admin
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── User Details modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        title={
          selectedUser
            ? `${selectedUser.firstName} ${selectedUser.lastName}`
            : "User Details"
        }
        size="full"
      >
        {selectedUser ? (
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto">
            <Tabs
              tabs={detailTabs}
              defaultTab="overview"
              variant="default"
              contentClassName="pb-2"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-text-tertiary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading user details…
          </div>
        )}
      </Modal>

      {dialogs}
    </div>
  );
}
