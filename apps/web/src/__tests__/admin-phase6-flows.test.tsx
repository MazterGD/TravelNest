import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  adminService: {
    getAuditLogs: vi.fn(),
    exportAuditLogsCsv: vi.fn(),
    getScheduledReports: vi.fn(),
    createScheduledReport: vi.fn(),
    updateScheduledReport: vi.fn(),
    runScheduledReport: vi.fn(),
    exportAdminReport: vi.fn(),
    archiveScheduledReport: vi.fn(),
    getAdminProfile: vi.fn(),
    updateAdminProfile: vi.fn(),
    changeAdminProfilePassword: vi.fn(),
    getAdminProfileActivity: vi.fn(),
    getAdminProfilePermissions: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import { useAuditLogs } from "@/app/[locale]/admin/audit-logs/hooks/useAuditLogs";
import { useReportsGenerator } from "@/app/[locale]/admin/reports/hooks/useReportsGenerator";
import { useAdminProfile } from "@/app/[locale]/admin/profile/hooks/useAdminProfile";

const setupPhase6Mocks = () => {
  vi.clearAllMocks();

  (adminService.getAuditLogs as any).mockResolvedValue({
    logs: [
      {
        id: "log-1",
        adminId: "admin-1",
        action: "EXPORT",
        entityType: "REPORT",
        entityId: "report-1",
        changes: { format: "CSV" },
        ipAddress: null,
        userAgent: null,
        status: "success",
        errorMessage: null,
        createdAt: new Date().toISOString(),
        admin: {
          id: "admin-1",
          firstName: "Super",
          lastName: "Admin",
          email: "admin@example.com",
          adminRole: "SUPER_ADMIN",
        },
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  });

  (adminService.exportAuditLogsCsv as any).mockResolvedValue(undefined);

  (adminService.getScheduledReports as any).mockResolvedValue({
    items: [
      {
        id: "report-1",
        name: "Operations Pulse",
        description: "Daily operations digest",
        reportType: "OPERATIONS",
        format: "CSV",
        frequency: "DAILY",
        cronExpression: null,
        timezone: "Asia/Colombo",
        configuration: { includePending: true },
        recipients: [],
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { runs: 0 },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.createScheduledReport as any).mockResolvedValue({ id: "report-2" });
  (adminService.updateScheduledReport as any).mockResolvedValue({ id: "report-1" });
  (adminService.runScheduledReport as any).mockResolvedValue({
    run: { id: "run-1", status: "SUCCESS" },
  });
  (adminService.exportAdminReport as any).mockResolvedValue(undefined);
  (adminService.archiveScheduledReport as any).mockResolvedValue({
    id: "report-1",
    deleted: true,
  });

  (adminService.getAdminProfile as any).mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
    firstName: "Super",
    lastName: "Admin",
    phone: "+94770000000",
    avatar: null,
    role: "ADMIN",
    adminRole: "SUPER_ADMIN",
    status: "ACTIVE",
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    _count: {
      adminPermissions: 2,
      auditLogs: 12,
    },
  });

  (adminService.getAdminProfileActivity as any).mockResolvedValue({
    items: [
      {
        id: "activity-1",
        adminId: "admin-1",
        action: "UPDATE",
        entityType: "ADMIN_PROFILE",
        entityId: "admin-1",
        changes: null,
        ipAddress: null,
        userAgent: null,
        status: "success",
        errorMessage: null,
        createdAt: new Date().toISOString(),
        admin: {
          id: "admin-1",
          firstName: "Super",
          lastName: "Admin",
          email: "admin@example.com",
          adminRole: "SUPER_ADMIN",
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  (adminService.getAdminProfilePermissions as any).mockResolvedValue({
    admin: {
      id: "admin-1",
      email: "admin@example.com",
      role: "SUPER_ADMIN",
    },
    explicitPermissions: [
      {
        permission: "admin.profile.read",
        grantedAt: new Date().toISOString(),
        grantedBy: "admin-1",
        expiresAt: null,
      },
    ],
    effectivePermissions: ["*"],
  });

  (adminService.updateAdminProfile as any).mockResolvedValue({ id: "admin-1" });
  (adminService.changeAdminProfilePassword as any).mockResolvedValue({
    message: "Password changed successfully",
  });
};

describe("Admin phase 6 hook flows", () => {
  beforeEach(() => {
    setupPhase6Mocks();
  });

  it("loads and exports audit logs", async () => {
    const { result } = renderHook(() => useAuditLogs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.logsData?.logs.length).toBe(1);
    });

    await act(async () => {
      await result.current.exportCsv();
    });

    expect(adminService.exportAuditLogsCsv).toHaveBeenCalledTimes(1);
  });

  it("creates, runs, exports and archives reports", async () => {
    const { result } = renderHook(() => useReportsGenerator());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.reportsData?.items.length).toBe(1);
    });

    await act(async () => {
      await result.current.createReport({
        name: "Ops Daily",
        reportType: "OPERATIONS",
      });
      await result.current.runReport("report-1", "CSV");
      await result.current.exportReport("report-1", "CSV");
      await result.current.archiveReport("report-1");
    });

    expect(adminService.createScheduledReport).toHaveBeenCalledTimes(1);
    expect(adminService.runScheduledReport).toHaveBeenCalledTimes(1);
    expect(adminService.exportAdminReport).toHaveBeenCalledTimes(1);
    expect(adminService.archiveScheduledReport).toHaveBeenCalledTimes(1);
  });

  it("loads admin profile and updates personal info and password", async () => {
    const { result } = renderHook(() => useAdminProfile());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.profile?.email).toBe("admin@example.com");
    });

    await act(async () => {
      await result.current.updateProfile({ firstName: "Updated" });
      await result.current.changePassword({
        currentPassword: "CurrentPass123!",
        newPassword: "NewPass123!",
        confirmPassword: "NewPass123!",
      });
    });

    expect(adminService.updateAdminProfile).toHaveBeenCalledTimes(1);
    expect(adminService.changeAdminProfilePassword).toHaveBeenCalledTimes(1);
  });
});
