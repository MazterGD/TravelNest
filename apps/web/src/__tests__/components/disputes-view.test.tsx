/**
 * Component tests for DisputesView: list loading/error/empty states, role
 * filters, the detail modal with its reply thread, and raising a dispute.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class ApiError extends Error {}
  // Stable like real next-intl: `t` is a useCallback dependency in the component.
  const t = (key: string) => key;
  return {
    ApiError,
    t,
    svc: { list: vi.fn(), get: vi.fn(), reply: vi.fn(), create: vi.fn() },
  };
});

vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("@/store", () => ({
  useAuthStore: (sel: (s: any) => unknown) => sel({ user: { id: "me" } }),
}));
vi.mock("@/lib/api", () => ({ ApiError: h.ApiError, disputeService: h.svc }));

import { DisputesView } from "@/components/features/disputes/DisputesView";

const item = (over: any = {}) => ({
  id: "d1",
  subject: "Driver was late",
  status: "OPEN",
  disputeCode: "DSP-001",
  type: "BEHAVIOR_COMPLAINT",
  isRaisedByMe: true,
  booking: { vehicle: { name: "Lanka Coach" } },
  createdAt: "2026-10-01T10:00:00Z",
  ...over,
});

const detail = (over: any = {}) => ({
  ...item(),
  description: "Arrived two hours late",
  resolution: null,
  messages: [],
  ...over,
});

const bookings = [{ id: "b1", label: "BK-1 Colombo → Kandy" }];

beforeEach(() => {
  for (const fn of Object.values(h.svc)) fn.mockReset();
  h.svc.list.mockResolvedValue({ disputes: [] });
});

const listButton = (subject: string) => screen.getByRole("heading", { name: subject }).closest("button")!;

describe("DisputesView", () => {
  it("shows skeletons then the empty state; raise is disabled without bookings", async () => {
    let resolve!: (v: any) => void;
    h.svc.list.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { container } = render(<DisputesView locale="en" bookingOptions={[]} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    await act(async () => resolve({ disputes: [] }));
    expect(screen.getByText("noDisputes")).toBeTruthy();
    expect((screen.getByRole("button", { name: "raiseButton" }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.svc.list).toHaveBeenCalledWith({ role: "all", limit: 50 });
  });

  it("disables raising while bookings load", async () => {
    render(<DisputesView locale="en" bookingOptions={bookings} bookingsLoading />);
    await act(async () => {});
    expect((screen.getByRole("button", { name: "raiseButton" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows list errors (API and generic) with retry", async () => {
    h.svc.list
      .mockRejectedValueOnce(new h.ApiError("Forbidden"))
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce({ disputes: [item()] });
    render(<DisputesView locale="en" bookingOptions={bookings} />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Forbidden"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "retry" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("loadError");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "retry" }));
    });
    expect(screen.getByText("Driver was late")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders list items with status/type/role text and refetches per role filter", async () => {
    h.svc.list.mockResolvedValue({
      disputes: [item(), item({ id: "d2", subject: "Refund missing", status: "ESCALATED", isRaisedByMe: false, type: "PAYMENT_ISSUE" })],
    });
    render(<DisputesView locale="en" bookingOptions={bookings} />);
    await waitFor(() => expect(screen.getByText("Driver was late")).toBeTruthy());
    expect(screen.getByText("statusOPEN").className).toContain("text-primary");
    expect(screen.getByText("statusESCALATED").className).toContain("bg-error-bg");
    expect(within(listButton("Driver was late")).getByText(/raisedByYou/)).toBeTruthy();
    expect(within(listButton("Refund missing")).getByText(/raisedAgainstYou/)).toBeTruthy();
    expect(screen.getAllByText("DSP-001").length).toBe(2);
    const raised = screen.getByRole("button", { name: "filterRaised" });
    expect(raised.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      fireEvent.click(raised);
    });
    expect(raised.getAttribute("aria-pressed")).toBe("true");
    expect(h.svc.list).toHaveBeenLastCalledWith({ role: "raised", limit: 50 });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "filterAgainst" }));
    });
    expect(h.svc.list).toHaveBeenLastCalledWith({ role: "against", limit: 50 });
  });

  it("opens the detail modal, shows the thread and posts a reply", async () => {
    h.svc.list.mockResolvedValue({ disputes: [item()] });
    const withThread = detail({
      status: "INVESTIGATING",
      messages: [
        { id: "m1", sender: { id: "me", firstName: "K", lastName: "P" }, message: "Please help", createdAt: "2026-10-02T10:00:00Z" },
        { id: "m2", sender: { id: "adm", firstName: "Ada", lastName: "Admin" }, message: "Looking into it", createdAt: "2026-10-02T11:00:00Z" },
      ],
    });
    let resolveGet!: (v: any) => void;
    h.svc.get.mockReturnValueOnce(new Promise((r) => (resolveGet = r)));
    h.svc.reply.mockResolvedValue(undefined);
    render(<DisputesView locale="en" bookingOptions={bookings} />);
    await waitFor(() => expect(screen.getByText("Driver was late")).toBeTruthy());
    await act(async () => {
      fireEvent.click(listButton("Driver was late"));
    });
    expect(within(screen.getByRole("dialog")).getByText("…")).toBeTruthy();
    expect(h.svc.get).toHaveBeenCalledWith("d1");
    await act(async () => resolveGet({ dispute: withThread }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Arrived two hours late")).toBeTruthy();
    expect(within(dialog).getByText("statusINVESTIGATING").className).toContain("bg-muted");
    expect(within(dialog).getByText("you")).toBeTruthy();
    expect(within(dialog).getByText("Ada Admin")).toBeTruthy();
    expect(within(dialog).getByText("Please help").closest("li")!.className).toContain("justify-end");
    const send = within(dialog).getByRole("button", { name: "send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("reply"), { target: { value: "  Thanks for checking  " } });
    expect(send.disabled).toBe(false);
    h.svc.get.mockResolvedValueOnce({ dispute: { ...withThread, messages: [...withThread.messages, { id: "m3", sender: { id: "me" }, message: "Thanks for checking", createdAt: "2026-10-02T12:00:00Z" }] } });
    await act(async () => {
      fireEvent.click(send);
    });
    expect(h.svc.reply).toHaveBeenCalledWith("d1", "Thanks for checking");
    expect(within(screen.getByRole("dialog")).getByText("Thanks for checking")).toBeTruthy();
    expect((within(screen.getByRole("dialog")).getByLabelText("reply") as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "closeModal" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("surfaces reply failures and detail load failures", async () => {
    h.svc.list.mockResolvedValue({ disputes: [item()] });
    h.svc.get
      .mockResolvedValueOnce({ dispute: detail() })
      .mockRejectedValueOnce(new h.ApiError("Not found"))
      .mockRejectedValueOnce(new Error("x"));
    h.svc.reply.mockRejectedValueOnce(new h.ApiError("Too fast")).mockRejectedValueOnce(new Error("x"));
    render(<DisputesView locale="en" bookingOptions={bookings} />);
    await waitFor(() => expect(screen.getByText("Driver was late")).toBeTruthy());
    await act(async () => {
      fireEvent.click(listButton("Driver was late"));
    });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("noMessages")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("reply"), { target: { value: "Hello there" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "send" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("Too fast");
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "send" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("replyError");
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => {
      fireEvent.click(listButton("Driver was late"));
    });
    expect(screen.getByRole("alert").textContent).toContain("Not found");
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      fireEvent.click(listButton("Driver was late"));
    });
    expect(screen.getByRole("alert").textContent).toContain("loadError");
  });

  it.each([
    ["RESOLVED", "Refund issued", true],
    ["RESOLVED", null, false],
    ["CLOSED", null, false],
  ])("shows the closed notice for %s (resolution %s)", async (status: any, resolution: any, showsResolution: any) => {
    h.svc.list.mockResolvedValue({ disputes: [item({ status })] });
    h.svc.get.mockResolvedValue({ dispute: detail({ status, resolution }) });
    render(<DisputesView locale="en" bookingOptions={bookings} />);
    await waitFor(() => expect(screen.getByText("Driver was late")).toBeTruthy());
    await act(async () => {
      fireEvent.click(listButton("Driver was late"));
    });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("closedNotice")).toBeTruthy();
    expect(within(dialog).queryByLabelText("reply")).toBeNull();
    expect(Boolean(within(dialog).queryByText("resolution"))).toBe(showsResolution);
  });

  it("raises a dispute after validation and refreshes the list", async () => {
    h.svc.create.mockResolvedValue(undefined);
    render(<DisputesView locale="en" bookingOptions={bookings} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "raiseButton" }));
    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "submit" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const form = dialog.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(h.svc.create).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: /selectBooking/ }));
    fireEvent.click(within(dialog).getAllByRole("option", { name: "BK-1 Colombo → Kandy" }).find((el) => el.tagName === "BUTTON")!);
    fireEvent.click(within(dialog).getByRole("button", { name: /typeBOOKING_QUALITY_ISSUE/ }));
    fireEvent.click(within(dialog).getAllByRole("option", { name: "typePAYMENT_ISSUE" }).find((el) => el.tagName === "BUTTON")!);
    fireEvent.change(within(dialog).getByLabelText("fieldSubject"), { target: { value: " Overcharged " } });
    fireEvent.change(within(dialog).getByLabelText("fieldDescription"), { target: { value: "short" } });
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(h.svc.create).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("fieldDescription"), { target: { value: " I was charged twice for one trip " } });
    expect(submit.disabled).toBe(false);
    const listCalls = h.svc.list.mock.calls.length;
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(h.svc.create).toHaveBeenCalledWith({
      bookingId: "b1",
      type: "PAYMENT_ISSUE",
      subject: "Overcharged",
      description: "I was charged twice for one trip",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(h.svc.list.mock.calls.length).toBe(listCalls + 1);
    fireEvent.click(screen.getByRole("button", { name: "raiseButton" }));
    expect((within(screen.getByRole("dialog")).getByLabelText("fieldSubject") as HTMLInputElement).value).toBe("");
  });

  it("shows create errors and cancels", async () => {
    h.svc.create.mockRejectedValueOnce(new h.ApiError("Already disputed")).mockRejectedValueOnce(new Error("x"));
    render(<DisputesView locale="en" bookingOptions={bookings} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "raiseButton" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /selectBooking/ }));
    fireEvent.click(within(dialog).getAllByRole("option", { name: "BK-1 Colombo → Kandy" }).find((el) => el.tagName === "BUTTON")!);
    fireEvent.change(within(dialog).getByLabelText("fieldSubject"), { target: { value: "Subject" } });
    fireEvent.change(within(dialog).getByLabelText("fieldDescription"), { target: { value: "A long enough description" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "submit" }));
    });
    expect(within(dialog).getByRole("alert").textContent).toBe("Already disputed");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "submit" }));
    });
    expect(within(dialog).getByRole("alert").textContent).toBe("createError");
    fireEvent.click(within(dialog).getByRole("button", { name: "cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "raiseButton" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "closeModal" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the no-bookings notice if bookings disappear while the raise modal is open", async () => {
    const { rerender } = render(<DisputesView locale="en" bookingOptions={bookings} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "raiseButton" }));
    rerender(<DisputesView locale="en" bookingOptions={[]} />);
    expect(within(screen.getByRole("dialog")).getByText("noBookings")).toBeTruthy();
  });

  it.todo("raise-dispute Select fields have labels associated with their controls (DisputesView.tsx:422-433 pass no id, so <label htmlFor> is undefined)");
});
