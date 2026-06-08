"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LoadingSpinner,
  Input,
  Select,
  TextArea,
  FileUpload,
} from "@/components/ui";
import type { UploadedFile } from "@/components/ui/FileUpload";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { ArrowLeft, ArrowRight, Check, CheckCircle, Upload, X, Plus } from "lucide-react";
import { vehicleService, landingContentService } from "@/lib/api";

type PhotoTag = "exterior" | "interior" | "front" | "rear" | "seats" | "other";

interface PhotoItem {
  file: File;
  tag: PhotoTag;
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

export default function AddVehiclePage() {
  const { user } = useAuthStore();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const t = useTranslations("vehicleForm");

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenities, setCustomAmenities] = useState<string[]>([]);
  const [customAmenityInput, setCustomAmenityInput] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [documents, setDocuments] = useState<{
    license: UploadedFile | null;
    insurance: UploadedFile | null;
    registrationCertificate: UploadedFile | null;
  }>({ license: null, insurance: null, registrationCertificate: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  const STEPS = [
    { label: t("sectionBasic") },
    { label: t("sectionPricing") },
    { label: t("sectionPhotos") },
    { label: t("sectionDocuments") },
    { label: t("sectionAmenities") },
  ];

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

  const buildVehicleData = () => ({
    name: formData.name,
    licensePlate: formData.registration.toUpperCase(),
    type: formData.type as "ORDINARY" | "SEMI_LUXURY" | "LUXURY_AC",
    brand: formData.make,
    model: formData.model,
    year: parseInt(formData.year),
    seats: parseInt(formData.capacity),
    color: formData.color || undefined,
    acType: formData.acType as "full-ac" | "ac" | "non-ac",
    condition:
      (formData.condition as "excellent" | "good" | "fair") || undefined,
    fuelType: "DIESEL" as const,
    transmission: "MANUAL" as const,
    pricePerKm: parseFloat(formData.pricePerKm) || undefined,
    pricePerDay: parseFloat(formData.pricePerDay),
    driverAllowance: parseFloat(formData.driverAllowance) || undefined,
    location: formData.location,
    description: formData.description || undefined,
    amenities: selectedAmenities,
    features: { gpsEnabled: formData.gpsEnabled },
  });

  const validateCurrentStep = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (currentStep === 0) {
      if (!formData.name.trim()) errs.name = t("errorRequired");
      if (!formData.registration.trim()) errs.registration = t("errorRequired");
      if (!formData.type) errs.type = t("errorRequired");
      if (!formData.make.trim()) errs.make = t("errorRequired");
      if (!formData.model.trim()) errs.model = t("errorRequired");
      if (!formData.year) errs.year = t("errorRequired");
      if (!formData.capacity) errs.capacity = t("errorRequired");
      if (!formData.acType) errs.acType = t("errorRequired");
      if (!formData.location.trim()) errs.location = t("errorRequired");
    }
    if (currentStep === 1) {
      if (!formData.pricePerDay) errs.pricePerDay = t("errorRequired");
    }
    if (currentStep === 3) {
      if (
        !documents.license ||
        !documents.insurance ||
        !documents.registrationCertificate
      ) {
        errs.documents = t("errorDocRequired");
      }
    }
    return errs;
  };

  const handleNext = () => {
    const errs = validateCurrentStep();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setCurrentStep((s) => s + 1);
  };

  const handleDraft = async () => {
    setIsDraftSaving(true);
    setErrors({});
    try {
      await vehicleService.create(buildVehicleData());
      router.push(`/${locale}/owner/fleet`);
    } catch (error: any) {
      setErrors({ submit: error.message || t("errorCreate") });
    } finally {
      setIsDraftSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      if (
        !documents.license ||
        !documents.insurance ||
        !documents.registrationCertificate
      ) {
        setErrors({ documents: t("errorDocRequired") });
        setCurrentStep(3);
        setIsSubmitting(false);
        return;
      }

      const vehicle = await vehicleService.create(buildVehicleData());

      await vehicleService.uploadDocuments(vehicle.id, [
        { file: documents.license.file, type: "DRIVING_LICENSE" },
        { file: documents.insurance.file, type: "INSURANCE" },
        {
          file: documents.registrationCertificate.file,
          type: "REGISTRATION_CERTIFICATE",
        },
      ]);

      if (photos.length > 0) {
        await vehicleService.uploadPhotos(
          vehicle.id,
          photos.map((item, index) => ({
            file: item.file,
            isPrimary: index === 0,
          })),
        );
      }

      router.push(`/${locale}/owner/fleet`);
    } catch (error: any) {
      setErrors({ submit: error.message || t("errorCreate") });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (guardLoading || !isAuthorized || !user) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-muted">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/fleet`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToFleet")}
            </Link>
            <h1 className="text-heading-md font-semibold text-foreground">
              {t("addTitle")}
            </h1>
            <p className="mt-1 text-body text-muted-foreground">
              {t("addSubtitle")}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-[20px] border border-border bg-card">
            {/* Stepper navigation */}
            <div className="border-b border-border px-4 py-6 sm:px-6">
              <div className="flex items-start">
                {STEPS.map((step, idx) => (
                  <Fragment key={idx}>
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                          idx < currentStep
                            ? "bg-[var(--color-action-primary)] text-white"
                            : idx === currentStep
                              ? "border-2 border-[var(--color-action-primary)] text-[var(--color-action-primary)]"
                              : "border-2 border-[var(--color-border-default)] text-[var(--color-text-tertiary)]"
                        }`}
                      >
                        {idx < currentStep ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        className={`hidden text-xs font-medium sm:block ${
                          idx === currentStep
                            ? "text-[var(--color-action-primary)]"
                            : idx < currentStep
                              ? "text-[var(--color-text-secondary)]"
                              : "text-[var(--color-text-tertiary)]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`mx-2 mt-4 h-px flex-1 transition-colors ${
                          idx < currentStep
                            ? "bg-[var(--color-action-primary)]"
                            : "bg-[var(--color-border-default)]"
                        }`}
                      />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <form onSubmit={handleSubmit}>
                {errors.submit && (
                  <div className="mb-6 rounded-xl border border-error bg-[var(--color-error-bg)] p-4 text-sm text-error-foreground">
                    {errors.submit}
                  </div>
                )}

                {/* Step 0: Basic Information */}
                {currentStep === 0 && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("busDetailsTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("busDetailsSubtitle")}
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
                        error={errors.name}
                      />
                      <Input
                        label={t("fieldRegistration")}
                        name="registration"
                        required
                        value={formData.registration}
                        onChange={handleChange}
                        placeholder={t("fieldRegistrationPlaceholder")}
                        error={errors.registration}
                      />
                      <Select
                        label={t("fieldBusType")}
                        name="type"
                        required
                        value={formData.type}
                        onChange={(v) => handleSelectChange("type", v)}
                        options={vehicleTypeOptions}
                        placeholder={t("fieldBusTypePlaceholder")}
                        error={errors.type}
                      />
                      <Input
                        label={t("fieldMake")}
                        name="make"
                        required
                        value={formData.make}
                        onChange={handleChange}
                        placeholder={t("fieldMakePlaceholder")}
                        error={errors.make}
                      />
                      <Input
                        label={t("fieldModel")}
                        name="model"
                        required
                        value={formData.model}
                        onChange={handleChange}
                        placeholder={t("fieldModelPlaceholder")}
                        error={errors.model}
                      />
                      <Input
                        label={t("fieldYear")}
                        name="year"
                        type="number"
                        required
                        value={formData.year}
                        onChange={handleChange}
                        placeholder="2022"
                        error={errors.year}
                      />
                      <Input
                        label={t("fieldCapacity")}
                        name="capacity"
                        type="number"
                        required
                        value={formData.capacity}
                        onChange={handleChange}
                        placeholder="45"
                        error={errors.capacity}
                      />
                      <Input
                        label={t("fieldColor")}
                        name="color"
                        required
                        value={formData.color}
                        onChange={handleChange}
                        placeholder={t("fieldColorPlaceholder")}
                        error={errors.color}
                      />
                      <Select
                        label={t("fieldAcType")}
                        name="acType"
                        required
                        value={formData.acType}
                        onChange={(v) => handleSelectChange("acType", v)}
                        options={acTypeOptions}
                        placeholder={t("fieldAcTypePlaceholder")}
                        error={errors.acType}
                      />
                      <Select
                        label={t("fieldCondition")}
                        name="condition"
                        required
                        value={formData.condition}
                        onChange={(v) => handleSelectChange("condition", v)}
                        options={conditionOptions}
                        placeholder={t("fieldConditionPlaceholder")}
                        error={errors.condition}
                      />
                      <Input
                        label={t("fieldLocation")}
                        name="location"
                        required
                        value={formData.location}
                        onChange={handleChange}
                        placeholder={t("fieldLocationPlaceholder")}
                        error={errors.location}
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

                {/* Step 1: Pricing */}
                {currentStep === 1 && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("pricingTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("pricingSubtitle")}
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
                        error={errors.pricePerKm}
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
                        error={errors.pricePerDay}
                        helperText={t("fieldPricePerDayHelp")}
                      />
                      <Input
                        label={t("fieldDriverAllowance")}
                        name="driverAllowance"
                        type="number"
                        value={formData.driverAllowance}
                        onChange={handleChange}
                        placeholder="2500"
                        helperText={t("fieldDriverAllowanceHelp")}
                      />
                    </div>
                    {formData.pricePerKm && formData.pricePerDay && (
                      <div className="rounded-xl border border-border bg-muted p-5">
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

                {/* Step 2: Photos */}
                {currentStep === 2 && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("photosTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("photosSubtitle")}
                      </p>
                    </div>
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById("photo-upload")?.click()
                        }
                        className="w-full cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-[var(--color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <div className="mb-1 font-medium text-foreground">
                          {t("uploadZoneTitle")}
                        </div>
                        <p className="mb-3 text-sm text-muted-foreground">
                          {t("uploadZoneSubtitle")}
                        </p>
                        <input
                          id="photo-upload"
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
                              className="relative rounded-xl border border-border p-2"
                            >
                              <img
                                src={URL.createObjectURL(item.file)}
                                alt={`Vehicle ${index + 1}`}
                                className="aspect-video w-full rounded-lg object-cover"
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
                                <span className="absolute left-1 top-1 rounded-lg bg-[var(--color-action-primary)] px-2 py-0.5 text-xs text-white">
                                  {t("photoPrimary")}
                                </span>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1">
                                {PHOTO_TAGS.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => updatePhotoTag(index, tag)}
                                    className={`rounded-lg px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                                      item.tag === tag
                                        ? "bg-[var(--color-action-primary)] text-white"
                                        : "border border-border bg-muted text-muted-foreground hover:border-[var(--color-action-primary)]/50"
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

                      {errors.photos && (
                        <p className="text-sm text-error-foreground">
                          {errors.photos}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Documents */}
                {currentStep === 3 && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("documentsTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("documentsSubtitle")}
                      </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <FileUpload
                        label={t("docLicense")}
                        required
                        value={documents.license}
                        onChange={(file) =>
                          setDocuments({ ...documents, license: file })
                        }
                        helpText={t("docLicenseHelp")}
                      />
                      <FileUpload
                        label={t("docInsurance")}
                        required
                        value={documents.insurance}
                        onChange={(file) =>
                          setDocuments({ ...documents, insurance: file })
                        }
                        helpText={t("docInsuranceHelp")}
                      />
                      <div className="md:col-span-2">
                        <FileUpload
                          label={t("docRegistration")}
                          required
                          value={documents.registrationCertificate}
                          onChange={(file) =>
                            setDocuments({
                              ...documents,
                              registrationCertificate: file,
                            })
                          }
                          helpText={t("docRegistrationHelp")}
                        />
                      </div>
                      {errors.documents && (
                        <p className="text-sm text-error-foreground">
                          {errors.documents}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-[var(--color-action-primary)]/20 bg-[var(--color-action-primary)]/5 p-4">
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

                {/* Step 4: Amenities */}
                {currentStep === 4 && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 text-body-lg font-semibold text-foreground">
                        {t("amenitiesTitle")}
                      </h3>
                      <p className="mb-6 text-body text-muted-foreground">
                        {t("amenitiesSubtitle")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {amenitiesList.map((amenity) => (
                        <button
                          key={amenity.id}
                          type="button"
                          onClick={() => toggleAmenity(amenity.id)}
                          className={`rounded-xl border-2 p-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selectedAmenities.includes(amenity.id)
                              ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5 text-[var(--color-action-primary)]"
                              : "border-border text-foreground hover:border-[var(--color-action-primary)]/50"
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
                          className="rounded-xl border-2 border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5 p-4 text-sm font-medium text-[var(--color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomAmenity}
                        aria-label={t("addCustomAmenity")}
                        className="flex items-center gap-1 rounded-xl border border-[var(--color-action-primary)] px-3 py-2 text-sm font-medium text-[var(--color-action-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Plus className="h-4 w-4" />
                        {t("addCustomAmenity")}
                      </button>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:border-[var(--color-action-primary)]/30">
                      <input
                        type="checkbox"
                        name="gpsEnabled"
                        checked={formData.gpsEnabled}
                        onChange={handleChange}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--color-action-primary)] focus-visible:ring-2 focus-visible:ring-ring"
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

                {/* Step navigation buttons */}
                <div className="mt-8 flex max-w-3xl items-center gap-3 border-t border-border pt-6">
                  {currentStep > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrors({});
                        setCurrentStep((s) => s - 1);
                      }}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {t("back")}
                    </button>
                  )}

                  <div className="flex-1" />

                  {currentStep < STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t("next")}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isSubmitting || isDraftSaving}
                        onClick={handleDraft}
                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isDraftSaving ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          t("saveDraft")
                        )}
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || isDraftSaving}
                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isSubmitting ? (
                          <>
                            <LoadingSpinner size="sm" />
                            {t("publishing")}
                          </>
                        ) : (
                          <>
                            {t("publishVehicle")}
                            <CheckCircle className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
  );
}
