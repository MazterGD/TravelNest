/**
 * Admin owner verification page: status pills, queue filters/pagination,
 * per-document approve/reject and the detail tabs; plus owner-level hook
 * actions that the page does not surface directly.
 */
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/verifications/owners",
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getOwnerVerifications: vi.fn(),
    getOwnerVerificationById: vi.fn(),
    getVerificationHistory: vi.fn(),
    approveOwnerDocument: vi.fn(),
    rejectOwnerDocument: vi.fn(),
    approveOwnerVerification: vi.fn(),
    rejectOwnerVerification: vi.fn(),
    requestOwnerResubmission: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminOwnerVerificationsPage from "@/app/[locale]/admin/verifications/owners/page";
import { useOwnerVerifications } from "@/app/[locale]/admin/verifications/owners/hooks/useOwnerVerifications";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const owner = (overrides: Record<string, unknown> = {}) => ({
  id: "own-1",
  firstName: "Sunil",
  lastName: "Perera",
  email: "sunil@x.lk",
  status: "PENDING_VERIFICATION",
  documentSummary: { pending: 1, verified: 2, rejected: 1 },
  _count: { vehicles: 3 },
  ...overrides,
});

const detail = (overrides: Record<string, unknown> = {}) => ({
  ...owner(),
  phone: "+94770000000",
  nicNumber: "901234567V",
  isVerified: false,
  documentSummary: { pending: 1, verified: 1, rejected: 1, latestDocumentAt: now },
  documents: [
    { id: "d1", type: "NIC_FRONT", fileName: "nic.jpg", status: "PENDING", createdAt: now, url: "https://signed/nic" },
    { id: "d2", type: "LICENSE", fileName: "lic.jpg", status: "VERIFIED", createdAt: now, url: null },
    { id: "d3", type: "UTILITY", fileName: "bill.jpg", status: "REJECTED", rejectionReason: "Old bill", createdAt: null, url: null },
    { id: "d4", type: "MISC", fileName: "m.jpg", status: "OTHER", createdAt: now, url: null },
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
const lastQuery = () => svc.getOwnerVerifications.mock.calls.at(-1)[0];

const renderPage = async () => {
  render(<AdminOwnerVerificationsPage />);
  await waitFor(() => expect(svc.getOwnerVerifications).toHaveBeenCalled());
};

const openDetail = async (name = "Sunil Perera") => {
  await screen.findByText(name);
  await act(async () => fireEvent.click(screen.getByLabelText(`Review documents for ${name}`)));
  return screen.findByRole("dialog");
};

describe("AdminOwnerVerificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getOwnerVerifications.mockResolvedValue(
      queue([
        owner(),
        owner({
          id: "own-2",
          firstName: "Nimal",
          lastName: "Silva",
          status: "WEIRD",
          documentSummary: { pending: 0, verified: 0, rejected: 0 },
          _count: { vehicles: 0 },
        }),
      ]),
    );
    svc.getOwnerVerificationById.mockResolvedValue(detail());
    svc.getVerificationHistory.mockResolvedValue({
      logs: [
        { id: "l1", action: "DOC_APPROVED", entityType: "OWNER", changes: { message: "NIC ok" }, createdAt: now },
        { id: "l2", action: "DOC_REJECTED", entityType: "OWNER", changes: null, createdAt: now },
      ],
    });
    for (const fn of [
      "approveOwnerDocument",
      "rejectOwnerDocument",
      "approveOwnerVerification",
      "rejectOwnerVerification",
      "requestOwnerResubmission",
    ]) {
      svc[fn].mockResolvedValue({});
    }
  });

  it("defaults to the pending queue and renders owner rows", async () => {
    await renderPage();
    expect(lastQuery()).toMatchObject({ status: "PENDING_VERIFICATION", page: 1, limit: 20 });
    expect(await screen.findByText("Sunil Perera")).toBeTruthy();
    expect(screen.getByText("1 pending")).toBeTruthy();
    expect(screen.getByText("2 verified")).toBeTruthy();
    expect(screen.getByText("1 rejected")).toBeTruthy();
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.getByText("WEIRD")).toBeTruthy();
    expect(screen.getByText("1–2 of 2")).toBeTruthy();
  });

  it("seeds a valid status from the URL", async () => {
    nav.search = "status=SUSPENDED";
    await renderPage();
    expect(lastQuery().status).toBe("SUSPENDED");
  });

  it("falls back to pending for an unknown URL status", async () => {
    nav.search = "status=BOGUS";
    await renderPage();
    expect(lastQuery().status).toBe("PENDING_VERIFICATION");
  });

  it("shows empty and error states", async () => {
    svc.getOwnerVerifications.mockResolvedValueOnce(queue([]));
    await renderPage();
    expect(await screen.findByText("No owners found")).toBeTruthy();
    svc.getOwnerVerifications.mockRejectedValueOnce(new Error("Queue down"));
    fireEvent.click(screen.getByLabelText("Refresh verification queue"));
    expect(await screen.findByText(/Queue down/)).toBeTruthy();
  });

  it("switches status pills, searches, changes page size and paginates", async () => {
    svc.getOwnerVerifications.mockResolvedValue(queue([owner()], { page: 2, totalPages: 3, total: 50 }));
    await renderPage();
    await screen.findByText("Page 2 of 3");
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(lastQuery().page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(lastQuery().page).toBe(1));

    fireEvent.click(screen.getByText("All Owners"));
    await waitFor(() => expect(lastQuery().status).toBeUndefined());
    fireEvent.click(screen.getByText("Active"));
    await waitFor(() => expect(lastQuery().status).toBe("ACTIVE"));
    fireEvent.change(document.querySelector("select") as HTMLSelectElement, { target: { value: "50" } });
    await waitFor(() => expect(lastQuery().limit).toBe(50));
    fireEvent.change(screen.getByLabelText("Search owners"), { target: { value: " 9012 " } });
    await waitFor(() => expect(lastQuery().search).toBe("9012"), { timeout: 2000 });
  });

  it("reviews documents in the detail modal", async () => {
    await renderPage();
    const dialog = await openDetail();
    expect(svc.getOwnerVerificationById).toHaveBeenCalledWith("own-1");
    expect(svc.getVerificationHistory).toHaveBeenCalledWith("own-1", { page: 1, limit: 20 });
    expect(within(dialog).getByText("Old bill")).toBeTruthy();
    expect(within(dialog).getByText("N/A")).toBeTruthy();
    expect(within(dialog).getByLabelText("Open nic.jpg in a new tab").getAttribute("href")).toBe("https://signed/nic");
    expect((within(dialog).getByLabelText("Approve LICENSE") as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Reject UTILITY") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => fireEvent.click(within(dialog).getByLabelText("Approve NIC_FRONT")));
    expect(svc.approveOwnerDocument).toHaveBeenCalledWith("own-1", "d1");
    await waitFor(() => expect(svc.getOwnerVerificationById).toHaveBeenCalledTimes(2));

    fireEvent.click(within(dialog).getByLabelText("Reject NIC_FRONT"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    fireEvent.change(within(lastDialog()).getByRole("textbox"), { target: { value: "  Expired NIC  " } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Reject")));
    await waitFor(() => expect(svc.rejectOwnerDocument).toHaveBeenCalledWith("own-1", "d1", "Expired NIC"));

    fireEvent.click(within(dialog).getByLabelText("Reject NIC_FRONT"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.rejectOwnerDocument).toHaveBeenCalledTimes(1);
  });

  it("shows overview and history tabs", async () => {
    await renderPage();
    const dialog = await openDetail();
    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    expect(within(dialog).getByText("+94770000000")).toBeTruthy();
    expect(within(dialog).getByText("901234567V")).toBeTruthy();
    expect(within(dialog).getByText("No")).toBeTruthy();
    expect(within(dialog).getByText("Pending", { selector: "span" })).toBeTruthy();
    fireEvent.click(within(dialog).getByText("History", { selector: "span" }));
    expect(within(dialog).getByText("NIC ok")).toBeTruthy();
    expect(within(dialog).getByText("DOC_REJECTED")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("handles owners without documents, phone, NIC or history", async () => {
    svc.getOwnerVerificationById.mockResolvedValue(
      detail({
        id: "own-2",
        firstName: "Nimal",
        lastName: "Silva",
        status: "WEIRD",
        phone: null,
        nicNumber: null,
        isVerified: true,
        documents: [],
        documentSummary: { pending: 0, verified: 0, rejected: 0, latestDocumentAt: null },
      }),
    );
    svc.getVerificationHistory.mockResolvedValue({ logs: [] });
    await renderPage();
    const dialog = await openDetail("Nimal Silva");
    expect(within(dialog).getByText("No documents found")).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    expect(within(dialog).getByText("Yes")).toBeTruthy();
    expect(within(dialog).queryByText("NIC")).toBeNull();
    fireEvent.click(within(dialog).getByText("History", { selector: "span" }));
    expect(within(dialog).getByText("No history found")).toBeTruthy();
  });

  it("reports detail and mutation errors", async () => {
    svc.getOwnerVerificationById.mockRejectedValueOnce("x");
    await renderPage();
    await openDetail();
    expect(await screen.findByText(/Failed to load owner verification details/)).toBeTruthy();
    expect(screen.getByText("Loading owner details…")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    svc.approveOwnerDocument.mockRejectedValueOnce("x");
    const dialog = await openDetail();
    await act(async () => fireEvent.click(within(dialog).getByLabelText("Approve NIC_FRONT")));
    expect(await screen.findByText(/Document action failed/)).toBeTruthy();
  });
});

describe("useOwnerVerifications owner-level actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getOwnerVerifications.mockResolvedValue(queue([owner()]));
    svc.getOwnerVerificationById.mockResolvedValue(detail());
    svc.getVerificationHistory.mockResolvedValue({ logs: [] });
  });

  it("approves, rejects and requests resubmission, refreshing the open owner", async () => {
    svc.approveOwnerVerification.mockResolvedValue({});
    svc.rejectOwnerVerification.mockResolvedValue({});
    svc.requestOwnerResubmission.mockResolvedValue({});
    const { result } = renderHook(() => useOwnerVerifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // document actions are no-ops until an owner is selected
    await act(async () => {
      await result.current.approveDocument("d1");
      await result.current.rejectDocument("d1", "bad");
    });
    expect(svc.approveOwnerDocument).not.toHaveBeenCalled();
    expect(svc.rejectOwnerDocument).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.loadOwnerDetails("own-1");
    });
    await act(async () => {
      await result.current.approveOwner("own-1", "All good");
    });
    await act(async () => {
      await result.current.rejectOwner("own-1", "Fake NIC");
    });
    await act(async () => {
      await result.current.requestResubmission("own-1", "Blurry");
    });
    expect(svc.approveOwnerVerification).toHaveBeenCalledWith("own-1", "All good");
    expect(svc.rejectOwnerVerification).toHaveBeenCalledWith("own-1", "Fake NIC");
    expect(svc.requestOwnerResubmission).toHaveBeenCalledWith("own-1", "Blurry");
    expect(svc.getOwnerVerificationById).toHaveBeenCalledTimes(4);
  });

  it("captures Error messages from failed owner actions", async () => {
    svc.rejectOwnerVerification.mockRejectedValue(new Error("Not allowed"));
    const { result } = renderHook(() => useOwnerVerifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.rejectOwner("own-1", "nope");
    });
    expect(result.current.error).toBe("Not allowed");
    expect(result.current.isMutating).toBe(false);
  });
});
