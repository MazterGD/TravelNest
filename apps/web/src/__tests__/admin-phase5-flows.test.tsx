import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  adminService: {
    getPlatformSettings: vi.fn(),
    updatePlatformSettings: vi.fn(),
    getContentPages: vi.fn(),
    getContentPageBySlug: vi.fn(),
    updateContentPage: vi.fn(),
    getFaqs: vi.fn(),
    createFaq: vi.fn(),
    updateFaq: vi.fn(),
    deleteFaq: vi.fn(),
    getTestimonials: vi.fn(),
    approveTestimonial: vi.fn(),
    updateTestimonial: vi.fn(),
    deleteTestimonial: vi.fn(),
    getAmenities: vi.fn(),
    createAmenity: vi.fn(),
    updateAmenity: vi.fn(),
    deleteAmenity: vi.fn(),
    getPlatformNotifications: vi.fn(),
    getPlatformNotificationAnalytics: vi.fn(),
    createPlatformNotification: vi.fn(),
    resendPlatformNotification: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import { usePlatformSettings } from "@/app/[locale]/admin/settings/hooks/usePlatformSettings";
import { useContentManagement } from "@/app/[locale]/admin/content/hooks/useContentManagement";
import { useAmenitiesManagement } from "@/app/[locale]/admin/amenities/hooks/useAmenitiesManagement";
import { useNotificationsManagement } from "@/app/[locale]/admin/notifications/hooks/useNotificationsManagement";

const setupPhase5Mocks = () => {
  vi.clearAllMocks();

  (adminService.getPlatformSettings as any).mockResolvedValue({
    id: "settings-1",
    generalSettings: { platformName: "TravelNest" },
    notificationSettings: { emailEnabled: true },
    paymentSettings: { provider: "payhere" },
    bookingSettings: { autoCancelUnpaidHours: 24 },
    securitySettings: { sessionTimeoutMinutes: 60 },
    mapSettings: { defaultCity: "Colombo" },
    maintenanceMode: false,
    maintenanceMessage: null,
    updatedBy: "admin-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedByAdmin: {
      id: "admin-1",
      firstName: "Super",
      lastName: "Admin",
      email: "admin@example.com",
      adminRole: "SUPER_ADMIN",
    },
  });

  (adminService.updatePlatformSettings as any).mockResolvedValue({
    id: "settings-1",
    generalSettings: { platformName: "TravelNest" },
    notificationSettings: { emailEnabled: true },
    paymentSettings: { provider: "payhere" },
    bookingSettings: { autoCancelUnpaidHours: 24 },
    securitySettings: { sessionTimeoutMinutes: 60 },
    mapSettings: { defaultCity: "Colombo" },
    maintenanceMode: true,
    maintenanceMessage: "Scheduled maintenance",
    updatedBy: "admin-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedByAdmin: {
      id: "admin-1",
      firstName: "Super",
      lastName: "Admin",
      email: "admin@example.com",
      adminRole: "SUPER_ADMIN",
    },
  });

  (adminService.getContentPages as any).mockResolvedValue({
    items: [
      {
        id: "content-1",
        slug: "terms-and-conditions",
        title: "Terms and Conditions",
        content: { blocks: [{ type: "paragraph", text: "Initial" }] },
        excerpt: "Legal terms",
        seoTitle: null,
        seoDescription: null,
        isPublished: false,
        publishedAt: null,
        updatedBy: "admin-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedByAdmin: {
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
    limit: 20,
    totalPages: 1,
  });

  (adminService.getContentPageBySlug as any).mockResolvedValue({
    id: "content-1",
    slug: "terms-and-conditions",
    title: "Terms and Conditions",
    content: { blocks: [{ type: "paragraph", text: "Updated" }] },
    excerpt: "Legal terms",
    seoTitle: null,
    seoDescription: null,
    isPublished: true,
    publishedAt: new Date().toISOString(),
    updatedBy: "admin-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedByAdmin: {
      id: "admin-1",
      firstName: "Super",
      lastName: "Admin",
      email: "admin@example.com",
      adminRole: "SUPER_ADMIN",
    },
  });

  (adminService.updateContentPage as any).mockResolvedValue({ id: "content-1" });

  (adminService.getFaqs as any).mockResolvedValue({
    items: [
      {
        id: "faq-1",
        question: "How do I cancel?",
        answer: "From bookings page",
        category: "BOOKING",
        sortOrder: 1,
        isPublished: true,
        updatedBy: "admin-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedByAdmin: {
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
    limit: 20,
    totalPages: 1,
  });

  (adminService.createFaq as any).mockResolvedValue({ id: "faq-2" });
  (adminService.updateFaq as any).mockResolvedValue({ id: "faq-1" });
  (adminService.deleteFaq as any).mockResolvedValue({ id: "faq-1", deleted: true });

  (adminService.getTestimonials as any).mockResolvedValue({
    items: [
      {
        id: "testimonial-1",
        name: "Kasun",
        role: "Manager",
        organization: "ABC Travels",
        imageUrl: "https://example.com/image.jpg",
        rating: 5,
        quote: "Great service",
        tripDetails: "Colombo to Galle",
        sortOrder: 0,
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    limit: 12,
    totalPages: 1,
  });

  (adminService.approveTestimonial as any).mockResolvedValue({ id: "testimonial-1" });
  (adminService.updateTestimonial as any).mockResolvedValue({ id: "testimonial-1" });
  (adminService.deleteTestimonial as any).mockResolvedValue({
    id: "testimonial-1",
    deleted: true,
  });

  (adminService.getAmenities as any).mockResolvedValue({
    items: [
      {
        id: "amenity-1",
        code: "WIFI",
        name: "Wi-Fi",
        description: "Internet access",
        icon: "wifi",
        sortOrder: 1,
        isActive: true,
        updatedBy: "admin-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedByAdmin: {
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
    limit: 20,
    totalPages: 1,
  });

  (adminService.createAmenity as any).mockResolvedValue({ id: "amenity-2" });
  (adminService.updateAmenity as any).mockResolvedValue({ id: "amenity-1" });
  (adminService.deleteAmenity as any).mockResolvedValue({ id: "amenity-1", deleted: true });

  (adminService.getPlatformNotifications as any).mockResolvedValue({
    items: [
      {
        id: "notification-1",
        title: "System Notice",
        message: "Planned maintenance",
        type: "ANNOUNCEMENT",
        channel: "IN_APP",
        status: "SENT",
        targetRole: "CUSTOMER",
        targetUserIds: ["customer-1"],
        metadata: { source: "test" },
        scheduledFor: null,
        sentAt: new Date().toISOString(),
        createdBy: "admin-1",
        resentFromId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByAdmin: {
          id: "admin-1",
          firstName: "Super",
          lastName: "Admin",
          email: "admin@example.com",
          adminRole: "SUPER_ADMIN",
        },
        _count: {
          resends: 0,
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.getPlatformNotificationAnalytics as any).mockResolvedValue({
    notification: {
      id: "notification-1",
      title: "System Notice",
      message: "Planned maintenance",
      type: "ANNOUNCEMENT",
      channel: "IN_APP",
      status: "SENT",
      targetRole: "CUSTOMER",
      targetUserIds: ["customer-1"],
      metadata: { source: "test" },
      scheduledFor: null,
      sentAt: new Date().toISOString(),
      createdBy: "admin-1",
      resentFromId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByAdmin: {
        id: "admin-1",
        firstName: "Super",
        lastName: "Admin",
        email: "admin@example.com",
        adminRole: "SUPER_ADMIN",
      },
    },
    metrics: {
      targetedRecipients: 10,
      delivered: 10,
      reads: 8,
      openRate: 80,
      deliveryRate: 100,
      resendCount: 0,
    },
  });

  (adminService.createPlatformNotification as any).mockResolvedValue({
    notification: {
      id: "notification-2",
      title: "New message",
    },
    delivery: {
      recipientCount: 12,
      dispatchedCount: 12,
      status: "SENT",
      sentAt: new Date().toISOString(),
    },
  });

  (adminService.resendPlatformNotification as any).mockResolvedValue({
    notification: {
      id: "notification-3",
      title: "Resent message",
    },
    delivery: {
      recipientCount: 12,
      dispatchedCount: 12,
      status: "SENT",
      sentAt: new Date().toISOString(),
    },
  });
};

beforeEach(() => {
  setupPhase5Mocks();
});

describe("Admin Phase 5 web hooks", () => {
  it("loads and updates platform settings", async () => {
    const { result } = renderHook(() => usePlatformSettings());

    await waitFor(() => {
      expect(result.current.settings?.id).toBe("settings-1");
    });

    await act(async () => {
      await result.current.updateSettings({
        maintenanceMode: true,
        maintenanceMessage: "Scheduled maintenance",
      });
    });

    expect(adminService.updatePlatformSettings).toHaveBeenCalledWith({
      maintenanceMode: true,
      maintenanceMessage: "Scheduled maintenance",
    });
  });

  it("loads content management data and runs page/content mutations", async () => {
    const { result } = renderHook(() => useContentManagement());

    await waitFor(() => {
      expect(result.current.pagesData?.items.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.loadPage("terms-and-conditions");
    });

    await waitFor(() => {
      expect(result.current.selectedPage?.slug).toBe("terms-and-conditions");
    });

    await act(async () => {
      await result.current.savePage("terms-and-conditions", {
        title: "Updated Terms",
        isPublished: true,
      });
      await result.current.createFaq({
        question: "How can I cancel?",
        answer: "From your dashboard",
      });
      await result.current.updateFaq("faq-1", { isPublished: false });
      await result.current.deleteFaq("faq-1");
      await result.current.approveTestimonial("testimonial-1", "Looks valid");
      await result.current.updateTestimonial("testimonial-1", { rating: 4 });
      await result.current.deleteTestimonial("testimonial-1");
    });

    expect(adminService.updateContentPage).toHaveBeenCalledWith(
      "terms-and-conditions",
      {
        title: "Updated Terms",
        isPublished: true,
      },
    );
    expect(adminService.createFaq).toHaveBeenCalled();
    expect(adminService.approveTestimonial).toHaveBeenCalled();
    expect(adminService.deleteTestimonial).toHaveBeenCalledWith("testimonial-1");
  });

  it("loads amenities and executes amenity operations", async () => {
    const { result } = renderHook(() => useAmenitiesManagement());

    await waitFor(() => {
      expect(result.current.amenitiesData?.items.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.createAmenity({
        code: "USB",
        name: "USB Charging",
      });
      await result.current.updateAmenity("amenity-1", { name: "USB-C Charging" });
      await result.current.archiveAmenity("amenity-1");
    });

    expect(adminService.createAmenity).toHaveBeenCalled();
    expect(adminService.updateAmenity).toHaveBeenCalledWith("amenity-1", {
      name: "USB-C Charging",
    });
    expect(adminService.deleteAmenity).toHaveBeenCalledWith("amenity-1");
  });

  it("loads notifications and executes analytics/resend actions", async () => {
    const { result } = renderHook(() => useNotificationsManagement());

    await waitFor(() => {
      expect(result.current.notificationsData?.items.length).toBeGreaterThan(0);
    });

    await act(async () => {
      const created = await result.current.createNotification({
        title: "New promo",
        message: "Seasonal offer",
        channel: "IN_APP",
      });

      if (created?.notification?.id) {
        await result.current.loadAnalytics(created.notification.id);
      }

      await result.current.resendNotification("notification-1", {
        message: "Seasonal offer reminder",
      });
    });

    expect(adminService.createPlatformNotification).toHaveBeenCalled();
    expect(adminService.getPlatformNotificationAnalytics).toHaveBeenCalled();
    expect(adminService.resendPlatformNotification).toHaveBeenCalledWith(
      "notification-1",
      {
        message: "Seasonal offer reminder",
      },
    );
  });
});
