"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { FaArrowLeft, FaCheckCircle, FaUpload, FaTimes } from "react-icons/fa";
import { vehicleService } from "@/lib/api/services";

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

export default function AddVehiclePage() {
  const { user } = useAuthStore();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const [activeSection, setActiveSection] = useState<FormSection>("basic");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<{
    license: UploadedFile | null;
    insurance: UploadedFile | null;
    registrationCertificate: UploadedFile | null;
  }>({
    license: null,
    insurance: null,
    registrationCertificate: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
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
    setErrors({});

    try {
      if (
        !documents.license ||
        !documents.insurance ||
        !documents.registrationCertificate
      ) {
        setErrors({ documents: "All vehicle documents are required" });
        setActiveSection("documents");
        setIsSubmitting(false);
        return;
      }

      // Photo validation temporarily disabled - storage bucket not implemented yet
      // if (!photos.length) {
      //   setErrors({ photos: "At least one photo is required" });
      //   setActiveSection("photos");
      //   return;
      // }

      // Map form data to API format
      const vehicleData = {
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
      };

      // Create vehicle
      const vehicle = await vehicleService.create(vehicleData);

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
          photos.map((photo, index) => ({
            file: photo,
            isPrimary: index === 0,
          })),
        );
      }

      // Redirect to fleet page
      router.push(`/${locale}/owner/fleet`);
    } catch (error: any) {
      console.error("Error creating vehicle:", error);
      setErrors({ submit: error.message || "Failed to create vehicle" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth state
  if (guardLoading || !isAuthorized || !user) {
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
              Add New Vehicle
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Fill in the details to list your bus
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
                {errors.submit && (
                  <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                    {errors.submit}
                  </div>
                )}

                {/* Basic Information */}
                {activeSection === "basic" && (
                  <div className="max-w-3xl space-y-6">
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Bus Details
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        Enter the basic information about your bus
                      </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <Input
                        label="Bus Name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g., Luxury Coach 54-Seater"
                        error={errors.name}
                      />

                      <Input
                        label="Registration Number"
                        name="registration"
                        required
                        value={formData.registration}
                        onChange={handleChange}
                        placeholder="WP-1234"
                        error={errors.registration}
                      />

                      <Select
                        label="Bus Type"
                        name="type"
                        required
                        value={formData.type}
                        onChange={(value) => handleSelectChange("type", value)}
                        options={[
                          { value: "LUXURY_AC", label: "Luxury AC" },
                          { value: "SEMI_LUXURY", label: "Semi-Luxury" },
                          { value: "ORDINARY", label: "Ordinary" },
                        ]}
                        placeholder="Select bus type"
                        error={errors.type}
                      />

                      <Input
                        label="Make"
                        name="make"
                        required
                        value={formData.make}
                        onChange={handleChange}
                        placeholder="e.g., Ashok Leyland"
                        error={errors.make}
                      />

                      <Input
                        label="Model"
                        name="model"
                        required
                        value={formData.model}
                        onChange={handleChange}
                        placeholder="e.g., 2820"
                        error={errors.model}
                      />

                      <Input
                        label="Year"
                        name="year"
                        type="number"
                        required
                        value={formData.year}
                        onChange={handleChange}
                        placeholder="2022"
                        error={errors.year}
                      />

                      <Input
                        label="Seating Capacity"
                        name="capacity"
                        type="number"
                        required
                        value={formData.capacity}
                        onChange={handleChange}
                        placeholder="45"
                        error={errors.capacity}
                      />

                      <Input
                        label="Color"
                        name="color"
                        required
                        value={formData.color}
                        onChange={handleChange}
                        placeholder="White"
                        error={errors.color}
                      />

                      <Select
                        label="AC Type"
                        name="acType"
                        required
                        value={formData.acType}
                        onChange={(value) =>
                          handleSelectChange("acType", value)
                        }
                        options={[
                          { value: "full-ac", label: "Full AC" },
                          { value: "ac", label: "AC" },
                          { value: "non-ac", label: "Non-AC" },
                        ]}
                        placeholder="Select AC type"
                        error={errors.acType}
                      />

                      <Select
                        label="Condition"
                        name="condition"
                        required
                        value={formData.condition}
                        onChange={(value) =>
                          handleSelectChange("condition", value)
                        }
                        options={[
                          { value: "excellent", label: "Excellent" },
                          { value: "good", label: "Good" },
                          { value: "fair", label: "Fair" },
                        ]}
                        placeholder="Select condition"
                        error={errors.condition}
                      />

                      <Input
                        label="Location"
                        name="location"
                        required
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g., Colombo, Sri Lanka"
                        error={errors.location}
                      />

                      <div className="md:col-span-2">
                        <TextArea
                          label="Description"
                          name="description"
                          value={formData.description}
                          onChange={(e) => handleChange(e)}
                          rows={4}
                          placeholder="Describe your bus, seating layout, and any special features..."
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
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Pricing Information
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        Set your rental rates
                      </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <Input
                        label="Price per Kilometer"
                        name="pricePerKm"
                        type="number"
                        required
                        value={formData.pricePerKm}
                        onChange={handleChange}
                        placeholder="85"
                        error={errors.pricePerKm}
                        helperText="LKR per kilometer"
                      />

                      <Input
                        label="Price per Day"
                        name="pricePerDay"
                        type="number"
                        required
                        value={formData.pricePerDay}
                        onChange={handleChange}
                        placeholder="25000"
                        error={errors.pricePerDay}
                        helperText="LKR per day"
                      />

                      <Input
                        label="Driver Allowance per Day"
                        name="driverAllowance"
                        type="number"
                        value={formData.driverAllowance}
                        onChange={handleChange}
                        placeholder="2500"
                        helperText="Optional: LKR daily allowance for the driver"
                      />
                    </div>

                    {formData.pricePerKm && formData.pricePerDay && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                        <div className="mb-3 text-sm font-medium text-gray-900">
                          Sample Calculation
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>Distance: 150 km</span>
                            <span>
                              LKR{" "}
                              {(
                                parseFloat(formData.pricePerKm) * 150
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>1 Day rental</span>
                            <span>
                              LKR{" "}
                              {parseFloat(
                                formData.pricePerDay,
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-gray-300 pt-2 font-medium text-gray-900">
                            <span>Estimated Total</span>
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
                      <h3 className="mb-1 font-semibold text-gray-900">
                        Vehicle Photos
                      </h3>
                      <p className="mb-6 text-sm text-gray-600">
                        Upload clear photos of your vehicle (first photo will be
                        primary)
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div
                        className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-[#20B0E9]"
                        onClick={() =>
                          document.getElementById("photo-upload")?.click()
                        }
                      >
                        <FaUpload className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                        <div className="mb-1 font-medium text-gray-900">
                          Upload Vehicle Photos
                        </div>
                        <p className="mb-3 text-sm text-gray-600">
                          Click to select or drag and drop
                        </p>
                        <input
                          id="photo-upload"
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files) {
                              setPhotos(Array.from(e.target.files));
                            }
                          }}
                          className="hidden"
                        />
                        <p className="text-xs text-gray-500">
                          JPG, PNG up to 5MB each
                        </p>
                      </div>

                      {photos.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          {photos.map((photo, index) => (
                            <div
                              key={index}
                              className="relative rounded-lg border border-gray-200 p-2"
                            >
                              <img
                                src={URL.createObjectURL(photo)}
                                alt={`Vehicle ${index + 1}`}
                                className="w-full aspect-video object-cover rounded"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setPhotos(
                                    photos.filter((_, i) => i !== index),
                                  )
                                }
                                className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600"
                              >
                                <FaTimes className="h-3 w-3" />
                              </button>
                              {index === 0 && (
                                <span className="absolute top-1 left-1 bg-[#20B0E9] text-white text-xs px-2 py-0.5 rounded">
                                  Primary
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {errors.photos && (
                        <p className="text-sm text-red-500">{errors.photos}</p>
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
                        Upload required documents for verification
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

                      {errors.documents && (
                        <p className="text-sm text-red-500">
                          {errors.documents}
                        </p>
                      )}
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
                        Select available amenities
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

                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300">
                      <input
                        type="checkbox"
                        name="gpsEnabled"
                        checked={formData.gpsEnabled}
                        onChange={handleChange}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#20B0E9] focus:ring-[#20B0E9]/20"
                      />
                      <div>
                        <div className="mb-0.5 font-medium text-gray-900">
                          GPS Tracking
                        </div>
                        <div className="text-sm text-gray-600">
                          Real-time tracking for safety
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex max-w-3xl gap-3 border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        Publish Vehicle
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
