"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAdminGuard } from "@/hooks";
import { useAuthStore } from "@/store";
import { cn } from "@/lib/utils/cn";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Live platform overview",
    segment: "dashboard",
  },
  {
    key: "users",
    label: "Users",
    description: "Accounts and admin controls",
    segment: "users",
  },
  {
    key: "bookings",
    label: "Bookings",
    description: "Operations and refunds",
    segment: "bookings",
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Performance and trends",
    segment: "analytics",
  },
  {
    key: "disputes",
    label: "Disputes",
    description: "Case resolution queue",
    segment: "disputes",
  },
  {
    key: "financial",
    label: "Financial",
    description: "Settlements and commissions",
    segment: "financial",
  },
  {
    key: "settings",
    label: "Settings",
    description: "Platform defaults and controls",
    segment: "settings",
  },
  {
    key: "content",
    label: "Content",
    description: "Pages, FAQs, testimonials",
    segment: "content",
  },
  {
    key: "amenities",
    label: "Amenities",
    description: "Bus amenity catalog",
    segment: "amenities",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Campaigns and delivery stats",
    segment: "notifications",
  },
  {
    key: "audit-logs",
    label: "Audit Logs",
    description: "Security and activity history",
    segment: "audit-logs",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Scheduled and exported insights",
    segment: "reports",
  },
  {
    key: "profile",
    label: "Admin Profile",
    description: "Personal info and permissions",
    segment: "profile",
  },
  {
    key: "owner-verifications",
    label: "Owner Verify",
    description: "Owner approval queue",
    segment: "verifications/owners",
  },
  {
    key: "vehicle-verifications",
    label: "Vehicle Verify",
    description: "Vehicle document checks",
    segment: "verifications/vehicles",
  },
  {
    key: "reviews-moderation",
    label: "Review Moderation",
    description: "Flagged and reported reviews",
    segment: "reviews/moderation",
  },
] as const;

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const { user } = useAuthStore();
  const { isLoading, isAuthorized } = useAdminGuard();

  if (isLoading || !isAuthorized || !user) {
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
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-[20px] border border-border bg-muted p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">TravelNest Admin</p>
                <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
                  Platform Command Center
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Manage users, monitor bookings, and track platform health from one place.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <p className="font-medium text-foreground">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <nav className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">
              {NAV_ITEMS.map((item) => {
                const href = `/${locale}/admin/${item.segment}`;
                const isActive = pathname === href;

                return (
                  <Link
                    key={item.key}
                    href={href}
                    className={cn(
                      "rounded-xl border px-4 py-3 transition-all duration-200",
                      isActive
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/40 hover:bg-background",
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        isActive ? "text-primary" : "text-foreground",
                      )}
                    >
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </Link>
                );
              })}
            </nav>
          </section>

          <div className="pb-12 pt-6">{children}</div>
        </div>
      </div>
    </MainLayout>
  );
}
