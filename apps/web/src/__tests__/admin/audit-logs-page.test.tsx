/**
 * Admin audit logs page: status pills and filters, clear-filters, CSV
 * export, pagination and the log detail modal (actor fallbacks included).
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getAuditLogs: vi.fn(),
    exportAuditLogsCsv: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminAuditLogsPage from "@/app/[locale]/admin/audit-logs/page";

const svc = adminService as any;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

const log = (overrides: Record<string, unknown> = {}) => ({
  id: "log-1",
  action: "APPROVE",
  entityType: "VERIFICATION",
  entityId: "ver-123",
  status: "success",
  createdAt: minutesAgo(5),
  actor: { firstName: "Ama", lastName: "Admin", email: "ama@tn.lk", role: "ADMIN", adminRole: "SUPER_ADMIN" },
  admin: null,
  actorRole: "ADMIN",
  ipAddress: "10.0.0.1",
  userAgent: "Mozilla/5.0",
  changes: { before: "PENDING", after: "VERIFIED" },
  errorMessage: null,
  ...overrides,
});

const response = (logs: any[], pagination: Record<string, unknown> = {}) => ({
  logs,
  pagination: { page: 1, limit: 20, total: logs.length, ...pagination },
});

const lastQuery = () => svc.getAuditLogs.mock.calls.at(-1)[0];

const renderPage = async () => {
  render(<AdminAuditLogsPage />);
  await waitFor(() => expect(svc.getAuditLogs).toHaveBeenCalled());
};

describe("AdminAuditLogsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getAuditLogs.mockResolvedValue(
      response([
        log(),
        log({
          id: "log-2",
          action: "CUSTOM_ACTION",
          entityType: "WIDGET",
          status: "failure",
          createdAt: minutesAgo(180),
          actor: null,
          admin: { firstName: "Old", lastName: "Admin", email: "old@tn.lk", adminRole: "MODERATOR" },
          actorRole: null,
          errorMessage: "Permission denied",
          ipAddress: null,
          userAgent: null,
          changes: {},
        }),
        log({
          id: "log-3",
          action: "VIEW",
          entityType: "USER",
          createdAt: minutesAgo(60 * 50),
          actor: null,
          admin: null,
          actorRole: null,
          changes: null,
        }),
        log({
          id: "log-4",
          action: "EXPORT",
          entityType: "REPORT",
          actor: { firstName: "Cus", lastName: "Tomer", email: "c@x.lk", role: "CUSTOMER" },
          actorRole: "WEIRD_ROLE",
        }),
      ]),
    );
    svc.exportAuditLogsCsv.mockResolvedValue(undefined);
  });

  it("renders log rows with relative times and actor fallbacks", async () => {
    await renderPage();
    expect(await screen.findByText("Ama Admin")).toBeTruthy();
    expect(screen.getByText("Super Admin")).toBeTruthy();
    expect(screen.getByText("Moderator")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("WEIRD_ROLE")).toBeTruthy();
    expect(screen.getByText("CUSTOM_ACTION")).toBeTruthy();
    expect(screen.getAllByText(/· 5m ago/).length).toBe(2);
    expect(screen.getByText(/· 3h ago/)).toBeTruthy();
    expect(screen.getByText(/· 2d ago/)).toBeTruthy();
    expect(screen.getByText("4 records")).toBeTruthy();
    expect(screen.getAllByText("Failed").length).toBe(1);
    expect(screen.queryByText("Clear filters")).toBeNull();
  });

  it("shows singular record count, empty state and error banner", async () => {
    svc.getAuditLogs.mockResolvedValueOnce(response([], { total: 1 }));
    await renderPage();
    expect(await screen.findByText("No audit logs found")).toBeTruthy();
    expect(screen.getByText("1 record")).toBeTruthy();
    svc.getAuditLogs.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByLabelText("Refresh audit logs"));
    expect(await screen.findByText(/Failed to load audit logs/)).toBeTruthy();
  });

  it("applies all filters, then clears them", async () => {
    await renderPage();
    await screen.findByText("Ama Admin");
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by status" })).getByText("Failure"));
    await waitFor(() => expect(lastQuery().status).toBe("failure"));

    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "DELETE" } });
    fireEvent.change(selects[1], { target: { value: "PAYMENT" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-09-30" } });
    fireEvent.change(selects[2], { target: { value: "CUSTOMER" } });
    fireEvent.change(screen.getByLabelText("Entity ID"), { target: { value: "  abc  " } });
    fireEvent.change(selects[3], { target: { value: "100" } });
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({
        action: "DELETE",
        entityType: "PAYMENT",
        dateFrom: "2026-09-01",
        dateTo: "2026-09-30",
        actorRole: "CUSTOMER",
        entityId: "abc",
        status: "failure",
        limit: 100,
        page: 1,
      }),
    );

    await act(async () => fireEvent.click(screen.getByLabelText("Export audit logs as CSV")));
    expect(svc.exportAuditLogsCsv).toHaveBeenCalledWith({
      adminId: undefined,
      actorRole: "CUSTOMER",
      action: "DELETE",
      entityType: "PAYMENT",
      entityId: "  abc  ",
      status: "failure",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });

    fireEvent.click(screen.getByText("Clear filters"));
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({
        action: undefined,
        entityType: undefined,
        entityId: undefined,
        actorRole: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        status: undefined,
      }),
    );
    expect(screen.queryByText("Clear filters")).toBeNull();

    fireEvent.change(selects[0], { target: { value: "" } });
    fireEvent.change(selects[1], { target: { value: "" } });
    fireEvent.change(selects[2], { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Entity ID"), { target: { value: "" } });
    expect(screen.queryByText("Clear filters")).toBeNull();
  });

  it("reports export errors", async () => {
    svc.exportAuditLogsCsv.mockRejectedValueOnce(new Error("Export quota exceeded"));
    await renderPage();
    await screen.findByText("Ama Admin");
    await act(async () => fireEvent.click(screen.getByLabelText("Export audit logs as CSV")));
    expect(await screen.findByText(/Export quota exceeded/)).toBeTruthy();
    svc.exportAuditLogsCsv.mockRejectedValueOnce("x");
    await act(async () => fireEvent.click(screen.getByLabelText("Export audit logs as CSV")));
    expect(await screen.findByText(/Failed to export audit logs/)).toBeTruthy();
  });

  it("paginates using total / limit", async () => {
    svc.getAuditLogs.mockResolvedValue(response([log()], { page: 2, limit: 20, total: 55 }));
    await renderPage();
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(lastQuery().page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(lastQuery().page).toBe(1));
  });

  it("opens the detail modal for a successful log with changes", async () => {
    await renderPage();
    await screen.findByText("Ama Admin");
    fireEvent.click(screen.getByLabelText("View details for Approve on Verification"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Operation succeeded")).toBeTruthy();
    expect(within(dialog).getByText("ver-123")).toBeTruthy();
    expect(within(dialog).getByText("ama@tn.lk · Super Admin")).toBeTruthy();
    expect(within(dialog).getByText("10.0.0.1")).toBeTruthy();
    expect(within(dialog).getByText("Mozilla/5.0")).toBeTruthy();
    expect(within(dialog).getByText(/"after": "VERIFIED"/)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens the detail modal for a failed log and a system log", async () => {
    await renderPage();
    await screen.findByText("Ama Admin");
    fireEvent.click(screen.getByLabelText("View details for CUSTOM_ACTION on WIDGET"));
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Operation failed")).toBeTruthy();
    expect(within(dialog).getByText("Permission denied")).toBeTruthy();
    expect(within(dialog).queryByText("IP Address")).toBeNull();
    expect(within(dialog).queryByText("Changes")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByLabelText("View details for View on User"));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("System")).toBeTruthy();
    expect(within(dialog).getByText("— · —")).toBeTruthy();
    expect(within(dialog).getByText("?")).toBeTruthy();
  });

  it("keeps the open log in sync after a refetch", async () => {
    await renderPage();
    await screen.findByText("Ama Admin");
    fireEvent.click(screen.getByLabelText("View details for Approve on Verification"));
    await screen.findByRole("dialog");
    svc.getAuditLogs.mockResolvedValueOnce(response([log({ entityId: "ver-999" })]));
    await act(async () => fireEvent.click(screen.getByLabelText("Refresh audit logs")));
    expect(await within(screen.getByRole("dialog")).findByText("ver-999")).toBeTruthy();

    svc.getAuditLogs.mockResolvedValueOnce(response([]));
    await act(async () => fireEvent.click(screen.getByLabelText("Refresh audit logs")));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
