"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, FileUpload } from "@/components/ui";
import type { UploadedFile } from "@/components/ui/FileUpload";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { vehicleService, ApiError } from "@/lib/api";
import { FaArrowLeft, FaUpload, FaCheckCircle, FaTimes } from "react-icons/fa";

type FormSection = "basic" | "pricing" | "photos" | "documents" | "amenities";

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
}

export default function EditVehiclePage() {
  const { user } = useAuthStore();
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;
  const [activeSection, setActiveSection] = useState<FormSection>("basic");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [primaryPhoto, setPrimaryPhoto] = useState<File | null>(null);
  const [additionalPhotos, setAdditionalPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<{
    license: UploadedFile | null;
    insurance: UploadedFile | null;
    registrationCertificate: UploadedFile | null;
  }>({
    license: null,
    insurance: null,
    registrationCertificate: null,
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  });

  // Protect this route - only vehicle owners can access
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();
  const locale = params.locale as string;

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        setLoading(true);
        const response = await vehicleService.getById(vehicleId);
        const vehicle = (response as any)?.vehicle || response;

        // Map API response to form data
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
        });
        setSelectedAmenities(vehicle.amenities || []);
      } catch (err) {
        console.error("Failed to fetch vehicle:", err);
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load vehicle data");
        }
      } finally {
        setLoading(false);
      }
    };

    if (vehicleId) {
      fetchVehicle();
    }
  }, [vehicleId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const amenitiesList = [
    { id: "wifi", label: "WiFi" },
    { id: "ac", label: "Air Conditioning" },
    { id: "music", label: "Music System" },
    { id: "usb", label: "USB Charging" },
    { id: "tv", label: "TV/Entertainment" },
    { id: "reclining", label: "Reclining Seats" },
    { id: "reading", label: "Reading Lights" },
    { id: "gps", label: "GPS Tracking" },
  ];

  const toggleAmenity = (id: string) => {
    if (selectedAmenities.includes(id)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== id));
    } else {
      setSelectedAmenities([...selectedAmenities, id]);
    }
  };

  const sections = [
    { id: "basic", label: "Basic Information" },
    { id: "pricing", label: "Pricing" },
    { id: "photos", label: "Photos" },
    { id: "documents", label: "Documents" },
    { id: "amenities", label: "Amenities & Features" },
  ] as const;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (
        !documents.license ||
        !documents.insurance ||
        !documents.registrationCertificate
      ) {
        setError("All vehicle documents are required");
        setActiveSection("documents");
        setIsSubmitting(false);
        return;
      }

      // Map form data to API format
      const updateData = {
        name: formData.name,
        licensePlate: formData.registration,
        type: formData.type,
        brand: formData.make,
        model: formData.model,
        year: parseInt(formData.year),
        seats: parseInt(formData.capacity),
        color: formData.color || undefined,
        acType: formData.acType,
        condition: formData.condition || undefined,
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
      };

      console.log("Updating vehicle with data:", updateData);
      const result = await vehicleService.update(vehicleId, updateData);
      console.log("Update result:", result);

      await vehicleService.uploadDocuments(vehicleId, [
        { file: documents.license.file, type: "DRIVING_LICENSE" },
        { file: documents.insurance.file, type: "INSURANCE" },
        {
          file: documents.registrationCertificate.file,
          type: "REGISTRATION_CERTIFICATE",
        },
      ]);

      const photoUploads = [] as Array<{ file: File; isPrimary?: boolean }>;
      if (primaryPhoto) {
        photoUploads.push({ file: primaryPhoto, isPrimary: true });
      }
      additionalPhotos.forEach((photo) => photoUploads.push({ file: photo }));
      if (photoUploads.length > 0) {
        await vehicleService.uploadPhotos(vehicleId, photoUploads);
      }

      router.push(`/${locale}/owner/fleet`);
    } catch (err) {
      console.error("Failed to update vehicle:", err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update vehicle");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth state or fetching data
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
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/fleet`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              <FaArrowLeft className="h-4 w-4" />
              Back to Fleet
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">
              Edit Vehicle - {formData.registration}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Update vehicle information
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
          {/* Section Navigation */}
          <div className="mb-8 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6">
              <nav className="flex gap-8">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                      activeSection === section.id
                        ? "border-[#20B0E9] text-[#20B0E9]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
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
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Vehicle Details
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        Update the basic information about your vehicle
                      </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Bus Name *
                        </label>
                        <input
                          type="text"
                          name="name"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="e.g., Luxury Coach 54-Seater"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Registration Number *
                        </label>
                        <input
                          type="text"
                          name="registration"
                          required
                          value={formData.registration}
                          onChange={handleChange}
                          placeholder="WP-1234"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Bus Type *
                        </label>
                        <select
                          name="type"
                          required
                          value={formData.type}
                          onChange={handleChange}
                          className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        >
                          <option value="">Select bus type</option>
                          <option value="LUXURY_AC">Luxury AC</option>
                          <option value="SEMI_LUXURY">Semi-Luxury</option>
                          <option value="ORDINARY">Ordinary</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Make *
                        </label>
                        <input
                          type="text"
                          name="make"
                          required
                          value={formData.make}
                          onChange={handleChange}
                          placeholder="e.g., Ashok Leyland"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Model *
                        </label>
                        <input
                          type="text"
                          name="model"
                          required
                          value={formData.model}
                          onChange={handleChange}
                          placeholder="e.g., 2820"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Year *
                        </label>
                        <input
                          type="number"
                          name="year"
                          required
                          value={formData.year}
                          onChange={handleChange}
                          placeholder="2022"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Seating Capacity *
                        </label>
                        <input
                          type="number"
                          name="capacity"
                          required
                          value={formData.capacity}
                          onChange={handleChange}
                          placeholder="45"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Color *
                        </label>
                        <input
                          type="text"
                          name="color"
                          required
                          value={formData.color}
                          onChange={handleChange}
                          placeholder="White"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          AC Type *
                        </label>
                        <select
                          name="acType"
                          required
                          value={formData.acType}
                          onChange={handleChange}
                          className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        >
                          <option value="">Select AC type</option>
                          <option value="full-ac">Full AC</option>
                          <option value="ac">AC</option>
                          <option value="non-ac">Non-AC</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Condition *
                        </label>
                        <select
                          name="condition"
                          required
                          value={formData.condition}
                          onChange={handleChange}
                          className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        >
                          <option value="">Select condition</option>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Location *
                        </label>
                        <input
                          type="text"
                          name="location"
                          required
                          value={formData.location}
                          onChange={handleChange}
                          placeholder="e.g., Colombo, Sri Lanka"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Description
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          rows={4}
                          placeholder="Describe your vehicle, seating layout, and any special features..."
                          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pricing */}
                {activeSection === "pricing" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Pricing Information
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        Update your rental rates
                      </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Price per Kilometer *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            LKR
                          </span>
                          <input
                            type="number"
                            name="pricePerKm"
                            required
                            value={formData.pricePerKm}
                            onChange={handleChange}
                            placeholder="85"
                            className="w-full rounded-lg border border-gray-300 py-2 pl-14 pr-3 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Price per Day *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            LKR
                          </span>
                          <input
                            type="number"
                            name="pricePerDay"
                            required
                            value={formData.pricePerDay}
                            onChange={handleChange}
                            placeholder="25000"
                            className="w-full rounded-lg border border-gray-300 py-2 pl-14 pr-3 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Driver Allowance per Day
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            LKR
                          </span>
                          <input
                            type="number"
                            name="driverAllowance"
                            value={formData.driverAllowance || ""}
                            onChange={handleChange}
                            placeholder="2500"
                            className="w-full rounded-lg border border-gray-300 py-2 pl-14 pr-3 transition-all focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20"
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Optional: Daily allowance for the driver
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photos */}
                {activeSection === "photos" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Vehicle Photos
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        Update vehicle photos
                      </p>
                    </div>

                    <div className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-gray-400">
                      <FaUpload className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                      <div className="mb-1 font-medium text-gray-900">
                        Upload New Primary Photo
                      </div>
                      <p className="mb-3 text-sm text-gray-600">
                        This will replace the current main photo
                      </p>
                      <label className="inline-block cursor-pointer rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]">
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setPrimaryPhoto(e.target.files?.[0] || null)
                          }
                          className="hidden"
                        />
                      </label>
                      <p className="mt-3 text-xs text-gray-500">
                        JPG, PNG up to 5MB
                      </p>
                      {primaryPhoto && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-green-600">
                          <FaCheckCircle className="h-4 w-4" />
                          {primaryPhoto.name}
                          <button
                            type="button"
                            onClick={() => setPrimaryPhoto(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <FaTimes className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {activeSection === "documents" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Vehicle Documents
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        Update vehicle documents for verification
                      </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <FileUpload
                        label="Driving License"
                        required
                        value={documents.license}
                        onChange={(file) =>
                          setDocuments({ ...documents, license: file })
                        }
                        helpText="Valid heavy vehicle driving license"
                      />

                      <FileUpload
                        label="Insurance Certificate"
                        required
                        value={documents.insurance}
                        onChange={(file) =>
                          setDocuments({ ...documents, insurance: file })
                        }
                        helpText="Current vehicle insurance document"
                      />

                      <div className="md:col-span-2">
                        <FileUpload
                          label="Certificate of Registration (CR)"
                          required
                          value={documents.registrationCertificate}
                          onChange={(file) =>
                            setDocuments({
                              ...documents,
                              registrationCertificate: file,
                            })
                          }
                          helpText="Vehicle registration certificate"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <div className="text-sm">
                        <div className="mb-1 font-medium text-gray-900">
                          Document Requirements
                        </div>
                        <ul className="space-y-1 text-gray-600">
                          <li>• All documents must be clear and readable</li>
                          <li>• Accepted formats: PDF, JPG, PNG (Max 5MB)</li>
                          <li>• Documents must be current and valid</li>
                          <li>• Documents are reviewed within 24-48 hours</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {activeSection === "amenities" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Amenities & Features
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        Update available amenities
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {amenitiesList.map((amenity) => (
                        <button
                          key={amenity.id}
                          type="button"
                          onClick={() => toggleAmenity(amenity.id)}
                          className={`rounded-lg border-2 p-4 text-sm font-medium transition-all ${
                            selectedAmenities.includes(amenity.id)
                              ? "border-[#20B0E9] bg-[#20B0E9]/5 text-[#20B0E9]"
                              : "border-gray-300 text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          {amenity.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mt-6 max-w-3xl rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                    <p className="font-medium">Error</p>
                    <p>{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex max-w-3xl gap-3 border-t border-gray-200 pt-6">
                  <Link
                    href={`/${locale}/owner/fleet`}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save Changes
                        <FaCheckCircle className="h-4 w-4" />
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
