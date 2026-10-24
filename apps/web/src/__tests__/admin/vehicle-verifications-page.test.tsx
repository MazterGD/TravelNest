/**
 * Admin vehicle verification page: queue filters/pagination, activation
 * approve/reject, per-document review and the detail tabs.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/verifications/vehicles",
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getVehicleVerifications: vi.fn(),
    getVehicleVerificationById: vi.fn(),
    getVerificationHistory: vi.fn(),
    approveVehicleDocument: vi.fn(),
    rejectVehicleDocument: vi.fn(),
    approveVehicleVerification: vi.fn(),
    rejectVehicleVerification: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminVehicleVerificationsPage from "@/app/[locale]/admin/verifications/vehicles/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";
const owner = { firstName: "Sunil", lastName: "Owner", email: "sunil@x.lk" };

const item = (overrides: Record<string, unknown> = {}) => ({
  id: "veh-1",
  name: "Lanka Cruiser Deluxe",
  licensePlate: "NB-1234",
  owner,
  verificationState: "PENDING",
  documentSummary: { pending: 2, verified: 1, rejected: 1 },
  ...overrides,
});

const detail = (overrides: Record<string, unknown> = {}) => ({
  id: "veh-1",
  name: "Lanka Cruiser Deluxe",
  licensePlate: "NB-1234",
  brand: "Ashok",
  model: "Viking",
  location: "Colombo",
  isActive: false,
  owner,
  documentSummary: { pending: 1, verified: 1, rejected: 1, latestDocumentAt: now },
  documents: [
    { id: "doc-1", type: "INSURANCE", fileName: "ins.pdf", status: "PENDING", createdAt: now, url: "https://signed/ins" },
    { id: "doc-2", type: "REGISTRATION", fileName: "reg.pdf", status: "VERIFIED", createdAt: now, url: null },
    { id: "doc-3", type: "PERMIT", fileName: "per.pdf", status: "REJECTED", rejectionReason: "Blurry", createdAt: now, url: null },
    { id: "doc-4", type: "OTHER", fileName: "o.pdf", status: "ODD", createdAt: null, url: null },
  ],
  photos: [
    { id: "p1", url: "https://img/1.webp", isPrimary: true, tag: "FRONT" },
    { id: "p2", url: "https://img/2.webp", isPrimary: false, tag: null },
  ],
  ...overrides,
});

const queue = (items: any[], extra: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  page: 1,
  limit: 10,
  totalPages: 1,
  ...extra,
});

const lastDialog = () => screen.getAllByRole("dialog").pop() as HTMLElement;
const lastQuery = () => svc.getVehicleVerifications.mock.calls.at(-1)[0];

const renderPage = async () => {
  render(<AdminVehicleVerificationsPage />);
  await waitFor(() => expect(svc.getVehicleVerifications).toHaveBeenCalled());
};

const openDetail = async (name = "Lanka Cruiser Deluxe") => {
  await screen.findByText(name);
  await act(async () => fireEvent.click(screen.getByLabelText(`Review details for ${name}`)));
  return screen.findByRole("dialog");
};

describe("AdminVehicleVerificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getVehicleVerifications.mockResolvedValue(
      queue([
        item(),
        item({
          id: "veh-2",
          name: "Hill Rider",
          verificationState: "ACTIVATION_REQUEST",
          documentSummary: { pending: 0, verified: 0, rejected: 0 },
        }),
        item({ id: "veh-3", name: "Odd Bus", verificationState: "SOMETHING" }),
      ]),
    );
    svc.getVehicleVerificationById.mockResolvedValue(detail());
    svc.getVerificationHistory.mockResolvedValue({
      logs: [
        { id: "l1", action: "DOC_APPROVED", entityType: "VEHICLE", changes: { message: "Insurance ok" }, createdAt: now },
        { id: "l2", action: "DOC_REJECTED", entityType: "VEHICLE", changes: null, createdAt: now },
      ],
    });
    for (const fn of [
      "approveVehicleDocument",
      "rejectVehicleDocument",
      "approveVehicleVerification",
      "rejectVehicleVerification",
    ]) {
      svc[fn].mockResolvedValue({});
    }
  });

  it("renders the queue with state badges and document counts", async () => {
    await renderPage();
    expect(await screen.findByText("Lanka Cruiser Deluxe")).toBeTruthy();
    expect(screen.getByText("Activation Request")).toBeTruthy();
    expect(screen.getByText("SOMETHING")).toBeTruthy();
    expect(screen.getAllByText("2 pending").length).toBe(2);
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.getByText("1–3 of 3")).toBeTruthy();
    expect(screen.getByLabelText("Approve activation for Hill Rider")).toBeTruthy();
    expect(screen.queryByLabelText("Approve activation for Odd Bus")).toBeNull();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
  });

  it("seeds valid state and search from the URL", async () => {
    nav.search = "verificationState=MISSING_DOCUMENTS&search=NB";
    await renderPage();
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ verificationState: "MISSING_DOCUMENTS", search: "NB" }),
    );
  });

  it("ignores an unknown verification state in the URL", async () => {
    nav.search = "verificationState=NOPE";
    await renderPage();
    expect(lastQuery().verificationState).toBeUndefined();
  });

  it("shows empty and error states", async () => {
    svc.getVehicleVerifications.mockResolvedValueOnce(queue([]));
    await renderPage();
    expect(await screen.findByText("No vehicles pending review")).toBeTruthy();
    svc.getVehicleVerifications.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByLabelText("Refresh verification queue"));
    expect(await screen.findByText(/Failed to load vehicle verification queue/)).toBeTruthy();
  });

  it("filters and paginates", async () => {
    svc.getVehicleVerifications.mockResolvedValue(queue([item()], { page: 2, totalPages: 3, total: 25 }));
    await renderPage();
    await screen.findByText("Page 2 of 3");
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(lastQuery().page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(lastQuery().page).toBe(1));
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "ACTIVATION_REQUEST" } });
    await waitFor(() => expect(lastQuery().verificationState).toBe("ACTIVATION_REQUEST"));
    fireEvent.change(selects[0], { target: { value: "" } });
    await waitFor(() => expect(lastQuery().verificationState).toBeUndefined());
    fireEvent.change(selects[1], { target: { value: "50" } });
    await waitFor(() => expect(lastQuery().limit).toBe(50));
    fireEvent.change(screen.getByLabelText("Search vehicles"), { target: { value: " Hill " } });
    await waitFor(() => expect(lastQuery().search).toBe("Hill"), { timeout: 2000 });
  });

  it("approves and rejects activation requests from the queue", async () => {
    await renderPage();
    await screen.findByText("Hill Rider");
    await act(async () => fireEvent.click(screen.getByLabelText("Approve activation for Hill Rider")));
    expect(svc.approveVehicleVerification).toHaveBeenCalledWith("veh-2", undefined);

    fireEvent.click(screen.getByLabelText("Reject activation for Hill Rider"));
    await screen.findByText("Reject Activation Request");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.rejectVehicleVerification).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Reject activation for Hill Rider"));
    await screen.findByText("Reject Activation Request");
    fireEvent.change(within(lastDialog()).getByRole("textbox"), { target: { value: "  Photos missing " } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Reject")));
    await waitFor(() =>
      expect(svc.rejectVehicleVerification).toHaveBeenCalledWith("veh-2", "Photos missing"),
    );
  });

  it("surfaces activation errors", async () => {
    svc.approveVehicleVerification.mockRejectedValue(new Error("Docs incomplete"));
    await renderPage();
    await screen.findByText("Hill Rider");
    await act(async () => fireEvent.click(screen.getByLabelText("Approve activation for Hill Rider")));
    expect(await screen.findByText(/Docs incomplete/)).toBeTruthy();
  });

  it("opens on the documents tab and reviews documents individually", async () => {
    await renderPage();
    const dialog = await openDetail();
    expect(svc.getVehicleVerificationById).toHaveBeenCalledWith("veh-1");
    expect(svc.getVerificationHistory).toHaveBeenCalledWith("veh-1", { page: 1, limit: 20 });
    expect(within(dialog).getByText("Blurry")).toBeTruthy();
    expect(within(dialog).getByLabelText("Open ins.pdf in a new tab").getAttribute("href")).toBe("https://signed/ins");
    expect(within(dialog).getAllByText("Unavailable").length).toBe(3);
    expect(within(dialog).getByText("N/A")).toBeTruthy();
    expect((within(dialog).getByLabelText("Approve REGISTRATION") as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Reject PERMIT") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => fireEvent.click(within(dialog).getByLabelText("Approve INSURANCE")));
    expect(svc.approveVehicleDocument).toHaveBeenCalledWith("veh-1", "doc-1");
    // detail panel refreshes after a mutation
    await waitFor(() => expect(svc.getVehicleVerificationById).toHaveBeenCalledTimes(2));

    fireEvent.click(within(dialog).getByLabelText("Reject INSURANCE"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Reject")));
    await waitFor(() =>
      expect(svc.rejectVehicleDocument).toHaveBeenCalledWith(
        "veh-1",
        "doc-1",
        "Document is outdated or illegible. Please resubmit.",
      ),
    );

    fireEvent.click(within(dialog).getByLabelText("Reject INSURANCE"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.rejectVehicleDocument).toHaveBeenCalledTimes(1);
  });

  it("shows overview, photos and history tabs", async () => {
    await renderPage();
    const dialog = await openDetail();

    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    expect(within(dialog).getByText("Ashok Viking")).toBeTruthy();
    expect(within(dialog).getByText("Pending", { selector: "span" })).toBeTruthy();
    expect(within(dialog).getByText("Colombo")).toBeTruthy();
    expect(within(dialog).getByText("No")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Photos", { selector: "span" }));
    expect(within(dialog).getByText(/2 photos uploaded/)).toBeTruthy();
    expect(within(dialog).getByLabelText("View vehicle photo 1 (primary listing photo) in a new tab")).toBeTruthy();
    expect(within(dialog).getByText("Front")).toBeTruthy();
    expect(within(dialog).getByText("Primary")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("History", { selector: "span" }));
    expect(within(dialog).getByText("Insurance ok")).toBeTruthy();
    expect(within(dialog).getByText("DOC_REJECTED")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("derives rejected / verified / missing states and handles empty sections", async () => {
    svc.getVerificationHistory.mockResolvedValue({ logs: [] });
    svc.getVehicleVerificationById.mockResolvedValueOnce(
      detail({ documentSummary: { pending: 0, verified: 1, rejected: 2, latestDocumentAt: null } }),
    );
    await renderPage();
    let dialog = await openDetail();
    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    expect(within(dialog).getByText("Rejected", { selector: "span" })).toBeTruthy();
    fireEvent.click(within(dialog).getByText("History", { selector: "span" }));
    expect(within(dialog).getByText("No history found")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    svc.getVehicleVerificationById.mockResolvedValueOnce(
      detail({ documentSummary: { pending: 0, verified: 3, rejected: 0 }, photos: [{ id: "p", url: "u", isPrimary: false }] }),
    );
    dialog = await openDetail();
    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    expect(within(dialog).getByText("Verified", { selector: "span" })).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Photos", { selector: "span" }));
    expect(within(dialog).getByText(/^1 photo uploaded/)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    svc.getVehicleVerificationById.mockResolvedValueOnce(
      detail({
        documentSummary: { pending: 0, verified: 0, rejected: 0 },
        documents: [],
        photos: [],
        location: null,
        isActive: true,
      }),
    );
    dialog = await openDetail();
    expect(within(dialog).getByText("No documents found")).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    expect(within(dialog).getByText("No Documents")).toBeTruthy();
    expect(within(dialog).getByText(/No documents submitted/)).toBeTruthy();
    expect(within(dialog).getByText("Yes")).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Photos", { selector: "span" }));
    expect(within(dialog).getByText("No photos uploaded")).toBeTruthy();
  });

  it("reports detail load failures", async () => {
    svc.getVehicleVerificationById.mockRejectedValueOnce("x");
    await renderPage();
    await openDetail();
    expect(await screen.findByText(/Failed to load vehicle verification details/)).toBeTruthy();
    expect(screen.getByText("Loading vehicle details…")).toBeTruthy();
  });

  it.todo(
    "shows Approve Activation / Reject in the detail overview for a vehicle in ACTIVATION_REQUEST state (deriveVerificationState never yields ACTIVATION_REQUEST)",
  );
});
