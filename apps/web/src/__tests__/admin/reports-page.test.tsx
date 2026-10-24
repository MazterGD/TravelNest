/**
 * Admin scheduled reports page: list + filters, create form with JSON
 * configuration validation, detail tabs (overview/edit/history) and the
 * run / export / archive actions.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getScheduledReports: vi.fn(),
    createScheduledReport: vi.fn(),
    updateScheduledReport: vi.fn(),
    runScheduledReport: vi.fn(),
    exportAdminReport: vi.fn(),
    archiveScheduledReport: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminReportsPage from "@/app/[locale]/admin/reports/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const makeReport = (overrides: Record<string, unknown> = {}) => ({
  id: "rep-1",
  name: "Weekly Ops",
  description: "Ops summary",
  reportType: "OPERATIONS",
  frequency: "WEEKLY",
  format: "CSV",
  cronExpression: "0 6 * * 1",
  timezone: "Asia/Colombo",
  isActive: true,
  lastRunAt: now,
  nextRunAt: now,
  recipients: ["ops@tn.lk", "cto@tn.lk"],
  createdAt: now,
  _count: { runs: 2 },
  runs: [
    { id: "run-1", startedAt: now, status: "SUCCESS", triggerSource: "MANUAL", rowCount: 1200 },
    { id: "run-2", startedAt: now, status: "WEIRD", triggerSource: "SCHEDULER", rowCount: null },
  ],
  ...overrides,
});

const listOf = (items: any[], extra: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...extra,
});

const lastDialog = () => screen.getAllByRole("dialog").pop() as HTMLElement;

const renderPage = async () => {
  render(<AdminReportsPage />);
  await waitFor(() => expect(svc.getScheduledReports).toHaveBeenCalled());
};

describe("AdminReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getScheduledReports.mockResolvedValue(
      listOf([
        makeReport(),
        makeReport({
          id: "rep-2",
          name: "Legacy Audit",
          description: null,
          reportType: "CUSTOM",
          frequency: "HOURLY",
          isActive: false,
          lastRunAt: null,
          nextRunAt: null,
        }),
      ]),
    );
    svc.createScheduledReport.mockResolvedValue(
      makeReport({ id: "rep-new", name: "Fresh Report", runs: [], _count: { runs: 0 } }),
    );
    svc.updateScheduledReport.mockResolvedValue(makeReport({ name: "Renamed", description: null, isActive: false }));
    svc.runScheduledReport.mockResolvedValue({});
    svc.exportAdminReport.mockResolvedValue({});
    svc.archiveScheduledReport.mockResolvedValue({});
  });

  it("lists reports with type/schedule labels and fallbacks", async () => {
    await renderPage();
    expect(await screen.findByText("Weekly Ops")).toBeTruthy();
    expect(screen.getByText("Ops summary")).toBeTruthy();
    expect(screen.getByText("CUSTOM")).toBeTruthy();
    expect(screen.getByText("HOURLY")).toBeTruthy();
    expect(screen.getByText("Never")).toBeTruthy();
    expect(screen.getByText("1–2 of 2")).toBeTruthy();
    expect((screen.getByLabelText("Archive Legacy Audit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the empty state and error banner", async () => {
    svc.getScheduledReports.mockResolvedValueOnce(listOf([]));
    await renderPage();
    expect(await screen.findByText("No reports found")).toBeTruthy();
    svc.getScheduledReports.mockRejectedValueOnce(new Error("Reports offline"));
    fireEvent.click(screen.getByLabelText("Refresh report list"));
    expect(await screen.findByText(/Reports offline/)).toBeTruthy();
    expect(screen.getByText("Could not load reports.")).toBeTruthy();
  });

  it("filters by status, search, type, schedule, format and page size", async () => {
    await renderPage();
    await screen.findByText("Weekly Ops");
    const last = () => svc.getScheduledReports.mock.calls.at(-1)[0];

    fireEvent.click(screen.getByText("Archived", { selector: "button" }));
    await waitFor(() => expect(last()).toMatchObject({ isActive: false, page: 1 }));

    fireEvent.change(screen.getByLabelText("Search reports"), { target: { value: " ops " } });
    await waitFor(() => expect(last()).toMatchObject({ search: "ops" }));

    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "AUDIT" } });
    await waitFor(() => expect(last()).toMatchObject({ reportType: "AUDIT" }));
    fireEvent.change(selects[1], { target: { value: "DAILY" } });
    await waitFor(() => expect(last()).toMatchObject({ frequency: "DAILY" }));
    fireEvent.change(selects[2], { target: { value: "PDF" } });
    await waitFor(() => expect(last()).toMatchObject({ format: "PDF" }));
    fireEvent.change(selects[3], { target: { value: "50" } });
    await waitFor(() => expect(last()).toMatchObject({ limit: 50, page: 1 }));
    fireEvent.change(selects[0], { target: { value: "" } });
    fireEvent.change(selects[1], { target: { value: "" } });
    fireEvent.change(selects[2], { target: { value: "" } });
    await waitFor(() =>
      expect(last()).toMatchObject({ reportType: undefined, frequency: undefined, format: undefined }),
    );
  });

  it("paginates", async () => {
    svc.getScheduledReports.mockResolvedValue(listOf([makeReport()], { page: 2, totalPages: 3, total: 45 }));
    await renderPage();
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(svc.getScheduledReports.mock.calls.at(-1)[0].page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(svc.getScheduledReports.mock.calls.at(-1)[0].page).toBe(1));
  });

  it("runs, exports and archives from the table after confirmation", async () => {
    await renderPage();
    await screen.findByText("Weekly Ops");

    fireEvent.click(screen.getByLabelText("Run Weekly Ops now"));
    await screen.findByText("Run Report Now");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Run Now")));
    await waitFor(() => expect(svc.runScheduledReport).toHaveBeenCalledWith("rep-1", "CSV"));

    await act(async () => fireEvent.click(screen.getByLabelText("Export Weekly Ops")));
    expect(svc.exportAdminReport).toHaveBeenCalledWith({ reportId: "rep-1", format: "CSV" });

    fireEvent.click(screen.getByLabelText("Archive Weekly Ops"));
    await screen.findByText("Archive Report");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.archiveScheduledReport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Archive Weekly Ops"));
    await screen.findByText("Archive Report");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Archive")));
    await waitFor(() => expect(svc.archiveScheduledReport).toHaveBeenCalledWith("rep-1"));
  });

  it("surfaces run, export and archive failures", async () => {
    svc.runScheduledReport.mockRejectedValue("x");
    svc.exportAdminReport.mockRejectedValue(new Error("Export failed hard"));
    svc.archiveScheduledReport.mockRejectedValue("x");
    await renderPage();
    await screen.findByText("Weekly Ops");

    fireEvent.click(screen.getByLabelText("Run Weekly Ops now"));
    await screen.findByText("Run Report Now");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Run Now")));
    expect(await screen.findByText(/Failed to run report/)).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByLabelText("Export Weekly Ops")));
    expect(await screen.findByText(/Export failed hard/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Archive Weekly Ops"));
    await screen.findByText("Archive Report");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Archive")));
    expect(await screen.findByText(/Failed to archive report/)).toBeTruthy();
  });

  it("validates JSON configuration and creates a report, then opens it", async () => {
    await renderPage();
    await screen.findByText("Weekly Ops");
    fireEvent.click(screen.getAllByText("Create Report")[0]);
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getAllByText("Create Report").pop()!.closest("button") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "  Fresh Report " } });
    fireEvent.change(within(dialog).getByLabelText("Description (optional)"), { target: { value: " Desc " } });
    const textarea = within(dialog).getByLabelText("Configuration JSON");
    fireEvent.change(textarea, { target: { value: "{bad" } });
    expect(within(dialog).getByText("Invalid JSON — check your syntax")).toBeTruthy();
    fireEvent.change(textarea, { target: { value: "[1,2]" } });
    expect(within(dialog).getByText("Configuration must be a JSON object")).toBeTruthy();
    fireEvent.change(textarea, { target: { value: '{"range":"30d"}' } });
    expect(within(dialog).queryByText(/Invalid JSON|must be a JSON object/)).toBeNull();

    const selects = dialog.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "FINANCIAL" } });
    fireEvent.change(selects[1], { target: { value: "MONTHLY" } });
    fireEvent.change(selects[2], { target: { value: "EXCEL" } });

    await act(async () => {
      fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    });
    expect(svc.createScheduledReport).toHaveBeenCalledWith({
      name: "Fresh Report",
      description: "Desc",
      reportType: "FINANCIAL",
      frequency: "MONTHLY",
      format: "EXCEL",
      configuration: { range: "30d" },
    });
    const detail = await screen.findByRole("dialog");
    expect(within(detail).getAllByText("Fresh Report").length).toBeGreaterThan(0);

    fireEvent.click(within(detail).getByText("Run History", { selector: "span" }));
    expect(within(detail).getByText("No run history available")).toBeTruthy();
    expect(within(detail).getByText(/This report has not been run yet/)).toBeTruthy();
  });

  it("blocks invalid JSON on submit and keeps the form open on create failure", async () => {
    svc.createScheduledReport.mockRejectedValue(new Error("Duplicate name"));
    await renderPage();
    await screen.findByText("Weekly Ops");
    fireEvent.click(screen.getAllByText("Create Report")[0]);
    let dialog = await screen.findByRole("dialog");
    const form = dialog.querySelector("form") as HTMLFormElement;

    // Name too short: nothing submitted
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "A" } });
    await act(async () => fireEvent.submit(form));
    expect(svc.createScheduledReport).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Dup" } });
    await act(async () => fireEvent.submit(form));
    expect(svc.createScheduledReport).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Dup", description: undefined, configuration: {} }),
    );
    expect(await screen.findByText(/Duplicate name/)).toBeTruthy();
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Create Scheduled Report")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows overview, edits and saves a report, and lists run history", async () => {
    await renderPage();
    await screen.findByText("Weekly Ops");
    fireEvent.click(screen.getByLabelText("View details for Weekly Ops"));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("0 6 * * 1")).toBeTruthy();
    expect(within(dialog).getByText("ops@tn.lk, cto@tn.lk")).toBeTruthy();
    expect(within(dialog).getByText("Asia/Colombo")).toBeTruthy();

    await act(async () => fireEvent.click(within(dialog).getByText("Export")));
    expect(svc.exportAdminReport).toHaveBeenCalledWith({ reportId: "rep-1", format: "CSV" });

    fireEvent.click(within(dialog).getByText("Run History", { selector: "span" }));
    expect(within(dialog).getByText("1,200")).toBeTruthy();
    expect(within(dialog).getByText("Weird")).toBeTruthy();
    expect(within(dialog).getByText("Scheduler")).toBeTruthy();
    expect(within(dialog).getByText("—")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Edit", { selector: "span" }));
    const nameInput = within(dialog).getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Weekly Ops");
    fireEvent.change(nameInput, { target: { value: "X" } });
    expect((within(dialog).getByText("Save Changes").closest("button") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(nameInput, { target: { value: " Renamed " } });
    fireEvent.change(within(dialog).getByLabelText("Description"), { target: { value: "   " } });
    fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, { target: { value: "false" } });
    await act(async () => fireEvent.click(within(dialog).getByText("Save Changes")));
    expect(svc.updateScheduledReport).toHaveBeenCalledWith("rep-1", {
      name: "Renamed",
      description: undefined,
      isActive: false,
    });
    await waitFor(() => expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("Renamed"));
  });

  it("keeps edits when saving fails and archives from the detail view", async () => {
    svc.updateScheduledReport.mockRejectedValue("x");
    await renderPage();
    await screen.findByText("Weekly Ops");
    fireEvent.click(screen.getByLabelText("View details for Weekly Ops"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("Edit", { selector: "span" }));
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Changed" } });
    await act(async () => fireEvent.click(within(dialog).getByText("Save Changes")));
    expect(await screen.findByText(/Failed to update report/)).toBeTruthy();
    expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("Changed");

    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    fireEvent.click(within(dialog).getByText("Run Now"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.runScheduledReport).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByText("Archive"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Archive")));
    await waitFor(() => expect(svc.archiveScheduledReport).toHaveBeenCalledWith("rep-1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("renders an archived report without archive action and with a run count hint", async () => {
    svc.getScheduledReports.mockResolvedValue(
      listOf([
        makeReport({
          isActive: false,
          description: null,
          cronExpression: null,
          lastRunAt: null,
          nextRunAt: null,
          recipients: [],
          runs: undefined,
          _count: { runs: 5 },
        }),
      ]),
    );
    await renderPage();
    await screen.findByText("Weekly Ops");
    fireEvent.click(screen.getByLabelText("View details for Weekly Ops"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Not scheduled")).toBeTruthy();
    expect(within(dialog).queryByText("Archive")).toBeNull();
    expect(within(dialog).queryByText("Recipients")).toBeNull();
    fireEvent.click(within(dialog).getByText("Run History", { selector: "span" }));
    expect(within(dialog).getByText(/5 run\(s\) recorded/)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
