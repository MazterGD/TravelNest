"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { useAuthStore } from "@/store";
import { UserRole, type User } from "@/types";

interface UseProtectedRouteOptions {
  /**
   * Required roles to access the route
   * If empty, any authenticated user can access
   */
  allowedRoles?: UserRole[];
  /**
   * Where to redirect if not authenticated
   */
  redirectTo?: string;
  /**
   * Where to redirect if not authorized (wrong role)
   */
  unauthorizedRedirectTo?: string;
}

interface ProtectedRouteResult {
  isLoading: boolean;
  isAuthorized: boolean;
  user: User | null;
}

/**
 * Hook to protect routes based on authentication and roles
 * Automatically redirects unauthorized users
 *
 * @example
 * // Protect route for any authenticated user
 * const { isLoading, isAuthorized, user } = useProtectedRoute();
 *
 * @example
 * // Protect route for vehicle owners only
 * const { isLoading } = useProtectedRoute({
 *   allowedRoles: [UserRole.VEHICLE_OWNER, UserRole.ADMIN]
 * });
 *
 * @example
 * // Protect admin dashboard
 * const { isLoading } = useProtectedRoute({
 *   allowedRoles: [UserRole.ADMIN],
 *   unauthorizedRedirectTo: '/dashboard'
 * });
 */
export function useProtectedRoute(
  options: UseProtectedRouteOptions = {},
): ProtectedRouteResult {
  const { allowedRoles = [], redirectTo, unauthorizedRedirectTo = "/" } = options;

  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const { user, isAuthenticated, isLoading } = useAuthStore();

  const loginRedirect = redirectTo ?? `/${locale}/login`;

  useEffect(() => {
    // Wait for auth state to be determined
    if (isLoading) return;

    // Not authenticated - redirect to login
    if (!isAuthenticated || !user) {
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`${loginRedirect}?returnUrl=${returnUrl}`);
      return;
    }

    // Check role authorization if roles are specified
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      router.replace(unauthorizedRedirectTo);
    }
  }, [
    isLoading,
    isAuthenticated,
    user,
    allowedRoles,
    loginRedirect,
    unauthorizedRedirectTo,
    router,
    pathname,
  ]);

  // Determine if user is authorized
  const isAuthorized =
    isAuthenticated &&
    user !== null &&
    (allowedRoles.length === 0 || allowedRoles.includes(user.role));

  return {
    isLoading,
    isAuthorized,
    user,
  };
}

/**
 * Hook for customer-only routes
 */
export function useCustomerRoute() {
  return useProtectedRoute({
    allowedRoles: [UserRole.CUSTOMER],
    unauthorizedRedirectTo: "/dashboard",
  });
}

/**
 * Hook for vehicle owner routes
 */
export function useVehicleOwnerRoute() {
  return useProtectedRoute({
    allowedRoles: [UserRole.VEHICLE_OWNER],
    unauthorizedRedirectTo: "/dashboard",
  });
}

/**
 * Hook for admin-only routes
 */
export function useAdminRoute() {
  return useProtectedRoute({
    allowedRoles: [UserRole.ADMIN],
    unauthorizedRedirectTo: "/",
  });
}

/**
 * Hook for routes accessible by owners and admins
 */
export function useOwnerOrAdminRoute() {
  return useProtectedRoute({
    allowedRoles: [UserRole.VEHICLE_OWNER, UserRole.ADMIN],
    unauthorizedRedirectTo: "/dashboard",
  });
}
