"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminService,
  type AdminAuditLog,
  type AdminAuditLogQuery,
  type AdminAuditLogListResponse,
} from "@/lib/api";

interface UseAuditLogsResult {
  isLoading: boolean;
  isExporting: boolean;
  error: string | null;
  filters: AdminAuditLogQuery;
  logsData: AdminAuditLogListResponse | null;
  selectedLog: AdminAuditLog | null;
  setFilters: (next: Partial<AdminAuditLogQuery>) => void;
  selectLog: (log: AdminAuditLog | null) => void;
  exportCsv: () => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminAuditLogQuery = {
  page: 1,
  limit: 20,
};

export const useAuditLogs = (): UseAuditLogsResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] = useState<AdminAuditLogQuery>(DEFAULT_FILTERS);
  const [logsData, setLogsData] = useState<AdminAuditLogListResponse | null>(null);
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  // Ref avoids including selectedLog in fetchAuditLogs deps, which caused an
  // infinite refetch loop: selecting a log changed the callback identity,
  // which triggered the effect, which fetched and re-set selectedLog, repeat.
  const selectedLogIdRef = useRef<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getAuditLogs({
        ...filters,
        action: filters.action?.trim() || undefined,
        entityType: filters.entityType?.trim() || undefined,
        entityId: filters.entityId?.trim() || undefined,
      });

      setLogsData(data);

      if (selectedLogIdRef.current) {
        const fresh = data.logs.find((log) => log.id === selectedLogIdRef.current) ?? null;
        setSelectedLog(fresh);
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load audit logs";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchAuditLogs();
  }, [fetchAuditLogs]);

  const setFilters = useCallback((next: Partial<AdminAuditLogQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.action !== undefined ||
              next.entityType !== undefined ||
              next.entityId !== undefined ||
              next.status !== undefined ||
              next.actorRole !== undefined ||
              next.dateFrom !== undefined ||
              next.dateTo !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const selectLog = useCallback((log: AdminAuditLog | null) => {
    selectedLogIdRef.current = log?.id ?? null;
    setSelectedLog(log);
  }, []);

  const exportCsv = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      await adminService.exportAuditLogsCsv({
        adminId: filters.adminId,
        actorRole: filters.actorRole,
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "Failed to export audit logs";
      setError(message);
    } finally {
      setIsExporting(false);
    }
  }, [filters]);

  return {
    isLoading,
    isExporting,
    error,
    filters,
    logsData,
    selectedLog,
    setFilters,
    selectLog,
    exportCsv,
    refetch: fetchAuditLogs,
  };
};
