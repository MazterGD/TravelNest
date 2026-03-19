"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  PageHeader,
  Button,
  Card,
  Input,
  Modal,
  DatePicker,
} from "@/components/ui";
import { TripPackageCard } from "@/components/features/customer";
import { tripPackageService, ApiError } from "@/lib/api";
import type { TripPackage } from "@/types";
import { FaFilter, FaTimes } from "react-icons/fa";

interface PackagesPageContentProps {
  locale: string;
}

export function PackagesPageContent({ locale }: PackagesPageContentProps) {
  const t = useTranslations("packages");
  const router = useRouter();
  const [packages, setPackages] = useState<TripPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    startLocation: "",
    endLocation: "",
    durationDays: "",
    minPassengers: "",
    maxPassengers: "",
    minPrice: "",
    maxPrice: "",
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [bookingPackage, setBookingPackage] = useState<TripPackage | null>(
    null,
  );
  const [bookingDate, setBookingDate] = useState("");
  const [bookingPassengers, setBookingPassengers] = useState(1);
  const [bookingNotes, setBookingNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);

  const fetchPackages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tripPackageService.getAll({ isActive: true });
      setPackages(response.packages || []);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t("errors.fetchPackages"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const filteredPackages = useMemo(() => {
    let list = [...packages];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      list = list.filter((pkg) =>
        [pkg.title, pkg.startLocation, pkg.endLocation]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    if (filters.startLocation) {
      list = list.filter((pkg) =>
        pkg.startLocation
          .toLowerCase()
          .includes(filters.startLocation.toLowerCase()),
      );
    }

    if (filters.endLocation) {
      list = list.filter((pkg) =>
        pkg.endLocation
          .toLowerCase()
          .includes(filters.endLocation.toLowerCase()),
      );
    }

    if (filters.durationDays) {
      const duration = Number(filters.durationDays);
      list = list.filter((pkg) => pkg.durationDays === duration);
    }

    if (filters.minPassengers) {
      const minPassengers = Number(filters.minPassengers);
      list = list.filter((pkg) => pkg.maxPassengers >= minPassengers);
    }

    if (filters.maxPassengers) {
      const maxPassengers = Number(filters.maxPassengers);
      list = list.filter((pkg) => pkg.minPassengers <= maxPassengers);
    }

    if (filters.minPrice) {
      const minPrice = Number(filters.minPrice);
      list = list.filter((pkg) => pkg.price >= minPrice);
    }

    if (filters.maxPrice) {
      const maxPrice = Number(filters.maxPrice);
      list = list.filter((pkg) => pkg.price <= maxPrice);
    }

    return list;
  }, [packages, searchQuery, filters]);

  const selectedPackages = packages.filter((pkg) =>
    selectedIds.includes(pkg.id),
  );

  const toggleCompare = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        alert(t("errors.compareLimit"));
        return prev;
      }
      return [...prev, id];
    });
  };

  const openBookingModal = (pkg: TripPackage) => {
    setBookingPackage(pkg);
    setBookingDate("");
    setBookingPassengers(pkg.minPassengers);
    setBookingNotes("");
  };

  const handleBooking = async () => {
    if (!bookingPackage) return;
    if (!bookingDate) {
      alert(t("errors.missingStartDate"));
      return;
    }

    if (
      bookingPassengers < bookingPackage.minPassengers ||
      bookingPassengers > bookingPackage.maxPassengers
    ) {
      alert(t("errors.passengerLimit"));
      return;
    }

    setIsBooking(true);
    try {
      const startDate = new Date(bookingDate).toISOString();
      const response = await tripPackageService.book(bookingPackage.id, {
        startDate,
        passengerCount: bookingPassengers,
        notes: bookingNotes || undefined,
      });
      setBookingPackage(null);
      const bookingId = (response as { booking: { id: string } }).booking.id;
      router.push(`/${locale}/dashboard/bookings/${bookingId}/payment`);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert(t("errors.bookingFailed"));
    } finally {
      setIsBooking(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      startLocation: "",
      endLocation: "",
      durationDays: "",
      minPassengers: "",
      maxPassengers: "",
      minPrice: "",
      maxPrice: "",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FaFilter className="mr-2 h-4 w-4" />
              {t("filters.title")}
            </Button>
            <Button variant="ghost" onClick={clearFilters}>
              {t("filters.clear")}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Input
              label={t("filters.startLocation")}
              value={filters.startLocation}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  startLocation: e.target.value,
                }))
              }
            />
            <Input
              label={t("filters.endLocation")}
              value={filters.endLocation}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  endLocation: e.target.value,
                }))
              }
            />
            <Input
              label={t("filters.durationDays")}
              type="number"
              min={1}
              value={filters.durationDays}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  durationDays: e.target.value,
                }))
              }
            />
            <Input
              label={t("filters.minPassengers")}
              type="number"
              min={1}
              value={filters.minPassengers}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  minPassengers: e.target.value,
                }))
              }
            />
            <Input
              label={t("filters.maxPassengers")}
              type="number"
              min={1}
              value={filters.maxPassengers}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  maxPassengers: e.target.value,
                }))
              }
            />
            <Input
              label={t("filters.minPrice")}
              type="number"
              min={0}
              value={filters.minPrice}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  minPrice: e.target.value,
                }))
              }
            />
            <Input
              label={t("filters.maxPrice")}
              type="number"
              min={0}
              value={filters.maxPrice}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  maxPrice: e.target.value,
                }))
              }
            />
          </div>
        )}
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-background p-8 text-center">
          {t("loading")}
        </div>
      ) : filteredPackages.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredPackages.map((pkg) => (
            <TripPackageCard
              key={pkg.id}
              tripPackage={pkg}
              isSelected={selectedIds.includes(pkg.id)}
              onToggleCompare={toggleCompare}
              onBook={openBookingModal}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      )}

      {selectedPackages.length >= 2 && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {t("compare.title")}
            </h3>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedIds([])}
            >
              {t("compare.clear")}
            </button>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">{t("compare.feature")}</th>
                  {selectedPackages.map((pkg) => (
                    <th key={pkg.id} className="min-w-[200px] py-2 pr-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {pkg.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCompare(pkg.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t("compare.route")}
                  </td>
                  {selectedPackages.map((pkg) => (
                    <td key={pkg.id} className="py-3 pr-4">
                      {pkg.startLocation} → {pkg.endLocation}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t("compare.duration")}
                  </td>
                  {selectedPackages.map((pkg) => (
                    <td key={pkg.id} className="py-3 pr-4">
                      {t("durationDays", { count: pkg.durationDays })}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t("compare.passengers")}
                  </td>
                  {selectedPackages.map((pkg) => (
                    <td key={pkg.id} className="py-3 pr-4">
                      {pkg.minPassengers} - {pkg.maxPassengers}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t("compare.vehicle")}
                  </td>
                  {selectedPackages.map((pkg) => (
                    <td key={pkg.id} className="py-3 pr-4">
                      {pkg.vehicle?.name || t("vehicleFallback")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t("compare.price")}
                  </td>
                  {selectedPackages.map((pkg) => (
                    <td key={pkg.id} className="py-3 pr-4 font-semibold">
                      LKR {pkg.price.toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!bookingPackage}
        onClose={() => setBookingPackage(null)}
        title={
          bookingPackage
            ? t("modal.titleWithName", { name: bookingPackage.title })
            : t("modal.title")
        }
        size="md"
      >
        {bookingPackage && (
          <div className="space-y-4">
            <DatePicker
              label={t("modal.startDate")}
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
            <Input
              label={t("modal.passengerCount", {
                min: bookingPackage.minPassengers,
              })}
              type="number"
              min={bookingPackage.minPassengers}
              max={bookingPackage.maxPassengers}
              value={bookingPassengers}
              onChange={(e) => setBookingPassengers(Number(e.target.value))}
            />
            <Input
              label={t("modal.notes")}
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
            />

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setBookingPackage(null)}>
                {t("modal.cancel")}
              </Button>
              <Button isLoading={isBooking} onClick={handleBooking}>
                {t("modal.confirm")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
