"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { vehicleService, ApiError } from "@/lib/api";
import {
  FaPlus,
  FaSearch,
  FaStar,
  FaEdit,
  FaEye,
  FaArrowLeft,
  FaFilter,
  FaBus,
  FaUsers,
  FaTh,
  FaList,
  FaEllipsisV,
  FaToggleOn,
  FaToggleOff,
  FaTrash,
  FaCalendarAlt,
  FaTimes,
} from "react-icons/fa";

type VehicleStatus = "all" | "active" | "inactive" | "pending";
type ViewMode = "grid" | "table";

interface Vehicle {
  id: string;
  images: string[];
  licensePlate: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  seats: number;
  rating?: number;
  totalBookings?: number;
  isActive: boolean;
  isAvailable: boolean;
  acType: string;
}

export default function FleetManagementPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const locale = params.locale as string;
  const [activeTab, setActiveTab] = useState<VehicleStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);

  // State for API data
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Protect this route - only vehicle owners can access
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  // Fetch vehicles from API
  useEffect(() => {
    const fetchVehicles = async () => {
      if (!user) return;

      setIsLoadingVehicles(true);
      setError(null);

      try {
        const response = await vehicleService.getMyVehicles();
        // Extract vehicles array from response
        const vehiclesData = response?.vehicles || [];
        setVehicles(vehiclesData as Vehicle[]);
      } catch (err) {
        console.error("Failed to fetch vehicles:", err);
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load vehicles");
        }
        setVehicles([]); // Set empty array on error
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    if (user && isAuthorized) {
      fetchVehicles();
    }
  }, [user, isAuthorized]);

  // Helper to get vehicle status
  const getVehicleStatus = (
    vehicle: Vehicle,
  ): "active" | "inactive" | "pending" => {
    if (!vehicle.isActive) return "pending";
    if (!vehicle.isAvailable) return "inactive";
    return "active";
  };

  const filteredVehicles = Array.isArray(vehicles)
    ? vehicles.filter((v) => {
        const status = getVehicleStatus(v);
        const matchesTab = activeTab === "all" || status === activeTab;
        const matchesSearch =
          searchQuery === "" ||
          v.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.brand.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
      })
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "inactive":
        return "bg-gray-100 text-gray-600";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const tabCounts = {
    all: vehicles.length,
    active: vehicles.filter((v) => getVehicleStatus(v) === "active").length,
    inactive: vehicles.filter((v) => getVehicleStatus(v) === "inactive").length,
    pending: vehicles.filter((v) => getVehicleStatus(v) === "pending").length,
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
              href={`/${locale}/owner/dashboard`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              <FaArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Fleet Management
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  {filteredVehicles.length} vehicle
                  {filteredVehicles.length !== 1 && "s"}
                </p>
              </div>
              <Link
                href={`/${locale}/owner/fleet/add`}
                className="flex items-center gap-2 rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]"
              >
                <FaPlus className="h-4 w-4" />
                Add Vehicle
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          {/* Filters */}
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-2">
                {(
                  [
                    { id: "all", label: "All Vehicles" },
                    { id: "active", label: "Active" },
                    { id: "inactive", label: "Inactive" },
                    { id: "pending", label: "Pending" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-[#20B0E9] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label} ({tabCounts[tab.id]})
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === "grid"
                      ? "bg-[#20B0E9] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <FaTh className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === "table"
                      ? "bg-[#20B0E9] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <FaList className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by registration or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                <FaFilter className="h-4 w-4" />
                Filters
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 grid gap-4 border-t border-gray-200 pt-4 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Vehicle Type
                  </label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20">
                    <option value="">All Types</option>
                    <option value="luxury">Luxury Coach</option>
                    <option value="semi-luxury">Semi-Luxury</option>
                    <option value="standard">Standard Bus</option>
                    <option value="mini">Mini Bus</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Capacity Range
                  </label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20">
                    <option value="">All Capacities</option>
                    <option value="0-20">0-20 seats</option>
                    <option value="21-30">21-30 seats</option>
                    <option value="31-45">31-45 seats</option>
                    <option value="45+">45+ seats</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    AC Type
                  </label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20">
                    <option value="">All AC Types</option>
                    <option value="full-ac">Full AC</option>
                    <option value="ac">AC</option>
                    <option value="non-ac">Non-AC</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Sort By
                  </label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#20B0E9] focus:outline-none focus:ring-2 focus:ring-[#20B0E9]/20">
                    <option value="recent">Most Recent</option>
                    <option value="rating">Highest Rating</option>
                    <option value="bookings">Most Bookings</option>
                    <option value="capacity">Capacity</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Vehicle Grid/Table */}
          {isLoadingVehicles ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-sm text-red-600 underline hover:text-red-800"
              >
                Try again
              </button>
            </div>
          ) : filteredVehicles.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredVehicles.map((vehicle) => {
                  const status = getVehicleStatus(vehicle);
                  return (
                    <div
                      key={vehicle.id}
                      className="overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300"
                    >
                      <div className="relative h-48 bg-gray-100">
                        {vehicle.images && vehicle.images.length > 0 ? (
                          <Image
                            src={vehicle.images[0]}
                            alt={vehicle.licensePlate}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <FaBus className="h-16 w-16 text-gray-300" />
                          </div>
                        )}
                        <div className="absolute left-3 top-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(
                              status,
                            )}`}
                          >
                            {status}
                          </span>
                        </div>
                        {status === "active" &&
                          vehicle.rating &&
                          vehicle.rating > 0 && (
                            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
                              <FaStar className="h-3.5 w-3.5 text-yellow-400" />
                              <span className="text-sm font-medium text-gray-900">
                                {vehicle.rating}
                              </span>
                            </div>
                          )}
                        {/* Quick Actions Menu */}
                        <div className="absolute bottom-3 right-3">
                          <div className="relative">
                            <button
                              onClick={() =>
                                setShowActionsMenu(
                                  showActionsMenu === vehicle.id
                                    ? null
                                    : vehicle.id,
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-gray-50"
                            >
                              <FaEllipsisV className="h-4 w-4 text-gray-600" />
                            </button>
                            {showActionsMenu === vehicle.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setShowActionsMenu(null)}
                                />
                                <div className="absolute bottom-full right-0 z-20 mb-2 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                                  <Link
                                    href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                                  >
                                    <FaEdit className="h-4 w-4" />
                                    Edit Vehicle
                                  </Link>
                                  <Link
                                    href={`/${locale}/owner/fleet/${vehicle.id}`}
                                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                                  >
                                    <FaEye className="h-4 w-4" />
                                    View Details
                                  </Link>
                                  <Link
                                    href={`/${locale}/owner/fleet/${vehicle.id}/availability`}
                                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                                  >
                                    <FaCalendarAlt className="h-4 w-4" />
                                    Set Availability
                                  </Link>
                                  <button className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50">
                                    {status === "active" ? (
                                      <>
                                        <FaToggleOff className="h-4 w-4" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <FaToggleOn className="h-4 w-4" />
                                        Activate
                                      </>
                                    )}
                                  </button>
                                  <button className="flex w-full items-center gap-3 border-t border-gray-200 px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50">
                                    <FaTrash className="h-4 w-4" />
                                    Delete Vehicle
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="mb-1 text-lg font-semibold text-gray-900">
                          {vehicle.licensePlate}
                        </h3>
                        <p className="mb-3 text-sm text-gray-600">
                          {vehicle.brand} {vehicle.model} • {vehicle.year}
                        </p>

                        {status !== "pending" && (
                          <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3">
                            <div>
                              <div className="mb-0.5 text-xs text-gray-500">
                                Capacity
                              </div>
                              <div className="font-medium text-gray-900">
                                {vehicle.seats}
                              </div>
                            </div>
                            <div>
                              <div className="mb-0.5 text-xs text-gray-500">
                                Bookings
                              </div>
                              <div className="font-medium text-gray-900">
                                {vehicle.totalBookings || 0}
                              </div>
                            </div>
                            <div>
                              <div className="mb-0.5 text-xs text-gray-500">
                                Rating
                              </div>
                              <div className="font-medium text-gray-900">
                                {vehicle.rating
                                  ? `${vehicle.rating}/5.0`
                                  : "N/A"}
                              </div>
                            </div>
                          </div>
                        )}

                        {status === "pending" && (
                          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
                            <p className="text-xs font-medium text-yellow-700">
                              Awaiting verification approval
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Link
                            href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <FaEdit className="h-4 w-4" />
                            Edit
                          </Link>
                          <Link
                            href={`/${locale}/owner/fleet/${vehicle.id}`}
                            className="flex-1 rounded-lg bg-[#20B0E9] px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Vehicle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Capacity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Rating
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredVehicles.map((vehicle) => {
                        const status = getVehicleStatus(vehicle);
                        return (
                          <tr
                            key={vehicle.id}
                            className="transition-colors hover:bg-gray-50"
                          >
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                  {vehicle.images &&
                                  vehicle.images.length > 0 ? (
                                    <Image
                                      src={vehicle.images[0]}
                                      alt={vehicle.licensePlate}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <FaBus className="h-6 w-6 text-gray-300" />
                                    </div>
                                  )}
                                </div>
                                <div className="font-medium text-gray-900">
                                  {vehicle.licensePlate}
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                              {vehicle.type}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                              {vehicle.seats} seats
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(
                                  status,
                                )}`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              {status !== "pending" && (
                                <div className="flex items-center gap-1 text-sm text-gray-900">
                                  <FaStar className="h-3.5 w-3.5 text-yellow-400" />
                                  {vehicle.rating || "N/A"}
                                </div>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/${locale}/owner/fleet/${vehicle.id}/edit`}
                                  className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
                                >
                                  <FaEdit className="h-4 w-4" />
                                </Link>
                                <Link
                                  href={`/${locale}/owner/fleet/${vehicle.id}`}
                                  className="rounded p-1.5 text-[#20B0E9] transition-colors hover:bg-blue-50"
                                >
                                  <FaEye className="h-4 w-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          ) : (
            /* Empty State */
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <div className="mx-auto max-w-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <FaBus className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  No Vehicles Found
                </h3>
                <p className="mb-6 text-sm text-gray-600">
                  {activeTab === "all"
                    ? "You haven't added any vehicles yet. Start by adding your first vehicle."
                    : `No ${activeTab} vehicles found.`}
                </p>
                <Link
                  href={`/${locale}/owner/fleet/add`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]"
                >
                  <FaPlus className="h-4 w-4" />
                  Add Your Vehicle
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
