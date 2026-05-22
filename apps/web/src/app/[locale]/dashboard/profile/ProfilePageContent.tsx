"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Camera,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  User,
  LoaderCircle,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store";
import { userService, ApiError } from "@/lib/api";

interface ProfilePageContentProps {
  locale: string;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2";

const cardSurface =
  "rounded-[20px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)]";

export function ProfilePageContent({
  locale: _locale,
}: ProfilePageContentProps) {
  const t = useTranslations("profile");
  const { user, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(
    user?.avatar || null,
  );
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await userService.getProfile();
        setFormData({
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          phone: profile.phone || "",
        });
        setProfileAvatar(profile.avatar || null);
        setUser(profile);
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
      setProfileAvatar(user.avatar || null);
      setIsLoading(false);
    }

    if (!user || !user.avatar) {
      loadProfile();
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxFileSize = 5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setError(t("avatarInvalidType"));
      e.target.value = "";
      return;
    }

    if (file.size > maxFileSize) {
      setError(t("avatarMaxSize"));
      e.target.value = "";
      return;
    }

    setIsUploadingAvatar(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedUser = await userService.uploadAvatar(file);
      setProfileAvatar(updatedUser.avatar || null);
      setUser(updatedUser);
      setSuccessMessage(t("avatarUpdated"));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("avatarUploadFailed"));
      }
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    setIsDeletingAvatar(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedUser = await userService.deleteAvatar();
      setProfileAvatar(null);
      setUser(updatedUser);
      setSuccessMessage(t("avatarDeleted"));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("avatarDeleteFailed"));
      }
    } finally {
      setIsDeletingAvatar(false);
    }
  };

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
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 space-y-6">
        <Skeleton className="h-40 w-full" variant="rectangular" />
        <Skeleton className="h-64 w-full" variant="rectangular" />
        <Skeleton className="h-48 w-full" variant="rectangular" />
      </div>
    );
  }

  const displayName = user
    ? `${user.firstName} ${user.lastName}`
    : `${formData.firstName} ${formData.lastName}`;
  const displayEmail = user?.email || "";
  const isVerified = user?.isVerified ?? false;
  const createdAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8 space-y-8">
      {/* ── Profile banner ────────────────────────────────────────────────── */}
      <section
        aria-labelledby="profile-name-heading"
        className="relative overflow-hidden rounded-[20px] bg-[var(--color-text-primary)] px-6 py-8 md:px-8"
      >
        {/* Decorative circles */}
        <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/4 rounded-full bg-white/5 blur-3xl"
        />
        <div
            aria-hidden="true"
            className="pointer-events-none absolute right-10 top-10 h-96 w-96 translate-x-1/3 -translate-y-1/3 rounded-full bg-white/5 blur-[80px]"
        />

        <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          {/* Avatar Section */}
          <div className="group relative shrink-0">
            <div className="h-24 w-24 overflow-hidden rounded-full border-3 border-white/10 bg-muted shadow-xl transition-transform duration-300 group-hover:scale-[1.02]">
              {profileAvatar ? (
                  <img
                      src={profileAvatar}
                      alt={t("profilePhoto")}
                      className="h-full w-full object-cover"
                  />
              ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800/50">
                    <User className="h-10 w-10 text-white/30" />
                  </div>
              )}
            </div>

            {/* Integrated Hover Overlay */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-black/60 opacity-0 backdrop-blur-sm transition-all duration-200 focus-within:opacity-100 group-hover:opacity-100">
              {profileAvatar && (
                  <button
                      type="button"
                      onClick={handleAvatarDelete}
                      disabled={isDeletingAvatar || isUploadingAvatar}
                      aria-label={t("avatarDelete")}
                      className={`flex h-8 w-8 items-center justify-center rounded-full bg-red-500/80 text-white shadow-sm transition-all hover:scale-110 hover:bg-red-500 disabled:scale-100 disabled:opacity-50 ${focusRing}`}
                  >
                    {isDeletingAvatar ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                        <Trash2 className="h-4 w-4" />
                    )}
                  </button>
              )}
              <label
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/20 text-white shadow-sm backdrop-blur-md transition-all hover:scale-110 hover:bg-white/30 ${focusRing}`}
                  aria-label={t("changePhoto")}
              >
                {isUploadingAvatar ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                    <Camera className="h-3.5 w-3.5" />
                )}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleAvatarUpload}
                />
              </label>
            </div>
          </div>

          {/* Name and Meta */}
          <div className="flex min-w-0 flex-1 flex-col sm:justify-center">
            <h1
                id="profile-name-heading"
                className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              {displayName}
            </h1>
            <p className="mt-1 truncate text-sm text-white/50 sm:text-base">
              {displayEmail}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              {isVerified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-bg)]/75 px-2.5 py-1 text-xs font-medium text-[var(--color-success-text)] shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("verified")}
        </span>
              )}
              {createdAt && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-white/40">
          <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden="true" />
                    {t("memberSince")} {createdAt}
        </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feedback banners ─────────────────────────────────────────────── */}
      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-[20px] border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-4 text-sm text-[var(--color-success-text)]"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]"
        >
          {error}
        </div>
      )}

      {/* ── Section 01: About you ─────────────────────────────────────────── */}
      <section className={cardSurface} aria-labelledby="about-heading">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
                01
              </span>
              <h2
                id="about-heading"
                className="font-semibold text-[var(--color-text-primary)]"
              >
                {t("personalInfo")}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {t("profileDescription", {
                defaultValue: "Your name, contact, and account details.",
              })}
            </p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={`inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] ${focusRing}`}
            >
              {t("edit")}
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className={`inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] ${focusRing}`}
              >
                {t("cancel")}
              </button>
              <Button type="submit" isLoading={isSaving}>
                {t("saveChanges")}
              </Button>
            </div>
          )}
        </form>
      </section>

      {/* ── Section 02: Sign-in & security ────────────────────────────────── */}
      <section className={cardSurface} aria-labelledby="security-heading">
        <div className="border-b border-[var(--color-border-default)] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
              02
            </span>
            <h2
              id="security-heading"
              className="font-semibold text-[var(--color-text-primary)]"
            >
              {t("security")}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            {t("securityDescription", {
              defaultValue: "Manage your password and account access.",
            })}
          </p>
        </div>

        <div className="divide-y divide-[var(--color-border-default)]">
          {/* Password row */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-bg-surface)]">
                <ShieldCheck
                  className="h-5 w-5 text-[var(--color-text-secondary)]"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t("password")}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("passwordDescription")}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={`inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] ${focusRing}`}
            >
              {t("changePassword")}
            </button>
          </div>

          {/* 2FA row */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-bg-surface)]">
                <ShieldCheck
                  className="h-5 w-5 text-[var(--color-text-secondary)]"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t("twoFactor")}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("twoFactorDescription")}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={`inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] ${focusRing}`}
            >
              {t("enable")}
            </button>
          </div>
        </div>
      </section>

      {/* ── Danger zone ───────────────────────────────────────────────────── */}
      <section
        className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-bg-base)]"
        aria-labelledby="danger-heading"
      >
        <div className="border-b border-[var(--color-error-border)] px-6 py-4">
          <h2
            id="danger-heading"
            className="text-sm font-semibold text-[var(--color-error-text)]"
          >
            {t("dangerZone")}
          </h2>
        </div>
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("deleteAccount")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {t("deleteAccountDescription")}
            </p>
          </div>
          <button
            type="button"
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-error-border)] px-3 text-sm font-medium text-[var(--color-error-text)] transition-colors hover:bg-[var(--color-error-bg)] ${focusRing}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t("delete")}
          </button>
        </div>
      </section>
    </div>
  );
}
