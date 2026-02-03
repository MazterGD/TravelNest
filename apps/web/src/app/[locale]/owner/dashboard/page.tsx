"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import {
  vehicleService,
  quotationService,
  bookingService,
  ApiError,
} from "@/lib/api";
import {
  FaDollarSign,
  FaCalendarAlt,
  FaFileAlt,
  FaStar,
  FaBus,
  FaPlus,
  FaClipboardList,
  FaArrowRight,
  FaMapMarkerAlt,
  FaUsers,
  FaClock,
} from "react-icons/fa";

interface DashboardMetrics {
  totalRevenue: string;
  activeBookings: number;
  pendingQuotes: number;
  averageRating: number;
}

interface FleetStats {
  active: number;
  inactive: number;
  pendingReview: number;
  utilization: number;
}

interface QuotationRequest {
  id: string;
  customer: string;
  route: string;
  date: string;
  passengers: number;
  expiresIn: string;
}

interface UpcomingBooking {
  id: string;
  customer: string;
  route: string;
  date: string;
  vehicle: string;
}

export default function OwnerDashboardPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const { user } = useAuthStore();
  const [quotationFilter, setQuotationFilter] = useState<
    "all" | "new" | "pending"
  >("all");

  // State for API data
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: "LKR 0",
    activeBookings: 0,
    pendingQuotes: 0,
    averageRating: 0,
  });
  const [fleetStats, setFleetStats] = useState<FleetStats>({
    active: 0,
    inactive: 0,
    pendingReview: 0,
    utilization: 0,
  });
  const [quotationRequests, setQuotationRequests] = useState<
    QuotationRequest[]
  >([]);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>(
    [],
  );

  // Protect this route - only vehicle owners can access
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      setIsLoadingData(true);

      try {
        // Fetch vehicles to calculate fleet stats
        const response = await vehicleService.getMyVehicles();
        const vehicleList = (response?.vehicles || []) as Array<{
          isActive: boolean;
          isAvailable: boolean;
        }>;

        const activeVehicles = vehicleList.filter(
          (v) => v.isActive && v.isAvailable,
        ).length;
        const inactiveVehicles = vehicleList.filter(
          (v) => v.isActive && !v.isAvailable,
        ).length;
        const pendingVehicles = vehicleList.filter((v) => !v.isActive).length;

        setFleetStats({
          active: activeVehicles,
          inactive: inactiveVehicles,
          pendingReview: pendingVehicles,
          utilization:
            vehicleList.length > 0
              ? Math.round((activeVehicles / vehicleList.length) * 100)
              : 0,
        });

        // For now, set metrics based on available data
        // These would come from dedicated API endpoints in production
        setMetrics({
          totalRevenue: "LKR 0",
          activeBookings: 0,
          pendingQuotes: 0,
          averageRating: 0,
        });

        // Try to fetch quotations and bookings (may not have endpoints yet)
        try {
          const response = await quotationService.getOwnerRequests({
            status: "pending",
          });
          const quotes = (response as any)?.quotations || [];

          // Transform quotations for display
          const quotationRequestsData = quotes.map((q: any) => ({
            id: q.id,
            customer:
              `${q.customer?.firstName || ""} ${q.customer?.lastName || ""}`.trim() ||
              "Unknown",
            route:
              q.pickupLocation && q.dropoffLocation
                ? `${q.pickupLocation} → ${q.dropoffLocation}`
                : "N/A",
            date: q.startDate || "",
            passengers: q.passengerCount || 0,
            expiresIn: "2 days", // Calculate based on createdAt
          }));

          setQuotationRequests(quotationRequestsData);
          setMetrics((prev) => ({
            ...prev,
            pendingQuotes: quotes.length,
          }));
        } catch {
          // Quotation endpoints may not be implemented yet
        }

        try {
          const response = await bookingService.getOwnerBookings();
          const data = response as any;
          const bookings = data.bookings || [];

          // Filter for active bookings (CONFIRMED, ONGOING)
          const activeBookings = bookings.filter(
            (b: any) => b.status === "CONFIRMED" || b.status === "ONGOING",
          );

          // Transform upcoming bookings for display
          const upcoming = bookings
            .filter(
              (b: any) => b.status === "CONFIRMED" || b.status === "ONGOING",
            )
            .slice(0, 5)
            .map((b: any) => ({
              id: b.id,
              customer: b.customer?.name || "Unknown",
              route: b.trip?.route || "N/A",
              date: b.trip?.startDate || "",
              vehicle: b.vehicle?.registration || "N/A",
            }));

          setUpcomingBookings(upcoming);
          setMetrics((prev) => ({
            ...prev,
            activeBookings: activeBookings.length,
          }));
        } catch {
          // Booking endpoints may not be implemented yet
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (user && isAuthorized) {
      fetchDashboardData();
    }
  }, [user, isAuthorized]);

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
          <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {t("ownerDashboard", { defaultValue: "Owner Dashboard" })}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {t("welcomeBack", { defaultValue: "Welcome back" })},{" "}
                  {user.firstName}!
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
          {/* Metrics Grid */}
          <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Revenue */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Revenue
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {metrics.totalRevenue}
                  </p>
                </div>
                <div className="rounded-full bg-green-100 p-3">
                  <FaDollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Active Bookings */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Active Bookings
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {metrics.activeBookings}
                  </p>
                </div>
                <div className="rounded-full bg-blue-100 p-3">
                  <FaCalendarAlt className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Pending Quotes */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Pending Quotes
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {metrics.pendingQuotes}
                  </p>
                </div>
                <div className="rounded-full bg-yellow-100 p-3">
                  <FaFileAlt className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>

            {/* Average Rating */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Average Rating
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {metrics.averageRating > 0
                      ? `${metrics.averageRating}/5.0`
                      : "N/A"}
                  </p>
                </div>
                <div className="rounded-full bg-purple-100 p-3">
                  <FaStar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Quick Actions
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Add Vehicle - Primary Action */}
              <Link
                href={`/${locale}/owner/fleet/add`}
                className="flex items-center gap-4 rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                <div className="rounded-full bg-gray-100 p-3">
                  <FaPlus className="h-6 w-6 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Add Vehicle</h3>
                  <p className="text-sm text-gray-500">List a new vehicle</p>
                </div>
              </Link>

              {/* Manage Fleet */}
              <Link
                href={`/${locale}/owner/fleet`}
                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="rounded-full bg-blue-100 p-3">
                  <FaBus className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Manage Fleet</h3>
                  <p className="text-sm text-gray-500">View all vehicles</p>
                </div>
              </Link>

              {/* View All Quotes */}
              <Link
                href={`/${locale}/owner/quotations`}
                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="rounded-full bg-yellow-100 p-3">
                  <FaClipboardList className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">View All Quotes</h3>
                  <p className="text-sm text-gray-500">Manage quotations</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Quotation Requests - Takes 2 columns */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Quotation Requests
                    </h2>
                    <p className="text-sm text-gray-500">
                      Respond to customer inquiries
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/owner/quotations`}
                    className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    View All
                    <FaArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Filter Tabs */}
                <div className="border-b border-gray-200 px-6">
                  <div className="flex gap-4">
                    {[
                      { id: "all", label: "All" },
                      { id: "new", label: "New" },
                      { id: "pending", label: "Pending Response" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() =>
                          setQuotationFilter(tab.id as typeof quotationFilter)
                        }
                        className={`border-b-2 py-3 text-sm font-medium transition-colors ${
                          quotationFilter === tab.id
                            ? "border-gray-900 text-gray-900"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Request List */}
                <div className="p-6">
                  {quotationRequests.length > 0 ? (
                    <div className="space-y-4">
                      {quotationRequests.map((request) => (
                        <div
                          key={request.id}
                          className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900">
                                {request.customer}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {request.id}
                              </p>
                            </div>
                            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                              New
                            </span>
                          </div>

                          <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                            <div className="flex items-center gap-1.5">
                              <FaMapMarkerAlt className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">
                                {request.route}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <FaCalendarAlt className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">
                                {request.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <FaUsers className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">
                                {request.passengers} passengers
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <FaClock className="h-4 w-4 text-gray-400" />
                              <span className="text-yellow-600">
                                {request.expiresIn}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                        <FaFileAlt className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="mb-2 font-semibold text-gray-900">
                        No Quotation Requests
                      </h3>
                      <p className="text-sm text-gray-600">
                        New quotation requests from customers will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-8">
              {/* Upcoming Bookings */}
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Upcoming Bookings
                  </h2>
                  <Link
                    href={`/${locale}/owner/bookings`}
                    className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    View All
                    <FaArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="p-6">
                  {upcomingBookings.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-gray-900">
                              {booking.customer}
                            </span>
                            <span className="text-xs text-gray-500">
                              {booking.date}
                            </span>
                          </div>
                          <p className="mb-1 text-sm text-gray-600">
                            {booking.route}
                          </p>
                          <p className="text-xs text-gray-500">
                            {booking.vehicle}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <FaCalendarAlt className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                      <p className="text-sm text-gray-500">
                        No upcoming bookings
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fleet Overview */}
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Fleet Overview
                  </h2>
                  <Link
                    href={`/${locale}/owner/fleet`}
                    className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    Manage
                    <FaArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="p-6">
                  <div className="mb-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm text-gray-600">Active</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {fleetStats.active} vehicles
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        <span className="text-sm text-gray-600">Inactive</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {fleetStats.inactive} vehicles
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="text-sm text-gray-600">
                          Pending Review
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {fleetStats.pendingReview} vehicles
                      </span>
                    </div>
                  </div>

                  {/* Fleet Utilization */}
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Fleet Utilization
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {fleetStats.utilization}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${fleetStats.utilization}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
