"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store";
import { getDashboardUrl } from "@/lib/utils/getDashboardUrl";
import { UserRole } from "@/types";

type GuardType = "auth" | "guest" | "role";

interface UseAuthGuardOptions {
  /**
   * Type of guard:
   * - "auth": Requires user to be logged in
   * - "guest": Requires user to NOT be logged in (for login/register pages)
   * - "role": Requires specific role(s)
   */
  type: GuardType;
  /**
   * Required roles (only for "role" type)
   */
  allowedRoles?: UserRole[];
  /**
   * Custom redirect path for unauthorized access
   */
  redirectTo?: string;
}

interface UseAuthGuardResult {
  isLoading: boolean;
  isAuthorized: boolean;
}

// Simple external store for mounted state
const mountedSubscribers = new Set<() => void>();
let isMountedGlobal = false;

function subscribeMounted(callback: () => void) {
  mountedSubscribers.add(callback);
  return () => mountedSubscribers.delete(callback);
}

function getMountedSnapshot() {
  return isMountedGlobal;
}

function getMountedServerSnapshot() {
  return false;
}

/**
 * Hook for protecting routes based on authentication state and user roles.
 * Handles redirects automatically and prevents flash of unauthorized content.
 */
export function useAuthGuard(options: UseAuthGuardOptions): UseAuthGuardResult {
  const { type, allowedRoles = [], redirectTo } = options;
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || "en";

  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const hasRedirected = useRef(false);

  // Use useSyncExternalStore to track mounting without causing cascading renders
  const isMounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );

  // Mark as mounted on first render (client-side only)
  useEffect(() => {
    if (!isMountedGlobal) {
      isMountedGlobal = true;
      mountedSubscribers.forEach((cb) => cb());
    }
  }, []);

  // Calculate authorization synchronously (no setState needed)
  const { authorized, redirectPath } = useMemo(() => {
    if (authLoading || !isMounted) {
      return { authorized: false, redirectPath: null };
    }

    let auth = false;
    let redirect: string | null = null;

    switch (type) {
      case "guest":
        // Guest routes (login, register) - redirect to dashboard if logged in
        if (isAuthenticated && user) {
          auth = false;
          redirect = redirectTo || getDashboardUrl(user, locale);
        } else {
          auth = true;
        }
        break;

      case "auth":
        // Protected routes - redirect to login if not logged in
        if (isAuthenticated && user) {
          auth = true;
        } else {
          auth = false;
          redirect = redirectTo || `/${locale}/login`;
        }
        break;

      case "role":
        // Role-based routes - check if user has required role
        if (!isAuthenticated || !user) {
          auth = false;
          redirect = redirectTo || `/${locale}/login`;
        } else if (
          allowedRoles.length > 0 &&
          !allowedRoles.includes(user.role)
        ) {
          auth = false;
          // Redirect to their appropriate dashboard instead
          redirect = getDashboardUrl(user, locale);
        } else if (
          user.role === UserRole.VEHICLE_OWNER &&
          !user.isVerified
        ) {
          // Unverified owners can authenticate but cannot enter the owner
          // workspace — funnel them to the pending-approval page.
          auth = false;
          redirect = `/${locale}/owner/pending-approval`;
        } else {
          auth = true;
        }
        break;
    }

    return { authorized: auth, redirectPath: redirect };
  }, [
    type,
    allowedRoles,
    redirectTo,
    isAuthenticated,
    user,
    authLoading,
    locale,
    isMounted,
  ]);

  // Handle redirect in effect (but don't set state)
  useEffect(() => {
    if (redirectPath && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(redirectPath);
    }
  }, [redirectPath, router]);

  // Reset redirect flag when auth state changes
  useEffect(() => {
    hasRedirected.current = false;
  }, [isAuthenticated, user]);

  return {
    isLoading: authLoading || !isMounted,
    isAuthorized: authorized,
  };
}

/**
 * Convenience hook for guest-only pages (login, register)
 */
export function useGuestGuard() {
  return useAuthGuard({ type: "guest" });
}

/**
 * Convenience hook for authenticated-only pages
 */
export function useAuthRequired() {
  return useAuthGuard({ type: "auth" });
}

/**
 * Convenience hook for customer-only pages
 */
export function useCustomerGuard() {
  return useAuthGuard({ type: "role", allowedRoles: [UserRole.CUSTOMER] });
}

/**
 * Convenience hook for vehicle owner-only pages
 */
export function useOwnerGuard() {
  return useAuthGuard({ type: "role", allowedRoles: [UserRole.VEHICLE_OWNER] });
}

/**
 * Convenience hook for admin-only pages
 */
export function useAdminGuard() {
  return useAuthGuard({ type: "role", allowedRoles: [UserRole.ADMIN] });
}
