/**
 * Owner earnings page: summary cards, paginated/filtered transactions,
 * settlement history, and the bank account view/add/edit flow with
 * validation and error handling.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/earnings",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => state.t, useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks", () => ({ useOwnerGuard: () => state.guard }));
vi.mock("@/store", () => ({ useAuthStore: () => ({ user: state.user }) }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {}
  return {
    ApiError,
    ownerService: {
      getEarningsSummary: vi.fn(),
      getEarningsSettlements: vi.fn(),
      getBankAccount: vi.fn(),
      getEarningsTransactions: vi.fn(),
      upsertBankAccount: vi.fn(),
    },
  };
});

import { ApiError, ownerService } from "@/lib/api";
import OwnerEarningsPage from "@/app/[locale]/owner/earnings/page";

const owner = ownerService as any;
const now = "2026-10-01T10:00:00.000Z";

const tx = (id: string, status: string, overrides: Record<string, unknown> = {}) => ({
  id,
  date: now,
  bookingId: `bk-${id}`,
  bookingRef: `REF-${id}`,
  route: "Colombo → Kandy",
  amount: 45000,
  currency: "LKR",
  method: "PAYHERE",
  status,
  ...overrides,
});

const bank = (overrides: Record<string, unknown> = {}) => ({
  id: "bank-1",
  accountHolderName: "Kamal Silva",
  accountNumberMasked: "****1234",
  bankName: "Commercial Bank",
  bankCode: "7056",
  branchName: "Kandy",
  branchCode: "041",
  isPrimary: true,
  updatedAt: now,
  ...overrides,
});

const renderPage = async () => {
  render(<OwnerEarningsPage />);
  await screen.findByText("summary.pendingBalance");
};

describe("OwnerEarningsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    owner.getEarningsSummary.mockResolvedValue({
      lifetimeEarnings: 1200000,
      thisMonthEarnings: 90000,
      thisYearEarnings: 600000,
      pendingBalance: 45000,
    });
    owner.getEarningsSettlements.mockResolvedValue([
      { id: "s1", settlementCode: "SET-1", period: "2026-09", totalBookings: 3, grossAmount: 100000, commissionAmount: 10000, netAmount: 90000, status: "COMPLETED", processedAt: now, createdAt: now },
      { id: "s2", settlementCode: "SET-2", period: "2026-10", totalBookings: 1, grossAmount: 50000, commissionAmount: 5000, netAmount: 45000, status: "PENDING", processedAt: null, createdAt: now },
      { id: "s3", settlementCode: "SET-3", period: "2026-08", totalBookings: 1, grossAmount: 1, commissionAmount: 0, netAmount: 1, status: "CANCELLED", processedAt: null, createdAt: now },
      { id: "s4", settlementCode: "SET-4", period: "2026-07", totalBookings: 1, grossAmount: 1, commissionAmount: 0, netAmount: 1, status: "PROCESSING", processedAt: null, createdAt: now },
      { id: "s5", settlementCode: "SET-5", period: "2026-06", totalBookings: 1, grossAmount: 1, commissionAmount: 0, netAmount: 1, status: "FAILED", processedAt: null, createdAt: now },
    ]);
    owner.getBankAccount.mockResolvedValue(bank());
    owner.getEarningsTransactions.mockResolvedValue({
      transactions: ["COMPLETED", "PROCESSING", "FAILED", "PENDING", "REFUNDED"].map((s, i) => tx(String(i), s)),
      totalPages: 3,
    });
    owner.upsertBankAccount.mockResolvedValue(bank({ accountHolderName: "K. Silva", bankCode: null, branchName: null, branchCode: null }));
  });

  it("is gated by guard and user", () => {
    state.user = null;
    render(<OwnerEarningsPage />);
    expect(owner.getEarningsSummary).not.toHaveBeenCalled();
  });

  it("renders summary, transactions, settlements and bank details", async () => {
    await renderPage();
    expect(screen.getAllByText("currency 45,000").length).toBeGreaterThan(0);
    expect(screen.getByText("currency 1,200,000")).toBeTruthy();
    expect(owner.getEarningsTransactions).toHaveBeenCalledWith({ page: 1, limit: 10, status: undefined });
    expect(await screen.findByText("REF-0")).toBeTruthy();
    expect(screen.getByText("REF-0").closest("a")?.getAttribute("href")).toBe("/en/owner/bookings/bk-0");
    expect(screen.getAllByText("status.REFUNDED").length).toBeGreaterThan(0);
    expect(screen.getByText("SET-1")).toBeTruthy();
    expect(screen.getByText("− currency 10,000")).toBeTruthy();
    expect(screen.getByText("Kamal Silva")).toBeTruthy();
    expect(screen.getByText("****1234")).toBeTruthy();
    expect(screen.getByText("Commercial Bank (7056)")).toBeTruthy();
    expect(screen.getByText("Kandy (041)")).toBeTruthy();
    expect(screen.getByText('transactions.pageOf:{"page":1,"totalPages":3}')).toBeTruthy();
  });

  it("paginates and filters transactions", async () => {
    await renderPage();
    await screen.findByText("REF-0");
    expect((screen.getByLabelText("transactions.prev") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("transactions.next"));
    await waitFor(() => expect(owner.getEarningsTransactions).toHaveBeenLastCalledWith({ page: 2, limit: 10, status: undefined }));
    fireEvent.click(screen.getByLabelText("transactions.next"));
    await waitFor(() => expect(owner.getEarningsTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })));
    await waitFor(() => expect((screen.getByLabelText("transactions.next") as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(screen.getByLabelText("transactions.prev"));
    await waitFor(() => expect(owner.getEarningsTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));

    owner.getEarningsTransactions.mockResolvedValue({ transactions: [], totalPages: 1 });
    fireEvent.change(screen.getByLabelText("transactions.filterLabel"), { target: { value: "FAILED" } });
    await waitFor(() => expect(owner.getEarningsTransactions).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: "FAILED" }));
    expect(await screen.findByText("transactions.emptyTitle")).toBeTruthy();
    expect(screen.queryByLabelText("transactions.next")).toBeNull();
  });

  it("shows empty settlements and adds a bank account with validation", async () => {
    owner.getEarningsSettlements.mockResolvedValue(null);
    owner.getBankAccount.mockResolvedValue(null);
    owner.getEarningsSummary.mockResolvedValue(null);
    await renderPage();
    expect(screen.getAllByText("currency 0").length).toBe(4);
    expect(screen.getByText("settlements.emptyTitle")).toBeTruthy();
    expect(screen.getByText("bank.emptyTitle")).toBeTruthy();

    fireEvent.click(screen.getByText("bank.addAccount"));
    await act(async () => fireEvent.click(screen.getByText("bank.save")));
    expect(screen.getByText("bank.errorRequired")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("bank.accountHolder"), { target: { value: " K. Silva " } });
    fireEvent.change(screen.getByLabelText("bank.accountNumber"), { target: { value: " 001234 " } });
    fireEvent.change(screen.getByLabelText("bank.bankName"), { target: { value: " BOC " } });
    fireEvent.change(screen.getByLabelText("bank.bankCode"), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("bank.branchCode"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("bank.branchName"), { target: { value: "" } });
    await act(async () => fireEvent.click(screen.getByText("bank.save")));
    expect(owner.upsertBankAccount).toHaveBeenCalledWith({
      accountHolderName: "K. Silva",
      accountNumber: "001234",
      bankName: "BOC",
      bankCode: undefined,
      branchName: undefined,
      branchCode: undefined,
    });
    expect(await screen.findByText("K. Silva")).toBeTruthy();
    expect(screen.queryByText("bank.branchName")).toBeNull();
  });

  it("edits an existing bank account, reports save errors and cancels", async () => {
    owner.upsertBankAccount.mockRejectedValueOnce(new (ApiError as any)("Invalid account")).mockRejectedValueOnce("x");
    owner.getBankAccount.mockResolvedValue(bank({ accountNumberMasked: null, bankCode: null, branchName: null, branchCode: "041" }));
    await renderPage();
    expect(screen.getByText("—", { selector: "dd" })).toBeTruthy();
    fireEvent.click(screen.getByText("bank.edit"));
    expect((screen.getByLabelText("bank.accountHolder") as HTMLInputElement).value).toBe("Kamal Silva");
    expect((screen.getByLabelText("bank.accountNumber") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("bank.accountNumber"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("bank.branchCode"), { target: { value: "099" } });
    await act(async () => fireEvent.click(screen.getByText("bank.save")));
    expect(screen.getByText("Invalid account")).toBeTruthy();
    expect(owner.upsertBankAccount.mock.calls[0][0]).toMatchObject({ branchCode: "099", accountNumber: "123" });
    await act(async () => fireEvent.click(screen.getByText("bank.save")));
    expect(screen.getByText("bank.errorSave")).toBeTruthy();
    fireEvent.click(screen.getByText("bank.cancel"));
    expect(screen.getByText("bank.edit")).toBeTruthy();
  });

  it("shows load errors and retries", async () => {
    owner.getEarningsSummary.mockRejectedValueOnce(new (ApiError as any)("Earnings unavailable"));
    owner.getEarningsTransactions.mockRejectedValueOnce(new Error("x"));
    render(<OwnerEarningsPage />);
    expect(await screen.findByText(/Earnings unavailable|error\.loadFailed/)).toBeTruthy();
    owner.getEarningsSummary.mockRejectedValueOnce(new Error("x"));
    await act(async () => fireEvent.click(screen.getByText("error.tryAgain")));
    expect(await screen.findByText("error.loadFailed")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("error.tryAgain")));
    await waitFor(() => expect(screen.queryByText("error.tryAgain")).toBeNull());
  });

  it("surfaces API errors from the transactions endpoint", async () => {
    owner.getEarningsTransactions.mockRejectedValueOnce(new (ApiError as any)("Tx down"));
    render(<OwnerEarningsPage />);
    expect(await screen.findByText("Tx down")).toBeTruthy();
  });
});
