"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui";
import { useOwnerGuard } from "@/hooks";
import { vehicleService, tripPackageService, ApiError } from "@/lib/api";
import type { Vehicle } from "@/types";
import { TripPackageForm } from "@/components/features/owner/TripPackageForm";
import { ArrowLeft } from 'lucide-react';

export default function NewTripPackagePage() {
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVehicles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await vehicleService.getMyVehicles();
        setVehicles(response.vehicles || []);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load vehicles");
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthorized) {
      loadVehicles();
    }
  }, [isAuthorized]);

  const handleSubmit = async (data: {
    vehicleId: string;
    title: string;
    description?: string;
    startLocation: string;
    endLocation: string;
    durationDays: number;
    price: number;
    minPassengers: number;
    maxPassengers: number;
    isActive: boolean;
  }) => {
    setIsSaving(true);
    try {
      await tripPackageService.create(data);
      router.push(`/${locale}/owner/packages`);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Failed to create package");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (guardLoading || !isAuthorized) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href={`/${locale}/owner/packages`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Packages
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">
              Create Trip Package
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm text-gray-600">
                Add at least one vehicle before creating a trip package.
              </p>
              <Link
                href={`/${locale}/owner/fleet/add`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#20B0E9] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a8fc4]"
              >
                Add Vehicle
              </Link>
            </div>
          ) : (
            <TripPackageForm
              vehicles={vehicles}
              isLoading={isSaving}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
  );
}
