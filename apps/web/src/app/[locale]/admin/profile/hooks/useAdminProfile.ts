"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminProfileActivityResponse,
  type AdminProfileDetails,
  type AdminProfilePermissionsResponse,
} from "@/lib/api";

interface UseAdminProfileResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  profile: AdminProfileDetails | null;
  activity: AdminProfileActivityResponse | null;
  permissions: AdminProfilePermissionsResponse | null;
  refresh: () => Promise<void>;
  updateProfile: (payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => Promise<boolean>;
  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<boolean>;
}

export const useAdminProfile = (): UseAdminProfileResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<AdminProfileDetails | null>(null);
  const [activity, setActivity] = useState<AdminProfileActivityResponse | null>(null);
  const [permissions, setPermissions] = useState<AdminProfilePermissionsResponse | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [profileData, activityData, permissionsData] = await Promise.all([
        adminService.getAdminProfile(),
        adminService.getAdminProfileActivity({ page: 1, limit: 10 }),
        adminService.getAdminProfilePermissions(),
      ]);

      setProfile(profileData);
      setActivity(activityData);
      setPermissions(permissionsData);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load admin profile";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const updateProfile = useCallback<UseAdminProfileResult["updateProfile"]>(
    async (payload) => {
      setIsMutating(true);
      setError(null);

      try {
        await adminService.updateAdminProfile(payload);
        await fetchAll();
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to update profile";
        setError(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchAll],
  );

  const changePassword = useCallback<UseAdminProfileResult["changePassword"]>(
    async (payload) => {
      setIsMutating(true);
      setError(null);

      try {
        await adminService.changeAdminProfilePassword(payload);
        await fetchAll();
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to update password";
        setError(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchAll],
  );

  return {
    isLoading,
    isMutating,
    error,
    profile,
    activity,
    permissions,
    refresh: fetchAll,
    updateProfile,
    changePassword,
  };
};
