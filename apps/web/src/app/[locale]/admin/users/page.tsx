"use client";

import { useMemo, useState } from "react";
import { Download, Eye, KeyRound, Plus, RefreshCw, ShieldAlert, Trash2, UserCog } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select } from "@/components/ui";
import { useDialogPrompts } from "@/hooks";
import { useUserFilters } from "./hooks/useUserFilters";

const roleOptions = [
  { value: "", label: "All roles" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "VEHICLE_OWNER", label: "Vehicle Owner" },
  { value: "ADMIN", label: "Admin" },
];

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "PENDING_VERIFICATION", label: "Pending Verification" },
];

const adminRoleOptions = [
  { value: "", label: "All admin roles" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "MODERATOR", label: "Moderator" },
  { value: "FINANCE_ADMIN", label: "Finance Admin" },
  { value: "SUPPORT_ADMIN", label: "Support Admin" },
];

const statusVariant = (status: string) => {
  if (status === "ACTIVE") return "success" as const;
  if (status === "SUSPENDED") return "danger" as const;
  if (status === "PENDING_VERIFICATION") return "warning" as const;
  return "secondary" as const;
};

export default function AdminUsersPage() {
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

  const [adminForm, setAdminForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    adminRole: "MODERATOR" as
      | "SUPER_ADMIN"
      | "MODERATOR"
      | "FINANCE_ADMIN"
      | "SUPPORT_ADMIN",
  });

  const canGoPrev = (usersData?.page || 1) > 1;
  const canGoNext =
    usersData !== null ? usersData.page < usersData.totalPages : false;

  const users = usersData?.users || [];

  const totalSummary = useMemo(() => {
    if (!usersData) return "";

    const start = (usersData.page - 1) * usersData.limit + 1;
    const end = Math.min(usersData.total, usersData.page * usersData.limit);
    return `${start}-${end} of ${usersData.total}`;
  }, [usersData]);

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              label="Search users"
              placeholder="Name, email, or phone"
              value={filters.search || ""}
              onChange={(event) =>
                setFilters({
                  search: event.target.value,
                })
              }
            />
          </div>
          <div className="w-full sm:w-[190px]">
            <Select
              label="Role"
              options={roleOptions}
              value={filters.role || ""}
              onChange={(value) =>
                setFilters({
                  role: (value || undefined) as
                    | "CUSTOMER"
                    | "VEHICLE_OWNER"
                    | "ADMIN"
                    | undefined,
                })
              }
            />
          </div>
          <div className="w-full sm:w-[220px]">
            <Select
              label="Status"
              options={statusOptions}
              value={filters.status || ""}
              onChange={(value) =>
                setFilters({
                  status: (value || undefined) as
                    | "ACTIVE"
                    | "INACTIVE"
                    | "SUSPENDED"
                    | "PENDING_VERIFICATION"
                    | undefined,
                })
              }
            />
          </div>
          <div className="w-full sm:w-[220px]">
            <Select
              label="Admin role"
              options={adminRoleOptions}
              value={filters.adminRole || ""}
              onChange={(value) =>
                setFilters({
                  adminRole: (value || undefined) as
                    | "SUPER_ADMIN"
                    | "MODERATOR"
                    | "FINANCE_ADMIN"
                    | "SUPPORT_ADMIN"
                    | undefined,
                })
              }
            />
          </div>
          <Button variant="secondary" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" />
            Reload
          </Button>
          <Button onClick={() => void exportUsersCsv()} disabled={isMutating}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">User management</h2>
            {usersData && <p className="text-sm text-muted-foreground">{totalSummary}</p>}
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : users.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No users found with current filters.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[800px] table-auto text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3">User</th>
                    <th className="py-3">Role</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Bookings</th>
                    <th className="py-3">Created</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/70 align-top">
                      <td className="py-3">
                        <p className="font-medium text-foreground">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary">{user.adminRole || user.role}</Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{user._count.bookings}</td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void loadUserDetails(user.id)}
                            disabled={isMutating}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>

                          {user.status !== "ACTIVE" ? (
                            <Button
                              size="sm"
                              onClick={() => void updateUserStatus(user.id, "ACTIVE")}
                              disabled={isMutating}
                            >
                              Activate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void updateUserStatus(
                                  user.id,
                                  "SUSPENDED",
                                  "Suspended by admin",
                                )
                              }
                              disabled={isMutating}
                            >
                              <ShieldAlert className="h-4 w-4" />
                              Suspend
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void (async () => {
                                const newPassword = await prompt({
                                  title: "Reset user password",
                                  message:
                                    "Enter a temporary password (minimum 8 characters).",
                                  placeholder: "Temporary password",
                                  type: "password",
                                  minLength: 8,
                                  confirmText: "Reset",
                                });

                                if (!newPassword) {
                                  return;
                                }

                                await resetUserPassword(user.id, newPassword);
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <KeyRound className="h-4 w-4" />
                            Reset Password
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void (async () => {
                                const approved = await confirm({
                                  title: "Delete User Account",
                                  message:
                                    "Delete this user account permanently? This action cannot be undone.",
                                  confirmText: "Delete",
                                  variant: "danger",
                                });

                                if (!approved) {
                                  return;
                                }

                                await deleteUser(user.id);
                              })();
                            }}
                            disabled={isMutating}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {usersData && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                disabled={!canGoPrev || isMutating}
                onClick={() =>
                  setFilters({
                    page: (usersData.page || 1) - 1,
                  })
                }
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {usersData.page} of {usersData.totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={!canGoNext || isMutating}
                onClick={() =>
                  setFilters({
                    page: (usersData.page || 1) + 1,
                  })
                }
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="bg-background">
            <h3 className="text-base font-semibold text-foreground">Create admin account</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a moderator, finance admin, or support admin.
            </p>

            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createAdmin({
                  ...adminForm,
                  phone: adminForm.phone || undefined,
                });
              }}
            >
              <Input
                label="First name"
                value={adminForm.firstName}
                onChange={(event) =>
                  setAdminForm((prev) => ({ ...prev, firstName: event.target.value }))
                }
                required
              />
              <Input
                label="Last name"
                value={adminForm.lastName}
                onChange={(event) =>
                  setAdminForm((prev) => ({ ...prev, lastName: event.target.value }))
                }
                required
              />
              <Input
                label="Email"
                type="email"
                value={adminForm.email}
                onChange={(event) =>
                  setAdminForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
              <Input
                label="Temporary password"
                type="password"
                minLength={8}
                value={adminForm.password}
                onChange={(event) =>
                  setAdminForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
              />
              <Input
                label="Phone (optional)"
                value={adminForm.phone}
                onChange={(event) =>
                  setAdminForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
              <Select
                label="Admin role"
                options={adminRoleOptions.slice(1)}
                value={adminForm.adminRole}
                onChange={(value) =>
                  setAdminForm((prev) => ({
                    ...prev,
                    adminRole: value as
                      | "SUPER_ADMIN"
                      | "MODERATOR"
                      | "FINANCE_ADMIN"
                      | "SUPPORT_ADMIN",
                  }))
                }
              />

              <Button type="submit" disabled={isMutating} className="w-full">
                <Plus className="h-4 w-4" />
                Create Admin
              </Button>
            </form>
          </Card>

          <Card className="bg-background">
            <h3 className="text-base font-semibold text-foreground">Selected user details</h3>
            {selectedUser ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  {selectedUser.firstName} {selectedUser.lastName}
                </p>
                <p className="text-muted-foreground">{selectedUser.email}</p>
                <p className="text-muted-foreground">Role: {selectedUser.adminRole || selectedUser.role}</p>
                <p className="text-muted-foreground">
                  Bookings: {selectedUser._count.bookings} | Reviews: {selectedUser._count.reviews}
                </p>
                <p className="text-muted-foreground">
                  Notifications: {selectedUser._count.notifications}
                </p>
                <p className="text-muted-foreground">
                  Last updated: {new Date(selectedUser.updatedAt).toLocaleString()}
                </p>

                <div className="mt-3 rounded-xl border border-border bg-muted/60 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recent activity
                  </p>
                  {selectedUserActivity?.logs?.length ? (
                    <ul className="space-y-2">
                      {selectedUserActivity.logs.slice(0, 5).map((log) => (
                        <li key={log.id} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{log.action}</span> on {log.entityType} · {new Date(log.createdAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No activity logs loaded.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <UserCog className="h-4 w-4" />
                Select a user from the table to view details.
              </div>
            )}
          </Card>
        </div>
      </div>

      {dialogs}
    </div>
  );
}
