"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { quotationService } from "@/lib/api/services";
import type { Quotation } from "@/types";
import {
  FaArrowLeft,
  FaClock,
  FaMapMarkerAlt,
  FaUsers,
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaFileAlt,
} from "react-icons/fa";
import { useParams } from "next/navigation";

export default function QuotationRequestsPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const locale = params.locale as string;
  const [activeTab, setActiveTab] = useState<"PENDING" | "all">("PENDING");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [requests, setRequests] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Protect this route - only vehicle owners can access
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const response = await quotationService.getOwnerRequests({
          status: activeTab === "PENDING" ? "PENDING" : undefined,
        });
        setRequests(response.quotations || []);
      } catch (error) {
        console.error("Failed to fetch quotation requests:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized) {
      fetchRequests();
    }
  }, [isAuthorized, activeTab]);

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      searchQuery === "" ||
      `${req.customer?.firstName || ""} ${req.customer?.lastName || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      req.pickupLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.dropoffLocation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const tabCounts = {
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    all: requests.length,
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
                  Quotation Requests
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  {filteredRequests.length} request
                  {filteredRequests.length !== 1 && "s"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/${locale}/owner/quotations/sent`}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <FaFileAlt className="h-4 w-4" />
                  Sent Quotations
                </Link>
                {tabCounts.PENDING > 0 && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                    {tabCounts.PENDING} New
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          {/* Filters & Tabs */}
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("PENDING")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "PENDING"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Pending ({tabCounts.PENDING})
                </button>
                <button
                  onClick={() => setActiveTab("all")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "all"
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  All ({tabCounts.all})
                </button>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Filters
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer name or route..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-4 grid gap-4 border-t border-gray-200 pt-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Vehicle Type
                  </label>
                  <select className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option>All Types</option>
                    <option>Luxury Coach</option>
                    <option>Semi-Luxury</option>
                    <option>Standard</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Passenger Count
                  </label>
                  <select className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option>All Capacities</option>
                    <option>16-20</option>
                    <option>21-30</option>
                    <option>31-40</option>
                    <option>41-50</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Sort By
                  </label>
                  <select className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option>Newest First</option>
                    <option>Expiring Soon</option>
                    <option>Distance</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Request Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((request) => {
                const customerName =
                  `${request.customer?.firstName || ""} ${request.customer?.lastName || ""}`.trim() ||
                  "Unknown";
                const startDate = new Date(
                  request.startDate,
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const createdTime = new Date(
                  request.createdAt,
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });

                return (
                  <div
                    key={request.id}
                    className="rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <div className="mb-2 flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900">
                            {customerName}
                          </h3>
                          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                            {request.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {request.quotationId}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <div className="mb-1 text-gray-500">{createdTime}</div>
                      </div>
                    </div>

                    <div className="mb-5 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-center gap-2">
                        <FaMapMarkerAlt className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-xs text-gray-500">Route</div>
                          <div className="font-medium text-gray-900">
                            {request.pickupLocation} → {request.dropoffLocation}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <FaCalendarAlt className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-xs text-gray-500">Date</div>
                          <div className="font-medium text-gray-900">
                            {startDate}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <FaUsers className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-xs text-gray-500">
                            Passengers
                          </div>
                          <div className="font-medium text-gray-900">
                            {request.passengerCount}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-gray-500">
                          Vehicle Type
                        </div>
                        <div className="font-medium text-gray-900">
                          {request.vehicleType}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Link
                        href={`/${locale}/owner/quotations/send/${request.id}`}
                        className="flex-1 rounded-lg bg-[#20B0E9] px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:[#1a8fc4]"
                      >
                        Send Quotation
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <div className="mx-auto max-w-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <FaClock className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  No {activeTab === "PENDING" ? "pending" : ""} requests
                </h3>
                <p className="text-sm text-gray-600">
                  {activeTab === "PENDING"
                    ? "You're all caught up! New quotation requests will appear here."
                    : "No quotation requests at the moment."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
