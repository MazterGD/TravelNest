"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";
import { useOwnerGuard } from "@/hooks";
import { vehicleService, ApiError } from "@/lib/api";
import { ArrowLeft, Ban, Check, X } from "lucide-react";

interface BlockedDate {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  notes?: string;
}

interface BookedDate {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface VehicleSummary {
  id: string;
  registration: string;
  type: string;
}

export default function VehicleAvailabilityPage() {
  const params = useParams<{ id?: string | string[]; locale?: string }>();
  const { user } = useAuthStore();
  const { isLoading: guardLoading, isAuthorized } = useOwnerGuard();
  const locale = typeof params?.locale === "string" ? params.locale : "en";
  const vehicleId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const t = useTranslations("vehicleAvailability");

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockNotes, setBlockNotes] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleSummary | null>(null);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [bookedDates, setBookedDates] = useState<BookedDate[]>([]);

  const fetchAvailabilityData = useCallback(
    async (month?: string) => {
      if (!isAuthorized || !vehicleId) {
        if (!vehicleId) {
          setPageError(t("errorNotFound"));
        }
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      setPageError(null);

      try {
        const [vehicleResponse, availabilityResponse] = await Promise.all([
          vehicleService.getById(vehicleId),
          vehicleService.getAvailability(vehicleId, month),
        ]);

        const vehicleData =
          (vehicleResponse as any)?.vehicle || vehicleResponse;
        setVehicle({
          id: vehicleData.id,
          registration: vehicleData.licensePlate,
          type: vehicleData.type,
        });

        setBlockedDates(
          availabilityResponse.blocked.map((b) => ({
            id: b.id,
            startDate: b.startDate,
            endDate: b.endDate,
            reason: b.reason || "",
          })),
        );

        setBookedDates(availabilityResponse.booked);
      } catch (error) {
        if (error instanceof ApiError) {
          setPageError(error.message);
        } else {
          setPageError(t("errorLoad"));
        }
      } finally {
        setIsLoadingData(false);
      }
    },
    [isAuthorized, t, vehicleId],
  );

  useEffect(() => {
    const year = selectedMonth.getFullYear();
    const month = String(selectedMonth.getMonth() + 1).padStart(2, "0");
    fetchAvailabilityData(`${year}-${month}`);
  }, [selectedMonth, fetchAvailabilityData]);

  // Sri Lanka is UTC+5:30. Using toISOString() converts midnight local time to the
  // previous UTC day, causing an off-by-one. This helper formats using local time.
  const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      daysInMonth: lastDay.getDate(),
      startingDayOfWeek: firstDay.getDay(),
      year,
      month,
    };
  };

  const isDateBlocked = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return blockedDates.some(
      (block) => dateStr >= block.startDate && dateStr <= block.endDate,
    );
  };

  const isDateBooked = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return bookedDates.some(
      (booking) => dateStr >= booking.startDate && dateStr <= booking.endDate,
    );
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.some(
      (d) => toLocalDateStr(d) === toLocalDateStr(date),
    );
  };

  const handleDateClick = (date: Date) => {
    if (isDateBooked(date)) return;
    setSelectedDates((prev) =>
      isDateSelected(date)
        ? prev.filter((d) => d.getTime() !== date.getTime())
        : [...prev, date],
    );
  };

  const confirmBlock = () => {
    if (!selectedDates.length) return;

    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const start = sorted[0] ? toLocalDateStr(sorted[0]) : "";
    const end = sorted[sorted.length - 1] ? toLocalDateStr(sorted[sorted.length - 1]!) : "";

    setBlockedDates((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        startDate: start,
        endDate: end,
        reason: blockReason,
        notes: blockNotes || undefined,
      },
    ]);

    setShowBlockModal(false);
    setSelectedDates([]);
    setBlockReason("");
    setBlockNotes("");
  };

  const removeBlock = (id: string) => {
    setBlockedDates((prev) => prev.filter((b) => b.id !== id));
  };

  const WEEK_DAYS = [
    t("weekSun"),
    t("weekMon"),
    t("weekTue"),
    t("weekWed"),
    t("weekThu"),
    t("weekFri"),
    t("weekSat"),
  ];

  const { daysInMonth, startingDayOfWeek, year, month } =
    getDaysInMonth(selectedMonth);

  if (guardLoading || !isAuthorized || !user || isLoadingData) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (pageError || !vehicle) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-md border border-error bg-[var(--color-error-bg)] p-6 text-sm text-error-foreground">
            {pageError || t("errorNotFound")}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-muted">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
            <Link
              href={`/${locale}/owner/fleet`}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToFleet")}
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-heading-md font-semibold text-foreground">
                  {t("pageTitle")}
                </h1>
                <p className="mt-1 text-body text-muted-foreground">
                  {vehicle.registration} • {vehicle.type}
                </p>
              </div>
              {selectedDates.length > 0 && (
                <button
                  onClick={() => setShowBlockModal(true)}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Ban className="h-4 w-4" />
                  {t("blockDates")} ({selectedDates.length})
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-border bg-card p-6">
                {/* Month Navigation */}
                <div className="mb-6 flex items-center justify-between">
                  <button
                    aria-label="Previous month"
                    onClick={() =>
                      setSelectedMonth(
                        new Date(
                          selectedMonth.getFullYear(),
                          selectedMonth.getMonth() - 1,
                        ),
                      )
                    }
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h2 className="text-body-lg font-semibold text-foreground">
                    {selectedMonth.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <button
                    aria-label="Next month"
                    onClick={() =>
                      setSelectedMonth(
                        new Date(
                          selectedMonth.getFullYear(),
                          selectedMonth.getMonth() + 1,
                        ),
                      )
                    }
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </button>
                </div>

                {/* Weekday Headers */}
                <div className="mb-2 grid grid-cols-7 gap-2">
                  {WEEK_DAYS.map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-muted-foreground"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(year, month, day);
                    const isBooked = isDateBooked(date);
                    const isBlocked = isDateBlocked(date);
                    const isSelected = isDateSelected(date);
                    const isPast =
                      date < new Date(new Date().setHours(0, 0, 0, 0));

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => !isPast && handleDateClick(date)}
                        disabled={isPast || isBooked}
                        className={`aspect-square rounded-md border-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isPast
                            ? "cursor-not-allowed border-transparent bg-muted text-[var(--color-text-tertiary)]"
                            : isBooked
                              ? "cursor-not-allowed border-error bg-[var(--color-error-bg)] text-error-foreground"
                              : isBlocked
                                ? "border-border bg-muted text-muted-foreground"
                                : isSelected
                                  ? "border-primary bg-primary text-white"
                                  : "border-transparent bg-card text-foreground hover:border-primary"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-sm border-2 border-primary bg-primary" />
                    <span className="text-muted-foreground">
                      {t("legendSelected")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-sm border-2 border-error bg-[var(--color-error-bg)]" />
                    <span className="text-muted-foreground">
                      {t("legendBooked")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-sm border-2 border-border bg-muted" />
                    <span className="text-muted-foreground">
                      {t("legendBlocked")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-sm border-2 border-border bg-card" />
                    <span className="text-muted-foreground">
                      {t("legendAvailable")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* How to Use */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="mb-3 text-body-lg font-semibold text-foreground">
                  {t("howToUseTitle")}
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {t("howToUseSelect")}</li>
                  <li>• {t("howToUseBlock")}</li>
                  <li>• {t("howToUseBooked")}</li>
                  <li>• {t("howToUsePast")}</li>
                </ul>
              </div>

              {/* Blocked Periods */}
              {blockedDates.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-5">
                  <h3 className="mb-4 text-body-lg font-semibold text-foreground">
                    {t("blockedPeriodsTitle")}
                  </h3>
                  <div className="space-y-3">
                    {blockedDates.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-md border border-border bg-muted p-3"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          {block.reason && (
                            <div className="text-sm font-medium text-foreground">
                              {block.reason}
                            </div>
                          )}
                          <button
                            type="button"
                            aria-label="Remove block"
                            onClick={() => removeBlock(block.id)}
                            className="shrink-0 text-muted-foreground transition-colors hover:text-error-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(block.startDate).toLocaleDateString()} —{" "}
                          {new Date(block.endDate).toLocaleDateString()}
                        </div>
                        {block.notes && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {block.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Bookings */}
              {bookedDates.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-5">
                  <h3 className="mb-4 text-body-lg font-semibold text-foreground">
                    {t("upcomingBookingsTitle")}
                  </h3>
                  <div className="space-y-3">
                    {bookedDates.map((booking) => (
                      <div
                        key={booking.id}
                        className="rounded-md border border-border bg-muted p-3"
                      >
                        <div className="mb-1 text-xs font-medium text-muted-foreground">
                          {booking.status}
                        </div>
                        <div className="text-xs text-foreground">
                          {new Date(booking.startDate).toLocaleDateString()} —{" "}
                          {new Date(booking.endDate).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Block Dates Modal */}
        {showBlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
              <h3 className="mb-4 text-body-lg font-semibold text-foreground">
                {t("modalTitle")}
              </h3>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t("modalReasonLabel")}
                </label>
                <select
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t("modalReasonPlaceholder")}</option>
                  <option value="Maintenance">
                    {t("modalReasonMaintenance")}
                  </option>
                  <option value="Personal Use">
                    {t("modalReasonPersonal")}
                  </option>
                  <option value="Repairs">{t("modalReasonRepairs")}</option>
                  <option value="Other">{t("modalReasonOther")}</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t("modalNotesLabel")}
                </label>
                <textarea
                  value={blockNotes}
                  onChange={(e) => setBlockNotes(e.target.value)}
                  rows={3}
                  placeholder={t("modalNotesPlaceholder")}
                  className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("modalCancel")}
                </button>
                <button
                  type="button"
                  onClick={confirmBlock}
                  disabled={!blockReason}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Check className="h-4 w-4" />
                  {t("modalConfirm")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
