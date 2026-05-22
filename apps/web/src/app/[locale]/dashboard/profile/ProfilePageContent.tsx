"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Avatar,
  SkeletonProfile,
} from "@/components/ui";
import { useAuthStore } from "@/store";
import { userService, ApiError } from "@/lib/api";

interface ProfilePageContentProps {
  locale: string;
}

export function ProfilePageContent({ locale }: ProfilePageContentProps) {
  const t = useTranslations("profile");
  const { user, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await userService.getProfile();
        setFormData({
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          phone: profile.phone || "",
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load profile");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
      });
      setIsLoading(false);
    } else {
      loadProfile();
    }
  }, [user]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: "" }));
    setError(null);
    setSuccessMessage(null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim())
      newErrors.firstName = t("firstNameRequired");
    if (!formData.lastName.trim()) newErrors.lastName = t("lastNameRequired");
    if (!formData.phone.trim()) newErrors.phone = t("phoneRequired");
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedUser = await userService.updatePersonalInfo({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
      });

      // Update the auth store with new user data
      if (user) {
        setUser({
          ...user,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phone: updatedUser.phone,
        });
      }

      setSuccessMessage(t("profileUpdated"));
      setIsEditing(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update profile");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
    });
    setFormErrors({});
    setError(null);
    setSuccessMessage(null);
    setIsEditing(false);
  };

  if (isLoading) {
    return <SkeletonProfile />;
  }

  const displayName = user
    ? `${user.firstName} ${user.lastName}`
    : formData.firstName + " " + formData.lastName;
  const displayEmail = user?.email || "";
  const isVerified = user?.isVerified ?? false;
  const createdAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString()
    : "";

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={t("myProfile")} subtitle={t("profileDescription")} />

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <Avatar name={displayName} size="xl" src={user?.avatar} />
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground">
                {displayName}
              </h2>
              <p className="text-muted-foreground">{displayEmail}</p>
              <div className="flex items-center gap-2 mt-2">
                {isVerified ? (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t("verified")}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                    {t("unverified")}
                  </span>
                )}
                {createdAt && (
                  <span className="text-xs text-muted-foreground">
                    {t("memberSince")} {createdAt}
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm">
              {t("changePhoto")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("personalInfo")}</CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              {t("edit")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                value={formData.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                label={t("firstName")}
                disabled={!isEditing}
                error={formErrors.firstName}
              />
              <Input
                value={formData.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                label={t("lastName")}
                disabled={!isEditing}
                error={formErrors.lastName}
              />
              <Input
                label={t("email")}
                value={displayEmail}
                disabled
                helperText={t("emailCannotBeChanged")}
              />
              <Input
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                label={t("phone")}
                disabled={!isEditing}
                error={formErrors.phone}
              />
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t("cancel")}
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  {t("saveChanges")}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("security")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium text-foreground">{t("password")}</p>
              <p className="text-sm text-muted-foreground">
                {t("passwordDescription")}
              </p>
            </div>
            <Button variant="outline" size="sm">
              {t("changePassword")}
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium text-foreground">{t("twoFactor")}</p>
              <p className="text-sm text-muted-foreground">
                {t("twoFactorDescription")}
              </p>
            </div>
            <Button variant="outline" size="sm">
              {t("enable")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">{t("dangerZone")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
            <div>
              <p className="font-medium text-foreground">
                {t("deleteAccount")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("deleteAccountDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              {t("delete")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
