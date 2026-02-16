"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaBus,
  FaFileAlt,
  FaIdCard,
  FaCamera,
  FaImage,
} from "react-icons/fa";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, FileUpload, type UploadedFile } from "@/components/ui";
import { ownerRegistrationService, storageService, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store";
import { useGuestGuard } from "@/hooks";
import { cn } from "@/lib/utils/cn";
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

const VEHICLE_TYPES = [
  { value: "luxury", label: "Luxury Coach" },
  { value: "semi-luxury", label: "Semi-Luxury" },
  { value: "standard", label: "Standard Bus" },
  { value: "mini", label: "Mini Bus" },
];

const AC_TYPES = [
  { value: "full-ac", label: "Full AC" },
  { value: "ac", label: "AC" },
  { value: "non-ac", label: "Non-AC" },
];

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const AMENITIES_LIST = [
  { id: "wifi", label: "WiFi" },
  { id: "ac", label: "Air Conditioning" },
  { id: "music", label: "Music System" },
  { id: "usb", label: "USB Charging" },
  { id: "tv", label: "TV/Entertainment" },
  { id: "reclining", label: "Reclining Seats" },
  { id: "reading", label: "Reading Lights" },
  { id: "gps", label: "GPS Tracking" },
];

const DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Mullaitivu",
  "Vavuniya",
  "Trincomalee",
  "Batticaloa",
  "Ampara",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

export default function OwnerRegistrationPage() {
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
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    if (passwordStrength < 50) return "Weak";
    if (passwordStrength < 75) return "Medium";
    return "Strong";
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
          setError("Please fill in all required fields");
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)) {
          setFieldErrors({ email: "Please enter a valid email address" });
          return false;
        }
        if (!ownerPhoto || !nicDocument) {
          setFieldErrors({
            ownerPhoto: !ownerPhoto ? "Profile photo is required" : "",
            nicDocument: !nicDocument ? "NIC document is required" : "",
          });
          setError("Please upload the required identity documents");
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
          setError("Please fill in all required address fields");
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
            setError(`Please fill in all required fields for Vehicle ${i + 1}`);
            return false;
          }
          if (
            !vehicle.documents.license ||
            !vehicle.documents.insurance ||
            !vehicle.documents.registrationCertificate
          ) {
            setError(
              `Please upload all required documents for Vehicle ${i + 1}`,
            );
            return false;
          }
        }
        return true;

      case 4: // Password
        if (!passwordData.password || !passwordData.confirmPassword) {
          setError("Please enter and confirm your password");
          return false;
        }
        if (passwordData.password !== passwordData.confirmPassword) {
          setFieldErrors({ confirmPassword: "Passwords do not match" });
          return false;
        }
        if (passwordStrength < 50) {
          setError("Please choose a stronger password");
          return false;
        }
        return true;

      case 5: // Terms
        if (
          !termsData.termsAccepted ||
          !termsData.privacyAccepted ||
          !termsData.dataProcessingAccepted
        ) {
          setError("Please accept all terms and conditions");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    setError(null);

    try {
      const uploadRegistrationFile = async (
        file: File,
        category: "owner-documents" | "vehicle-documents" | "vehicle-photos",
      ) => {
        const result = await storageService.uploadRegistrationFile(
          file,
          category,
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
          url: await uploadRegistrationFile(doc.file, "owner-documents"),
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
              url: await uploadRegistrationFile(doc.file, "vehicle-documents"),
            })),
          );

          return {
            registrationNumber: v.registrationNumber,
            vehicleType: v.vehicleType as
              | "luxury"
              | "semi-luxury"
              | "standard"
              | "mini",
            make: v.make,
            model: v.model,
            year: parseInt(v.year),
            seatingCapacity: parseInt(v.seatingCapacity),
            acType: v.acType as "full-ac" | "ac" | "non-ac",
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
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Bus Owner Registration
                </h2>
                <span className="text-lg text-gray-600">
                  Step {currentStep} of {TOTAL_STEPS}
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
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                          step <= currentStep
                            ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
                            : "bg-gray-200 text-gray-500",
                        )}
                      >
                        {step < currentStep ? (
                          <FaCheckCircle className="w-5 h-5" />
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
                        {step === 1 && "Personal"}
                        {step === 2 && "Address"}
                        {step === 3 && "Vehicle"}
                        {step === 4 && "Password"}
                        {step === 5 && "Terms"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 -z-10">
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

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl shadow-2xl p-8 border-2 border-gray-100 sticky top-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    Become a Partner
                  </h2>
                  <p className="text-gray-600 leading-relaxed">
                    List your buses and reach thousands of customers across Sri
                    Lanka
                  </p>
                </div>

                <div className="relative h-64 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-primary/20 to-primary/10">
                  <Image
                    src="https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600"
                    alt="Bus Business"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaCheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">
                        No Listing Fees
                      </h3>
                      <p className="text-sm text-gray-600">
                        List unlimited vehicles for free
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaCheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">
                        10% Commission
                      </h3>
                      <p className="text-sm text-gray-600">
                        Pay only on confirmed bookings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaCheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">
                        Business Dashboard
                      </h3>
                      <p className="text-sm text-gray-600">
                        Track bookings and earnings
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">
                    Already registered?
                  </p>
                  <Link
                    href={`/${locale}/login`}
                    className="block w-full py-3 border-2 border-primary text-primary rounded-xl hover:bg-primary hover:text-white transition-all font-semibold text-center"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Side - Multi-step Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border-2 border-gray-100">
                <form onSubmit={handleSubmit}>
                  {error && (
                    <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Step 1: Personal Information */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Personal Information
                        </h2>
                        <p className="text-gray-600 mb-6">
                          Tell us about yourself
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            First Name *
                          </label>
                          <div className="relative group">
                            <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
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
                              placeholder="Enter first name"
                              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            Last Name *
                          </label>
                          <div className="relative group">
                            <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
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
                              placeholder="Enter last name"
                              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            Email Address *
                          </label>
                          <div className="relative group">
                            <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
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
                              placeholder="your@email.com"
                              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                          {fieldErrors.email && (
                            <p className="mt-1 text-sm text-red-600">
                              {fieldErrors.email}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            Phone Number *
                          </label>
                          <div className="relative group">
                            <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
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
                              placeholder="+94 XX XXX XXXX"
                              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            NIC Number *
                          </label>
                          <div className="relative group">
                            <FaIdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
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
                              placeholder="e.g., 199012345678 or 901234567V"
                              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Owner Photo and NIC Document */}
                      <div className="border-t-2 border-gray-100 pt-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <FaCamera className="text-primary" />
                          Identity Verification
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                            Required
                          </span>
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <label className="block font-semibold text-gray-800 mb-2">
                              Profile Photo *
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
                                    alt="Owner photo"
                                    className="w-32 h-32 object-cover rounded-full mx-auto"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setOwnerPhoto(null)}
                                    className="absolute top-0 right-1/4 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                                  >
                                    ×
                                  </button>
                                  <p className="mt-2 text-sm text-green-600 font-medium">
                                    Photo uploaded
                                  </p>
                                </div>
                              ) : (
                                <label className="cursor-pointer">
                                  <FaCamera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                  <p className="text-gray-600">
                                    Click to upload your photo
                                  </p>
                                  <p className="text-sm text-gray-400 mt-1">
                                    JPG, PNG (Max 5MB)
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
                            label="NIC Document"
                            required
                            value={nicDocument}
                            onChange={(file) => {
                              setNicDocument(file);
                              setFieldErrors((prev) => ({
                                ...prev,
                                nicDocument: "",
                              }));
                            }}
                            helpText="Upload a clear copy of your NIC (front & back)"
                            error={fieldErrors.nicDocument}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Address & Base Location */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Address & Base Location
                        </h2>
                        <p className="text-gray-600 mb-6">
                          Where is your base location?
                        </p>
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          Address *
                        </label>
                        <div className="relative group">
                          <FaMapMarkerAlt className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
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
                            placeholder="Enter your full address"
                            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white resize-none"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            City *
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
                            placeholder="Enter city"
                            className="w-full px-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            District *
                          </label>
                          <select
                            required
                            value={addressInfo.district}
                            onChange={(e) =>
                              setAddressInfo({
                                ...addressInfo,
                                district: e.target.value,
                              })
                            }
                            className="w-full px-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none bg-gray-50 focus:bg-white cursor-pointer"
                          >
                            <option value="">Select district</option>
                            {DISTRICTS.map((district) => (
                              <option
                                key={district}
                                value={district.toLowerCase()}
                              >
                                {district}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            Postal Code
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
                            placeholder="Postal code"
                            className="w-full px-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          Base Location for Buses *
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
                          placeholder="e.g., Colombo, Kandy"
                          className="w-full px-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                        />
                        <p className="text-sm text-gray-500 mt-2">
                          This will be shown to customers as your primary
                          service area
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Vehicle Information & Documents */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Vehicle Information & Documents
                        </h2>
                        <p className="text-gray-600 mb-2">
                          Add at least one bus to complete registration
                        </p>
                        <p className="text-sm text-primary font-medium">
                          Note: You must add at least one vehicle with all
                          required documents
                        </p>
                      </div>

                      {vehicles.map((vehicle, index) => (
                        <div
                          key={index}
                          className="border-2 border-gray-200 rounded-2xl p-6 space-y-6"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                              <FaBus className="text-primary" />
                              Vehicle {index + 1}
                            </h3>
                            {vehicles.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeVehicle(index)}
                                className="text-red-500 hover:text-red-700 font-semibold text-sm"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {/* Vehicle Details */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Registration Number *
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
                                placeholder="ABC-1234"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Vehicle Type *
                              </label>
                              <select
                                required
                                value={vehicle.vehicleType}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "vehicleType",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none bg-gray-50 focus:bg-white cursor-pointer"
                              >
                                <option value="">Select type</option>
                                {VEHICLE_TYPES.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Make *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicle.make}
                                onChange={(e) =>
                                  updateVehicle(index, "make", e.target.value)
                                }
                                placeholder="e.g., Ashok Leyland"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Model *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicle.model}
                                onChange={(e) =>
                                  updateVehicle(index, "model", e.target.value)
                                }
                                placeholder="e.g., 2820"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Year *
                              </label>
                              <input
                                type="number"
                                required
                                value={vehicle.year}
                                onChange={(e) =>
                                  updateVehicle(index, "year", e.target.value)
                                }
                                placeholder="2022"
                                min="1990"
                                max={new Date().getFullYear()}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Seating Capacity *
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
                                placeholder="45"
                                min="1"
                                max="100"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                AC Type *
                              </label>
                              <select
                                required
                                value={vehicle.acType}
                                onChange={(e) =>
                                  updateVehicle(index, "acType", e.target.value)
                                }
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none bg-gray-50 focus:bg-white cursor-pointer"
                              >
                                <option value="">Select AC type</option>
                                {AC_TYPES.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Color *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicle.color}
                                onChange={(e) =>
                                  updateVehicle(index, "color", e.target.value)
                                }
                                placeholder="White"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Condition *
                              </label>
                              <select
                                required
                                value={vehicle.condition}
                                onChange={(e) =>
                                  updateVehicle(
                                    index,
                                    "condition",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none bg-gray-50 focus:bg-white cursor-pointer"
                              >
                                <option value="">Select condition</option>
                                {CONDITION_OPTIONS.map((option) => (
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
                              <label className="block font-semibold text-gray-800 mb-2">
                                Price per Kilometer *
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
                                placeholder="85"
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                LKR per kilometer
                              </p>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Price per Day *
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
                                placeholder="25000"
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                LKR per day
                              </p>
                            </div>

                            <div>
                              <label className="block font-semibold text-gray-800 mb-2">
                                Driver Allowance
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
                                placeholder="5000"
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Daily driver allowance (LKR)
                              </p>
                            </div>
                          </div>

                          {/* Description */}
                          <div className="mt-4">
                            <label className="block font-semibold text-gray-800 mb-2">
                              Description
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
                              placeholder="Describe your vehicle, seating layout, and any special features..."
                              maxLength={500}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white resize-none"
                            />
                            <p className="text-xs text-gray-500 mt-1 text-right">
                              {vehicle.description.length}/500 characters
                            </p>
                          </div>

                          {/* Amenities Selection */}
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">
                              Amenities
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {AMENITIES_LIST.map((amenity) => {
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
                            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <FaImage className="text-primary" />
                              Vehicle Photos
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                                Optional
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
                                    alt={`Vehicle ${index + 1} photo ${photoIndex + 1}`}
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
                                  <FaCamera className="w-8 h-8 text-gray-400 mb-2" />
                                  <span className="text-sm text-gray-500">
                                    Add Photo
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
                              Upload up to 8 photos of your vehicle (interior &
                              exterior)
                            </p>
                          </div>

                          {/* Document Uploads */}
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <FaFileAlt className="text-primary" />
                              Vehicle Documents
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                                Required
                              </span>
                            </h4>

                            <div className="grid md:grid-cols-3 gap-4">
                              <FileUpload
                                label="Driving License"
                                required
                                value={vehicle.documents.license}
                                onChange={(file) =>
                                  updateVehicleDocument(index, "license", file)
                                }
                                helpText="Valid heavy vehicle driving license"
                              />

                              <FileUpload
                                label="Insurance Certificate"
                                required
                                value={vehicle.documents.insurance}
                                onChange={(file) =>
                                  updateVehicleDocument(
                                    index,
                                    "insurance",
                                    file,
                                  )
                                }
                                helpText="Current vehicle insurance document"
                              />

                              <FileUpload
                                label="Certificate of Registration"
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
                                helpText="Vehicle registration certificate (CR)"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addVehicle}
                        className="w-full py-4 border-2 border-dashed border-primary text-primary rounded-xl hover:bg-primary/5 transition-all font-semibold flex items-center justify-center gap-2"
                      >
                        <FaBus />
                        Add Another Vehicle
                      </button>

                      {/* Document Guidelines */}
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                        <div className="flex gap-3">
                          <FaFileAlt className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                          <div>
                            <h3 className="font-bold text-gray-900 mb-2">
                              Document Guidelines
                            </h3>
                            <ul className="space-y-1 text-sm text-gray-700">
                              <li>
                                • All documents must be clear and readable
                              </li>
                              <li>• Documents should be current and valid</li>
                              <li>
                                • Accepted formats: PDF, JPG, PNG (Max 5MB)
                              </li>
                              <li>
                                • Verification typically takes 2-3 business days
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Create Password */}
                  {currentStep === 4 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Create Password
                        </h2>
                        <p className="text-gray-600 mb-6">
                          Secure your account with a strong password
                        </p>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            Password *
                          </label>
                          <div className="relative group">
                            <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
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
                              placeholder="Create a strong password"
                              className="w-full pl-12 pr-12 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                            >
                              {showPassword ? (
                                <FaEyeSlash className="w-5 h-5" />
                              ) : (
                                <FaEye className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {passwordData.password && (
                            <div className="mt-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-gray-600">
                                  Password Strength:
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
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            Confirm Password *
                          </label>
                          <div className="relative group">
                            <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
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
                              placeholder="Re-enter your password"
                              className="w-full pl-12 pr-12 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                            >
                              {showConfirmPassword ? (
                                <FaEyeSlash className="w-5 h-5" />
                              ) : (
                                <FaEye className="w-5 h-5" />
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

                      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                        <h3 className="font-bold text-gray-900 mb-3">
                          Password Requirements:
                        </h3>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-center gap-2">
                            <FaCheckCircle
                              className={cn(
                                "w-4 h-4",
                                passwordData.password.length >= 8
                                  ? "text-green-500"
                                  : "text-gray-400",
                              )}
                            />
                            At least 8 characters long
                          </li>
                          <li className="flex items-center gap-2">
                            <FaCheckCircle
                              className={cn(
                                "w-4 h-4",
                                /[a-z]/.test(passwordData.password) &&
                                  /[A-Z]/.test(passwordData.password)
                                  ? "text-green-500"
                                  : "text-gray-400",
                              )}
                            />
                            Include uppercase and lowercase letters
                          </li>
                          <li className="flex items-center gap-2">
                            <FaCheckCircle
                              className={cn(
                                "w-4 h-4",
                                /\d/.test(passwordData.password)
                                  ? "text-green-500"
                                  : "text-gray-400",
                              )}
                            />
                            Include at least one number
                          </li>
                          <li className="flex items-center gap-2">
                            <FaCheckCircle
                              className={cn(
                                "w-4 h-4",
                                /[^a-zA-Z\d]/.test(passwordData.password)
                                  ? "text-green-500"
                                  : "text-gray-400",
                              )}
                            />
                            Include at least one special character
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Terms and Conditions */}
                  {currentStep === 5 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          Terms & Conditions
                        </h2>
                        <p className="text-gray-600 mb-6">
                          Please review and accept our terms
                        </p>
                      </div>

                      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 max-h-64 overflow-y-auto">
                        <h3 className="font-bold text-gray-900 mb-3">
                          Partnership Agreement Summary
                        </h3>
                        <div className="space-y-3 text-gray-700">
                          <p>
                            By registering as a bus owner on TraveNest, you
                            agree to:
                          </p>
                          <ul className="list-disc pl-5 space-y-2">
                            <li>
                              Provide accurate and up-to-date information about
                              your vehicles
                            </li>
                            <li>
                              Maintain all necessary licenses, permits, and
                              insurance
                            </li>
                            <li>Pay a 10% commission on confirmed bookings</li>
                            <li>
                              Respond to quotation requests within 24 hours
                            </li>
                            <li>
                              Maintain vehicle condition and safety standards
                            </li>
                            <li>
                              Comply with all local transportation laws and
                              regulations
                            </li>
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
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-1"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900 leading-relaxed">
                            I accept the{" "}
                            <Link
                              href={`/${locale}/terms`}
                              className="text-primary hover:underline font-semibold"
                            >
                              Terms and Conditions
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
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-1"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900 leading-relaxed">
                            I have read and agree to the{" "}
                            <Link
                              href={`/${locale}/privacy`}
                              className="text-primary hover:underline font-semibold"
                            >
                              Privacy Policy
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
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-1"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900 leading-relaxed">
                            I consent to data processing for business operations
                            and marketing purposes *
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex gap-4 mt-8 pt-6 border-t-2 border-gray-100">
                    {currentStep > 1 && (
                      <button
                        type="button"
                        onClick={prevStep}
                        className="flex items-center gap-2 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
                      >
                        <FaChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                    )}

                    {currentStep < TOTAL_STEPS ? (
                      <button
                        type="button"
                        onClick={nextStep}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/90 text-white py-4 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all font-bold text-lg"
                      >
                        Continue
                        <FaChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-primary to-primary/90 text-white py-4 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <LoadingSpinner size="sm" className="text-white" />
                        ) : (
                          "Complete Registration"
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
    </MainLayout>
  );
}
