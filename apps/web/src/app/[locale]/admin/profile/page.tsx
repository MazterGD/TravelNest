"use client";

import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, Save } from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner } from "@/components/ui";
import { useAdminProfile } from "./hooks/useAdminProfile";

export default function AdminProfilePage() {
  const {
    isLoading,
    isMutating,
    error,
    profile,
    activity,
    permissions,
    refresh,
    updateProfile,
    changePassword,
  } = useAdminProfile();

  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!profile) {
      return;
    }

    setFirstNameDraft(profile.firstName);
    setLastNameDraft(profile.lastName);
    setPhoneDraft(profile.phone || "");
  }, [profile]);

  const saveProfile = async () => {
    await updateProfile({
      firstName: firstNameDraft,
      lastName: lastNameDraft,
      phone: phoneDraft,
    });
  };

  const savePassword = async () => {
    const changed = await changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (changed) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Admin profile</h2>
            <p className="text-sm text-muted-foreground">Personal information and account security.</p>
          </div>
          <Button variant="secondary" onClick={() => void refresh()} disabled={isLoading || isMutating}>
            <RefreshCw className="h-4 w-4" />
            Reload
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      {isLoading || !profile ? (
        <Card className="bg-background">
          <div className="flex min-h-[220px] items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Card className="bg-background">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">Personal information</h3>
                <Button size="sm" onClick={() => void saveProfile()} disabled={isMutating}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input
                  label="First name"
                  value={firstNameDraft}
                  onChange={(event) => setFirstNameDraft(event.target.value)}
                />
                <Input
                  label="Last name"
                  value={lastNameDraft}
                  onChange={(event) => setLastNameDraft(event.target.value)}
                />
                <Input label="Email" value={profile.email} disabled />
                <Input
                  label="Phone"
                  value={phoneDraft}
                  onChange={(event) => setPhoneDraft(event.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">{profile.adminRole || "UNASSIGNED"}</Badge>
                <Badge variant={profile.status === "ACTIVE" ? "success" : "warning"}>
                  {profile.status}
                </Badge>
              </div>
            </Card>

            <Card className="bg-background">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">Change password</h3>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void savePassword()}
                  disabled={isMutating}
                >
                  <KeyRound className="h-4 w-4" />
                  Update
                </Button>
              </div>

              <div className="mt-4 grid gap-3">
                <Input
                  type="password"
                  label="Current password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
                <Input
                  type="password"
                  label="New password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <Input
                  type="password"
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-background">
              <h3 className="text-base font-semibold text-foreground">Activity log</h3>
              {!activity || activity.items.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {activity.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-medium text-foreground">{item.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.entityType} | {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="bg-background">
              <h3 className="text-base font-semibold text-foreground">Effective permissions</h3>
              {!permissions || permissions.effectivePermissions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No permissions assigned.</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {permissions.effectivePermissions.map((permission) => (
                    <Badge key={permission} variant="secondary">
                      {permission}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
