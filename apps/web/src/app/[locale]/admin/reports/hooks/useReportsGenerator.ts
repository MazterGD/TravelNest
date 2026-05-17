"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminReportFormat,
  type AdminScheduledReport,
  type AdminScheduledReportInput,
  type AdminScheduledReportListQuery,
  type AdminScheduledReportListResponse,
} from "@/lib/api";

interface UseReportsGeneratorResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminScheduledReportListQuery;
  reportsData: AdminScheduledReportListResponse | null;
  selectedReport: AdminScheduledReport | null;
  setFilters: (next: Partial<AdminScheduledReportListQuery>) => void;
  selectReport: (report: AdminScheduledReport | null) => void;
  createReport: (payload: AdminScheduledReportInput) => Promise<AdminScheduledReport | null>;
  updateReport: (
    reportId: string,
    payload: Partial<AdminScheduledReportInput>,
  ) => Promise<AdminScheduledReport | null>;
  runReport: (
    reportId: string,
    format?: AdminReportFormat,
  ) => Promise<boolean>;
  exportReport: (reportId: string, format?: AdminReportFormat) => Promise<boolean>;
  archiveReport: (reportId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminScheduledReportListQuery = {
  page: 1,
  limit: 20,
};

export const useReportsGenerator = (): UseReportsGeneratorResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilterState] =
    useState<AdminScheduledReportListQuery>(DEFAULT_FILTERS);
  const [reportsData, setReportsData] =
    useState<AdminScheduledReportListResponse | null>(null);
  const [selectedReport, setSelectedReport] = useState<AdminScheduledReport | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getScheduledReports({
        ...filters,
        search: filters.search?.trim() || undefined,
      });
      setReportsData(data);

      if (selectedReport) {
        const freshSelection = data.items.find((item) => item.id === selectedReport.id) || null;
        setSelectedReport(freshSelection);
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load reports";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, selectedReport]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const setFilters = useCallback((next: Partial<AdminScheduledReportListQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined ||
              next.reportType !== undefined ||
              next.frequency !== undefined ||
              next.format !== undefined ||
              next.isActive !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const createReport = useCallback<UseReportsGeneratorResult["createReport"]>(
    async (payload) => {
      setIsMutating(true);
      setError(null);

      try {
        const created = await adminService.createScheduledReport(payload);
        await fetchReports();
        return created;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to create report";
        setError(message);
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchReports],
  );

  const updateReport = useCallback<UseReportsGeneratorResult["updateReport"]>(
    async (reportId, payload) => {
      setIsMutating(true);
      setError(null);

      try {
        const updated = await adminService.updateScheduledReport(reportId, payload);
        await fetchReports();
        return updated;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to update report";
        setError(message);
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchReports],
  );

  const runReport = useCallback<UseReportsGeneratorResult["runReport"]>(
    async (reportId, format) => {
      setIsMutating(true);
      setError(null);

      try {
        await adminService.runScheduledReport(reportId, format);
        await fetchReports();
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to run report";
        setError(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchReports],
  );

  const exportReport = useCallback<UseReportsGeneratorResult["exportReport"]>(
    async (reportId, format) => {
      setIsMutating(true);
      setError(null);

      try {
        await adminService.exportAdminReport({ reportId, format });
        await fetchReports();
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to export report";
        setError(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchReports],
  );

  const archiveReport = useCallback<UseReportsGeneratorResult["archiveReport"]>(
    async (reportId) => {
      setIsMutating(true);
      setError(null);

      try {
        await adminService.archiveScheduledReport(reportId);
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
        }
        await fetchReports();
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to archive report";
        setError(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [fetchReports, selectedReport?.id],
  );

  return {
    isLoading,
    isMutating,
    error,
    filters,
    reportsData,
    selectedReport,
    setFilters,
    selectReport: setSelectedReport,
    createReport,
    updateReport,
    runReport,
    exportReport,
    archiveReport,
    refetch: fetchReports,
  };
};
