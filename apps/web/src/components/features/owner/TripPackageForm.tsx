"use client";

import { useState } from "react";
import {
  Button,
  Input,
  TextArea,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui";
import type { TripPackage, Vehicle } from "@/types";

interface TripPackageFormProps {
  vehicles: Vehicle[];
  initialData?: Partial<TripPackage>;
  isLoading?: boolean;
  onSubmit: (data: {
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
  }) => Promise<void>;
}

export function TripPackageForm({
  vehicles,
  initialData,
  isLoading = false,
  onSubmit,
}: TripPackageFormProps) {
  const [formData, setFormData] = useState({
    vehicleId: initialData?.vehicleId || "",
    title: initialData?.title || "",
    description: initialData?.description || "",
    startLocation: initialData?.startLocation || "",
    endLocation: initialData?.endLocation || "",
    durationDays: Number(initialData?.durationDays || 1),
    price: Number(initialData?.price || 0),
    minPassengers: Number(initialData?.minPassengers || 1),
    maxPassengers: Number(initialData?.maxPassengers || 1),
    isActive: initialData?.isActive ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle.id,
    label: `${vehicle.name} (${vehicle.seats} seats)`,
  }));

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.vehicleId) nextErrors.vehicleId = "Select a vehicle";
    if (!formData.title.trim()) nextErrors.title = "Title is required";
    if (!formData.startLocation.trim())
      nextErrors.startLocation = "Start location is required";
    if (!formData.endLocation.trim())
      nextErrors.endLocation = "End location is required";
    if (formData.durationDays < 1)
      nextErrors.durationDays = "Duration must be at least 1 day";
    if (formData.price <= 0) nextErrors.price = "Price must be positive";
    if (formData.minPassengers < 1)
      nextErrors.minPassengers = "Minimum passengers required";
    if (formData.maxPassengers < formData.minPassengers)
      nextErrors.maxPassengers = "Max passengers must be >= min passengers";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    await onSubmit({
      vehicleId: formData.vehicleId,
      title: formData.title,
      description: formData.description || undefined,
      startLocation: formData.startLocation,
      endLocation: formData.endLocation,
      durationDays: Number(formData.durationDays),
      price: Number(formData.price),
      minPassengers: Number(formData.minPassengers),
      maxPassengers: Number(formData.maxPassengers),
      isActive: formData.isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Package Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Vehicle"
            options={vehicleOptions}
            value={formData.vehicleId}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, vehicleId: value }))
            }
            error={errors.vehicleId}
            placeholder="Select a vehicle"
          />

          <Input
            label="Package Title"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            error={errors.title}
            placeholder="Colombo to Kandy 2-Day Tour"
          />

          <TextArea
            label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Include itinerary highlights and what is covered"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Route & Duration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input
            label="Start Location"
            value={formData.startLocation}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                startLocation: e.target.value,
              }))
            }
            error={errors.startLocation}
          />
          <Input
            label="End Location"
            value={formData.endLocation}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, endLocation: e.target.value }))
            }
            error={errors.endLocation}
          />
          <Input
            label="Duration (days)"
            type="number"
            min={1}
            value={formData.durationDays}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                durationDays: Number(e.target.value),
              }))
            }
            error={errors.durationDays}
          />
          <Input
            label="Package Price (LKR)"
            type="number"
            min={0}
            value={formData.price}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                price: Number(e.target.value),
              }))
            }
            error={errors.price}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Passenger Limits</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input
            label="Minimum Passengers"
            type="number"
            min={1}
            value={formData.minPassengers}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                minPassengers: Number(e.target.value),
              }))
            }
            error={errors.minPassengers}
          />
          <Input
            label="Maximum Passengers"
            type="number"
            min={1}
            value={formData.maxPassengers}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                maxPassengers: Number(e.target.value),
              }))
            }
            error={errors.maxPassengers}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="h-4 w-4"
            />
            Package is active and visible to customers
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" isLoading={isLoading}>
          Save Package
        </Button>
      </div>
    </form>
  );
}
