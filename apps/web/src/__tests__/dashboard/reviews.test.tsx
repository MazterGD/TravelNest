/**
 * Customer reviews page: my reviews vs pending tabs, deep-link to a booking's
 * review form, submit success/failure, and load errors with retry.
 */
import { configure, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  t: (key: string) => key,
  params: new URLSearchParams(),
  form: null as any,
}));

vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => h.params,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/dashboard/reviews",
  useParams: () => ({ locale: "en" }),
}));
vi.mock("@/components/features/customer", () => ({
  ReviewDisplay: ({ review }: any) => <div data-testid="review-display">{review.comment}</div>,
  ReviewForm: (props: any) => {
    h.form = props;
    return (
      <div data-testid="review-form">
        <span>{props.vehicleName}</span>
        <button onClick={props.onCancel}>form-cancel</button>
        <button onClick={props.onSkip}>form-skip</button>
      </div>
    );
  },
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  reviewService: { getMyReviews: vi.fn(), getPendingReviews: vi.fn(), create: vi.fn() },
}));

import { ReviewsPageContent } from "@/app/[locale]/dashboard/reviews/ReviewsPageContent";
import { ApiError, reviewService } from "@/lib/api";

const svc = reviewService as any;

const tab = (label: string) => screen.getAllByRole("tab").find((el) => el.textContent?.startsWith(label))!;

const renderReviews = async () => {
  render(<ReviewsPageContent locale="en" />);
  await screen.findByRole("tablist");
};

beforeEach(() => {
  vi.clearAllMocks();
  h.params = new URLSearchParams();
  h.form = null;
  svc.getMyReviews.mockResolvedValue({
    reviews: [
      { id: "r1", rating: 5, comment: "Great trip", createdAt: "2026-10-01", vehicleName: "Lanka Coach", ownerName: "Sunil", tripDate: "2026-09-30" },
      { id: "r2", rating: 3, comment: "OK", createdAt: "2026-10-02", vehicle: { name: "Hill Coach" }, owner: { name: "Kamal" } },
      { id: "r3", rating: 4, createdAt: "2026-10-03" },
    ],
  });
  svc.getPendingReviews.mockResolvedValue({
    pendingReviews: [
      { bookingId: "b1", vehicleId: "v1", vehicleName: "Coastal Bus", ownerName: "Nimal", tripDate: "2026-10-05" },
      { id: "b2", vehicle: { name: "Mini Van" }, owner: { name: "Ruwan" }, endDate: "2026-10-06" },
      { id: "b3", endDate: "2026-10-07" },
    ],
  });
});

describe("ReviewsPageContent", () => {
  it("lists my reviews with fallbacks for missing vehicle/owner names", async () => {
    await renderReviews();
    expect(tab("myReviews").textContent).toBe("myReviews3");
    expect(tab("pendingReviews").textContent).toBe("pendingReviews3");
    expect(screen.getByText("Lanka Coach")).toBeTruthy();
    expect(screen.getByText("Hill Coach")).toBeTruthy();
    expect(screen.getByText("vehicleFallback")).toBeTruthy();
    expect(screen.getByText("by Kamal")).toBeTruthy();
    expect(screen.getByText("by ownerFallback")).toBeTruthy();
    expect(screen.getAllByTestId("review-display").length).toBe(3);
  });

  it("opens, cancels and skips the review form from the pending tab", async () => {
    await renderReviews();
    fireEvent.click(tab("pendingReviews"));
    expect(screen.getByText("Mini Van")).toBeTruthy();
    expect(screen.getByText("by Ruwan", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getAllByText("writeReview")[0]);
    expect(screen.getByTestId("review-form")).toBeTruthy();
    expect(h.form).toMatchObject({ bookingId: "b1", vehicleId: "v1", vehicleName: "Coastal Bus", ownerName: "Nimal" });
    fireEvent.click(screen.getByText("form-cancel"));
    expect(screen.queryByTestId("review-form")).toBeNull();
    fireEvent.click(screen.getAllByText("writeReview")[2]);
    expect(h.form).toMatchObject({ bookingId: "b3", vehicleId: "", vehicleName: "vehicleFallback" });
    fireEvent.click(screen.getByText("form-skip"));
    expect(screen.queryByTestId("review-form")).toBeNull();
  });

  it("deep-links ?booking=<id> to the pending tab with that form open", async () => {
    h.params = new URLSearchParams("booking=b2");
    await renderReviews();
    expect(screen.getByTestId("review-form")).toBeTruthy();
    expect(h.form.bookingId).toBe("b2");
  });

  it("submits a review and refreshes", async () => {
    h.params = new URLSearchParams("booking=b1");
    svc.create.mockResolvedValue({});
    await renderReviews();
    const input = {
      bookingId: "b1", vehicleId: "v1", rating: 5, title: "Lovely", comment: "Smooth ride",
      isRecommended: true, dimensions: { punctuality: 5 },
    };
    let result: any;
    await act(async () => {
      result = await h.form.onSubmit(input);
    });
    expect(result).toEqual({ success: true });
    expect(svc.create).toHaveBeenCalledWith(input);
    await waitFor(() => expect(svc.getMyReviews).toHaveBeenCalledTimes(2));
  });

  it("returns API or generic errors from a failed submit", async () => {
    h.params = new URLSearchParams("booking=b1");
    svc.create.mockRejectedValueOnce(new ApiError(409, "Already reviewed")).mockRejectedValueOnce(new Error("x"));
    await renderReviews();
    let result: any;
    await act(async () => {
      result = await h.form.onSubmit({ bookingId: "b1", vehicleId: "v1", rating: 4 });
    });
    expect(result).toEqual({ success: false, error: "Already reviewed" });
    await act(async () => {
      result = await h.form.onSubmit({ bookingId: "b1", vehicleId: "v1", rating: 4 });
    });
    expect(result).toEqual({ success: false, error: "submitError" });
    expect(screen.getByTestId("review-form")).toBeTruthy();
  });

  it("accepts bare arrays and alternate pending payload shapes", async () => {
    svc.getMyReviews.mockResolvedValue([]);
    svc.getPendingReviews.mockResolvedValue({ bookings: [{ id: "b9", endDate: "2026-10-10" }] });
    await renderReviews();
    expect(screen.getByText("noReviews")).toBeTruthy();
    fireEvent.click(tab("pendingReviews"));
    expect(screen.getByText("writeReview")).toBeTruthy();
  });

  it("accepts a bare pending array and shows the empty pending state", async () => {
    svc.getPendingReviews.mockResolvedValue([]);
    await renderReviews();
    fireEvent.click(tab("pendingReviews"));
    expect(screen.getByText("noPendingReviews")).toBeTruthy();
  });

  it("shows load errors and retries", async () => {
    svc.getMyReviews.mockRejectedValueOnce(new ApiError(500, "Reviews offline")).mockRejectedValueOnce(new Error("x"));
    render(<ReviewsPageContent locale="en" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Reviews offline");
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("fetchError"));
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
