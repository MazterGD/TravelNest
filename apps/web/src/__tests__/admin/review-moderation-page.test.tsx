/**
 * Admin review moderation page: queue scope/filters, activate / hide /
 * delete flows, the resolve-report modal and the review detail tabs.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/reviews/moderation",
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getReviewModerationQueue: vi.fn(),
    getReviewModerationById: vi.fn(),
    updateReviewModerationStatus: vi.fn(),
    resolveReviewReport: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminReviewModerationPage from "@/app/[locale]/admin/reviews/moderation/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const review = (overrides: Record<string, unknown> = {}) => ({
  id: "rev-1",
  rating: 2,
  comment: "x".repeat(120),
  createdAt: now,
  isFlagged: true,
  isRemoved: false,
  moderationStatus: "ACTIVE",
  customer: { firstName: "Ravi", lastName: "Kumar", email: "ravi@x.lk#removed-1" },
  vehicle: { name: "Lanka Cruiser", licensePlate: "NB-1234" },
  ...overrides,
});

const details = (overrides: Record<string, unknown> = {}) => ({
  ...review(),
  comment: "Rude driver",
  flaggedByKeyword: true,
  ownerResponse: "We apologise",
  vehicle: {
    name: "Lanka Cruiser",
    licensePlate: "NB-1234",
    owner: { firstName: "Sunil", lastName: "Owner", email: "sunil@x.lk" },
  },
  booking: {
    id: "booking-abcdefghijklmnop",
    startDate: now,
    endDate: now,
    pickupLocation: "Colombo",
    dropoffLocation: "Kandy",
    totalAmount: 42000,
    status: "COMPLETED",
  },
  moderationHistory: [
    { id: "h1", action: "HIDE", createdAt: now, entityType: "REVIEW", changes: { message: "Hidden for language" } },
    { id: "h2", action: "ACTIVATE", createdAt: now, entityType: "REVIEW", changes: { message: "  " } },
    { id: "h3", action: "FLAG", createdAt: now, entityType: "REVIEW_REPORT", changes: null },
  ],
  ...overrides,
});

const queue = (reviews: any[], extra: Record<string, unknown> = {}) => ({
  reviews,
  total: reviews.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...extra,
});

const lastDialog = () => screen.getAllByRole("dialog").pop() as HTMLElement;
const lastQuery = () => svc.getReviewModerationQueue.mock.calls.at(-1)[0];

const renderPage = async () => {
  render(<AdminReviewModerationPage />);
  await waitFor(() => expect(svc.getReviewModerationQueue).toHaveBeenCalled());
};

describe("AdminReviewModerationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getReviewModerationQueue.mockResolvedValue(
      queue([
        review(),
        review({
          id: "rev-2",
          rating: 5,
          comment: null,
          isFlagged: false,
          moderationStatus: "HIDDEN",
          customer: { firstName: "Mala", lastName: "Silva", email: "mala@x.lk" },
        }),
        review({
          id: "rev-3",
          moderationStatus: "DELETED",
          customer: { firstName: "Del", lastName: "Eted", email: "d@x.lk" },
        }),
        review({
          id: "rev-4",
          isRemoved: true,
          customer: { firstName: "Gone", lastName: "Person", email: "g@x.lk" },
        }),
      ]),
    );
    svc.getReviewModerationById.mockResolvedValue(details());
    svc.updateReviewModerationStatus.mockResolvedValue({});
    svc.resolveReviewReport.mockResolvedValue({});
  });

  it("defaults to the flagged queue and renders rows with truncated comments", async () => {
    await renderPage();
    expect(lastQuery()).toMatchObject({ flaggedOnly: true, page: 1, limit: 20 });
    expect(await screen.findByText("Ravi Kumar")).toBeTruthy();
    expect(screen.getAllByText("ravi@x.lk").length).toBe(1);
    expect(screen.getAllByText(`${"x".repeat(100)}…`).length).toBe(3);
    expect(screen.getByText("No comment")).toBeTruthy();
    expect(screen.getByText("Removed")).toBeTruthy();
    expect(screen.getByText("1–4 of 4")).toBeTruthy();
    expect(screen.getAllByLabelText("Activate review").length).toBe(2);
    expect(screen.getAllByLabelText("Hide review").length).toBe(2);
    expect(screen.getAllByLabelText("Delete review").length).toBe(2);
    expect(screen.getAllByLabelText("Resolve flagged report").length).toBe(3);
  });

  it("reads search and flaggedOnly from the URL", async () => {
    nav.search = "search=Lanka&flaggedOnly=false";
    await renderPage();
    expect(lastQuery()).toMatchObject({ search: "Lanka", flaggedOnly: false });
  });

  it("shows the empty state and errors", async () => {
    svc.getReviewModerationQueue.mockResolvedValueOnce(queue([]));
    await renderPage();
    expect(await screen.findByText("No reviews found")).toBeTruthy();
    svc.getReviewModerationQueue.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByLabelText("Refresh moderation queue"));
    expect(await screen.findByText(/Failed to load review moderation queue/)).toBeTruthy();
  });

  it("changes scope, search, status, page size and pages", async () => {
    svc.getReviewModerationQueue.mockResolvedValue(queue([review()], { page: 2, totalPages: 3, total: 50 }));
    await renderPage();
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(lastQuery().page).toBe(3));
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => expect(lastQuery().page).toBe(1));

    fireEvent.click(screen.getByText("All Reviews"));
    await waitFor(() => expect(lastQuery()).toMatchObject({ flaggedOnly: false, page: 1 }));
    fireEvent.change(screen.getByLabelText("Search reviews"), { target: { value: " rude " } });
    await waitFor(() => expect(lastQuery().search).toBe("rude"));
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "HIDDEN" } });
    await waitFor(() => expect(lastQuery().status).toBe("HIDDEN"));
    fireEvent.change(selects[0], { target: { value: "" } });
    await waitFor(() => expect(lastQuery().status).toBeUndefined());
    fireEvent.change(selects[1], { target: { value: "50" } });
    await waitFor(() => expect(lastQuery().limit).toBe(50));
  });

  it("activates directly and hides with a trimmed reason", async () => {
    await renderPage();
    await screen.findByText("Mala Silva");
    await act(async () => fireEvent.click(screen.getAllByLabelText("Activate review")[0]));
    expect(svc.updateReviewModerationStatus).toHaveBeenCalledWith("rev-2", "ACTIVE", undefined);

    fireEvent.click(screen.getAllByLabelText("Hide review")[0]);
    await screen.findByText("Hide Review");
    const input = screen.getByDisplayValue("Pending moderator review.");
    fireEvent.change(input, { target: { value: "  Abusive language  " } });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Hide")));
    await waitFor(() =>
      expect(svc.updateReviewModerationStatus).toHaveBeenCalledWith("rev-1", "HIDDEN", "Abusive language"),
    );

    fireEvent.click(screen.getAllByLabelText("Hide review")[0]);
    await screen.findByText("Hide Review");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.updateReviewModerationStatus).toHaveBeenCalledTimes(2);
  });

  it("deletes only after confirm + reason", async () => {
    await renderPage();
    await screen.findByText("Ravi Kumar");

    fireEvent.click(screen.getAllByLabelText("Delete review")[0]);
    await screen.findByText("Delete Review");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(screen.queryByText("Deletion Reason")).toBeNull();

    fireEvent.click(screen.getAllByLabelText("Delete review")[0]);
    await screen.findByText("Delete Review");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Continue")));
    await screen.findByText("Deletion Reason");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.updateReviewModerationStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByLabelText("Delete review")[0]);
    await screen.findByText("Delete Review");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Continue")));
    await screen.findByText("Deletion Reason");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Delete")));
    await waitFor(() =>
      expect(svc.updateReviewModerationStatus).toHaveBeenCalledWith(
        "rev-1",
        "DELETED",
        "Review violates content policy.",
      ),
    );
  });

  it("validates and applies a report resolution", async () => {
    svc.resolveReviewReport.mockRejectedValueOnce(new Error("Already resolved"));
    await renderPage();
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getAllByLabelText("Resolve flagged report")[0]);
    const dialog = await screen.findByRole("dialog");
    const note = within(dialog).getByLabelText("Resolution note");
    fireEvent.change(note, { target: { value: "ok" } });
    await act(async () => fireEvent.click(within(dialog).getByText("Apply Resolution")));
    expect(within(dialog).getByRole("alert").textContent).toBe(
      "Resolution note must be at least 3 characters.",
    );
    fireEvent.change(note, { target: { value: "  No violation found  " } });
    fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, { target: { value: "DISMISSED" } });
    await act(async () => fireEvent.click(within(dialog).getByText("Apply Resolution")));
    expect(svc.resolveReviewReport).toHaveBeenCalledWith("rev-1", "DISMISSED", "No violation found");
    expect(await screen.findByText(/Already resolved/)).toBeTruthy();

    fireEvent.click(screen.getAllByLabelText("Resolve flagged report")[0]);
    const again = await screen.findByRole("dialog");
    fireEvent.click(within(again).getByText("Cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows details across overview, trip context and history tabs and acts on them", async () => {
    await renderPage();
    await screen.findByText("Ravi Kumar");
    await act(async () =>
      fireEvent.click(screen.getByLabelText("View moderation details for review by Ravi Kumar")),
    );
    expect(svc.getReviewModerationById).toHaveBeenCalledWith("rev-1");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Review by Ravi Kumar")).toBeTruthy();
    expect(within(dialog).getByText("2/5")).toBeTruthy();
    expect(within(dialog).getByText("Low rating (2★)")).toBeTruthy();
    expect(within(dialog).getByText("Sensitive keyword")).toBeTruthy();
    expect(within(dialog).getByText("We apologise")).toBeTruthy();
    expect(within(dialog).getByText("Yes")).toBeTruthy();
    expect(within(dialog).queryByText("Activate")).toBeNull();

    fireEvent.click(within(dialog).getByText("Trip Context", { selector: "span" }));
    expect(within(dialog).getByText("booking-abcd…")).toBeTruthy();
    expect(within(dialog).getByText("Kandy")).toBeTruthy();
    expect(within(dialog).getByText("LKR 42,000")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("History", { selector: "span" }));
    expect(within(dialog).getByText("Hidden for language")).toBeTruthy();
    expect(within(dialog).getByText("REVIEW")).toBeTruthy();
    expect(within(dialog).getByText("REVIEW_REPORT")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    fireEvent.click(within(dialog).getByText("Hide"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Hide")));
    await waitFor(() => expect(svc.updateReviewModerationStatus).toHaveBeenCalledWith("rev-1", "HIDDEN", "Pending moderator review."));
    // selected review reloads after a mutation on it
    await waitFor(() => expect(svc.getReviewModerationById).toHaveBeenCalledTimes(2));

    fireEvent.click(within(screen.getAllByRole("dialog")[0]).getByText("Resolve Report"));
    await screen.findByText("Apply Resolution");
    await act(async () => fireEvent.click(screen.getByText("Apply Resolution")));
    await waitFor(() =>
      expect(svc.resolveReviewReport).toHaveBeenCalledWith(
        "rev-1",
        "RESOLVED",
        "Reviewed and resolved by moderation team.",
      ),
    );
    fireEvent.click(within(screen.getAllByRole("dialog")[0]).getByText("Delete"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("renders minimal details for a hidden, unflagged review and a removed review", async () => {
    svc.getReviewModerationById.mockResolvedValueOnce(
      details({
        rating: 4,
        isFlagged: false,
        flaggedByKeyword: false,
        moderationStatus: "HIDDEN",
        comment: null,
        ownerResponse: null,
        booking: { id: "b-1", startDate: now, endDate: now, status: "CANCELLED", pickupLocation: null, dropoffLocation: null },
        moderationHistory: [],
      }),
    );
    await renderPage();
    await screen.findByText("Mala Silva");
    await act(async () =>
      fireEvent.click(screen.getByLabelText("View moderation details for review by Mala Silva")),
    );
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("No comment provided.")).toBeTruthy();
    expect(within(dialog).getByText("No")).toBeTruthy();
    expect(within(dialog).queryByText("Hide")).toBeNull();
    fireEvent.click(within(dialog).getByText("Trip Context", { selector: "span" }));
    expect(within(dialog).queryByText("Pick-up")).toBeNull();
    expect(within(dialog).queryByText("Booking value")).toBeNull();
    fireEvent.click(within(dialog).getByText("History", { selector: "span" }));
    expect(within(dialog).getByText("No history")).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Activate")));
    expect(svc.updateReviewModerationStatus).toHaveBeenCalledWith("rev-1", "ACTIVE", undefined);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    svc.getReviewModerationById.mockResolvedValueOnce(
      details({ isRemoved: true, moderationStatus: "DELETED", rating: 3 }),
    );
    await act(async () =>
      fireEvent.click(screen.getByLabelText("View moderation details for review by Gone Person")),
    );
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Removed")).toBeTruthy();
    expect(within(dialog).getByText("Status: DELETED")).toBeTruthy();
    expect(within(dialog).queryByText("Resolve Report")).toBeNull();
  });

  it("reports detail load failures", async () => {
    svc.getReviewModerationById.mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("Ravi Kumar");
    await act(async () =>
      fireEvent.click(screen.getByLabelText("View moderation details for review by Ravi Kumar")),
    );
    expect(await screen.findByText(/Failed to load review details/)).toBeTruthy();
    expect(screen.getByText("Loading review details…")).toBeTruthy();
  });

  it("reports moderation mutation failures", async () => {
    svc.updateReviewModerationStatus.mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("Mala Silva");
    await act(async () => fireEvent.click(screen.getAllByLabelText("Activate review")[0]));
    expect(await screen.findByText(/Moderation action failed/)).toBeTruthy();
  });
});
