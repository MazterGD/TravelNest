/**
 * Admin platform notifications page: history filters/pagination, compose +
 * publish payload (targets, schedule, metadata parsing), delivery analytics
 * and resend.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getPlatformNotifications: vi.fn(),
    getPlatformNotificationAnalytics: vi.fn(),
    createPlatformNotification: vi.fn(),
    resendPlatformNotification: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminNotificationsPage from "@/app/[locale]/admin/notifications/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const notification = (overrides: Record<string, unknown> = {}) => ({
  id: "n1",
  title: "Service update",
  type: "ANNOUNCEMENT",
  message: "We are upgrading payments tonight",
  targetRole: "CUSTOMER",
  targetUserIds: ["u1", "u2"],
  status: "SENT",
  channel: "IN_APP",
  sentAt: now,
  scheduledFor: null,
  _count: { resends: 1 },
  ...overrides,
});

const history = (items: any[], extra: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...extra,
});

const analytics = (id = "n1", title = "Service update") => ({
  notification: { id, title, type: "ANNOUNCEMENT", channel: "EMAIL" },
  metrics: { targetedRecipients: 100, delivered: 90, reads: 45, openRate: 45.678 },
});

const lastQuery = () => svc.getPlatformNotifications.mock.calls.at(-1)[0];
const selects = () => document.querySelectorAll("select");

const renderPage = async () => {
  render(<AdminNotificationsPage />);
  await screen.findByText(/Page \d+ of \d+/);
};

describe("AdminNotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getPlatformNotifications.mockResolvedValue(
      history([
        notification(),
        notification({ id: "n2", title: "Scheduled promo", targetRole: null, targetUserIds: [], status: "SCHEDULED", sentAt: null, scheduledFor: now, _count: undefined }),
        notification({ id: "n3", title: "Draft note", status: "DRAFT", sentAt: null }),
        notification({ id: "n4", title: "Failed blast", status: "FAILED" }),
      ]),
    );
    svc.getPlatformNotificationAnalytics.mockResolvedValue(analytics());
    svc.createPlatformNotification.mockResolvedValue({ notification: { id: "n9" } });
    svc.resendPlatformNotification.mockResolvedValue({ notification: { id: "n1" } });
  });

  it("renders notification history with audience and send states", async () => {
    await renderPage();
    expect(screen.getByText("Service update")).toBeTruthy();
    expect(screen.getByText("ALL_ACTIVE_USERS")).toBeTruthy();
    expect(screen.getAllByText("2 direct user(s)").length).toBe(3);
    expect(screen.getByText(/^Scheduled [0-9]/, { selector: "td" })).toBeTruthy();
    expect(screen.getByText("Not sent")).toBeTruthy();
    expect(screen.getByText("Resends: 0")).toBeTruthy();
    expect(screen.getByText("1-4 of 4")).toBeTruthy();
    expect(screen.getByText(/Select a notification from history/)).toBeTruthy();
  });

  it("shows empty and error states", async () => {
    svc.getPlatformNotifications.mockResolvedValueOnce(history([]));
    await renderPage();
    expect(screen.getByText("No notifications found.")).toBeTruthy();
    svc.getPlatformNotifications.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByText("Reload"));
    expect(await screen.findByText("Failed to load notifications")).toBeTruthy();
  });

  it("filters and paginates history", async () => {
    svc.getPlatformNotifications.mockResolvedValue(history([notification()], { page: 2, totalPages: 3, total: 41 }));
    await renderPage();
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(lastQuery().page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(lastQuery().page).toBe(1));
    fireEvent.change(screen.getByLabelText("Search history"), { target: { value: " promo " } });
    fireEvent.change(selects()[0], { target: { value: "FAILED" } });
    fireEvent.change(selects()[1], { target: { value: "EMAIL" } });
    fireEvent.change(selects()[2], { target: { value: "ADMIN" } });
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ search: "promo", status: "FAILED", channel: "EMAIL", targetRole: "ADMIN", page: 1 }),
    );
    fireEvent.change(selects()[0], { target: { value: "" } });
    fireEvent.change(selects()[1], { target: { value: "" } });
    fireEvent.change(selects()[2], { target: { value: "" } });
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ status: undefined, channel: undefined, targetRole: undefined }),
    );
  });

  it("does not publish until title and message are long enough", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello there" } });
    await act(async () => fireEvent.click(screen.getByText("Publish")));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Alert" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hi" } });
    await act(async () => fireEvent.click(screen.getByText("Publish")));
    expect(svc.createPlatformNotification).not.toHaveBeenCalled();
  });

  it("publishes a fully configured notification and opens its analytics", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  Holiday notice " } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "  Offices closed on Poya day " } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "  " } });
    fireEvent.change(selects()[3], { target: { value: "SMS" } });
    fireEvent.change(selects()[4], { target: { value: "VEHICLE_OWNER" } });
    fireEvent.change(screen.getByLabelText("Target user IDs (comma separated)"), {
      target: { value: " u1, ,u2 " },
    });
    fireEvent.change(screen.getByLabelText("Schedule at (optional)"), { target: { value: "2026-12-01T09:30" } });
    fireEvent.change(screen.getByLabelText("Metadata JSON"), { target: { value: '{"campaign":"poya"}' } });
    await act(async () => fireEvent.click(screen.getByText("Publish")));
    expect(svc.createPlatformNotification).toHaveBeenCalledWith({
      title: "Holiday notice",
      message: "Offices closed on Poya day",
      type: "ANNOUNCEMENT",
      channel: "SMS",
      targetRole: "VEHICLE_OWNER",
      targetUserIds: ["u1", "u2"],
      scheduledFor: new Date("2026-12-01T09:30").toISOString(),
      metadata: { campaign: "poya" },
    });
    expect(svc.getPlatformNotificationAnalytics).toHaveBeenCalledWith("n9");
    expect(await screen.findByText("45.7%")).toBeTruthy();
    expect(screen.getByText("ANNOUNCEMENT | EMAIL")).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
  });

  it.each([
    ["", undefined],
    ["[1,2]", undefined],
    ["{broken", undefined],
  ])("drops invalid metadata %j", async (metadata: string, expected: unknown) => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Notice" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Something happened" } });
    fireEvent.change(screen.getByLabelText("Metadata JSON"), { target: { value: metadata } });
    fireEvent.change(selects()[3], { target: { value: "" } });
    await act(async () => fireEvent.click(screen.getByText("Publish")));
    const payload = svc.createPlatformNotification.mock.calls[0][0];
    expect(payload.metadata).toBe(expected);
    expect(payload.channel).toBe("IN_APP");
    expect(payload.targetRole).toBeUndefined();
    expect(payload.scheduledFor).toBeUndefined();
    expect(payload.targetUserIds).toEqual([]);
  });

  it("keeps the draft when publishing fails", async () => {
    svc.createPlatformNotification.mockRejectedValueOnce(new Error("Rate limited"));
    await renderPage();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Notice" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Something happened" } });
    await act(async () => fireEvent.click(screen.getByText("Publish")));
    expect(await screen.findByText("Rate limited")).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Notice");
    svc.createPlatformNotification.mockRejectedValueOnce("x");
    await act(async () => fireEvent.click(screen.getByText("Publish")));
    expect(await screen.findByText("Failed to create notification")).toBeTruthy();
  });

  it("loads analytics and resends, refreshing analytics for the open notification", async () => {
    await renderPage();
    await act(async () => fireEvent.click(screen.getAllByText("Analytics")[0]));
    expect(svc.getPlatformNotificationAnalytics).toHaveBeenCalledWith("n1");
    expect(await screen.findByText("100")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getAllByText("Resend")[0]));
    expect(svc.resendPlatformNotification).toHaveBeenCalledWith("n1", {
      message: "We are upgrading payments tonight (resent)",
    });
    await waitFor(() => expect(svc.getPlatformNotificationAnalytics).toHaveBeenCalledTimes(2));

    await act(async () => fireEvent.click(screen.getAllByText("Resend")[1]));
    expect(svc.resendPlatformNotification).toHaveBeenLastCalledWith("n2", expect.any(Object));
    expect(svc.getPlatformNotificationAnalytics).toHaveBeenCalledTimes(2);
  });

  it("reports analytics and resend failures", async () => {
    svc.getPlatformNotificationAnalytics.mockRejectedValueOnce("x");
    await renderPage();
    await act(async () => fireEvent.click(screen.getAllByText("Analytics")[0]));
    expect(await screen.findByText("Failed to load notification analytics")).toBeTruthy();
    svc.resendPlatformNotification.mockRejectedValueOnce("x");
    await act(async () => fireEvent.click(screen.getAllByText("Resend")[0]));
    expect(await screen.findByText("Failed to resend notification")).toBeTruthy();
  });
});
