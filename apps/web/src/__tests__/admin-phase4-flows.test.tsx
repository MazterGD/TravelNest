import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  adminService: {
    getDisputes: vi.fn(),
    getDisputeById: vi.fn(),
    assignDispute: vi.fn(),
    updateDisputePriority: vi.fn(),
    updateDisputeStatus: vi.fn(),
    addDisputeMessage: vi.fn(),
    resolveDispute: vi.fn(),
    getSettlements: vi.fn(),
    getSettlementHistory: vi.fn(),
    getSettlementById: vi.fn(),
    processSettlement: vi.fn(),
    getCommissionRules: vi.fn(),
    createCommissionRule: vi.fn(),
    updateCommissionRule: vi.fn(),
    deleteCommissionRule: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import { useDisputeManagement } from "@/app/[locale]/admin/disputes/hooks/useDisputeManagement";
import { useFinancialManagement } from "@/app/[locale]/admin/financial/hooks/useFinancialManagement";

const setupPhase4Mocks = () => {
  vi.clearAllMocks();

  (adminService.getDisputes as any).mockResolvedValue({
    items: [
      {
        id: "dispute-1",
        disputeCode: "DSP-2026-001",
        bookingId: "booking-1",
        raisedBy: "customer-1",
        raisedAgainst: "owner-1",
        type: "SERVICE_NOT_PROVIDED",
        priority: "HIGH",
        status: "OPEN",
        subject: "Trip started very late",
        description: "Driver arrived 2 hours late and support did not respond.",
        evidenceUrls: ["https://example.com/dispute-1.png"],
        assignedTo: null,
        proposedResolution: null,
        resolution: null,
        resolutionType: null,
        resolutionAmount: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        closedAt: null,
        booking: {
          id: "booking-1",
          status: "COMPLETED",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          pickupLocation: "Colombo",
          dropoffLocation: "Kandy",
          totalAmount: 55000,
          customer: {
            id: "customer-1",
            firstName: "Nimal",
            lastName: "Perera",
            email: "nimal@example.com",
          },
          vehicle: {
            id: "vehicle-1",
            name: "Luxury Coach",
            licensePlate: "ABC-1234",
          },
        },
        raisedByUser: {
          id: "customer-1",
          firstName: "Nimal",
          lastName: "Perera",
          email: "nimal@example.com",
        },
        againstUser: {
          id: "owner-1",
          firstName: "Kasun",
          lastName: "Silva",
          email: "kasun@example.com",
        },
        assignedAdmin: null,
        _count: {
          messages: 1,
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.getDisputeById as any).mockResolvedValue({
    id: "dispute-1",
    disputeCode: "DSP-2026-001",
    bookingId: "booking-1",
    raisedBy: "customer-1",
    raisedAgainst: "owner-1",
    type: "SERVICE_NOT_PROVIDED",
    priority: "HIGH",
    status: "OPEN",
    subject: "Trip started very late",
    description: "Driver arrived 2 hours late and support did not respond.",
    evidenceUrls: ["https://example.com/dispute-1.png"],
    assignedTo: "admin-2",
    proposedResolution: null,
    resolution: null,
    resolutionType: null,
    resolutionAmount: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    closedAt: null,
    booking: {
      id: "booking-1",
      status: "COMPLETED",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      pickupLocation: "Colombo",
      dropoffLocation: "Kandy",
      totalAmount: 55000,
      customer: {
        id: "customer-1",
        firstName: "Nimal",
        lastName: "Perera",
        email: "nimal@example.com",
        phone: "+94770000000",
      },
      vehicle: {
        id: "vehicle-1",
        name: "Luxury Coach",
        licensePlate: "ABC-1234",
        owner: {
          id: "owner-1",
          firstName: "Kasun",
          lastName: "Silva",
          email: "kasun@example.com",
          phone: "+94771111111",
        },
      },
      payment: {
        id: "payment-1",
        amount: 55000,
        status: "COMPLETED",
        refundAmount: null,
        refundReason: null,
      },
    },
    raisedByUser: {
      id: "customer-1",
      firstName: "Nimal",
      lastName: "Perera",
      email: "nimal@example.com",
      phone: "+94770000000",
      role: "CUSTOMER",
    },
    againstUser: {
      id: "owner-1",
      firstName: "Kasun",
      lastName: "Silva",
      email: "kasun@example.com",
      phone: "+94771111111",
      role: "VEHICLE_OWNER",
    },
    assignedAdmin: {
      id: "admin-2",
      firstName: "Support",
      lastName: "Admin",
      email: "support@example.com",
      adminRole: "SUPPORT_ADMIN",
    },
    messages: [
      {
        id: "message-1",
        disputeId: "dispute-1",
        senderId: "admin-2",
        message: "We are investigating this case.",
        isInternalNote: true,
        createdAt: new Date().toISOString(),
        sender: {
          id: "admin-2",
          firstName: "Support",
          lastName: "Admin",
          email: "support@example.com",
          role: "ADMIN",
          adminRole: "SUPPORT_ADMIN",
        },
      },
    ],
  });

  (adminService.assignDispute as any).mockResolvedValue({ id: "dispute-1" });
  (adminService.updateDisputePriority as any).mockResolvedValue({ id: "dispute-1" });
  (adminService.updateDisputeStatus as any).mockResolvedValue({ id: "dispute-1" });
  (adminService.addDisputeMessage as any).mockResolvedValue({ id: "message-2" });
  (adminService.resolveDispute as any).mockResolvedValue({ id: "dispute-1", status: "RESOLVED" });

  (adminService.getSettlements as any).mockResolvedValue({
    items: [
      {
        id: "settlement-1",
        settlementCode: "SET-2026-001",
        ownerId: "owner-1",
        period: "2026-03",
        totalBookings: 1,
        grossAmount: 55000,
        commissionAmount: 5500,
        netAmount: 49500,
        status: "PENDING",
        bankAccountName: "Owner One",
        bankAccountNumber: "1234567890",
        bankCode: "7010",
        processedBy: null,
        processedAt: null,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: {
          id: "owner-1",
          firstName: "Kasun",
          lastName: "Silva",
          email: "kasun@example.com",
          phone: "+94771111111",
        },
        processedByAdmin: null,
        _count: {
          bookings: 1,
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  (adminService.getSettlementHistory as any).mockResolvedValue({
    items: [
      {
        id: "settlement-history-1",
        settlementCode: "SET-2026-000",
        ownerId: "owner-1",
        period: "2026-02",
        totalBookings: 3,
        grossAmount: 155000,
        commissionAmount: 15500,
        netAmount: 139500,
        status: "COMPLETED",
        bankAccountName: "Owner One",
        bankAccountNumber: "1234567890",
        bankCode: "7010",
        processedBy: "admin-3",
        processedAt: new Date().toISOString(),
        notes: "Transferred",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: {
          id: "owner-1",
          firstName: "Kasun",
          lastName: "Silva",
          email: "kasun@example.com",
          phone: "+94771111111",
        },
        processedByAdmin: {
          id: "admin-3",
          firstName: "Finance",
          lastName: "Admin",
          email: "finance@example.com",
          adminRole: "FINANCE_ADMIN",
        },
        _count: {
          bookings: 3,
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 6,
    totalPages: 1,
  });

  (adminService.getSettlementById as any).mockResolvedValue({
    id: "settlement-1",
    settlementCode: "SET-2026-001",
    ownerId: "owner-1",
    period: "2026-03",
    totalBookings: 1,
    grossAmount: 55000,
    commissionAmount: 5500,
    netAmount: 49500,
    status: "PENDING",
    bankAccountName: "Owner One",
    bankAccountNumber: "1234567890",
    bankCode: "7010",
    processedBy: null,
    processedAt: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: {
      id: "owner-1",
      firstName: "Kasun",
      lastName: "Silva",
      email: "kasun@example.com",
      phone: "+94771111111",
      status: "ACTIVE",
      isVerified: true,
    },
    processedByAdmin: null,
    _count: {
      bookings: 1,
    },
    bookings: [
      {
        id: "settlement-booking-1",
        settlementId: "settlement-1",
        bookingId: "booking-1",
        amount: 55000,
        commission: 5500,
        net: 49500,
        booking: {
          id: "booking-1",
          status: "COMPLETED",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          pickupLocation: "Colombo",
          dropoffLocation: "Kandy",
          totalAmount: 55000,
          customer: {
            id: "customer-1",
            firstName: "Nimal",
            lastName: "Perera",
            email: "nimal@example.com",
          },
          vehicle: {
            id: "vehicle-1",
            name: "Luxury Coach",
            licensePlate: "ABC-1234",
          },
        },
      },
    ],
  });

  (adminService.processSettlement as any).mockResolvedValue({
    id: "settlement-1",
    status: "COMPLETED",
  });

  (adminService.getCommissionRules as any).mockResolvedValue([
    {
      id: "rule-1",
      name: "Default owner rate",
      type: "PERCENTAGE",
      percentage: 10,
      fixedAmount: null,
      minAmount: 0,
      maxAmount: 200000,
      tiers: null,
      appliesFrom: null,
      appliesTo: null,
      isActive: true,
      createdBy: "admin-3",
      updatedBy: "admin-3",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  (adminService.createCommissionRule as any).mockResolvedValue({ id: "rule-2" });
  (adminService.updateCommissionRule as any).mockResolvedValue({ id: "rule-1" });
  (adminService.deleteCommissionRule as any).mockResolvedValue({ id: "rule-1", deleted: true });
};

describe("Admin phase 4 hooks", () => {
  beforeEach(() => {
    setupPhase4Mocks();
  });

  it("loads dispute queue and performs dispute actions", async () => {
    const { result } = renderHook(() => useDisputeManagement());

    await waitFor(() => {
      expect(result.current.queueData?.items[0]?.id).toBe("dispute-1");
    });

    await act(async () => {
      await result.current.loadDisputeDetails("dispute-1");
    });

    expect(adminService.getDisputeById).toHaveBeenCalledWith("dispute-1");
    expect(result.current.selectedDispute?.id).toBe("dispute-1");

    await act(async () => {
      await result.current.assignDispute("dispute-1", "admin-2", "Handle this quickly");
      await result.current.updatePriority("dispute-1", "URGENT", "Escalated by QA");
      await result.current.updateStatus("dispute-1", "INVESTIGATING", "Review started");
      await result.current.addMessage("dispute-1", "Internal update", true);
      await result.current.resolveDispute("dispute-1", "Resolved by partial refund", "REFUND", 5000);
    });

    expect(adminService.assignDispute).toHaveBeenCalledWith(
      "dispute-1",
      "admin-2",
      "Handle this quickly",
    );
    expect(adminService.updateDisputePriority).toHaveBeenCalledWith(
      "dispute-1",
      "URGENT",
      "Escalated by QA",
    );
    expect(adminService.updateDisputeStatus).toHaveBeenCalledWith(
      "dispute-1",
      "INVESTIGATING",
      "Review started",
    );
    expect(adminService.addDisputeMessage).toHaveBeenCalledWith(
      "dispute-1",
      "Internal update",
      true,
    );
    expect(adminService.resolveDispute).toHaveBeenCalledWith(
      "dispute-1",
      "Resolved by partial refund",
      "REFUND",
      5000,
    );

    act(() => {
      result.current.setFilters({ page: 4 });
    });
    expect(result.current.filters.page).toBe(4);

    act(() => {
      result.current.setFilters({ search: "fresh" });
    });
    expect(result.current.filters.page).toBe(1);
  });

  it("loads financial data and executes settlement and commission actions", async () => {
    const { result } = renderHook(() => useFinancialManagement());

    await waitFor(() => {
      expect(result.current.settlementsData?.items[0]?.id).toBe("settlement-1");
      expect(result.current.commissionRules.length).toBe(1);
    });

    await act(async () => {
      await result.current.loadSettlementDetails("settlement-1");
    });

    expect(adminService.getSettlementById).toHaveBeenCalledWith("settlement-1");
    expect(result.current.selectedSettlement?.id).toBe("settlement-1");

    await act(async () => {
      await result.current.processSettlement("settlement-1", "COMPLETED", "Paid to owner");
      await result.current.createCommissionRule({
        name: "Peak season",
        type: "PERCENTAGE",
        percentage: 12,
      });
      await result.current.updateCommissionRule("rule-1", { percentage: 11 });
      await result.current.archiveCommissionRule("rule-1");
    });

    expect(adminService.processSettlement).toHaveBeenCalledWith(
      "settlement-1",
      "COMPLETED",
      "Paid to owner",
    );
    expect(adminService.createCommissionRule).toHaveBeenCalledWith({
      name: "Peak season",
      type: "PERCENTAGE",
      percentage: 12,
    });
    expect(adminService.updateCommissionRule).toHaveBeenCalledWith("rule-1", {
      percentage: 11,
    });
    expect(adminService.deleteCommissionRule).toHaveBeenCalledWith("rule-1");

    act(() => {
      result.current.setFilters({ page: 3 });
    });
    expect(result.current.filters.page).toBe(3);

    act(() => {
      result.current.setFilters({ status: "PENDING" });
    });
    expect(result.current.filters.page).toBe(1);

    act(() => {
      result.current.setIncludeInactiveRules(true);
    });
    expect(result.current.includeInactiveRules).toBe(true);
  });
});
