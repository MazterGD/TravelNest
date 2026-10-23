"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Button,
  Input,
  TextArea,
  Select,
  DatePicker,
  TimePicker,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ArrowRightIcon,
  ArrowsRightLeftIcon,
} from "@/components/ui";
import { DISTRICTS, VEHICLE_TYPES } from "@/constants";
import { cn } from "@/lib/utils/cn";

// Form input type
export interface QuotationRequestInput {
  pickupDistrict: string;
  pickupAddress: string;
  pickupCity: string;
  dropoffDistrict: string;
  dropoffAddress: string;
  dropoffCity: string;
  pickupDate: string;
  pickupTime: string;
  returnDate?: string;
  returnTime?: string;
  isRoundTrip: boolean;
  passengerCount: number;
  vehicleType: string;
  specialRequests?: string;
  luggageCount: number;
  needsAC: boolean;
}

interface QuotationRequestFormProps {
  onSubmit: (
    data: QuotationRequestInput
  ) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
  initialData?: Partial<QuotationRequestInput>;
  isLoading?: boolean;
}

export function QuotationRequestForm({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
}: QuotationRequestFormProps) {
  const t = useTranslations("quotation");
  const [isRoundTrip, setIsRoundTrip] = useState(
    initialData?.isRoundTrip ?? true
  );
  const [formData, setFormData] = useState<Partial<QuotationRequestInput>>({
    isRoundTrip: true,
    passengerCount: 1,
    luggageCount: 0,
    needsAC: true,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = <K extends keyof QuotationRequestInput>(
    field: K,
    value: QuotationRequestInput[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.pickupDistrict) newErrors.pickupDistrict = t("required");
    if (!formData.pickupAddress) newErrors.pickupAddress = t("required");
    if (!formData.dropoffDistrict) newErrors.dropoffDistrict = t("required");
    if (!formData.dropoffAddress) newErrors.dropoffAddress = t("required");
    if (!formData.pickupDate) newErrors.pickupDate = t("required");
    if (!formData.pickupTime) newErrors.pickupTime = t("required");
    if (!formData.vehicleType) newErrors.vehicleType = t("required");
    if (isRoundTrip && !formData.returnDate)
      newErrors.returnDate = t("required");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const result = await onSubmit(formData as QuotationRequestInput);
    if (!result.success && result.error) {
      console.error("Form submission error:", result.error);
    }
  };

  const districtOptions = DISTRICTS.map((d: string) => ({
    value: d,
    label: d,
  }));
  const vehicleTypeOptions = VEHICLE_TYPES.map((v) => ({
    value: v.value,
    label: v.label,
  }));

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* Trip Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("tripType")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setIsRoundTrip(false);
                updateField("isRoundTrip", false);
              }}
              className={cn(
                "flex-1 p-4 rounded-lg border-2 transition-colors",
                !isRoundTrip
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-3">
                <ArrowRightIcon className="w-6 h-6" />
                <div className="text-left">
                  <p className="font-medium">{t("oneWay")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("oneWayDesc")}
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRoundTrip(true);
                updateField("isRoundTrip", true);
              }}
              className={cn(
                "flex-1 p-4 rounded-lg border-2 transition-colors",
                isRoundTrip
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-3">
                <ArrowsRightLeftIcon className="w-6 h-6" />
                <div className="text-left">
                  <p className="font-medium">{t("roundTrip")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("roundTripDesc")}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Pickup Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("pickupLocation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={formData.pickupAddress || ""}
            onChange={(e) => updateField("pickupAddress", e.target.value)}
            label={t("address")}
            placeholder={t("addressPlaceholder")}
            error={errors.pickupAddress}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              value={formData.pickupCity || ""}
              onChange={(e) => updateField("pickupCity", e.target.value)}
              label={t("city")}
              placeholder={t("cityPlaceholder")}
            />
            <Select
              options={districtOptions}
              value={formData.pickupDistrict}
              label={t("district")}
              placeholder={t("selectDistrict")}
              onChange={(value) => updateField("pickupDistrict", value)}
              error={errors.pickupDistrict}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dropoff Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("dropoffLocation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={formData.dropoffAddress || ""}
            onChange={(e) => updateField("dropoffAddress", e.target.value)}
            label={t("address")}
            placeholder={t("addressPlaceholder")}
            error={errors.dropoffAddress}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              value={formData.dropoffCity || ""}
              onChange={(e) => updateField("dropoffCity", e.target.value)}
              label={t("city")}
              placeholder={t("cityPlaceholder")}
            />
            <Select
              options={districtOptions}
              value={formData.dropoffDistrict}
              label={t("district")}
              placeholder={t("selectDistrict")}
              onChange={(value) => updateField("dropoffDistrict", value)}
              error={errors.dropoffDistrict}
            />
          </div>
        </CardContent>
      </Card>

      {/* Date & Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("dateTime")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              value={formData.pickupDate}
              onChange={(e) => updateField("pickupDate", e.target.value)}
              label={t("pickupDate")}
              min={new Date().toISOString().split("T")[0]}
              error={errors.pickupDate}
            />
            <TimePicker
              value={formData.pickupTime}
              onChange={(e) => updateField("pickupTime", e.target.value)}
              label={t("pickupTime")}
              error={errors.pickupTime}
            />
          </div>
          {isRoundTrip && (
            <div className="grid grid-cols-2 gap-4">
              <DatePicker
                value={formData.returnDate}
                onChange={(e) => updateField("returnDate", e.target.value)}
                label={t("returnDate")}
                min={
                  formData.pickupDate || new Date().toISOString().split("T")[0]
                }
                error={errors.returnDate}
              />
              <TimePicker
                value={formData.returnTime}
                onChange={(e) => updateField("returnTime", e.target.value)}
                label={t("returnTime")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("vehiclePreferences")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            options={vehicleTypeOptions}
            value={formData.vehicleType}
            label={t("vehicleType")}
            placeholder={t("selectVehicleType")}
            onChange={(value) => updateField("vehicleType", value)}
            error={errors.vehicleType}
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              type="number"
              min={1}
              value={formData.passengerCount || 1}
              onChange={(e) =>
                updateField("passengerCount", parseInt(e.target.value) || 1)
              }
              label={t("passengers")}
            />
            <Input
              type="number"
              min={0}
              value={formData.luggageCount || 0}
              onChange={(e) =>
                updateField("luggageCount", parseInt(e.target.value) || 0)
              }
              label={t("luggage")}
            />
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.needsAC ?? true}
                  onChange={(e) => updateField("needsAC", e.target.checked)}
                  className="w-4 h-4 rounded border-input text-primary focus-visible:ring-primary"
                />
                <span className="text-sm font-medium">{t("needsAC")}</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("specialRequests")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TextArea
            value={formData.specialRequests || ""}
            onChange={(e) => updateField("specialRequests", e.target.value)}
            placeholder={t("specialRequestsPlaceholder")}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            {t("cancel")}
          </Button>
        )}
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {t("submitRequest")}
        </Button>
      </div>
    </form>
  );
}
