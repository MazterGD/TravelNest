"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Bus,
  FileText,
  Contact,
  Camera,
  ImageUp,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  LoadingSpinner,
  FileUpload,
  OtpVerificationModal,
  type UploadedFile,
} from "@/components/ui";
import {
  authService,
  ownerRegistrationService,
  storageService,
  landingContentService,
  ApiError,
} from "@/lib/api";
import { useAuthStore } from "@/store";
import { useGuestGuard } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import { localizePlaceName } from "@/lib/i18n/placeName";
import type { OwnerRegistrationInput } from "@/types";

// Vehicle type for the form
interface VehicleData {
  registrationNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: string;
  seatingCapacity: string;
  color: string;
  acType: string;
  condition: string;
  description: string;
  pricePerKm: string;
  pricePerDay: string;
  driverAllowance: string;
  amenities: string[];
  photos: UploadedFile[]; // Vehicle photos (optional)
  documents: {
    license: UploadedFile | null;
    insurance: UploadedFile | null;
    registrationCertificate: UploadedFile | null;
  };
}

const TOTAL_STEPS = 5;

export default function OwnerRegistrationPage() {
  const t = useTranslations("auth.ownerRegister");
  const tSearch = useTranslations("search");
  const tLocations = useTranslations("locations");
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { login } = useAuthStore();

  // Redirect authenticated users to their dashboard
  const { isLoading: guardLoading, isAuthorized } = useGuestGuard();

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Personal Information (including NIC moved from vehicle)
  const [personalInfo, setPersonalInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nicNumber: "",
  });

  // Owner photo
  const [ownerPhoto, setOwnerPhoto] = useState<UploadedFile | null>(null);

  // Owner NIC document
  const [nicDocument, setNicDocument] = useState<UploadedFile | null>(null);

  // Address Information
  const [addressInfo, setAddressInfo] = useState({
    address: "",
    city: "",
    district: "",
    postalCode: "",
    baseLocation: "",
  });

  // Vehicle Information (Required - at least one)
  const [vehicles, setVehicles] = useState<VehicleData[]>([
    {
      registrationNumber: "",
      vehicleType: "",
      make: "",
      model: "",
      year: "",
      seatingCapacity: "",
      color: "",
      acType: "",
      condition: "",
      description: "",
      pricePerKm: "",
      pricePerDay: "",
      driverAllowance: "",
      amenities: [],
      photos: [],
      documents: {
        license: null,
        insurance: null,
        registrationCertificate: null,
      },
    },
  ]);

  // Password
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });

  // Terms
  const [termsData, setTermsData] = useState({
    termsAccepted: false,
    privacyAccepted: false,
    dataProcessingAccepted: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [publicOptions, setPublicOptions] = useState<{
    vehicleTypes: Array<{ value: string; label: string }>;
    acTypes: Array<{ value: string; label: string }>;
    conditions: Array<{ value: string; label: string }>;
    amenities: Array<{ id: string; label: string }>;
    districts: Array<{ value: string; label: string }>;
  }>({
    vehicleTypes: [],
    acTypes: [],
    conditions: [],
    amenities: [],
    districts: [],
  });

  const normalizeEnumValue = (value: string) =>
    value.toUpperCase().replace(/[- ]/g, "_");

  const localizeVehicleTypeLabel = (value: string, fallbackLabel: string) => {
    switch (normalizeEnumValue(value)) {
      case "ORDINARY":
        return tSearch("filters.vehicleTypes.ordinary");
      case "SEMI_LUXURY":
        return tSearch("filters.vehicleTypes.semiLuxury");
      case "LUXURY_AC":
        return tSearch("filters.vehicleTypes.luxuryAc");
      default:
        return fallbackLabel;
    }
  };

  const localizeAcTypeLabel = (value: string, fallbackLabel: string) => {
    switch (normalizeEnumValue(value)) {
      case "FULL_AC":
        return tSearch("filters.acTypes.fullAc");
      case "AC":
        return tSearch("filters.acTypes.ac");
      case "NON_AC":
        return tSearch("filters.acTypes.nonAc");
      default:
        return fallbackLabel;
    }
  };

  const localizeAmenityLabel = (id: string, fallbackLabel: string) => {
    switch (id.toLowerCase()) {
      case "wifi":
        return tSearch("filters.amenityOptions.wifi");
      case "ac":
        return tSearch("filters.amenityOptions.ac");
      case "music":
        return tSearch("filters.amenityOptions.music");
      case "usb":
        return tSearch("filters.amenityOptions.usb");
      case "tv":
        return tSearch("filters.amenityOptions.tv");
      case "reclining":
        return tSearch("filters.amenityOptions.reclining");
      case "reading":
        return tSearch("filters.amenityOptions.reading");
      case "gps":
        return tSearch("filters.amenityOptions.gps");
      default:
        return fallbackLabel;
    }
  };

  const localizeConditionLabel = (value: string, fallbackLabel: string) => {
    switch (normalizeEnumValue(value)) {
      case "EXCELLENT":
        return t("fields.condition.options.excellent");
      case "GOOD":
        return t("fields.condition.options.good");
      case "FAIR":
        return t("fields.condition.options.fair");
      case "NEEDS_REPAIR":
        return t("fields.condition.options.needsRepair");
      default:
        return fallbackLabel;
    }
  };

  const localizePlace = (placeName: string) =>
    localizePlaceName(placeName, (key) => tLocations(key));

  useEffect(() => {
    const fetchPublicOptions = async () => {
      try {
        const response = await landingContentService.getPublicConfig();
        setPublicOptions({
          vehicleTypes: response.options.vehicleTypes.map((type) => ({
            ...type,
            label: localizeVehicleTypeLabel(type.value, type.label),
          })),
          acTypes: response.options.acTypes.map((type) => ({
            ...type,
            label: localizeAcTypeLabel(type.value, type.label),
          })),
          conditions: response.options.conditions.map((option) => ({
            ...option,
            label: localizeConditionLabel(option.value, option.label),
          })),
          amenities: response.options.amenities.map((amenity) => ({
            ...amenity,
            label: localizeAmenityLabel(amenity.id, amenity.label),
          })),
          districts: response.options.districts.map((district) => ({
            value: district,
            label: localizePlace(district),
          })),
        });
      } catch (err) {
        console.error("Failed to fetch owner registration config:", err);
      }
    };

    fetchPublicOptions();
  }, []);

  // Password strength calculation
  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 25;
    if (/[^a-zA-Z\d]/.test(password)) strength += 25;
    setPasswordStrength(strength);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 50) return "bg-red-500";
    if (passwordStrength < 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 50) return t("passwordStrength.weak");
    if (passwordStrength < 75) return t("passwordStrength.medium");
    return t("passwordStrength.strong");
  };

  // Validation for each step
  const validateStep = (step: number): boolean => {
    setError(null);
    setFieldErrors({});

    switch (step) {
      case 1: // Personal Information (including NIC)
        if (
          !personalInfo.firstName ||
          !personalInfo.lastName ||
          !personalInfo.email ||
          !personalInfo.phone ||
          !personalInfo.nicNumber
        ) {
          setError(t("errors.requiredFields"));
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)) {
          setFieldErrors({ email: t("errors.invalidEmail") });
          return false;
        }
        if (!ownerPhoto || !nicDocument) {
          setFieldErrors({
            ownerPhoto: !ownerPhoto ? t("errors.profilePhotoRequired") : "",
            nicDocument: !nicDocument ? t("errors.nicDocumentRequired") : "",
          });
          setError(t("errors.identityDocsRequired"));
          return false;
        }
        return true;

      case 2: // Address
        if (
          !addressInfo.address ||
          !addressInfo.city ||
          !addressInfo.district ||
          !addressInfo.baseLocation
        ) {
          setError(t("errors.requiredAddressFields"));
          return false;
        }
        return true;

      case 3: // Vehicle Information
        for (let i = 0; i < vehicles.length; i++) {
          const vehicle = vehicles[i];
          if (
            !vehicle.registrationNumber ||
            !vehicle.vehicleType ||
            !vehicle.make ||
            !vehicle.model ||
            !vehicle.year ||
            !vehicle.seatingCapacity ||
            !vehicle.acType
          ) {
            setError(t("errors.requiredVehicleFields", { index: i + 1 }));
            return false;
          }
          if (
            !vehicle.documents.license ||
            !vehicle.documents.insurance ||
            !vehicle.documents.registrationCertificate
          ) {
            setError(t("errors.requiredVehicleDocs", { index: i + 1 }));
            return false;
          }
        }
        return true;

      case 4: // Password
        if (!passwordData.password || !passwordData.confirmPassword) {
          setError(t("errors.passwordRequired"));
          return false;
        }
        if (passwordData.password !== passwordData.confirmPassword) {
          setFieldErrors({ confirmPassword: t("errors.passwordMismatch") });
          return false;
        }
        if (passwordStrength < 50) {
          setError(t("errors.weakPassword"));
          return false;
        }
        return true;

      case 5: // Terms
        if (!termsData.termsAccepted || !termsData.privacyAccepted) {
          setError(t("errors.acceptTerms"));
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const addVehicle = () => {
    setVehicles([
      ...vehicles,
      {
        registrationNumber: "",
        vehicleType: "",
        make: "",
        model: "",
        year: "",
        seatingCapacity: "",
        color: "",
        acType: "",
        condition: "",
        description: "",
        pricePerKm: "",
        pricePerDay: "",
        driverAllowance: "",
        amenities: [],
        photos: [],
        documents: {
          license: null,
          insurance: null,
          registrationCertificate: null,
        },
      },
    ]);
  };

  const removeVehicle = (index: number) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter((_, i) => i !== index));
    }
  };

  const updateVehicle = (
    index: number,
    field: keyof VehicleData,
    value: string,
  ) => {
    const updated = [...vehicles];
    updated[index] = { ...updated[index], [field]: value };
    setVehicles(updated);
  };

  // Add vehicle photos
  const addVehiclePhoto = (vehicleIndex: number, file: UploadedFile) => {
    const updated = [...vehicles];
    updated[vehicleIndex].photos = [...updated[vehicleIndex].photos, file];
    setVehicles(updated);
  };

  // Remove vehicle photo
  const removeVehiclePhoto = (vehicleIndex: number, photoIndex: number) => {
    const updated = [...vehicles];
    updated[vehicleIndex].photos = updated[vehicleIndex].photos.filter(
      (_, i) => i !== photoIndex,
    );
    setVehicles(updated);
  };

  const updateVehicleDocument = (
    vehicleIndex: number,
    docKey: keyof VehicleData["documents"],
    file: UploadedFile | null,
  ) => {
    const updated = [...vehicles];
    updated[vehicleIndex].documents[docKey] = file;
    setVehicles(updated);
  };

  const completeRegistration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const uploadRegistrationFile = async (
        file: File,
        category: "owner-documents" | "vehicle-documents" | "vehicle-photos",
        subfolder?: string,
      ) => {
        const result = await storageService.uploadRegistrationFile(
          file,
          category,
          subfolder,
        );
        return result.url;
      };

      const ownerDocs = [
        {
          type: "NIC" as const,
          file: nicDocument!.file,
        },
        {
          type: "PROFILE_PHOTO" as const,
          file: ownerPhoto!.file,
        },
      ];

      const ownerDocuments = await Promise.all(
        ownerDocs.map(async (doc) => ({
          type: doc.type,
          fileName: doc.file.name,
          fileSize: doc.file.size,
          mimeType: doc.file.type,
          url: await uploadRegistrationFile(
            doc.file,
            "owner-documents",
            doc.type,
          ),
        })),
      );

      // Prepare vehicles data
      const vehiclesData = await Promise.all(
        vehicles.map(async (v) => {
          const photos = await Promise.all(
            v.photos.map(async (p, idx) => ({
              fileName: p.file.name,
              fileSize: p.file.size,
              mimeType: p.file.type,
              isPrimary: idx === 0,
              url: await uploadRegistrationFile(p.file, "vehicle-photos"),
            })),
          );

          const documentFiles = [
            {
              type: "DRIVING_LICENSE" as const,
              file: v.documents.license!.file,
            },
            {
              type: "INSURANCE" as const,
              file: v.documents.insurance!.file,
            },
            {
              type: "REGISTRATION_CERTIFICATE" as const,
              file: v.documents.registrationCertificate!.file,
            },
          ];

          const documents = await Promise.all(
            documentFiles.map(async (doc) => ({
              type: doc.type,
              fileName: doc.file.name,
              fileSize: doc.file.size,
              mimeType: doc.file.type,
              url: await uploadRegistrationFile(
                doc.file,
                "vehicle-documents",
                doc.type,
              ),
            })),
          );

          return {
            registrationNumber: v.registrationNumber,
            vehicleType: v.vehicleType as
              | "ORDINARY"
              | "SEMI_LUXURY"
              | "LUXURY_AC",
            make: v.make,
            model: v.model,
            year: parseInt(v.year),
            seatingCapacity: parseInt(v.seatingCapacity),
            acType: v.acType as "FULL_AC" | "AC" | "NON_AC",
            photos,
            documents,
          };
        }),
      );

      // Prepare registration payload
      const registrationPayload: OwnerRegistrationInput = {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        email: personalInfo.email,
        phone: personalInfo.phone,
        nicNumber: personalInfo.nicNumber,
        password: passwordData.password,
        confirmPassword: passwordData.confirmPassword,
        address: {
          address: addressInfo.address,
          city: addressInfo.city,
          district: addressInfo.district,
          postalCode: addressInfo.postalCode || undefined,
          baseLocation: addressInfo.baseLocation,
        },
        ownerDocuments,
        vehicles: vehiclesData,
      };

      // Register the owner
      const response =
        await ownerRegistrationService.register(registrationPayload);

      // Store user and token in auth store
      login(response.user, response.accessToken);

      // Redirect to pending approval page (owners need admin verification)
      router.push(`/${locale}/owner/pending-approval`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isValidationError()) {
          setFieldErrors(err.getValidationErrors());
        } else {
          setError(err.message);
        }
      } else {
        setError(t("errors.unexpected"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStep)) return;

    try {
      setIsSendingOtp(true);
      await authService.sendOtp({
        identifier: personalInfo.email,
        purpose: "REGISTRATION",
      });
      setOtpModalOpen(true);
    } catch (otpError) {
      if (otpError instanceof ApiError) {
        setError(otpError.message);
      } else {
        setError(t("errors.otpSendFailed"));
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setIsVerifyingOtp(true);

    try {
      await authService.verifyOtp({
        identifier: personalInfo.email,
        code,
        purpose: "REGISTRATION",
      });

      setOtpModalOpen(false);
      await completeRegistration();
    } catch (verifyError) {
      if (verifyError instanceof ApiError) {
        throw new Error(verifyError.message);
      }

      throw new Error(t("errors.invalidOtp"));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    await authService.sendOtp({
      identifier: personalInfo.email,
      purpose: "REGISTRATION",
    });
  };

  // Show loading while checking auth state
  if (guardLoading || !isAuthorized) {
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-4">
            <div className="bg-white rounded-2xl shadow-lg p-4 border-2 border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900">
                  {t("title")}
                </h2>
                <span className="text-sm text-gray-600">
                  {t("progress.stepOf", {
                    current: currentStep,
                    total: TOTAL_STEPS,
                  })}
                </span>
              </div>

              <div className="relative">
                <div className="flex justify-between mb-2">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div
                      key={step}
                      className="flex flex-col items-center flex-1"
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all text-sm",
                          step <= currentStep
                            ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
                            : "bg-gray-200 text-gray-500",
                        )}
                      >
                        {step < currentStep ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          step
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-xs mt-2 font-medium text-center",
                          step <= currentStep
                            ? "text-primary"
                            : "text-gray-400",
                        )}
                      >
                        {step === 1 && t("progress.steps.personal")}
                        {step === 2 && t("progress.steps.address")}
                        {step === 3 && t("progress.steps.vehicle")}
                        {step === 4 && t("progress.steps.password")}
                        {step === 5 && t("progress.steps.terms")}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 -z-10">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/90 transition-all duration-500"
                    style={{
                      width: `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Left Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl shadow-2xl p-6 border-2 border-gray-100 sticky top-6">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {t("sidebar.title")}
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t("sidebar.subtitle")}
                  </p>
                </div>

                <div className="relative h-44 rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-primary/20 to-primary/10">
                  <Image
                    src="https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600"
                    alt={t("sidebar.imageAlt")}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-0.5">
                        {t("sidebar.benefits.noListingFees.title")}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {t("sidebar.benefits.noListingFees.description")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-0.5">
                        {t("sidebar.benefits.commission.title")}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {t("sidebar.benefits.commission.description")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-0.5">
                        {t("sidebar.benefits.dashboard.title")}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {t("sidebar.benefits.dashboard.description")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-2.5">
                    {t("sidebar.alreadyRegistered")}
                  </p>
                  <Link
                    href={`/${locale}/login`}
                    className="block w-full py-2.5 border-2 border-primary text-primary rounded-xl hover:bg-primary hover:text-white transition-all font-semibold text-center text-sm"
                  >
                    {t("sidebar.signIn")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Side - Multi-step Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 border-2 border-gray-100">
                <form onSubmit={handleSubmit}>
                  {error && (
                    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Step 1: Personal Information */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1.5">
                          {t("sections.personalInfo")}
                        </h2>
                        <p className="text-sm text-gray-600 mb-3">
                          {t("sections.personalInfoDescription")}
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.firstName.label")}
                          </label>
                          <div className="relative group">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                              type="text"
                              required
                              value={personalInfo.firstName}
                              onChange={(e) =>
                                setPersonalInfo({
                                  ...personalInfo,
                                  firstName: e.target.value,
                                })
                              }
                              placeholder={t("fields.firstName.placeholder")}
                              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.lastName.label")}
                          </label>
                          <div className="relative group">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                              type="text"
                              required
                              value={personalInfo.lastName}
                              onChange={(e) =>
                                setPersonalInfo({
                                  ...personalInfo,
                                  lastName: e.target.value,
                                })
                              }
                              placeholder={t("fields.lastName.placeholder")}
                              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.email.label")}
                          </label>
                          <div className="relative group">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                              type="email"
                              required
                              value={personalInfo.email}
                              onChange={(e) =>
                                setPersonalInfo({
                                  ...personalInfo,
                                  email: e.target.value,
                                })
                              }
                              placeholder={t("fields.email.placeholder")}
                              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                          {fieldErrors.email && (
                            <p className="mt-1 text-sm text-red-600">
                              {fieldErrors.email}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.phone.label")}
                          </label>
                          <div className="relative group">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                              type="tel"
                              required
                              value={personalInfo.phone}
                              onChange={(e) =>
                                setPersonalInfo({
                                  ...personalInfo,
                                  phone: e.target.value,
                                })
                              }
                              placeholder={t("fields.phone.placeholder")}
                              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.nicNumber.label")}
                          </label>
                          <div className="relative group">
                            <Contact className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                              type="text"
                              required
                              value={personalInfo.nicNumber}
                              onChange={(e) =>
                                setPersonalInfo({
                                  ...personalInfo,
                                  nicNumber: e.target.value,
                                })
                              }
                              placeholder={t("fields.nicNumber.placeholder")}
                              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Owner Photo and NIC Document */}
                      <div className="border-t-2 border-gray-100 pt-4">
                        <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <Camera className="text-primary" />
                          {t("sections.identityVerification")}
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                            {t("badges.required")}
                          </span>
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block font-semibold text-gray-800 mb-1.5">
                              {t("fields.ownerPhoto.label")}
                            </label>
                            <div
                              className={cn(
                                "border-2 border-dashed rounded-xl p-6 text-center transition-all",
                                ownerPhoto
                                  ? "border-green-400 bg-green-50"
                                  : "border-gray-300 hover:border-primary",
                              )}
                            >
                              {ownerPhoto ? (
                                <div className="relative">
                                  <img
                                    src={ownerPhoto.preview}
                                    alt={t("fields.ownerPhoto.alt")}
                                    className="w-24 h-24 object-cover rounded-full mx-auto"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setOwnerPhoto(null)}
                                    className="absolute top-0 right-1/4 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                                  >
                                    ×
                                  </button>
                                  <p className="mt-2 text-sm text-green-600 font-medium">
                                    {t("fields.ownerPhoto.uploaded")}
                                  </p>
                                </div>
                              ) : (
                                <label className="cursor-pointer">
                                  <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                  <p className="text-gray-600">
                                    {t("fields.ownerPhoto.uploadPrompt")}
                                  </p>
                                  <p className="text-sm text-gray-400 mt-1">
                                    {t("fields.ownerPhoto.uploadHelp")}
                                  </p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const preview =
                                          URL.createObjectURL(file);
                                        setOwnerPhoto({ file, preview });
                                        setFieldErrors((prev) => ({
                                          ...prev,
                                          ownerPhoto: "",
                                        }));
                                      }
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                            {fieldErrors.ownerPhoto && (
                              <p className="mt-2 text-sm text-red-600">
                                {fieldErrors.ownerPhoto}
                              </p>
                            )}
                          </div>

                          <FileUpload
                            label={t("fields.nicDocument.label")}
                            required
                            value={nicDocument}
                            onChange={(file) => {
                              setNicDocument(file);
                              setFieldErrors((prev) => ({
                                ...prev,
                                nicDocument: "",
                              }));
                            }}
                            helpText={t("fields.nicDocument.helpText")}
                            error={fieldErrors.nicDocument}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Address & Base Location */}
                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1.5">
                          {t("sections.addressInfo")}
                        </h2>
                        <p className="text-sm text-gray-600 mb-3">
                          {t("sections.addressInfoDescription")}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.address.label")}
                        </label>
                        <div className="relative group">
                          <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <textarea
                            required
                            value={addressInfo.address}
                            onChange={(e) =>
                              setAddressInfo({
                                ...addressInfo,
                                address: e.target.value,
                              })
                            }
                            rows={3}
                            placeholder={t("fields.address.placeholder")}
                            className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white resize-none"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.city.label")}
                          </label>
                          <input
                            type="text"
                            required
                            value={addressInfo.city}
                            onChange={(e) =>
                              setAddressInfo({
                                ...addressInfo,
                                city: e.target.value,
                              })
                            }
                            placeholder={t("fields.city.placeholder")}
                            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.district.label")}
                          </label>
                          <select
                            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors cursor-pointer appearance-none"
                            required
                            value={addressInfo.district}
                            onChange={(e) =>
                              setAddressInfo({
                                ...addressInfo,
                                district: e.target.value,
                              })
                            }
                          >
                            <option value="">
                              {t("fields.district.select")}
                            </option>
                            {publicOptions.districts.map((district) => (
                              <option
                                key={district.value}
                                value={district.value}
                              >
                                {district.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.postalCode.label")}
                          </label>
                          <input
                            type="text"
                            value={addressInfo.postalCode}
                            onChange={(e) =>
                              setAddressInfo({
                                ...addressInfo,
                                postalCode: e.target.value,
                              })
                            }
                            placeholder={t("fields.postalCode.placeholder")}
                            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.baseLocation.label")}
                        </label>
                        <input
                          type="text"
                          required
                          value={addressInfo.baseLocation}
                          onChange={(e) =>
                            setAddressInfo({
                              ...addressInfo,
                              baseLocation: e.target.value,
                            })
                          }
                          placeholder={t("fields.baseLocation.placeholder")}
                          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                        />
                        <p className="text-sm text-gray-500 mt-2">
                          {t("fields.baseLocation.helpText")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Vehicle Information & Documents */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1.5">
                          {t("sections.vehicleInfo")}
                        </h2>
                        <p className="text-gray-600 mb-2">
                          {t("sections.vehicleInfoDescription")}
                        </p>
                        <p className="text-sm text-primary font-medium">
                          {t("sections.vehicleInfoNote")}
                        </p>
                      </div>

                      {vehicles.map((vehicle, index) => (
                        <div
                          key={index}
                          className="border-2 border-gray-200 rounded-2xl p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                              <Bus className="text-primary" />
                              {t("vehicle.cardTitle", { index: index + 1 })}
                            </h3>
                            {vehicles.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeVehicle(index)}
                                className="text-red-500 hover:text-red-700 font-semibold text-sm"
                              >
                                {t("vehicle.remove")}
                              </button>
                            )}
                          </div>

                          {/* Vehicle Details */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.registrationNumber.label")}
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicle.registrationNumber}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "registrationNumber",
                                    e.target.value,
                                  )
                                }
                                placeholder={t(
                                  "fields.registrationNumber.placeholder",
                                )}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.vehicleType.label")}
                              </label>
                              <select
                                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors appearance-none cursor-pointer"
                                required
                                value={vehicle.vehicleType}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "vehicleType",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">
                                  {t("fields.vehicleType.select")}
                                </option>
                                {publicOptions.vehicleTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.make.label")}
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicle.make}
                                onChange={(e) =>
                                  updateVehicle(index, "make", e.target.value)
                                }
                                placeholder={t("fields.make.placeholder")}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.model.label")}
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicle.model}
                                onChange={(e) =>
                                  updateVehicle(index, "model", e.target.value)
                                }
                                placeholder={t("fields.model.placeholder")}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.year.label")}
                              </label>
                              <input
                                type="number"
                                required
                                value={vehicle.year}
                                onChange={(e) =>
                                  updateVehicle(index, "year", e.target.value)
                                }
                                placeholder={t("fields.year.placeholder")}
                                min="1990"
                                max={new Date().getFullYear()}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.seatingCapacity.label")}
                              </label>
                              <input
                                type="number"
                                required
                                value={vehicle.seatingCapacity}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "seatingCapacity",
                                    e.target.value,
                                  )
                                }
                                placeholder={t(
                                  "fields.seatingCapacity.placeholder",
                                )}
                                min="1"
                                max="100"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.acType.label")}
                              </label>
                              <select
                                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors cursor-pointer appearance-none"
                                required
                                value={vehicle.acType}
                                onChange={(e) =>
                                  updateVehicle(index, "acType", e.target.value)
                                }
                              >
                                <option value="">
                                  {t("fields.acType.select")}
                                </option>
                                {publicOptions.acTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.color.label")}
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicle.color}
                                onChange={(e) =>
                                  updateVehicle(index, "color", e.target.value)
                                }
                                placeholder={t("fields.color.placeholder")}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.condition.label")}
                              </label>
                              <select
                                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors cursor-pointer appearance-none"
                                required
                                value={vehicle.condition}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "condition",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">
                                  {t("fields.condition.select")}
                                </option>
                                {publicOptions.conditions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.pricePerKilometer.label")}
                              </label>
                              <input
                                type="number"
                                required
                                value={vehicle.pricePerKm}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "pricePerKm",
                                    e.target.value,
                                  )
                                }
                                placeholder={t(
                                  "fields.pricePerKilometer.placeholder",
                                )}
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t("fields.pricePerKilometer.helpText")}
                              </p>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.pricePerDay.label")}
                              </label>
                              <input
                                type="number"
                                required
                                value={vehicle.pricePerDay}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "pricePerDay",
                                    e.target.value,
                                  )
                                }
                                placeholder={t(
                                  "fields.pricePerDay.placeholder",
                                )}
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t("fields.pricePerDay.helpText")}
                              </p>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-1.5">
                                {t("fields.driverAllowance.label")}
                              </label>
                              <input
                                type="number"
                                value={vehicle.driverAllowance}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "driverAllowance",
                                    e.target.value,
                                  )
                                }
                                placeholder={t(
                                  "fields.driverAllowance.placeholder",
                                )}
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t("fields.driverAllowance.helpText")}
                              </p>
                            </div>
                          </div>

                          {/* Description */}
                          <div className="mt-4">
                            <label className="block font-semibold text-gray-800 mb-1.5">
                              {t("fields.description.label")}
                            </label>
                            <textarea
                              value={vehicle.description}
                              onChange={(e) =>
                                updateVehicle(
                                  index,
                                  "description",
                                  e.target.value,
                                )
                              }
                              rows={4}
                              placeholder={t("fields.description.placeholder")}
                              maxLength={500}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white resize-none"
                            />
                            <p className="text-xs text-gray-500 mt-1 text-right">
                              {t("vehicle.descriptionCount", {
                                count: vehicle.description.length,
                              })}
                            </p>
                          </div>

                          {/* Amenities Selection */}
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-bold text-gray-900 mb-3">
                              {t("vehicle.amenitiesTitle")}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {publicOptions.amenities.map((amenity) => {
                                const isSelected = vehicle.amenities.includes(
                                  amenity.id,
                                );
                                return (
                                  <label
                                    key={amenity.id}
                                    className={`relative flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-gray-200 hover:border-gray-300"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const updated = [...vehicles];
                                        if (e.target.checked) {
                                          updated[index].amenities = [
                                            ...updated[index].amenities,
                                            amenity.id,
                                          ];
                                        } else {
                                          updated[index].amenities = updated[
                                            index
                                          ].amenities.filter(
                                            (a) => a !== amenity.id,
                                          );
                                        }
                                        setVehicles(updated);
                                      }}
                                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                      {amenity.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {/* Vehicle Photos */}
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                              <ImageUp className="text-primary" />
                              {t("vehicle.photosTitle")}
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                                {t("badges.optional")}
                              </span>
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {vehicle.photos.map((photo, photoIndex) => (
                                <div
                                  key={photoIndex}
                                  className="relative group aspect-video rounded-xl overflow-hidden border-2 border-gray-200"
                                >
                                  <img
                                    src={photo.preview}
                                    alt={t("vehicle.photoAlt", {
                                      vehicleIndex: index + 1,
                                      photoIndex: photoIndex + 1,
                                    })}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeVehiclePhoto(index, photoIndex)
                                    }
                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {vehicle.photos.length < 8 && (
                                <label className="aspect-video border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                                  <Camera className="w-8 h-8 text-gray-400 mb-2" />
                                  <span className="text-sm text-gray-500">
                                    {t("vehicle.addPhoto")}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const preview =
                                          URL.createObjectURL(file);
                                        addVehiclePhoto(index, {
                                          file,
                                          preview,
                                        });
                                      }
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                              {t("vehicle.photosHelpText")}
                            </p>
                          </div>

                          {/* Document Uploads */}
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                              <FileText className="text-primary" />
                              {t("vehicle.documentsTitle")}
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                                {t("badges.required")}
                              </span>
                            </h4>

                            {/* Document Guidelines */}
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-5">
                              <div className="flex gap-3">
                                <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                                <div>
                                  <h3 className="font-bold text-gray-900 mb-2">
                                    {t("vehicle.documentGuidelines.title")}
                                  </h3>
                                  <ul className="space-y-1 text-sm text-gray-700">
                                    <li>
                                      •{" "}
                                      {t(
                                        "vehicle.documentGuidelines.points.clear",
                                      )}
                                    </li>
                                    <li>
                                      •{" "}
                                      {t(
                                        "vehicle.documentGuidelines.points.valid",
                                      )}
                                    </li>
                                    <li>
                                      •{" "}
                                      {t(
                                        "vehicle.documentGuidelines.points.formats",
                                      )}
                                    </li>
                                    <li>
                                      •{" "}
                                      {t(
                                        "vehicle.documentGuidelines.points.verificationTime",
                                      )}
                                    </li>
                                  </ul>
                                </div>
                              </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                              <FileUpload
                                label={t(
                                  "fields.documents.drivingLicense.label",
                                )}
                                required
                                value={vehicle.documents.license}
                                onChange={(file) =>
                                  updateVehicleDocument(index, "license", file)
                                }
                                helpText={t(
                                  "fields.documents.drivingLicense.helpText",
                                )}
                              />

                              <FileUpload
                                label={t(
                                  "fields.documents.insuranceCertificate.label",
                                )}
                                required
                                value={vehicle.documents.insurance}
                                onChange={(file) =>
                                  updateVehicleDocument(
                                    index,
                                    "insurance",
                                    file,
                                  )
                                }
                                helpText={t(
                                  "fields.documents.insuranceCertificate.helpText",
                                )}
                              />

                              <FileUpload
                                label={t(
                                  "fields.documents.registrationCertificate.label",
                                )}
                                required
                                value={
                                  vehicle.documents.registrationCertificate
                                }
                                onChange={(file) =>
                                  updateVehicleDocument(
                                    index,
                                    "registrationCertificate",
                                    file,
                                  )
                                }
                                helpText={t(
                                  "fields.documents.registrationCertificate.helpText",
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addVehicle}
                        className="w-full py-3 border-2 border-dashed border-primary text-primary rounded-xl hover:bg-primary/5 transition-all font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        <Bus />
                        {t("vehicle.addAnother")}
                      </button>
                    </div>
                  )}

                  {/* Step 4: Create Password */}
                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1.5">
                          {t("sections.password")}
                        </h2>
                        <p className="text-sm text-gray-600 mb-3">
                          {t("sections.passwordDescription")}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.password.label")}
                          </label>
                          <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                              type={showPassword ? "text" : "password"}
                              required
                              value={passwordData.password}
                              onChange={(e) => {
                                setPasswordData({
                                  ...passwordData,
                                  password: e.target.value,
                                });
                                calculatePasswordStrength(e.target.value);
                              }}
                              placeholder={t("fields.password.placeholder")}
                              className="w-full pl-10 pr-10 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {passwordData.password && (
                            <div className="mt-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-gray-600">
                                  {t("passwordStrength.label")}
                                </span>
                                <span
                                  className={`text-sm font-semibold ${
                                    passwordStrength < 50
                                      ? "text-red-600"
                                      : passwordStrength < 75
                                        ? "text-yellow-600"
                                        : "text-green-600"
                                  }`}
                                >
                                  {getPasswordStrengthText()}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                                  style={{ width: `${passwordStrength}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.confirmPassword.label")}
                          </label>
                          <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              required
                              value={passwordData.confirmPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  confirmPassword: e.target.value,
                                })
                              }
                              placeholder={t(
                                "fields.confirmPassword.placeholder",
                              )}
                              className="w-full pl-10 pr-10 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {fieldErrors.confirmPassword && (
                            <p className="mt-1 text-sm text-red-600">
                              {fieldErrors.confirmPassword}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                        <h3 className="font-bold text-sm text-gray-900 mb-2">
                          {t("passwordRequirements.title")}
                        </h3>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-center gap-2">
                            <CheckCircle
                              className={cn(
                                "w-4 h-4",
                                passwordData.password.length >= 8
                                  ? "text-green-500"
                                  : "text-gray-400",
                              )}
                            />
                            {t("passwordRequirements.minLength")}
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle
                              className={cn(
                                "w-4 h-4",
                                /[a-z]/.test(passwordData.password) &&
                                  /[A-Z]/.test(passwordData.password)
                                  ? "text-green-500"
                                  : "text-gray-400",
                              )}
                            />
                            {t("passwordRequirements.upperLower")}
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle
                              className={cn(
                                "w-4 h-4",
                                /\d/.test(passwordData.password)
                                  ? "text-green-500"
                                  : "text-gray-400",
                              )}
                            />
                            {t("passwordRequirements.number")}
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle
                              className={cn(
                                "w-4 h-4",
                                /[^a-zA-Z\d]/.test(passwordData.password)
                                  ? "text-green-500"
                                  : "text-gray-400",
                              )}
                            />
                            {t("passwordRequirements.special")}
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Terms and Conditions */}
                  {currentStep === 5 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1.5">
                          {t("sections.terms")}
                        </h2>
                        <p className="text-sm text-gray-600 mb-3">
                          {t("sections.termsDescription")}
                        </p>
                      </div>

                      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                        <h3 className="font-bold text-sm text-gray-900 mb-2">
                          {t("terms.summaryTitle")}
                        </h3>
                        <div className="space-y-3 text-gray-700">
                          <p>{t("terms.summaryIntro")}</p>
                          <ul className="list-disc pl-5 space-y-2">
                            <li>{t("terms.points.accurateInfo")}</li>
                            <li>{t("terms.points.licenses")}</li>
                            <li>{t("terms.points.commission")}</li>
                            <li>{t("terms.points.respond")}</li>
                            <li>{t("terms.points.safety")}</li>
                            <li>{t("terms.points.compliance")}</li>
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={termsData.termsAccepted}
                            onChange={(e) =>
                              setTermsData({
                                ...termsData,
                                termsAccepted: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900 leading-relaxed">
                            {t("terms.acceptPrefix")}{" "}
                            <Link
                              href={`/${locale}/terms`}
                              className="text-primary hover:underline font-semibold"
                            >
                              {t("terms.termsLink")}
                            </Link>{" "}
                            *
                          </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={termsData.privacyAccepted}
                            onChange={(e) =>
                              setTermsData({
                                ...termsData,
                                privacyAccepted: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900 leading-relaxed">
                            {t("terms.privacyPrefix")}{" "}
                            <Link
                              href={`/${locale}/privacy`}
                              className="text-primary hover:underline font-semibold"
                            >
                              {t("terms.privacyLink")}
                            </Link>{" "}
                            *
                          </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={termsData.dataProcessingAccepted}
                            onChange={(e) =>
                              setTermsData({
                                ...termsData,
                                dataProcessingAccepted: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900 leading-relaxed">
                            {t("terms.dataProcessing")}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex gap-3 mt-5 pt-4 border-t-2 border-gray-100">
                    {currentStep > 1 && (
                      <button
                        type="button"
                        onClick={prevStep}
                        className="flex items-center gap-2 px-5 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold text-sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t("actions.previous")}
                      </button>
                    )}

                    {currentStep < TOTAL_STEPS ? (
                      <button
                        type="button"
                        onClick={nextStep}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/90 text-white py-3 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all font-bold text-base"
                      >
                        {t("actions.continue")}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isLoading || isSendingOtp}
                        className="flex-1 bg-gradient-to-r from-primary to-primary/90 text-white py-3 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isLoading || isSendingOtp ? (
                          <LoadingSpinner size="sm" className="text-white" />
                        ) : (
                          t("actions.completeRegistration")
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <OtpVerificationModal
        isOpen={otpModalOpen}
        destination={personalInfo.email}
        isSending={isSendingOtp}
        isVerifying={isVerifyingOtp}
        onClose={() => setOtpModalOpen(false)}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
      />
    </MainLayout>
  );
}
