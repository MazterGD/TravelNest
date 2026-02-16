"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, ConfirmDialog, Badge } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { tripPackageService, ApiError } from "@/lib/api";
import type { TripPackage } from "@/types";
import {
  FaArrowLeft,
  FaPlus,
  FaMapMarkerAlt,
  FaUsers,
  FaClock,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

export default function OwnerPackagesPage() {
  const params = useParams();
  const locale = params.locale as string;
  const { user } = useAuthStore();
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [packages, setPackages] = useState<TripPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPackages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tripPackageService.getMyPackages();
      setPackages(response.packages || []);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load trip packages");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAuthorized) {
      loadPackages();
    }
  }, [user, isAuthorized]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await tripPackageService.delete(deleteId);
      await loadPackages();
      setDeleteId(null);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert("Failed to delete package");
    } finally {
      setIsDeleting(false);
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
                  Trip Packages
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  {packages.length} package{packages.length !== 1 && "s"}
                </p>
              </div>
              <Link
                href={`/${locale}/owner/packages/new`}
                className="flex items-center gap-2 rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]"
              >
                <FaPlus className="h-4 w-4" />
                Add Package
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : packages.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {packages.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-white p-6"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {item.title}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {item.vehicle?.name || "Vehicle"}
                      </p>
                    </div>
                    <Badge variant={item.isActive ? "success" : "secondary"}>
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <FaMapMarkerAlt className="h-4 w-4 text-gray-400" />
                      {item.startLocation} → {item.endLocation}
                    </div>
                    <div className="flex items-center gap-2">
                      <FaClock className="h-4 w-4 text-gray-400" />
                      {item.durationDays} day(s)
                    </div>
                    <div className="flex items-center gap-2">
                      <FaUsers className="h-4 w-4 text-gray-400" />
                      {item.minPassengers} - {item.maxPassengers} passengers
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Package Price</p>
                      <p className="text-lg font-semibold text-gray-900">
                        LKR {item.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${locale}/owner/packages/${item.id}/edit`}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <FaEdit className="h-4 w-4" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteId(item.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        <FaTrash className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
              <p className="text-sm text-gray-600">
                No packages yet. Create your first package to offer fixed
                routes.
              </p>
              <Link
                href={`/${locale}/owner/packages/new`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]"
              >
                <FaPlus className="h-4 w-4" />
                Add Package
              </Link>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Package"
        message="Are you sure you want to delete this trip package?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </MainLayout>
  );
}
