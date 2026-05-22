"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  LoadingSpinner,
  Input,
  Select,
  TextArea,
  FileUpload,
} from "@/components/ui";
import type { UploadedFile, ExistingFile } from "@/components/ui/FileUpload";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { vehicleService, landingContentService, ApiError } from "@/lib/api";
import { ArrowLeft, CheckCircle, Upload, X, Plus } from "lucide-react";

type FormSection = "basic" | "pricing" | "photos" | "documents" | "amenities";
type PhotoTag = "exterior" | "interior" | "front" | "rear" | "seats" | "other";

interface PhotoItem {
  file: File;
  tag: PhotoTag;
}

interface ExistingPhoto {
  id: string;
  url: string;
  fileName: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface FormData {
  name: string;
  registration: string;
  type: string;
  make: string;
  model: string;
  year: string;
  capacity: string;
  color: string;
  acType: string;
  condition: string;
  description: string;
  pricePerKm: string;
  pricePerDay: string;
  driverAllowance: string;
  location: string;
  gpsEnabled: boolean;
}

const PHOTO_TAGS: PhotoTag[] = [
  "exterior",
  "interior",
  "front",
  "rear",
  "seats",
  "other",
];

export default function EditVehiclePage() {
  const { user } = useAuthStore();
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;
  const locale = params.locale as string;
  const t = useTranslations("vehicleForm");

  const [activeSection, setActiveSection] = useState<FormSection>("basic");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenities, setCustomAmenities] = useState<string[]>([]);
  const [customAmenityInput, setCustomAmenityInput] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [documents, setDocuments] = useState<{
    license: UploadedFile | null;
    insurance: UploadedFile | null;
    registrationCertificate: UploadedFile | null;
  }>({ license: null, insurance: null, registrationCertificate: null });
  const [existingDocuments, setExistingDocuments] = useState<{
    license: ExistingFile | null;
    insurance: ExistingFile | null;
    registrationCertificate: ExistingFile | null;
  }>({ license: null, insurance: null, registrationCertificate: null });
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [acTypeOptions, setAcTypeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [conditionOptions, setConditionOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [amenitiesList, setAmenitiesList] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    registration: "",
    type: "",
    make: "",
    model: "",
    year: "",
    capacity: "",
    color: "",
    acType: "",
    condition: "",
    description: "",
    pricePerKm: "",
    pricePerDay: "",
    driverAllowance: "",
    location: "",
    gpsEnabled: false,
  });

  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const photoTagLabel = useCallback(
    (tag: PhotoTag): string => {
      const labels: Record<PhotoTag, string> = {
        exterior: t("photoTagExterior"),
        interior: t("photoTagInterior"),
        front: t("photoTagFront"),
        rear: t("photoTagRear"),
        seats: t("photoTagSeats"),
        other: t("photoTagOther"),
      };
      return labels[tag];
    },
    [t],
  );

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        setLoading(true);
        const response = await vehicleService.getById(vehicleId);
        const vehicle = (response as any)?.vehicle || response;

        setFormData({
          name: vehicle.name || "",
          registration: vehicle.licensePlate || "",
          type: vehicle.type || "",
          make: vehicle.brand || "",
          model: vehicle.model || "",
          year: vehicle.year?.toString() || "",
          capacity: vehicle.seats?.toString() || "",
          color: vehicle.color || "",
          acType: vehicle.acType || "",
          condition: vehicle.condition || "",
          description: vehicle.description || "",
          pricePerKm: vehicle.pricePerKm?.toString() || "",
          pricePerDay: vehicle.pricePerDay?.toString() || "",
          driverAllowance: vehicle.driverAllowance?.toString() || "",
          location: vehicle.location || "",
          gpsEnabled:
            (vehicle.features as Record<string, boolean>)?.gpsEnabled ?? false,
        });
        setSelectedAmenities(vehicle.amenities || []);

        // Populate existing documents from API response
        if (vehicle.documents && Array.isArray(vehicle.documents)) {
          const docMap: Record<string, ExistingFile> = {};
          for (const doc of vehicle.documents) {
            const key =
              doc.type === "DRIVING_LICENSE"
                ? "license"
                : doc.type === "INSURANCE"
                  ? "insurance"
                  : doc.type === "REGISTRATION_CERTIFICATE"
                    ? "registrationCertificate"
                    : null;
            if (key) {
              docMap[key] = {
                url: doc.url,
                fileName: doc.fileName,
                fileSize: doc.fileSize,
                status: doc.status,
              };
            }
          }
          setExistingDocuments({
            license: docMap.license || null,
            insurance: docMap.insurance || null,
            registrationCertificate: docMap.registrationCertificate || null,
          });
        }

        // Populate existing photos from API response
        if (vehicle.photos && Array.isArray(vehicle.photos)) {
          setExistingPhotos(
            vehicle.photos.map((p: any) => ({
              id: p.id,
              url: p.url,
              fileName: p.fileName,
              isPrimary: p.isPrimary || false,
              sortOrder: p.sortOrder || 0,
            })),
          );
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("errorUpdate"));
        }
      } finally {
        setLoading(false);
      }
    };

    if (vehicleId) fetchVehicle();
  }, [vehicleId, t]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        if (response.options.vehicleTypes?.length)
          setVehicleTypeOptions(response.options.vehicleTypes);
        if (response.options.acTypes?.length) {
          setAcTypeOptions(
            response.options.acTypes.map((option) => ({
              value: option.value.toLowerCase().replace(/_/g, "-"),
              label: option.label,
            })),
          );
        }
        if (response.options.conditions?.length)
          setConditionOptions(response.options.conditions);
        if (response.options.amenities?.length)
          setAmenitiesList(response.options.amenities);
      } catch {
        // Config is non-critical; options remain empty
      }
    };
    fetchConfig();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const handleAddCustomAmenity = () => {
    const trimmed = customAmenityInput.trim();
    if (!trimmed || customAmenities.includes(trimmed)) return;
    setCustomAmenities((prev) => [...prev, trimmed]);
    setSelectedAmenities((prev) => [...prev, trimmed]);
    setCustomAmenityInput("");
  };

  const updatePhotoTag = (index: number, tag: PhotoTag) => {
    setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, tag } : p)));
  };

  const sections = [
    { id: "basic" as const, label: t("sectionBasic") },
    { id: "pricing" as const, label: t("sectionPricing") },
    { id: "photos" as const, label: t("sectionPhotos") },
    { id: "documents" as const, label: t("sectionDocuments") },
    { id: "amenities" as const, label: t("sectionAmenities") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const updateData = {
        name: formData.name,
        licensePlate: formData.registration,
        type: formData.type as "ORDINARY" | "SEMI_LUXURY" | "LUXURY_AC",
        brand: formData.make,
        model: formData.model,
        year: parseInt(formData.year),
        seats: parseInt(formData.capacity),
        color: formData.color || undefined,
        acType: formData.acType as "full-ac" | "ac" | "non-ac",
        condition:
          (formData.condition as "excellent" | "good" | "fair") || undefined,
        description: formData.description || undefined,
        pricePerDay: parseFloat(formData.pricePerDay),
        pricePerKm: formData.pricePerKm
          ? parseFloat(formData.pricePerKm)
          : undefined,
        driverAllowance: formData.driverAllowance
          ? parseFloat(formData.driverAllowance)
          : undefined,
        location: formData.location,
        amenities: selectedAmenities,
        features: { gpsEnabled: formData.gpsEnabled },
      };

      await vehicleService.update(vehicleId, updateData);

      // Only upload docs if new files were selected
      const docsToUpload: Array<{
        file: File;
        type: "DRIVING_LICENSE" | "INSURANCE" | "REGISTRATION_CERTIFICATE";
      }> = [];
      if (documents.license)
        docsToUpload.push({
          file: documents.license.file,
          type: "DRIVING_LICENSE",
        });
      if (documents.insurance)
        docsToUpload.push({
          file: documents.insurance.file,
          type: "INSURANCE",
        });
      if (documents.registrationCertificate)
        docsToUpload.push({
          file: documents.registrationCertificate.file,
          type: "REGISTRATION_CERTIFICATE",
        });
      if (docsToUpload.length > 0) {
        await vehicleService.uploadDocuments(vehicleId, docsToUpload);
      }

      if (photos.length > 0) {
        await vehicleService.uploadPhotos(
          vehicleId,
          photos.map((item, index) => ({
            file: item.file,
            isPrimary: index === 0,
          })),
        );
      }

      router.push(`/${locale}/owner/fleet`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("errorUpdate"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (guardLoading || !isAuthorized || !user || loading) {
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
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/fleet`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToFleet")}
            </Link>
            <h1 className="text-heading-md font-semibold text-foreground">
              {t("editTitle")}
              {formData.registration ? ` — ${formData.registration}` : ""}
            </h1>
            <p className="mt-1 text-body text-muted-foreground">
              {t("editSubtitle")}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
          <div className="mb-8 rounded-lg border border-border bg-card">
            {/* Tab Navigation */}
            <div className="border-b border-border px-6">
              <nav className="flex gap-6">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`border-b-2 py-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      activeSection === section.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-8">
              <form onSubmit={handleSubmit}>
                {/* Basic Information */}
                {activeSection === "basic" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("busDetailsTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("vehicleDetailsSubtitle")}
                      </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Input
                        label={t("fieldBusName")}
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        placeholder={t("fieldBusNamePlaceholder")}
                      />
                      <Input
                        label={t("fieldRegistration")}
                        name="registration"
                        required
                        value={formData.registration}
                        onChange={handleChange}
                        placeholder={t("fieldRegistrationPlaceholder")}
                      />
                      <Select
                        label={t("fieldBusType")}
                        name="type"
                        required
                        value={formData.type}
                        onChange={(v) => handleSelectChange("type", v)}
                        options={vehicleTypeOptions}
                        placeholder={t("fieldBusTypePlaceholder")}
                      />
                      <Input
                        label={t("fieldMake")}
                        name="make"
                        required
                        value={formData.make}
                        onChange={handleChange}
                        placeholder={t("fieldMakePlaceholder")}
                      />
                      <Input
                        label={t("fieldModel")}
                        name="model"
                        required
                        value={formData.model}
                        onChange={handleChange}
                        placeholder={t("fieldModelPlaceholder")}
                      />
                      <Input
                        label={t("fieldYear")}
                        name="year"
                        type="number"
                        required
                        value={formData.year}
                        onChange={handleChange}
                        placeholder="2022"
                      />
                      <Input
                        label={t("fieldCapacity")}
                        name="capacity"
                        type="number"
                        required
                        value={formData.capacity}
                        onChange={handleChange}
                        placeholder="45"
                      />
                      <Input
                        label={t("fieldColor")}
                        name="color"
                        required
                        value={formData.color}
                        onChange={handleChange}
                        placeholder={t("fieldColorPlaceholder")}
                      />
                      <Select
                        label={t("fieldAcType")}
                        name="acType"
                        required
                        value={formData.acType}
                        onChange={(v) => handleSelectChange("acType", v)}
                        options={acTypeOptions}
                        placeholder={t("fieldAcTypePlaceholder")}
                      />
                      <Select
                        label={t("fieldCondition")}
                        name="condition"
                        required
                        value={formData.condition}
                        onChange={(v) => handleSelectChange("condition", v)}
                        options={conditionOptions}
                        placeholder={t("fieldConditionPlaceholder")}
                      />
                      <Input
                        label={t("fieldLocation")}
                        name="location"
                        required
                        value={formData.location}
                        onChange={handleChange}
                        placeholder={t("fieldLocationPlaceholder")}
                      />
                      <div className="md:col-span-2">
                        <TextArea
                          label={t("fieldDescription")}
                          name="description"
                          value={formData.description}
                          onChange={(e) => handleChange(e)}
                          rows={4}
                          placeholder={t("fieldDescriptionPlaceholder")}
                          maxLength={500}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Pricing */}
                {activeSection === "pricing" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("pricingTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("pricingSubtitleEdit")}
                      </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Input
                        label={t("fieldPricePerKm")}
                        name="pricePerKm"
                        type="number"
                        required
                        value={formData.pricePerKm}
                        onChange={handleChange}
                        placeholder="85"
                        helperText={t("fieldPricePerKmHelp")}
                      />
                      <Input
                        label={t("fieldPricePerDay")}
                        name="pricePerDay"
                        type="number"
                        required
                        value={formData.pricePerDay}
                        onChange={handleChange}
                        placeholder="25000"
                        helperText={t("fieldPricePerDayHelp")}
                      />
                      <Input
                        label={t("fieldDriverAllowance")}
                        name="driverAllowance"
                        type="number"
                        value={formData.driverAllowance || ""}
                        onChange={handleChange}
                        placeholder="2500"
                        helperText={t("fieldDriverAllowanceHelp")}
                      />
                    </div>
                    {formData.pricePerKm && formData.pricePerDay && (
                      <div className="rounded-lg border border-border bg-muted p-5">
                        <div className="mb-3 text-sm font-medium text-foreground">
                          {t("sampleCalcTitle")}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{t("sampleCalcDistance")}</span>
                            <span>
                              LKR{" "}
                              {(
                                parseFloat(formData.pricePerKm) * 150
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>{t("sampleCalcRental")}</span>
                            <span>
                              LKR{" "}
                              {parseFloat(
                                formData.pricePerDay,
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-border pt-2 font-medium text-foreground">
                            <span>{t("sampleCalcTotal")}</span>
                            <span>
                              LKR{" "}
                              {(
                                parseFloat(formData.pricePerKm) * 150 +
                                parseFloat(formData.pricePerDay)
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Photos */}
                {activeSection === "photos" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("photosTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("photosSubtitleEdit")}
                      </p>
                    </div>

                    {/* Existing photos from server */}
                    {existingPhotos.length > 0 && (
                      <div>
                        <h4 className="mb-3 text-sm font-medium text-foreground">
                          Current Photos ({existingPhotos.length})
                        </h4>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                          {existingPhotos.map((photo) => (
                            <div
                              key={photo.id}
                              className="relative rounded-xl border border-border p-2"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.url}
                                alt={photo.fileName}
                                className="aspect-video w-full rounded-lg object-cover"
                              />
                              {photo.isPrimary && (
                                <span className="absolute left-1 top-1 rounded-lg bg-[var(--color-action-primary)] px-2 py-0.5 text-xs text-white">
                                  {t("photoPrimary")}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById("photo-upload-edit")?.click()
                        }
                        className="w-full cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <div className="mb-1 font-medium text-foreground">
                          {t("uploadZoneTitle")}
                        </div>
                        <p className="mb-3 text-sm text-muted-foreground">
                          {t("uploadZoneSubtitle")}
                        </p>
                        <input
                          id="photo-upload-edit"
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files) {
                              const newPhotos = Array.from(
                                e.target.files,
                              ).map((file) => ({
                                file,
                                tag: "exterior" as PhotoTag,
                              }));
                              setPhotos((prev) => [...prev, ...newPhotos]);
                            }
                          }}
                          className="hidden"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("uploadZoneFormats")}
                        </p>
                      </button>

                      {photos.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                          {photos.map((item, index) => (
                            <div
                              key={index}
                              className="relative rounded-lg border border-border p-2"
                            >
                              <img
                                src={URL.createObjectURL(item.file)}
                                alt={`Vehicle ${index + 1}`}
                                className="aspect-video w-full rounded-md object-cover"
                              />
                              <button
                                type="button"
                                aria-label="Remove photo"
                                onClick={() =>
                                  setPhotos((prev) =>
                                    prev.filter((_, i) => i !== index),
                                  )
                                }
                                className="absolute -right-2 -top-2 rounded-full bg-[var(--color-error-bg)] p-1.5 text-error-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              {index === 0 && (
                                <span className="absolute left-1 top-1 rounded-sm bg-primary px-2 py-0.5 text-xs text-white">
                                  {t("photoPrimary")}
                                </span>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1">
                                {PHOTO_TAGS.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => updatePhotoTag(index, tag)}
                                    className={`rounded-sm px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                                      item.tag === tag
                                        ? "bg-primary text-white"
                                        : "border border-border bg-muted text-muted-foreground hover:border-primary/50"
                                    }`}
                                  >
                                    {photoTagLabel(tag)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {activeSection === "documents" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("documentsTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("documentsSubtitleEdit")}
                      </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <FileUpload
                        label={t("docLicense")}
                        value={documents.license}
                        existingFile={existingDocuments.license}
                        onChange={(file) =>
                          setDocuments({ ...documents, license: file })
                        }
                        helpText={t("docLicenseHelp")}
                      />
                      <FileUpload
                        label={t("docInsurance")}
                        value={documents.insurance}
                        existingFile={existingDocuments.insurance}
                        onChange={(file) =>
                          setDocuments({ ...documents, insurance: file })
                        }
                        helpText={t("docInsuranceHelp")}
                      />
                      <div className="md:col-span-2">
                        <FileUpload
                          label={t("docRegistration")}
                          value={documents.registrationCertificate}
                          existingFile={existingDocuments.registrationCertificate}
                          onChange={(file) =>
                            setDocuments({
                              ...documents,
                              registrationCertificate: file,
                            })
                          }
                          helpText={t("docRegistrationHelp")}
                        />
                      </div>
                    </div>
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                      <div className="text-sm">
                        <div className="mb-1 font-medium text-foreground">
                          {t("docReqTitle")}
                        </div>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• {t("docReqClear")}</li>
                          <li>• {t("docReqFormats")}</li>
                          <li>• {t("docReqValid")}</li>
                          <li>• {t("docReqReview")}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {activeSection === "amenities" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("amenitiesTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("amenitiesSubtitleEdit")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {amenitiesList.map((amenity) => (
                        <button
                          key={amenity.id}
                          type="button"
                          onClick={() => toggleAmenity(amenity.id)}
                          className={`rounded-md border-2 p-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selectedAmenities.includes(amenity.id)
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-foreground hover:border-primary/50"
                          }`}
                        >
                          {amenity.label}
                        </button>
                      ))}
                      {customAmenities.map((amenity) => (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className="rounded-md border-2 border-primary bg-primary/5 p-4 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {amenity}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customAmenityInput}
                        onChange={(e) => setCustomAmenityInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomAmenity();
                          }
                        }}
                        placeholder={t("customAmenityPlaceholder")}
                        className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomAmenity}
                        aria-label={t("addCustomAmenity")}
                        className="flex items-center gap-1 rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Plus className="h-4 w-4" />
                        {t("addCustomAmenity")}
                      </button>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/30">
                      <input
                        type="checkbox"
                        name="gpsEnabled"
                        checked={formData.gpsEnabled}
                        onChange={handleChange}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div>
                        <div className="mb-0.5 font-medium text-foreground">
                          {t("gpsTitle")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("gpsSubtitle")}
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mt-6 max-w-3xl rounded-md border border-error bg-[var(--color-error-bg)] p-4 text-sm text-error-foreground">
                    <p className="font-medium">{t("errorLabel")}</p>
                    <p>{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex max-w-3xl gap-3 border-t border-border pt-6">
                  <Link
                    href={`/${locale}/owner/fleet`}
                    className="flex flex-1 items-center justify-center rounded-md border border-border px-4 py-2 text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("cancel")}
                  </Link>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" />
                        {t("saving")}
                      </>
                    ) : (
                      <>
                        {t("saveChanges")}
                        <CheckCircle className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
