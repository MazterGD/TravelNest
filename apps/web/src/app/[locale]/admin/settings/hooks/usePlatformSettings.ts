"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminPlatformSettings,
  type AdminPlatformSettingsUpdateInput,
} from "@/lib/api";

interface UsePlatformSettingsResult {
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  settings: AdminPlatformSettings | null;
  updateSettings: (payload: AdminPlatformSettingsUpdateInput) => Promise<void>;
  refresh: () => Promise<void>;
}

export const usePlatformSettings = (): UsePlatformSettingsResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdminPlatformSettings | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getPlatformSettings();
      setSettings(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load platform settings";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (payload: AdminPlatformSettingsUpdateInput) => {
      setIsSaving(true);
      setError(null);

      try {
        const updated = await adminService.updatePlatformSettings(payload);
        setSettings(updated);
      } catch (updateError) {
        const message =
          updateError instanceof Error
            ? updateError.message
            : "Failed to update platform settings";
        setError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  return {
    isLoading,
    isSaving,
    error,
    settings,
    updateSettings,
    refresh: fetchSettings,
  };
};
