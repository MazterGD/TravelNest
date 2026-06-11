"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DisputesView } from "@/components/features/disputes/DisputesView";
import { bookingService } from "@/lib/api";

export default function OwnerDisputesPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? "en";

  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = (await bookingService.getOwnerBookings({
          page: 1,
          limit: 100,
        })) as { bookings?: Array<Record<string, unknown>> };
        const list = res.bookings ?? [];
        if (active) {
          setOptions(
            list.map((b) => ({
              id: String(b.id),
              label: `${(b.vehicleName as string) ?? "Booking"} · ${new Date(
                b.startDate as string,
              ).toLocaleDateString(locale)}`,
            })),
          );
        }
      } catch {
        // Non-fatal: the user can still view existing disputes.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <DisputesView locale={locale} bookingOptions={options} bookingsLoading={loading} />
  );
}
