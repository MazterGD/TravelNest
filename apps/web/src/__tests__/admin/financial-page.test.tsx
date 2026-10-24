/**
 * Admin financial page: settlement queue (filters, KPIs, pagination),
 * settlement processing via prompt/confirm dialogs, commission rule
 * management and the recent history panel.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/financial",
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getSettlements: vi.fn(),
    getSettlementHistory: vi.fn(),
    getCommissionRules: vi.fn(),
    getSettlementById: vi.fn(),
    processSettlement: vi.fn(),
    createCommissionRule: vi.fn(),
    updateCommissionRule: vi.fn(),
    deleteCommissionRule: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminFinancialPage from "@/app/[locale]/admin/financial/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const owner = { id: "o1", firstName: "Sunil", lastName: "Owner", email: "sunil@x.lk", status: "ACTIVE" };

const settlement = (overrides: Record<string, unknown> = {}) => ({
  id: "set-1",
  settlementCode: "SET-001",
  period: "2026-09",
  totalBookings: 2,
  grossAmount: 100000,
  commissionAmount: 10000,
  netAmount: 90000,
  status: "PENDING",
  processedAt: null,
  owner,
  ...overrides,
});

const page = (items: any[], extra: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...extra,
});

const lastDialog = () => screen.getAllByRole("dialog").pop() as HTMLElement;
const lastCall = (fn: any) => fn.mock.calls.at(-1);

const renderPage = async () => {
  render(<AdminFinancialPage />);
  await waitFor(() => expect(svc.getSettlements).toHaveBeenCalled());
};

describe("AdminFinancialPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getSettlements.mockResolvedValue(
      page([
        settlement(),
        settlement({ id: "set-2", settlementCode: "SET-002", totalBookings: 1, status: "PROCESSING" }),
        settlement({ id: "set-3", settlementCode: "SET-003", status: "FAILED", processedAt: now }),
        settlement({ id: "set-4", settlementCode: "SET-004", status: "COMPLETED", processedAt: now }),
      ]),
    );
    svc.getSettlementHistory.mockResolvedValue(
      page([settlement({ id: "h-1", settlementCode: "HIST-1", status: "COMPLETED", processedAt: now })]),
    );
    svc.getCommissionRules.mockResolvedValue([
      { id: "r1", name: "Standard", type: "PERCENTAGE", percentage: 10, isActive: true },
      { id: "r2", name: "Flat", type: "FIXED", fixedAmount: 5000, isActive: false },
      { id: "r3", name: "Tiers", type: "TIERED", tiers: [{ min: 0, max: 1, rate: 2 }], isActive: true },
      { id: "r4", name: "Bare", type: "PERCENTAGE", percentage: null, isActive: true },
      { id: "r5", name: "Bare tiers", type: "TIERED", tiers: null, isActive: true },
      { id: "r6", name: "Bare fixed", type: "FIXED", fixedAmount: null, isActive: true },
    ]);
    svc.getSettlementById.mockResolvedValue({
      ...settlement(),
      owner: { ...owner, status: "SUSPENDED" },
      bookings: [
        {
          id: "sb-1",
          net: 45000,
          commission: 5000,
          booking: { vehicle: { name: "Lanka Cruiser", licensePlate: "NB-1234" } },
        },
      ],
    });
    svc.processSettlement.mockResolvedValue({});
    svc.createCommissionRule.mockResolvedValue({});
    svc.updateCommissionRule.mockResolvedValue({});
    svc.deleteCommissionRule.mockResolvedValue({});
  });

  it("renders KPIs, the queue, commission rules and history", async () => {
    await renderPage();
    expect(await screen.findByText("SET-001")).toBeTruthy();
    expect(screen.getByText("Settlements in queue")).toBeTruthy();
    expect(screen.getByText("All statuses")).toBeTruthy();
    expect(screen.getByText("Requires attention")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText(/^Net: /)).toBeTruthy();
    expect(screen.getByText("1–4 of 4")).toBeTruthy();
    expect(screen.getByText("10% of booking value")).toBeTruthy();
    expect(screen.getByText("0% of booking value")).toBeTruthy();
    expect(screen.getByText(/Fixed .*5,000 per booking/)).toBeTruthy();
    expect(screen.getByText("1 tier(s) configured")).toBeTruthy();
    expect(screen.getByText("0 tier(s) configured")).toBeTruthy();
    expect(screen.getByText("HIST-1")).toBeTruthy();
    expect(screen.getByText("Activate")).toBeTruthy();
    // completed settlements cannot be completed again
    expect((screen.getByLabelText("Mark SET-004 as completed") as HTMLButtonElement).disabled).toBe(true);
    expect(svc.getCommissionRules).toHaveBeenCalledWith(false);
    expect(svc.getSettlementHistory).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 6 }),
    );
  });

  it("seeds a valid status from the URL and ignores invalid ones", async () => {
    nav.search = "status=FAILED";
    await renderPage();
    expect(svc.getSettlements).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }));
    expect(await screen.findByText("Filtered: Failed")).toBeTruthy();
  });

  it("ignores an unknown status query param", async () => {
    nav.search = "status=BOGUS";
    await renderPage();
    expect(svc.getSettlements).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("shows empty states and calm KPIs when nothing is queued", async () => {
    svc.getSettlements.mockResolvedValue(page([]));
    svc.getSettlementHistory.mockResolvedValue(page([]));
    svc.getCommissionRules.mockResolvedValue([]);
    await renderPage();
    expect(await screen.findByText("No settlements found")).toBeTruthy();
    expect(screen.getByText("No commission rules")).toBeTruthy();
    expect(screen.getByText("No history yet")).toBeTruthy();
    expect(screen.getByText("None pending")).toBeTruthy();
    expect(screen.getByText("None processing")).toBeTruthy();
    expect(screen.getByText("None on this page")).toBeTruthy();
  });

  it("shows load errors", async () => {
    svc.getSettlements.mockRejectedValue("nope");
    await renderPage();
    expect(await screen.findByText(/Failed to load financial management data/)).toBeTruthy();
    svc.getSettlements.mockRejectedValue(new Error("Ledger offline"));
    fireEvent.click(screen.getByLabelText("Refresh financial data"));
    expect(await screen.findByText(/Ledger offline/)).toBeTruthy();
  });

  it("filters by status pills, debounced search, period and paginates", async () => {
    svc.getSettlements.mockResolvedValue(page([settlement()], { page: 2, totalPages: 3, total: 41 }));
    await renderPage();
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(lastCall(svc.getSettlements)[0].page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(lastCall(svc.getSettlements)[0].page).toBe(1));

    const pills = within(screen.getByRole("group", { name: "Filter by status" }));
    fireEvent.click(pills.getByText("Cancelled"));
    await waitFor(() =>
      expect(lastCall(svc.getSettlements)[0]).toMatchObject({ status: "CANCELLED", page: 1 }),
    );
    expect(pills.getByText("Cancelled").getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(screen.getByLabelText("Period (YYYY-MM)"), { target: { value: "2026-08" } });
    await waitFor(() => expect(lastCall(svc.getSettlements)[0].period).toBe("2026-08"));
    expect(lastCall(svc.getSettlementHistory)[0].period).toBe("2026-08");
    fireEvent.change(screen.getByLabelText("Period (YYYY-MM)"), { target: { value: "" } });
    await waitFor(() => expect(lastCall(svc.getSettlements)[0].period).toBeUndefined());

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "  SET-9 " } });
    await waitFor(() => expect(lastCall(svc.getSettlements)[0].search).toBe("SET-9"), { timeout: 2000 });
    expect(lastCall(svc.getSettlementHistory)[0].search).toBe("SET-9");
  });

  it("completes a settlement from the table with default notes when left blank", async () => {
    await renderPage();
    await screen.findByText("SET-001");
    fireEvent.click(screen.getByLabelText("Mark SET-001 as completed"));
    await screen.findByText("Complete Settlement");
    const input = screen.getByDisplayValue("Settlement completed by finance admin");
    fireEvent.change(input, { target: { value: "" } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Mark as Completed")));
    await waitFor(() =>
      expect(svc.processSettlement).toHaveBeenCalledWith(
        "set-1",
        "COMPLETED",
        "Settlement completed by finance admin",
      ),
    );

    fireEvent.click(screen.getByLabelText("Mark SET-001 as completed"));
    await screen.findByText("Complete Settlement");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.processSettlement).toHaveBeenCalledTimes(1);
  });

  it("opens settlement details and processes failed/cancel/complete actions", async () => {
    await renderPage();
    await screen.findByText("SET-001");
    await act(async () =>
      fireEvent.click(screen.getByLabelText("View details for settlement SET-001")),
    );
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Lanka Cruiser")).toBeTruthy();
    expect(within(dialog).getByText("Suspended")).toBeTruthy();
    expect(within(dialog).getByText("Included Bookings (1)")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Mark Failed"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    const reason = screen.getByPlaceholderText("e.g. Bank transfer rejected — insufficient funds");
    fireEvent.change(reason, { target: { value: "no" } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Mark as Failed")));
    expect(screen.getByText("Minimum 3 characters required.")).toBeTruthy();
    fireEvent.change(reason, { target: { value: "Bank rejected" } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Mark as Failed")));
    await waitFor(() =>
      expect(svc.processSettlement).toHaveBeenCalledWith("set-1", "FAILED", "Bank rejected"),
    );
    // selected settlement is reloaded after mutation
    await waitFor(() => expect(svc.getSettlementById).toHaveBeenCalledTimes(2));

    fireEvent.click(within(screen.getAllByRole("dialog")[0]).getByText("Cancel"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Cancel Settlement", { selector: "button" })));
    await waitFor(() =>
      expect(svc.processSettlement).toHaveBeenCalledWith(
        "set-1",
        "CANCELLED",
        "Settlement cancelled by finance admin",
      ),
    );

    await waitFor(() =>
      expect(within(screen.getAllByRole("dialog")[0]).queryByText("Mark Completed")).toBeTruthy(),
    );
    fireEvent.click(within(screen.getAllByRole("dialog")[0]).getByText("Mark Completed"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Mark as Completed")));
    await waitFor(() => expect(svc.processSettlement).toHaveBeenCalledTimes(3));

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not process when failure reason or cancel is dismissed, and shows detail errors", async () => {
    await renderPage();
    await screen.findByText("SET-001");
    await act(async () =>
      fireEvent.click(screen.getByLabelText("View details for settlement SET-001")),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Lanka Cruiser");

    fireEvent.click(within(dialog).getByText("Mark Failed"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));

    fireEvent.click(within(dialog).getByText("Cancel"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.processSettlement).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    svc.getSettlementById.mockRejectedValueOnce("x");
    await act(async () =>
      fireEvent.click(screen.getByLabelText("View details for settlement SET-002")),
    );
    expect(await screen.findByText(/Failed to load settlement details/)).toBeTruthy();
    expect(screen.getByText("Loading settlement details…")).toBeTruthy();
  });

  it("toggles, edits and archives commission rules", async () => {
    await renderPage();
    await screen.findByText("Standard");

    fireEvent.click(screen.getByText("Show inactive"));
    await waitFor(() => expect(svc.getCommissionRules).toHaveBeenLastCalledWith(true));
    expect(await screen.findByText("Hide inactive")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getAllByText("Deactivate")[0]));
    expect(svc.updateCommissionRule).toHaveBeenCalledWith("r1", { isActive: false });

    await act(async () => fireEvent.click(screen.getByLabelText("Archive commission rule Flat")));
    expect(svc.deleteCommissionRule).toHaveBeenCalledWith("r2");

    fireEvent.click(screen.getByLabelText("Edit commission rate for Standard"));
    await screen.findByText("Update Commission Rate");
    const rate = screen.getByDisplayValue("10");
    fireEvent.change(rate, { target: { value: "150" } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Update Rate")));
    expect(svc.updateCommissionRule).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Edit commission rate for Standard"));
    await screen.findByText("Update Commission Rate");
    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "12.5" } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Update Rate")));
    await waitFor(() => expect(svc.updateCommissionRule).toHaveBeenLastCalledWith("r1", { percentage: 12.5 }));

    fireEvent.click(screen.getByLabelText("Edit commission rate for Bare"));
    await screen.findByText("Update Commission Rate");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.updateCommissionRule).toHaveBeenCalledTimes(2);
  });

  it("surfaces commission mutation errors", async () => {
    svc.deleteCommissionRule.mockRejectedValue("bad");
    await renderPage();
    await screen.findByText("Standard");
    await act(async () => fireEvent.click(screen.getByLabelText("Archive commission rule Standard")));
    expect(await screen.findByText(/Financial operation failed/)).toBeTruthy();
  });

  it("validates and creates percentage and fixed commission rules", async () => {
    await renderPage();
    await screen.findByText("Standard");
    fireEvent.click(screen.getByText("Create Rule"));
    let dialog = await screen.findByRole("dialog");
    const form = () => screen.getByRole("dialog").querySelector("form") as HTMLFormElement;

    fireEvent.change(within(dialog).getByLabelText("Rule name"), { target: { value: "A" } });
    await act(async () => fireEvent.submit(form()));
    expect(within(dialog).getByRole("alert").textContent).toBe("Rule name must be at least 2 characters.");

    fireEvent.change(within(dialog).getByLabelText("Rule name"), { target: { value: " Peak " } });
    fireEvent.change(within(dialog).getByLabelText("Percentage rate (%)"), { target: { value: "0" } });
    await act(async () => fireEvent.submit(form()));
    expect(within(dialog).getByRole("alert").textContent).toBe("Enter a percentage between 1 and 100.");

    fireEvent.change(within(dialog).getByLabelText("Percentage rate (%)"), { target: { value: "15" } });
    fireEvent.change(within(dialog).getByLabelText("Min booking amount (optional)"), { target: { value: "1000" } });
    fireEvent.change(within(dialog).getByLabelText("Max booking amount (optional)"), { target: { value: "-1" } });
    await act(async () => fireEvent.submit(form()));
    expect(svc.createCommissionRule).toHaveBeenCalledWith({
      name: "Peak",
      type: "PERCENTAGE",
      isActive: true,
      percentage: 15,
      minAmount: 1000,
    });
    await waitFor(() => expect(screen.queryByText("Create Commission Rule")).toBeNull());

    fireEvent.click(screen.getByText("Create Rule"));
    dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Rule name"), { target: { value: "Flat fee" } });
    fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, { target: { value: "FIXED" } });
    fireEvent.change(within(dialog).getByLabelText("Fixed amount (LKR)"), { target: { value: "-5" } });
    await act(async () => fireEvent.submit(form()));
    expect(within(dialog).getByRole("alert").textContent).toBe("Enter a fixed amount greater than 0.");
    fireEvent.change(within(dialog).getByLabelText("Fixed amount (LKR)"), { target: { value: "2500" } });
    fireEvent.change(within(dialog).getByLabelText("Min booking amount (optional)"), { target: { value: "-3" } });
    fireEvent.change(within(dialog).getByLabelText("Max booking amount (optional)"), { target: { value: "90000" } });
    await act(async () => fireEvent.submit(form()));
    expect(svc.createCommissionRule).toHaveBeenLastCalledWith({
      name: "Flat fee",
      type: "FIXED",
      isActive: true,
      fixedAmount: 2500,
      maxAmount: 90000,
    });

    fireEvent.click(screen.getByText("Create Rule"));
    dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Rule name"), { target: { value: "Temp" } });
    fireEvent.click(within(dialog).getByText("Cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("collects tiers via a JSON prompt for tiered rules", async () => {
    await renderPage();
    await screen.findByText("Standard");
    fireEvent.click(screen.getByText("Create Rule"));
    const dialog = await screen.findByRole("dialog");
    const form = dialog.querySelector("form") as HTMLFormElement;
    fireEvent.change(within(dialog).getByLabelText("Rule name"), { target: { value: "Tiered" } });
    fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, { target: { value: "TIERED" } });
    expect(within(dialog).getByText(/Tiers are entered as JSON/)).toBeTruthy();

    // dismissed prompt: nothing created
    act(() => {
      fireEvent.submit(form);
    });
    await screen.findByText("Tiered Commission");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.createCommissionRule).not.toHaveBeenCalled();

    act(() => {
      fireEvent.submit(form);
    });
    await screen.findByText("Tiered Commission");
    let tiersInput = within(lastDialog()).getByRole("textbox");
    fireEvent.change(tiersInput, { target: { value: "not json" } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Apply Tiers")));
    expect(await screen.findByText("Invalid JSON — check the tier format and try again.")).toBeTruthy();

    act(() => {
      fireEvent.submit(form);
    });
    await screen.findByText("Tiered Commission");
    tiersInput = within(lastDialog()).getByRole("textbox");
    fireEvent.change(tiersInput, { target: { value: "[]" } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Apply Tiers")));
    expect(await screen.findByText("Tiers array cannot be empty.")).toBeTruthy();

    act(() => {
      fireEvent.submit(form);
    });
    await screen.findByText("Tiered Commission");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Apply Tiers")));
    await waitFor(() =>
      expect(svc.createCommissionRule).toHaveBeenCalledWith({
        name: "Tiered",
        type: "TIERED",
        isActive: true,
        tiers: [
          { min: 0, max: 50000, rate: 8 },
          { min: 50000, max: 150000, rate: 6 },
        ],
      }),
    );
  });
});
