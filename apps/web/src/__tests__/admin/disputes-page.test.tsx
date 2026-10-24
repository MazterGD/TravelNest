/**
 * Admin disputes page: queue filters/pagination, assign and resolve prompt
 * chains, and the detail panel actions (notes, public updates, status and
 * priority changes).
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/disputes",
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getDisputes: vi.fn(),
    getDisputeById: vi.fn(),
    assignDispute: vi.fn(),
    updateDisputePriority: vi.fn(),
    updateDisputeStatus: vi.fn(),
    addDisputeMessage: vi.fn(),
    resolveDispute: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminDisputesPage from "@/app/[locale]/admin/disputes/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const dispute = (overrides: Record<string, unknown> = {}) => ({
  id: "dis-1",
  disputeCode: "DSP-001",
  subject: "Bus arrived late",
  description: "d".repeat(130),
  createdAt: now,
  raisedByUser: { firstName: "Ravi", lastName: "Kumar" },
  againstUser: { firstName: "Sunil", lastName: "Owner" },
  assignedAdmin: null,
  assignedTo: null,
  booking: { id: "bk-1", pickupLocation: "Colombo", dropoffLocation: null, totalAmount: 45000 },
  priority: "URGENT",
  status: "OPEN",
  _count: { messages: 2 },
  ...overrides,
});

const details = (overrides: Record<string, unknown> = {}) => ({
  ...dispute({ description: "Full description" }),
  messages: [
    { id: "m1", message: "Investigating now", createdAt: now, sender: { firstName: "Ama", lastName: "Admin" } },
  ],
  ...overrides,
});

const queue = (items: any[], extra: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...extra,
});

const lastDialog = () => screen.getAllByRole("dialog").pop() as HTMLElement;
const lastQuery = () => svc.getDisputes.mock.calls.at(-1)[0];

const renderPage = async () => {
  render(<AdminDisputesPage />);
  await waitFor(() => expect(svc.getDisputes).toHaveBeenCalled());
  await screen.findAllByText(/Page \d+ of \d+|No disputes match/);
};

const confirmPrompt = async (title: string, button: string, value?: string) => {
  await screen.findByText(title);
  if (value !== undefined) {
    const input = lastDialog().querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
  }
  await act(async () => fireEvent.click(within(lastDialog()).getByText(button)));
};

describe("AdminDisputesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getDisputes.mockResolvedValue(
      queue([
        dispute(),
        dispute({
          id: "dis-2",
          disputeCode: "DSP-002",
          description: "short",
          priority: "HIGH",
          status: "ESCALATED",
          assignedAdmin: { firstName: "Ama", lastName: "Admin" },
          assignedTo: "admin-9",
          booking: { id: "bk-2", pickupLocation: "Galle", dropoffLocation: "Matara", totalAmount: 1000 },
        }),
        dispute({ id: "dis-3", disputeCode: "DSP-003", priority: "MEDIUM", status: "RESOLVED" }),
        dispute({ id: "dis-4", disputeCode: "DSP-004", priority: "LOW", status: "CLOSED" }),
        dispute({ id: "dis-5", disputeCode: "DSP-005", priority: "LOW", status: "INVESTIGATING" }),
        dispute({ id: "dis-6", disputeCode: "DSP-006", priority: "LOW", status: "ODD" }),
      ]),
    );
    svc.getDisputeById.mockResolvedValue(details());
    for (const fn of ["assignDispute", "updateDisputePriority", "updateDisputeStatus", "addDisputeMessage", "resolveDispute"]) {
      svc[fn].mockResolvedValue({});
    }
  });

  it("renders the queue with truncated descriptions and assignees", async () => {
    await renderPage();
    expect(screen.getByText("DSP-001")).toBeTruthy();
    expect(screen.getAllByText(`${"d".repeat(100)}...`).length).toBe(5);
    expect(screen.getByText("short")).toBeTruthy();
    expect(screen.getByText("Assignee: Ama Admin")).toBeTruthy();
    expect(screen.getAllByText("No dropoff").length).toBe(5);
    expect(screen.getByText("Matara")).toBeTruthy();
    expect(screen.getByText("1-6 of 6")).toBeTruthy();
    expect(screen.getByText(/Select a dispute to review/)).toBeTruthy();
  });

  it("seeds the status filter from the URL and ignores unknown values", async () => {
    nav.search = "status=ESCALATED";
    await renderPage();
    expect(lastQuery().status).toBe("ESCALATED");
  });

  it("shows empty and error states", async () => {
    nav.search = "status=WHAT";
    svc.getDisputes.mockResolvedValueOnce(queue([]));
    await renderPage();
    expect(lastQuery().status).toBeUndefined();
    expect(screen.getByText("No disputes match these filters.")).toBeTruthy();
    svc.getDisputes.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByText("Reload"));
    expect(await screen.findByText("Failed to load disputes")).toBeTruthy();
  });

  it("filters and paginates", async () => {
    svc.getDisputes.mockResolvedValue(queue([dispute()], { page: 2, totalPages: 3, total: 45 }));
    await renderPage();
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(lastQuery().page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(lastQuery().page).toBe(1));
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "OPEN" } });
    fireEvent.change(selects[1], { target: { value: "URGENT" } });
    fireEvent.change(selects[2], { target: { value: "PAYMENT_ISSUE" } });
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ status: "OPEN", priority: "URGENT", type: "PAYMENT_ISSUE", page: 1 }),
    );
    fireEvent.change(selects[0], { target: { value: "" } });
    fireEvent.change(selects[1], { target: { value: "" } });
    fireEvent.change(selects[2], { target: { value: "" } });
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ status: undefined, priority: undefined, type: undefined }),
    );
    fireEvent.change(screen.getByLabelText("Search disputes"), { target: { value: " DSP " } });
    await waitFor(() => expect(lastQuery().search).toBe("DSP"), { timeout: 2000 });
  });

  it("assigns a dispute through two prompts", async () => {
    await renderPage();
    fireEvent.click(screen.getAllByText("Assign")[0]);
    await confirmPrompt("Assign Dispute", "Assign", "  admin-7  ");
    await confirmPrompt("Assignment Note", "Continue", "   ");
    await waitFor(() => expect(svc.assignDispute).toHaveBeenCalledWith("dis-1", "admin-7", undefined));

    fireEvent.click(screen.getAllByText("Assign")[1]);
    await screen.findByText("Assign Dispute");
    expect((lastDialog().querySelector("input") as HTMLInputElement).value).toBe("admin-9");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Assign")));
    await confirmPrompt("Assignment Note", "Continue");
    await waitFor(() =>
      expect(svc.assignDispute).toHaveBeenLastCalledWith("dis-2", "admin-9", "Assigned for investigation"),
    );

    fireEvent.click(screen.getAllByText("Assign")[0]);
    await screen.findByText("Assign Dispute");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.assignDispute).toHaveBeenCalledTimes(2);
  });

  it("resolves a dispute with type and amount, or without optional fields", async () => {
    await renderPage();
    fireEvent.click(screen.getAllByText("Resolve")[0]);
    await confirmPrompt("Resolve Dispute", "Continue", " Refunded half ");
    await confirmPrompt("Resolution Type", "Continue", " PARTIAL_REFUND ");
    await confirmPrompt("Resolution Amount", "Apply", "2500");
    await waitFor(() =>
      expect(svc.resolveDispute).toHaveBeenCalledWith("dis-1", "Refunded half", "PARTIAL_REFUND", 2500),
    );

    fireEvent.click(screen.getAllByText("Resolve")[0]);
    await confirmPrompt("Resolve Dispute", "Continue");
    await screen.findByText("Resolution Type");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    await screen.findByText("Resolution Amount");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    await waitFor(() =>
      expect(svc.resolveDispute).toHaveBeenLastCalledWith(
        "dis-1",
        "Resolved after admin investigation.",
        undefined,
        undefined,
      ),
    );

    fireEvent.click(screen.getAllByText("Resolve")[0]);
    await screen.findByText("Resolve Dispute");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.resolveDispute).toHaveBeenCalledTimes(2);
  });

  it("loads details and runs the detail panel actions", async () => {
    await renderPage();
    await act(async () => fireEvent.click(screen.getAllByText("View")[0]));
    expect(svc.getDisputeById).toHaveBeenCalledWith("dis-1");
    expect(await screen.findByText("Full description")).toBeTruthy();
    expect(screen.getByText("Raised by: Ravi Kumar")).toBeTruthy();
    expect(screen.getByText("Investigating now")).toBeTruthy();

    const add = screen.getByText("Add Internal Note").closest("button") as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Add internal note"), { target: { value: "  Called the owner " } });
    await act(async () => fireEvent.click(add));
    expect(svc.addDisputeMessage).toHaveBeenCalledWith("dis-1", "Called the owner", true);
    await waitFor(() =>
      expect((screen.getByLabelText("Add internal note") as HTMLInputElement).value).toBe(""),
    );
    // the open dispute is refreshed after mutating it
    await waitFor(() => expect(svc.getDisputeById).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByText("Post Public Update"));
    await confirmPrompt("Public Dispute Update", "Post");
    await waitFor(() =>
      expect(svc.addDisputeMessage).toHaveBeenLastCalledWith(
        "dis-1",
        "Admin update: investigation is in progress.",
        false,
      ),
    );
    fireEvent.click(screen.getByText("Post Public Update"));
    await screen.findByText("Public Dispute Update");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.addDisputeMessage).toHaveBeenCalledTimes(2);

    await act(async () => fireEvent.click(screen.getByText("Investigate")));
    expect(svc.updateDisputeStatus).toHaveBeenCalledWith("dis-1", "INVESTIGATING", "Marked as investigating by admin");
    await act(async () => fireEvent.click(screen.getByText("Close")));
    expect(svc.updateDisputeStatus).toHaveBeenCalledWith("dis-1", "CLOSED", "Case closed by admin");
    await act(async () => fireEvent.click(screen.getByText("Escalate")));
    expect(svc.updateDisputeStatus).toHaveBeenCalledWith("dis-1", "ESCALATED", "Escalated for advanced review");
    await act(async () => fireEvent.click(screen.getByText("Mark High Priority")));
    expect(svc.updateDisputePriority).toHaveBeenCalledWith("dis-1", "HIGH", "Priority increased by admin");
  });

  it("shows assigned detail with dropoff and surfaces errors", async () => {
    svc.getDisputeById.mockResolvedValueOnce(
      details({
        assignedAdmin: { firstName: "Ama", lastName: "Admin" },
        booking: { id: "bk-2", pickupLocation: "Galle", dropoffLocation: "Matara", totalAmount: 1000 },
      }),
    );
    await renderPage();
    await act(async () => fireEvent.click(screen.getAllByText("View")[0]));
    await screen.findByText("Raised by: Ravi Kumar");
    expect(screen.getAllByText("Assignee: Ama Admin").length).toBe(2);
    expect(screen.getAllByText("Matara").length).toBe(2);

    svc.updateDisputeStatus.mockRejectedValueOnce(new Error("Invalid transition"));
    await act(async () => fireEvent.click(screen.getByText("Close")));
    expect(await screen.findByText("Invalid transition")).toBeTruthy();

    svc.updateDisputeStatus.mockRejectedValueOnce("x");
    await act(async () => fireEvent.click(screen.getByText("Close")));
    expect(await screen.findByText("Dispute action failed")).toBeTruthy();

    svc.getDisputeById.mockRejectedValueOnce("x");
    await act(async () => fireEvent.click(screen.getAllByText("View")[1]));
    expect(await screen.findByText("Failed to load dispute details")).toBeTruthy();
  });
});
