/**
 * Admin data hooks: error-message fallbacks (Error vs non-Error rejections),
 * page-preserving filter updates, selection refresh and stale-request
 * aborts that the page-level tests do not reach.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useParams: () => ({ locale: "en" }),
}));

vi.mock("@/lib/api", () => ({ adminService: new Proxy({}, { get: (t: any, k) => (t[k] ??= vi.fn()) }) }));

import { adminService } from "@/lib/api";
import { useAmenitiesManagement } from "@/app/[locale]/admin/amenities/hooks/useAmenitiesManagement";
import { useBookingManagement } from "@/app/[locale]/admin/bookings/hooks/useBookingManagement";
import { useContentManagement } from "@/app/[locale]/admin/content/hooks/useContentManagement";
import { useDashboardData } from "@/app/[locale]/admin/dashboard/hooks/useDashboardData";
import { useNotificationsManagement } from "@/app/[locale]/admin/notifications/hooks/useNotificationsManagement";
import { useReportsGenerator } from "@/app/[locale]/admin/reports/hooks/useReportsGenerator";
import { useReviewModeration } from "@/app/[locale]/admin/reviews/moderation/hooks/useReviewModeration";
import { useUserFilters } from "@/app/[locale]/admin/users/hooks/useUserFilters";
import { useVehicleFilters } from "@/app/[locale]/admin/vehicles/hooks/useVehicleFilters";
import { useOwnerVerifications } from "@/app/[locale]/admin/verifications/owners/hooks/useOwnerVerifications";
import { useVehicleVerifications } from "@/app/[locale]/admin/verifications/vehicles/hooks/useVehicleVerifications";

const svc = adminService as any;

/** Runs `action` once with an Error rejection and once with a non-Error one. */
const expectErrorMessages = async (
  result: { current: any },
  method: string,
  action: () => Promise<unknown>,
  fallback: string,
) => {
  svc[method].mockRejectedValueOnce(new Error(`${method} failed`));
  await act(async () => {
    await action();
  });
  expect(result.current.error).toBe(`${method} failed`);
  svc[method].mockRejectedValueOnce("nope");
  await act(async () => {
    await action();
  });
  expect(result.current.error).toBe(fallback);
};

describe("admin hook error branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useAmenitiesManagement", async () => {
    const item = { id: "a1", name: "Wi-Fi" };
    const data = { items: [item], total: 1, page: 1, limit: 20, totalPages: 1 };
    svc.getAmenities.mockResolvedValue(data);
    const { result } = renderHook(() => useAmenitiesManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expectErrorMessages(result, "getAmenities", () => result.current.refetch(), "Failed to load amenities");
    await expectErrorMessages(result, "createAmenity", () => result.current.createAmenity({} as any), "Amenity action failed");
    await expectErrorMessages(result, "updateAmenity", () => result.current.updateAmenity("a1", {}), "Amenity action failed");

    act(() => result.current.selectAmenity(item as any));
    await waitFor(() => expect(result.current.selectedAmenity).toBe(item));
    svc.getAmenities.mockResolvedValue({ ...data, items: [] });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.selectedAmenity).toBeNull();

    act(() => result.current.setFilters({ limit: 50 }));
    expect(result.current.filters.page).toBe(1);
  });

  it("useBookingManagement", async () => {
    svc.getBookings.mockResolvedValue({ bookings: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    const { result } = renderHook(() => useBookingManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expectErrorMessages(result, "getBookings", () => result.current.refetch(), "Failed to load bookings");
    await expectErrorMessages(result, "getBookingById", () => result.current.loadBookingDetails("b1"), "Failed to load booking details");
    await expectErrorMessages(result, "updateBookingStatus", () => result.current.updateBookingStatus("b1", "CONFIRMED"), "Operation failed");
    act(() => result.current.setFilters({ page: 3 }));
    act(() => result.current.setFilters({ limit: 5 }));
    expect(result.current.filters.page).toBe(3);
  });

  it("useContentManagement", async () => {
    svc.getContentPages.mockResolvedValue({ items: [] });
    svc.getFaqs.mockResolvedValue({ items: [] });
    svc.getTestimonials.mockResolvedValue({ items: [] });
    const { result } = renderHook(() => useContentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expectErrorMessages(result, "getContentPages", () => result.current.refetch(), "Failed to load content management data");
    await expectErrorMessages(result, "updateContentPage", () => result.current.savePage("faqs", {} as any), "Content management action failed");
    act(() => result.current.setFilters({ page: 2 }));
    act(() => result.current.setFilters({ limit: 5 }));
    expect(result.current.filters.page).toBe(2);
  });

  it("useDashboardData ignores results from a superseded or unmounted request", async () => {
    const ok = () => {
      svc.getDashboardOverview.mockResolvedValue({ users: {} });
      for (const m of ["getRevenueChart", "getUserGrowthChart", "getBookingTrendsChart", "getActivityFeed", "getPendingActions"]) {
        svc[m].mockResolvedValue([]);
      }
    };
    ok();
    let rejectFirst: (e: unknown) => void = () => {};
    svc.getDashboardOverview.mockReturnValueOnce(new Promise((_, j) => (rejectFirst = j)));
    const { result, unmount } = renderHook(() => useDashboardData());
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.overview).toEqual({ users: {} });
    await act(async () => rejectFirst(new Error("stale")));
    expect(result.current.error).toBeNull();

    let resolveLate: (v: unknown) => void = () => {};
    svc.getDashboardOverview.mockReturnValueOnce(new Promise((r) => (resolveLate = r)));
    act(() => {
      void result.current.refetch();
    });
    unmount();
    await act(async () => resolveLate({ users: { total: 1 } }));
    expect(result.current.overview).toEqual({ users: {} });
  });

  it("useNotificationsManagement", async () => {
    svc.getPlatformNotifications.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    const { result } = renderHook(() => useNotificationsManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expectErrorMessages(result, "getPlatformNotifications", () => result.current.refetch(), "Failed to load notifications");
    await expectErrorMessages(
      result,
      "getPlatformNotificationAnalytics",
      () => result.current.loadAnalytics("n1"),
      "Failed to load notification analytics",
    );
    await expectErrorMessages(result, "createPlatformNotification", () => result.current.createNotification({} as any), "Failed to create notification");
    await expectErrorMessages(result, "resendPlatformNotification", () => result.current.resendNotification("n1", {} as any), "Failed to resend notification");
    act(() => result.current.setFilters({ status: "SENT" as any }));
    act(() => result.current.setFilters({ page: 4 }));
    act(() => result.current.setFilters({ limit: 5 }));
    expect(result.current.filters.page).toBe(4);
  });

  it("useReportsGenerator", async () => {
    const report = { id: "r1", name: "R" };
    svc.getScheduledReports.mockResolvedValue({ items: [report], total: 1, page: 1, limit: 20, totalPages: 1 });
    const { result } = renderHook(() => useReportsGenerator());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selectReport(report as any));
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.selectedReport).toBe(report);
    svc.getScheduledReports.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.selectedReport).toBeNull();

    await expectErrorMessages(result, "createScheduledReport", () => result.current.createReport({} as any), "Failed to create report");
    await expectErrorMessages(result, "updateScheduledReport", () => result.current.updateReport("r1", {}), "Failed to update report");
    await expectErrorMessages(result, "runScheduledReport", () => result.current.runReport("r1"), "Failed to run report");
    await expectErrorMessages(result, "exportAdminReport", () => result.current.exportReport("r1"), "Failed to export report");
    await expectErrorMessages(result, "archiveScheduledReport", () => result.current.archiveReport("r1"), "Failed to archive report");
    await expectErrorMessages(result, "getScheduledReports", () => result.current.refetch(), "Failed to load reports");

    svc.archiveScheduledReport.mockResolvedValue({});
    svc.getScheduledReports.mockResolvedValue({ items: [report], total: 1, page: 1, limit: 20, totalPages: 1 });
    act(() => result.current.selectReport(report as any));
    await act(async () => {
      await result.current.archiveReport("other");
    });
    expect(result.current.selectedReport).toBe(report);

    act(() => result.current.setFilters({ page: 5 }));
    act(() => result.current.setFilters({ limit: 5 }));
    expect(result.current.filters.page).toBe(5);
  });

  it("useReviewModeration", async () => {
    svc.getReviewModerationQueue.mockResolvedValue({ reviews: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    const { result } = renderHook(() => useReviewModeration());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expectErrorMessages(result, "getReviewModerationQueue", () => result.current.refetch(), "Failed to load review moderation queue");
    await expectErrorMessages(result, "getReviewModerationById", () => result.current.loadReviewDetails("r1"), "Failed to load review details");
    await expectErrorMessages(result, "resolveReviewReport", () => result.current.resolveReport("r1", "RESOLVED" as any, "ok"), "Moderation action failed");
    act(() => result.current.setFilters({ limit: 5 }));
    expect(result.current.filters.page).toBe(1);
  });

  it("useUserFilters", async () => {
    svc.getUsers.mockResolvedValue({ users: [], total: 0, page: 1, limit: 10, totalPages: 1 });
    const { result } = renderHook(() => useUserFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expectErrorMessages(result, "getUsers", () => result.current.refetch(), "Failed to load users");
    await expectErrorMessages(result, "getUserById", () => result.current.loadUserDetails("u1"), "Failed to load user details");
    await expectErrorMessages(result, "createAdmin", () => result.current.createAdmin({} as any), "Operation failed");
    await expectErrorMessages(result, "exportUsersCsv", () => result.current.exportUsersCsv(), "Failed to export users CSV");
    act(() => result.current.setFilters({ adminRole: "MODERATOR" as any }));
    act(() => result.current.setFilters({ page: 2 }));
    act(() => result.current.setFilters({ limit: 25 }));
    expect(result.current.filters.page).toBe(2);
  });

  it("useVehicleFilters", async () => {
    svc.getAdminVehicles.mockResolvedValue({ vehicles: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    const { result } = renderHook(() => useVehicleFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expectErrorMessages(result, "getAdminVehicles", () => result.current.refetch(), "Failed to load vehicles");
    await expectErrorMessages(result, "suspendVehicle", () => result.current.suspendVehicle("v1"), "Operation failed");
    svc.suspendVehicle.mockResolvedValue({});
    act(() => result.current.selectVehicle({ id: "other", isActive: true } as any));
    await act(async () => {
      await result.current.suspendVehicle("v1");
    });
    expect(result.current.selectedVehicle?.isActive).toBe(true);
    svc.activateVehicle.mockResolvedValue({});
    await act(async () => {
      await result.current.activateVehicle("v1");
    });
    expect(result.current.selectedVehicle?.id).toBe("other");
    act(() => result.current.setFilters({ page: 3 }));
    act(() => result.current.setFilters({ limit: 25 }));
    expect(result.current.filters.page).toBe(3);
  });

  it("useOwnerVerifications", async () => {
    svc.getOwnerVerifications.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    const { result } = renderHook(() => useOwnerVerifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expectErrorMessages(result, "getOwnerVerifications", () => result.current.refetch(), "Failed to load owner verification queue");
    await expectErrorMessages(result, "approveOwnerVerification", () => result.current.approveOwner("o1"), "Document action failed");
    act(() => result.current.setFilters({ page: 2 }));
    act(() => result.current.setFilters({ limit: 50 }));
    expect(result.current.filters.page).toBe(2);
  });

  it("useVehicleVerifications", async () => {
    svc.getVehicleVerifications.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 });
    const { result } = renderHook(() => useVehicleVerifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expectErrorMessages(result, "getVehicleVerifications", () => result.current.refetch(), "Failed to load vehicle verification queue");
    await expectErrorMessages(result, "approveVehicleVerification", () => result.current.approveVehicle("v1"), "Document action failed");

    await act(async () => {
      await result.current.approveDocument("d1");
      await result.current.rejectDocument("d1", "bad");
    });
    expect(svc.approveVehicleDocument).not.toHaveBeenCalled();
    expect(svc.rejectVehicleDocument).not.toHaveBeenCalled();

    svc.getVehicleVerificationById.mockResolvedValue({ id: "v1" });
    svc.getVerificationHistory.mockResolvedValue({ logs: [] });
    svc.rejectVehicleVerification.mockResolvedValue({});
    await act(async () => {
      await result.current.loadVehicleDetails("v1");
    });
    await act(async () => {
      await result.current.rejectVehicle("v1", "Blurry photos");
    });
    expect(svc.rejectVehicleVerification).toHaveBeenCalledWith("v1", "Blurry photos");
    expect(svc.getVehicleVerificationById).toHaveBeenCalledTimes(2);
    act(() => result.current.setFilters({ page: 2 }));
    act(() => result.current.setFilters({ limit: 50 }));
    expect(result.current.filters.page).toBe(2);
  });
});
