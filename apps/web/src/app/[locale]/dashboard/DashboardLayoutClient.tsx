"use client";

import { useCustomerGuard } from "@/hooks";
import { LoadingSpinner } from "@/components/ui";

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  locale: string;
}

/**
 * Auth guard for dashboard pages that need explicit customer-role protection.
 * Layout (sidebar, header) is provided by dashboard/layout.tsx — this component
 * only blocks rendering until the auth check completes.
 */
export function DashboardLayoutClient({
  children,
}: DashboardLayoutClientProps) {
  const { isLoading: guardLoading, isAuthorized } = useCustomerGuard();

  if (guardLoading || !isAuthorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
