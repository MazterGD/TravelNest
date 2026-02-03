"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, Input, Select } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { vehicleService, ownerService, authService, ApiError } from "@/lib/api";
import {
  FaMapMarkerAlt,
  FaEnvelope,
  FaPhone,
  FaUser,
  FaArrowLeft,
  FaLock,
  FaCamera,
  FaBus,
  FaEdit,
  FaIdCard,
  FaExclamationCircle,
  FaCheckCircle,
} from "react-icons/fa";

type ProfileTab = "personal" | "address" | "vehicles" | "security";

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

export default function OwnerProfilePage() {
  const { user, updateUser } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");
  const [profilePicture, setProfilePicture] = useState<string | null>(
    user?.avatar || null,
  );

  // Loading and error states
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Personal Info State
  const [personalInfo, setPersonalInfo] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    nicNumber: user?.nicNumber || "",
  });

  // Address State
  const [addressInfo, setAddressInfo] = useState({
    address: user?.address || "",
    city: user?.city || "",
    district: user?.district || "",
    postalCode: user?.postalCode || "",
    baseLocation: user?.baseLocation || "",
  });

  // Security State
  const [securityInfo, setSecurityInfo] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Protect this route
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  // Fetch vehicles from API
  useEffect(() => {
    const fetchVehicles = async () => {
      if (!user) return;

      setIsLoadingVehicles(true);
      setError(null);

      try {
        const response = await vehicleService.getMyVehicles();
        setVehicles((response?.vehicles || []) as Vehicle[]);
      } catch (err) {
        console.error("Failed to fetch vehicles:", err);
        if (err instanceof ApiError) {
          setError(err.message);
        }
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    if (activeTab === "vehicles" && user) {
      fetchVehicles();
    }
  }, [activeTab, user]);

  // Update form data when user changes
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

  const handleProfilePictureChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
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

      // Update the auth store with new user data
      if (updateUser) {
        updateUser(response);
      }

      showSuccess("Personal information updated successfully!");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update personal information");
      }
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

      // Update the auth store with new user data
      if (updateUser) {
        updateUser(response);
      }

      showSuccess("Address updated successfully!");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update address");
      }
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

      // Clear the form
      setSecurityInfo({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      showSuccess("Password updated successfully!");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update password");
      }
    } finally {
      setIsSaving(false);
    }
  };

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
              href={`/${locale}/owner/dashboard`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              <FaArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          {/* Success/Error Messages */}
          {successMessage && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3">
              <FaCheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-700">{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
              <FaExclamationCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-700">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="mb-8 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6">
              <nav className="flex gap-8">
                {[
                  {
                    id: "personal",
                    label: "Personal Information",
                    icon: FaUser,
                  },
                  { id: "address", label: "Address", icon: FaMapMarkerAlt },
                  { id: "vehicles", label: "Vehicles", icon: FaBus },
                  { id: "security", label: "Security", icon: FaLock },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ProfileTab)}
                    className={`flex items-center gap-2 border-b-2 py-4 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "border-[#20B0E9] text-[#20B0E9]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Personal Information Tab */}
              {activeTab === "personal" && (
                <div className="max-w-3xl">
                  <div className="mb-6">
                    <h3 className="mb-1 font-semibold text-gray-900">
                      Personal Information
                    </h3>
                    <p className="text-sm text-gray-600">
                      Update your personal details
                    </p>
                  </div>

                  {/* Profile Picture */}
                  <div className="mb-6 flex items-center gap-6">
                    <div className="relative">
                      <div className="h-24 w-24 rounded-full border-4 border-gray-200 bg-gray-100 overflow-hidden">
                        {profilePicture ? (
                          <img
                            src={profilePicture}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <FaUser className="h-10 w-10 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 rounded-full bg-[#20B0E9] p-2 text-white cursor-pointer hover:bg-[#1a8fc4] transition-colors">
                        <FaCamera className="h-4 w-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfilePictureChange}
                        />
                      </label>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Profile Photo
                      </h4>
                      <p className="text-sm text-gray-600">
                        JPG, PNG or GIF. Max size 2MB
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
                        icon={<FaEnvelope />}
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
                        icon={<FaPhone />}
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
                        icon={<FaIdCard />}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSaving && <LoadingSpinner size="sm" />}
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Address Tab */}
              {activeTab === "address" && (
                <div className="max-w-3xl">
                  <div className="mb-6">
                    <h3 className="mb-1 font-semibold text-gray-900">
                      Address Information
                    </h3>
                    <p className="text-sm text-gray-600">
                      Update your business or home address
                    </p>
                  </div>

                  <form onSubmit={handleAddressSubmit} className="space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Address
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
                        placeholder="Enter your complete address"
                        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                        options={DISTRICTS.map((d) => ({ value: d, label: d }))}
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
                        helperText="Where your vehicles are primarily based"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSaving && <LoadingSpinner size="sm" />}
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Vehicles Tab */}
              {activeTab === "vehicles" && (
                <div className="max-w-4xl">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900">
                        My Vehicles
                      </h3>
                      <p className="text-sm text-gray-600">
                        Manage your fleet of vehicles ({vehicles.length} total)
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/owner/fleet/add`}
                      className="rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]"
                    >
                      + Add Vehicle
                    </Link>
                  </div>

                  {isLoadingVehicles ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {vehicles.map((vehicle) => (
                        <div
                          key={vehicle.id}
                          className="rounded-lg border border-gray-200 bg-white p-5 transition-all hover:border-[#20B0E9] hover:shadow-md"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
                                <FaBus className="h-8 w-8 text-gray-400" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">
                                  {vehicle.licensePlate}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {vehicle.brand} {vehicle.model} -{" "}
                                  {vehicle.type}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {vehicle.seats} seats
                                </p>
                                <div className="mt-2 flex gap-2">
                                  <span
                                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                      vehicle.isAvailable
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {vehicle.isAvailable
                                      ? "Available"
                                      : "Unavailable"}
                                  </span>
                                  {!vehicle.isActive && (
                                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                                      Pending Verification
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Link
                              href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <FaEdit className="h-4 w-4" />
                              Edit
                            </Link>
                          </div>
                        </div>
                      ))}

                      {vehicles.length === 0 && !isLoadingVehicles && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
                          <FaBus className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                          <h4 className="mb-2 font-semibold text-gray-900">
                            No vehicles yet
                          </h4>
                          <p className="mb-4 text-sm text-gray-600">
                            Add your first vehicle to start receiving bookings
                          </p>
                          <Link
                            href={`/${locale}/owner/fleet/add`}
                            className="inline-block rounded-lg bg-[#20B0E9] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]"
                          >
                            Add Your First Vehicle
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div className="max-w-3xl">
                  <div className="mb-6">
                    <h3 className="mb-1 font-semibold text-gray-900">
                      Security Settings
                    </h3>
                    <p className="text-sm text-gray-600">
                      Manage your password and account security
                    </p>
                  </div>

                  <form onSubmit={handleSecuritySubmit} className="space-y-5">
                    <Input
                      label="Current Password"
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
                      icon={<FaLock />}
                    />

                    <Input
                      label="New Password"
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
                      icon={<FaLock />}
                      helperText="At least 8 characters with numbers and special characters"
                    />

                    <Input
                      label="Confirm New Password"
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
                      icon={<FaLock />}
                    />

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSaving && <LoadingSpinner size="sm" />}
                        {isSaving ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
