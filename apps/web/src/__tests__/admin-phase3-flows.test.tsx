import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  adminService: {
    getOwnerVerifications: vi.fn(),
    getOwnerVerificationById: vi.fn(),
    getVerificationHistory: vi.fn(),
    approveOwnerVerification: vi.fn(),
    rejectOwnerVerification: vi.fn(),
    requestOwnerResubmission: vi.fn(),
    getVehicleVerifications: vi.fn(),
    getVehicleVerificationById: vi.fn(),
    approveVehicleVerification: vi.fn(),
    rejectVehicleVerification: vi.fn(),
    getReviewModerationQueue: vi.fn(),
    getReviewModerationById: vi.fn(),
    updateReviewModerationStatus: vi.fn(),
    resolveReviewReport: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import { useOwnerVerifications } from "@/app/[locale]/admin/verifications/owners/hooks/useOwnerVerifications";
import { useVehicleVerifications } from "@/app/[locale]/admin/verifications/vehicles/hooks/useVehicleVerifications";
import { useReviewModeration } from "@/app/[locale]/admin/reviews/moderation/hooks/useReviewModeration";

const setupMocks = () => {
  vi.clearAllMocks();

  (adminService.getOwnerVerifications as any).mockResolvedValue({
    items: [
      {
        id: "owner-1",
        firstName: "Owner",
        lastName: "One",
        email: "owner@example.com",
        phone: "+94770000000",
        nicNumber: "900011223V",
        status: "PENDING_VERIFICATION",
        isVerified: false,
        createdAt: new Date().toISOString(),
        verifiedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        documents: [],
        documentSummary: {
          pending: 2,
          verified: 0,
          rejected: 0,
          latestDocumentAt: new Date().toISOString(),
        },
        _count: {
          vehicles: 1,
          documents: 2,
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.getOwnerVerificationById as any).mockResolvedValue({
    id: "owner-1",
    firstName: "Owner",
    lastName: "One",
    email: "owner@example.com",
    phone: "+94770000000",
    nicNumber: "900011223V",
    avatar: null,
    address: null,
    city: null,
    district: "Kandy",
    postalCode: null,
    baseLocation: null,
    status: "PENDING_VERIFICATION",
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documents: [
      {
        id: "owner-doc-1",
        type: "NIC",
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: "https://example.com/doc.pdf",
        fileName: "doc.pdf",
        rejectionReason: null,
        verifiedAt: null,
        verifiedBy: null,
      },
    ],
    vehicles: [],
    documentSummary: {
      pending: 1,
      verified: 0,
      rejected: 0,
      latestDocumentAt: new Date().toISOString(),
    },
  });

  (adminService.getVerificationHistory as any).mockResolvedValue({
    logs: [
      {
        id: "history-1",
        action: "UPDATE",
        entityType: "OWNER_VERIFICATION",
        entityId: "owner-1",
        status: "success",
        createdAt: new Date().toISOString(),
        changes: {
          message: "Owner verification approved",
        },
        admin: {
          id: "admin-1",
          firstName: "Admin",
          lastName: "One",
          email: "admin@example.com",
          adminRole: "MODERATOR",
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.approveOwnerVerification as any).mockResolvedValue({ id: "owner-1" });
  (adminService.rejectOwnerVerification as any).mockResolvedValue({ id: "owner-1" });
  (adminService.requestOwnerResubmission as any).mockResolvedValue({ id: "owner-1" });

  (adminService.getVehicleVerifications as any).mockResolvedValue({
    items: [
      {
        id: "vehicle-1",
        ownerId: "owner-1",
        name: "Luxury Bus",
        brand: "Brand",
        model: "Model",
        licensePlate: "ABC-1234",
        type: "LUXURY",
        isActive: false,
        isAvailable: true,
        location: "Colombo",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: {
          id: "owner-1",
          firstName: "Owner",
          lastName: "One",
          email: "owner@example.com",
          status: "PENDING_VERIFICATION",
          isVerified: false,
        },
        documents: [],
        documentSummary: {
          pending: 2,
          verified: 0,
          rejected: 0,
          latestDocumentAt: new Date().toISOString(),
        },
        verificationState: "PENDING",
        _count: {
          bookings: 0,
          documents: 2,
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.getVehicleVerificationById as any).mockResolvedValue({
    id: "vehicle-1",
    ownerId: "owner-1",
    name: "Luxury Bus",
    description: null,
    brand: "Brand",
    model: "Model",
    year: 2020,
    licensePlate: "ABC-1234",
    type: "LUXURY",
    seats: 45,
    location: "Colombo",
    isActive: false,
    isAvailable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: {
      id: "owner-1",
      firstName: "Owner",
      lastName: "One",
      email: "owner@example.com",
      phone: null,
      status: "PENDING_VERIFICATION",
      isVerified: false,
      verifiedAt: null,
    },
    documents: [],
    photos: [],
    _count: {
      bookings: 0,
      reviews: 0,
    },
    documentSummary: {
      pending: 2,
      verified: 0,
      rejected: 0,
      latestDocumentAt: new Date().toISOString(),
    },
  });

  (adminService.approveVehicleVerification as any).mockResolvedValue({ id: "vehicle-1" });
  (adminService.rejectVehicleVerification as any).mockResolvedValue({ id: "vehicle-1" });

  (adminService.getReviewModerationQueue as any).mockResolvedValue({
    reviews: [
      {
        id: "review-1",
        rating: 1,
        comment: "Unsafe trip",
        ownerResponse: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        moderationStatus: "ACTIVE",
        isFlagged: true,
        flaggedByKeyword: true,
        customer: {
          id: "customer-1",
          firstName: "Customer",
          lastName: "One",
          email: "customer@example.com",
        },
        vehicle: {
          id: "vehicle-1",
          name: "Luxury Bus",
          licensePlate: "ABC-1234",
          owner: {
            id: "owner-1",
            firstName: "Owner",
            lastName: "One",
            email: "owner@example.com",
          },
        },
        booking: {
          id: "booking-1",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          status: "COMPLETED",
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.getReviewModerationById as any).mockResolvedValue({
    id: "review-1",
    rating: 1,
    comment: "Unsafe trip",
    ownerResponse: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    moderationStatus: "ACTIVE",
    isFlagged: true,
    flaggedByKeyword: true,
    customer: {
      id: "customer-1",
      firstName: "Customer",
      lastName: "One",
      email: "customer@example.com",
    },
    vehicle: {
      id: "vehicle-1",
      name: "Luxury Bus",
      licensePlate: "ABC-1234",
      owner: {
        id: "owner-1",
        firstName: "Owner",
        lastName: "One",
        email: "owner@example.com",
      },
    },
    booking: {
      id: "booking-1",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      status: "COMPLETED",
      pickupLocation: "Colombo",
      dropoffLocation: "Kandy",
      totalAmount: 45000,
    },
    moderationHistory: [
      {
        id: "history-review-1",
        action: "UPDATE",
        entityType: "REVIEW_MODERATION",
        entityId: "review-1",
        status: "success",
        createdAt: new Date().toISOString(),
        changes: {
          message: "Review moderation updated",
        },
        admin: {
          id: "admin-1",
          firstName: "Admin",
          lastName: "One",
          email: "admin@example.com",
          adminRole: "MODERATOR",
        },
      },
    ],
  });

  (adminService.updateReviewModerationStatus as any).mockResolvedValue({
    id: "review-1",
    moderationStatus: "HIDDEN",
    updated: true,
  });

  (adminService.resolveReviewReport as any).mockResolvedValue({
    reviewId: "review-1",
    reportStatus: "RESOLVED",
    resolution: "Resolved by moderator",
  });
};

describe("Admin phase 3 hooks", () => {
  beforeEach(() => {
    setupMocks();
  });

  it("loads and mutates owner verification flow", async () => {
    const { result } = renderHook(() => useOwnerVerifications());

    await waitFor(() => {
      expect(result.current.queueData?.items.length).toBe(1);
    });

    await act(async () => {
      await result.current.loadOwnerDetails("owner-1");
    });

    await waitFor(() => {
      expect(result.current.selectedOwner?.id).toBe("owner-1");
    });

    await act(async () => {
      await result.current.approveOwner("owner-1", "Looks good");
    });

    expect(adminService.approveOwnerVerification).toHaveBeenCalledWith(
      "owner-1",
      "Looks good",
    );

    await act(async () => {
      await result.current.rejectOwner("owner-1", "Document mismatch");
      await result.current.requestResubmission("owner-1", "Upload clearer scans");
    });

    expect(adminService.rejectOwnerVerification).toHaveBeenCalledWith(
      "owner-1",
      "Document mismatch",
    );
    expect(adminService.requestOwnerResubmission).toHaveBeenCalledWith(
      "owner-1",
      "Upload clearer scans",
    );
  });

  it("loads and mutates vehicle verification flow", async () => {
    const { result } = renderHook(() => useVehicleVerifications());

    await waitFor(() => {
      expect(result.current.queueData?.items.length).toBe(1);
    });

    await act(async () => {
      await result.current.loadVehicleDetails("vehicle-1");
    });

    await waitFor(() => {
      expect(result.current.selectedVehicle?.id).toBe("vehicle-1");
    });

    await act(async () => {
      await result.current.approveVehicle("vehicle-1", "All docs valid");
      await result.current.rejectVehicle("vehicle-1", "Insurance is expired");
    });

    expect(adminService.approveVehicleVerification).toHaveBeenCalledWith(
      "vehicle-1",
      "All docs valid",
    );
    expect(adminService.rejectVehicleVerification).toHaveBeenCalledWith(
      "vehicle-1",
      "Insurance is expired",
    );
  });

  it("loads and mutates review moderation flow", async () => {
    const { result } = renderHook(() => useReviewModeration());

    await waitFor(() => {
      expect(result.current.queueData?.reviews.length).toBe(1);
    });

    await act(async () => {
      result.current.setFilters({ status: "ACTIVE", flaggedOnly: true });
    });

    await waitFor(() => {
      expect(adminService.getReviewModerationQueue).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.loadReviewDetails("review-1");
    });

    await waitFor(() => {
      expect(result.current.selectedReview?.id).toBe("review-1");
    });

    await act(async () => {
      await result.current.updateModerationStatus(
        "review-1",
        "HIDDEN",
        "Escalated for review",
      );
      await result.current.resolveReport(
        "review-1",
        "RESOLVED",
        "Issue reviewed and closed",
      );
    });

    expect(adminService.updateReviewModerationStatus).toHaveBeenCalledWith(
      "review-1",
      "HIDDEN",
      "Escalated for review",
    );
    expect(adminService.resolveReviewReport).toHaveBeenCalledWith(
      "review-1",
      "RESOLVED",
      "Issue reviewed and closed",
    );
  });
});
