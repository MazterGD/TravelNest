"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, Input, Select } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import {
  vehicleService,
  ownerService,
  authService,
  landingContentService,
  storageService,
  ApiError,
} from "@/lib/api";
import {
  MapPin,
  Mail,
  Phone,
  User,
  ArrowLeft,
  Lock,
  Camera,
  Bus,
  Edit,
  Contact,
  AlertCircle,
  CheckCircle,
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Clock,
} from "lucide-react";

type ProfileTab =
  | "personal"
  | "address"
  | "vehicles"
  | "security"
  | "documents";

interface Vehicle {
  id: string;
  licensePlate: string;
  name: string;
  type: string;
  brand: string;
  model: string;
  seats: number;
  isAvailable: boolean;
  isActive: boolean;
}

interface OwnerDocument {
  id: string;
  type: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const DOCUMENT_SLOTS: Array<{ type: "NIC"; labelKey: string }> = [
  { type: "NIC", labelKey: "docTypeNIC" },
];

export default function OwnerProfilePage() {
  const t = useTranslations("ownerProfile");
  const { user, updateUser } = useAuthStore();
  const params = useParams();
  const locale = params.locale as string;
  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");
  const [profilePicture, setProfilePicture] = useState<string | null>(
    user?.avatar || null,
  );

  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<OwnerDocument[]>([]);
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [personalInfo, setPersonalInfo] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    nicNumber: user?.nicNumber || "",
  });

  const [addressInfo, setAddressInfo] = useState({
    address: user?.address || "",
    city: user?.city || "",
    district: user?.district || "",
    postalCode: user?.postalCode || "",
    baseLocation: user?.baseLocation || "",
  });

  const [securityInfo, setSecurityInfo] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  useEffect(() => {
    if (activeTab === "vehicles" && user) {
      setIsLoadingVehicles(true);
      setError(null);
      vehicleService
        .getMyVehicles()
        .then((response) =>
          setVehicles((response?.vehicles || []) as Vehicle[]),
        )
        .catch((err) => {
          if (err instanceof ApiError) setError(err.message);
        })
        .finally(() => setIsLoadingVehicles(false));
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === "documents" && user) {
      setIsLoadingDocs(true);
      ownerService
        .getDocuments()
        .then((docs) => setDocuments(docs))
        .catch(() => setDocuments([]))
        .finally(() => setIsLoadingDocs(false));
    }
  }, [activeTab, user]);

  useEffect(() => {
    landingContentService
      .getPublicConfig()
      .then((response) => setDistrictOptions(response.options.districts || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setPersonalInfo({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        nicNumber: user.nicNumber || "",
      });
      setAddressInfo({
        address: user.address || "",
        city: user.city || "",
        district: user.district || "",
        postalCode: user.postalCode || "",
        baseLocation: user.baseLocation || "",
      });
    }
  }, [user]);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleProfilePictureChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePicture(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await ownerService.updatePersonalInfo({
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        phone: personalInfo.phone,
        nicNumber: personalInfo.nicNumber,
      });
      if (updateUser) updateUser(response);
      showSuccess(t("successPersonal"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("uploadError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await ownerService.updateAddress({
        address: addressInfo.address,
        city: addressInfo.city,
        district: addressInfo.district,
        postalCode: addressInfo.postalCode,
        baseLocation: addressInfo.baseLocation,
      });
      if (updateUser) updateUser(response);
      showSuccess(t("successAddress"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("uploadError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (securityInfo.newPassword !== securityInfo.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (securityInfo.newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setIsSaving(true);
    try {
      await authService.changePassword(
        securityInfo.currentPassword,
        securityInfo.newPassword,
      );
      setSecurityInfo({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      showSuccess(t("successPassword"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("uploadError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDocumentUpload = async (
    type: "NIC" | "PROFILE_PHOTO",
    file: File,
  ) => {
    setUploadingDocType(type);
    setError(null);
    try {
      const { url } = await storageService.uploadRegistrationFile(
        file,
        "owner-documents",
        type,
      );
      await ownerService.addDocument({
        type,
        url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      const updated = await ownerService.getDocuments();
      setDocuments(updated);
      showSuccess(t("docUploaded"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("uploadError"));
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleDocumentDelete = async (docId: string) => {
    setDeletingDocId(docId);
    setError(null);
    try {
      await ownerService.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      showSuccess(t("docDeleted"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("deleteError"));
    } finally {
      setDeletingDocId(null);
    }
  };

  const getDocumentByType = (type: string) =>
    documents.find((d) => d.type === type) || null;

  const StatusBadge = ({
    status,
  }: {
    status: "PENDING" | "VERIFIED" | "REJECTED";
  }) => {
    if (status === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--color-success-bg)] px-2 py-0.5 text-caption font-medium text-success-foreground">
          <CheckCircle className="h-3 w-3" />
          {t("docStatusVerified")}
        </span>
      );
    }
    if (status === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--color-error-bg)] px-2 py-0.5 text-caption font-medium text-error-foreground">
          <AlertCircle className="h-3 w-3" />
          {t("docStatusRejected")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground border border-border">
        <Clock className="h-3 w-3" />
        {t("docStatusPending")}
      </span>
    );
  };

  const userStatus = (user as any)?.status as string | undefined;
  const isVerified = user?.isVerified && userStatus === "ACTIVE";
  const isRejected = !user?.isVerified && !!(user as any)?.rejectedAt;

  if (guardLoading || !isAuthorized || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  const tabs: Array<{
    id: ProfileTab;
    labelKey: string;
    icon: React.ElementType;
  }> = [
    { id: "personal", labelKey: "tabPersonal", icon: User },
    { id: "address", labelKey: "tabAddress", icon: MapPin },
    { id: "vehicles", labelKey: "tabVehicles", icon: Bus },
    { id: "documents", labelKey: "tabDocuments", icon: FileText },
    { id: "security", labelKey: "tabSecurity", icon: Lock },
  ];

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/dashboard`}
              className="mb-3 flex items-center gap-2 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToDashboard")}
            </Link>
            <h1 className="text-heading-md font-semibold text-foreground">
              {t("title")}
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-6 py-8 lg:px-8">
          {/* Success message */}
          {successMessage && (
            <div className="mb-6 rounded-lg border border-success bg-[var(--color-success-bg)] p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success-foreground shrink-0" />
              <span className="text-body text-success-foreground">
                {successMessage}
              </span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-lg border border-error bg-[var(--color-error-bg)] p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-error-foreground shrink-0" />
              <span className="text-body text-error-foreground">{error}</span>
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="ml-auto text-error-foreground hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                ×
              </button>
            </div>
          )}

          {/* Tab card */}
          <div className="rounded-lg border border-border bg-card">
            {/* Tab navigation */}
            <div className="border-b border-border px-6 overflow-x-auto">
              <nav className="flex gap-1 min-w-max">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 border-b-2 px-3 py-4 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-md ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {t(tab.labelKey)}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* ── Personal Information Tab ── */}
              {activeTab === "personal" && (
                <div className="max-w-3xl">
                  <div className="mb-6">
                    <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                      {t("personalInfo")}
                    </h3>
                    <p className="text-body text-muted-foreground">
                      {t("personalInfoDesc")}
                    </p>
                  </div>

                  {/* Profile picture */}
                  <div className="mb-6 flex items-center gap-6">
                    <div className="relative">
                      <div className="h-24 w-24 rounded-full border-4 border-border bg-muted overflow-hidden">
                        {profilePicture ? (
                          <img
                            src={profilePicture}
                            alt={t("profilePhoto")}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <User className="h-10 w-10 text-[var(--color-text-tertiary)]" />
                          </div>
                        )}
                      </div>
                      <label
                        className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Change profile photo"
                      >
                        <Camera className="h-4 w-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleProfilePictureChange}
                        />
                      </label>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {t("profilePhoto")}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {t("profilePhotoHint")}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handlePersonalInfoSubmit}
                    className="space-y-5"
                  >
                    <div className="grid gap-5 md:grid-cols-2">
                      <Input
                        label="First Name"
                        name="firstName"
                        required
                        value={personalInfo.firstName}
                        onChange={(e) =>
                          setPersonalInfo({
                            ...personalInfo,
                            firstName: e.target.value,
                          })
                        }
                      />
                      <Input
                        label="Last Name"
                        name="lastName"
                        required
                        value={personalInfo.lastName}
                        onChange={(e) =>
                          setPersonalInfo({
                            ...personalInfo,
                            lastName: e.target.value,
                          })
                        }
                      />
                      <Input
                        label="Email"
                        name="email"
                        type="email"
                        required
                        value={personalInfo.email}
                        onChange={(e) =>
                          setPersonalInfo({
                            ...personalInfo,
                            email: e.target.value,
                          })
                        }
                        icon={<Mail />}
                      />
                      <Input
                        label="Phone"
                        name="phone"
                        type="tel"
                        required
                        value={personalInfo.phone}
                        onChange={(e) =>
                          setPersonalInfo({
                            ...personalInfo,
                            phone: e.target.value,
                          })
                        }
                        icon={<Phone />}
                      />
                      <Input
                        label="NIC Number"
                        name="nicNumber"
                        required
                        value={personalInfo.nicNumber}
                        onChange={(e) =>
                          setPersonalInfo({
                            ...personalInfo,
                            nicNumber: e.target.value,
                          })
                        }
                        icon={<Contact />}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-md bg-foreground px-6 py-3 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isSaving && <LoadingSpinner size="sm" />}
                        {isSaving ? t("saving") : t("saveChanges")}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Address Tab ── */}
              {activeTab === "address" && (
                <div className="max-w-3xl">
                  <div className="mb-6">
                    <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                      {t("addressInfo")}
                    </h3>
                    <p className="text-body text-muted-foreground">
                      {t("addressInfoDesc")}
                    </p>
                  </div>

                  <form onSubmit={handleAddressSubmit} className="space-y-5">
                    <div>
                      <label className="mb-2 block text-body font-medium text-foreground">
                        {t("addressField")}
                      </label>
                      <textarea
                        rows={3}
                        value={addressInfo.address}
                        onChange={(e) =>
                          setAddressInfo({
                            ...addressInfo,
                            address: e.target.value,
                          })
                        }
                        placeholder={t("addressPlaceholder")}
                        className="w-full resize-none rounded-md border border-border px-3 py-2 text-body transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-card text-foreground"
                      />
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <Input
                        label="City"
                        name="city"
                        value={addressInfo.city}
                        onChange={(e) =>
                          setAddressInfo({
                            ...addressInfo,
                            city: e.target.value,
                          })
                        }
                        placeholder="Colombo"
                      />
                      <Select
                        label="District"
                        name="district"
                        value={addressInfo.district}
                        onChange={(value) =>
                          setAddressInfo({ ...addressInfo, district: value })
                        }
                        options={districtOptions.map((d) => ({
                          value: d,
                          label: d,
                        }))}
                        placeholder="Select district"
                      />
                      <Input
                        label="Postal Code"
                        name="postalCode"
                        value={addressInfo.postalCode}
                        onChange={(e) =>
                          setAddressInfo({
                            ...addressInfo,
                            postalCode: e.target.value,
                          })
                        }
                        placeholder="00300"
                      />
                      <Input
                        label="Base Location"
                        name="baseLocation"
                        value={addressInfo.baseLocation}
                        onChange={(e) =>
                          setAddressInfo({
                            ...addressInfo,
                            baseLocation: e.target.value,
                          })
                        }
                        placeholder="Primary operating location"
                        helperText={t("baseLocationHint")}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-md bg-foreground px-6 py-3 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isSaving && <LoadingSpinner size="sm" />}
                        {isSaving ? t("saving") : t("saveChanges")}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Vehicles Tab ── */}
              {activeTab === "vehicles" && (
                <div className="max-w-4xl">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("myVehicles")}
                      </h3>
                      <p className="text-body text-muted-foreground">
                        {t("myVehiclesCount", { count: vehicles.length })}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/owner/fleet/add`}
                      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-body font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t("addVehicle")}
                    </Link>
                  </div>

                  {isLoadingVehicles ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : vehicles.length === 0 ? (
                    <div className="rounded-lg border border-border bg-muted p-12 text-center">
                      <Bus className="mx-auto h-16 w-16 text-[var(--color-text-tertiary)] mb-4" />
                      <h4 className="mb-2 text-body-lg font-semibold text-foreground">
                        {t("noVehicles")}
                      </h4>
                      <p className="mb-4 text-body text-muted-foreground">
                        {t("noVehiclesDesc")}
                      </p>
                      <Link
                        href={`/${locale}/owner/fleet/add`}
                        className="inline-block rounded-md bg-primary px-6 py-3 text-body font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t("addFirstVehicle")}
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {vehicles.map((vehicle) => (
                        <div
                          key={vehicle.id}
                          className="rounded-md border border-border bg-card p-5 transition-shadow hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
                                <Bus className="h-8 w-8 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-foreground">
                                  {vehicle.licensePlate}
                                </h4>
                                <p className="text-body text-muted-foreground">
                                  {vehicle.brand} {vehicle.model} —{" "}
                                  {vehicle.type}
                                </p>
                                <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
                                  {vehicle.seats} seats
                                </p>
                                <div className="mt-2 flex gap-2">
                                  <span
                                    className={`inline-block rounded-sm px-2 py-0.5 text-caption font-medium ${
                                      vehicle.isAvailable
                                        ? "bg-[var(--color-success-bg)] text-success-foreground"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {vehicle.isAvailable
                                      ? "Available"
                                      : "Unavailable"}
                                  </span>
                                  {!vehicle.isActive && (
                                    <span className="inline-block rounded-sm bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                                      Pending Verification
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Link
                              href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-body font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Security Tab ── */}
              {activeTab === "security" && (
                <div className="max-w-3xl">
                  <div className="mb-6">
                    <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                      {t("securitySettings")}
                    </h3>
                    <p className="text-body text-muted-foreground">
                      {t("securitySettingsDesc")}
                    </p>
                  </div>

                  <form onSubmit={handleSecuritySubmit} className="space-y-5">
                    <Input
                      label={t("currentPassword")}
                      name="currentPassword"
                      type="password"
                      required
                      value={securityInfo.currentPassword}
                      onChange={(e) =>
                        setSecurityInfo({
                          ...securityInfo,
                          currentPassword: e.target.value,
                        })
                      }
                      icon={<Lock />}
                    />
                    <Input
                      label={t("newPassword")}
                      name="newPassword"
                      type="password"
                      required
                      value={securityInfo.newPassword}
                      onChange={(e) =>
                        setSecurityInfo({
                          ...securityInfo,
                          newPassword: e.target.value,
                        })
                      }
                      icon={<Lock />}
                      helperText={t("passwordMinLength")}
                    />
                    <Input
                      label={t("confirmPassword")}
                      name="confirmPassword"
                      type="password"
                      required
                      value={securityInfo.confirmPassword}
                      onChange={(e) =>
                        setSecurityInfo({
                          ...securityInfo,
                          confirmPassword: e.target.value,
                        })
                      }
                      icon={<Lock />}
                    />
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-md bg-foreground px-6 py-3 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isSaving && <LoadingSpinner size="sm" />}
                        {isSaving ? t("updating") : t("updatePassword")}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Documents Tab ── */}
              {activeTab === "documents" && (
                <div className="max-w-3xl space-y-6">
                  <div>
                    <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                      {t("documentsTitle")}
                    </h3>
                    <p className="text-body text-muted-foreground">
                      {t("documentsDesc")}
                    </p>
                  </div>

                  {/* Verification status card */}
                  <div
                    className={`rounded-lg border p-5 flex items-start gap-4 ${
                      isVerified
                        ? "border-success bg-[var(--color-success-bg)]"
                        : isRejected
                          ? "border-error bg-[var(--color-error-bg)]"
                          : "border-border bg-muted"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isVerified ? (
                        <ShieldCheck className="h-6 w-6 text-success-foreground" />
                      ) : isRejected ? (
                        <ShieldAlert className="h-6 w-6 text-error-foreground" />
                      ) : (
                        <Clock className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`font-semibold text-body-lg ${
                          isVerified
                            ? "text-success-foreground"
                            : isRejected
                              ? "text-error-foreground"
                              : "text-foreground"
                        }`}
                      >
                        {isVerified
                          ? t("statusVerified")
                          : isRejected
                            ? t("statusRejected")
                            : t("statusPending")}
                      </p>
                      <p
                        className={`mt-1 text-body ${
                          isVerified
                            ? "text-success-foreground"
                            : isRejected
                              ? "text-error-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {isVerified
                          ? t("statusVerifiedDesc")
                          : isRejected
                            ? t("statusRejectedDesc")
                            : t("statusPendingDesc")}
                      </p>
                      {isRejected && (user as any)?.rejectionReason && (
                        <div className="mt-3 rounded-md border border-error bg-card p-3">
                          <p className="text-caption font-semibold text-error-foreground">
                            {t("adminNotes")}
                          </p>
                          <p className="mt-1 text-body text-foreground">
                            {(user as any).rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Document cards */}
                  {isLoadingDocs ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {DOCUMENT_SLOTS.map(({ type, labelKey }) => {
                        const doc = getDocumentByType(type);
                        const isUploading = uploadingDocType === type;
                        const isDeleting = doc
                          ? deletingDocId === doc.id
                          : false;

                        return (
                          <div
                            key={type}
                            className="rounded-lg border border-border bg-card p-5"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                                  <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground">
                                    {t(labelKey)}
                                  </p>
                                  {doc ? (
                                    <>
                                      <p className="mt-0.5 text-caption text-muted-foreground truncate max-w-[240px]">
                                        {doc.fileName}
                                      </p>
                                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <StatusBadge status={doc.status} />
                                        <span className="text-caption text-[var(--color-text-tertiary)]">
                                          {new Date(
                                            doc.createdAt,
                                          ).toLocaleDateString()}
                                        </span>
                                      </div>
                                      {doc.status === "REJECTED" &&
                                        doc.rejectionReason && (
                                          <p className="mt-2 text-caption text-error-foreground">
                                            {doc.rejectionReason}
                                          </p>
                                        )}
                                    </>
                                  ) : (
                                    <p className="mt-0.5 text-caption text-[var(--color-text-tertiary)]">
                                      {t("noDocument")}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {doc && (
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={t("viewDocument")}
                                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}

                                {doc && doc.status !== "VERIFIED" && (
                                  <button
                                    onClick={() => handleDocumentDelete(doc.id)}
                                    disabled={isDeleting}
                                    aria-label={t("deleteDocument")}
                                    className="flex h-9 w-9 items-center justify-center rounded-md border border-error text-error-foreground transition-colors hover:bg-[var(--color-error-bg)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    {isDeleting ? (
                                      <LoadingSpinner size="sm" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                )}

                                <label
                                  className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-caption font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    doc
                                      ? "border border-border bg-card text-muted-foreground"
                                      : "bg-primary text-white"
                                  }`}
                                >
                                  {isUploading ? (
                                    <LoadingSpinner size="sm" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                  )}
                                  {isUploading
                                    ? "Uploading..."
                                    : doc
                                      ? t("replaceDocument")
                                      : t("uploadDocument")}
                                  <input
                                    type="file"
                                    accept={
                                      "application/pdf,image/jpeg,image/png"
                                    }
                                    className="sr-only"
                                    disabled={isUploading}
                                    ref={(el) => {
                                      fileInputRefs.current[type] = el;
                                    }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file)
                                        handleDocumentUpload(type, file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
