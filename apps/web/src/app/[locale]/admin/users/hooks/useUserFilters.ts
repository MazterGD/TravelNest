"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminService,
  type AdminCreateInput,
  type AdminManagedUser,
  type AdminUserActivityResponse,
  type AdminUsersQuery,
  type AdminUsersResponse,
} from "@/lib/api";

interface UseUserFiltersResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  usersData: AdminUsersResponse | null;
  filters: AdminUsersQuery;
  selectedUser: (AdminManagedUser & {
    address: string | null;
    city: string | null;
    district: string | null;
    postalCode: string | null;
    baseLocation: string | null;
    avatar: string | null;
    ownerBookingCount: number;
    _count: {
      bookings: number;
      reviews: number;
      notifications: number;
      vehicles: number;
    };
  }) | null;
  selectedUserActivity: AdminUserActivityResponse | null;
  setFilters: (next: Partial<AdminUsersQuery>) => void;
  loadUserDetails: (userId: string) => Promise<void>;
  updateUserStatus: (
    userId: string,
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION",
    reason?: string,
  ) => Promise<void>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  createAdmin: (payload: AdminCreateInput) => Promise<void>;
  exportUsersCsv: () => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminUsersQuery = {
  page: 1,
  limit: 10,
  search: "",
};

export const useUserFilters = (): UseUserFiltersResult => {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] = useState<AdminUsersQuery>({
    ...DEFAULT_FILTERS,
    search: initialSearch,
  });
  const [usersData, setUsersData] = useState<AdminUsersResponse | null>(null);
  const [selectedUser, setSelectedUser] = useState<
    UseUserFiltersResult["selectedUser"]
  >(null);
  const [selectedUserActivity, setSelectedUserActivity] =
    useState<AdminUserActivityResponse | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getUsers({
        ...filters,
        search: filters.search?.trim() || undefined,
      });

      setUsersData(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load users";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const setFilters = useCallback((next: Partial<AdminUsersQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.role !== undefined ||
              next.status !== undefined ||
              next.adminRole !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const loadUserDetails = useCallback(async (userId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const [user, activity] = await Promise.all([
        adminService.getUserById(userId),
        adminService.getUserActivity(userId, { page: 1, limit: 10 }),
      ]);

      setSelectedUser(user);
      setSelectedUserActivity(activity);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load user details";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<void>) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchUsers();
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Operation failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchUsers],
  );

  const updateUserStatus = useCallback<UseUserFiltersResult["updateUserStatus"]>(
    async (userId, status, reason) => {
      await withMutation(async () => {
        await adminService.updateUserStatus(userId, status, reason);
      });
    },
    [withMutation],
  );

  const resetUserPassword = useCallback<UseUserFiltersResult["resetUserPassword"]>(
    async (userId, newPassword) => {
      await withMutation(async () => {
        await adminService.resetUserPassword(userId, newPassword);
      });
    },
    [withMutation],
  );

  const deleteUser = useCallback<UseUserFiltersResult["deleteUser"]>(
    async (userId) => {
      await withMutation(async () => {
        await adminService.deleteUser(userId);
      });
    },
    [withMutation],
  );

  const createAdmin = useCallback<UseUserFiltersResult["createAdmin"]>(
    async (payload) => {
      await withMutation(async () => {
        await adminService.createAdmin(payload);
      });
    },
    [withMutation],
  );

  const exportUsersCsv = useCallback(async () => {
    setIsMutating(true);
    setError(null);

    try {
      await adminService.exportUsersCsv({
        search: filters.search?.trim() || undefined,
        role: filters.role,
        status: filters.status,
        adminRole: filters.adminRole,
      });
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "Failed to export users CSV";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, [filters]);

  return {
    isLoading,
    isMutating,
    error,
    usersData,
    filters,
    selectedUser,
    selectedUserActivity,
    setFilters,
    loadUserDetails,
    updateUserStatus,
    resetUserPassword,
    deleteUser,
    createAdmin,
    exportUsersCsv,
    refetch: fetchUsers,
  };
};
