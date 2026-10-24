/**
 * Owner reviews page: summary + distribution + dimension averages, tab
 * filtering (hasResponse), vehicle deep-link filter, responding to reviews
 * (optimistic summary update) and the categorised load-error messages.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  search: "",
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/reviews",
}));
vi.mock("next-intl", () => ({ useTranslations: () => state.t, useLocale: () => "en" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks", () => ({ useOwnerGuard: () => state.guard }));
vi.mock("@/components/ui/LoadingSpinner", () => ({ LoadingSpinner: () => <div data-testid="spinner" /> }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 400, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { ApiError };
});
vi.mock("@/lib/api/services", () => ({
  ownerService: { getReviewSummary: vi.fn(), getReviews: vi.fn() },
  reviewService: { respond: vi.fn() },
}));

import { ApiError } from "@/lib/api";
import { ownerService, reviewService } from "@/lib/api/services";
import OwnerReviewsPage from "@/app/[locale]/owner/reviews/page";

const owner = ownerService as any;
const reviewsApi = reviewService as any;
const now = "2026-10-01T10:00:00.000Z";
const Err = ApiError as any;

const summary = (overrides: Record<string, unknown> = {}) => ({
  averageRating: 4.25,
  totalReviews: 4,
  pendingResponses: 2,
  responseRate: 50,
  ratingDistribution: { 5: 2, 4: 1, 1: 1 },
  dimensionAverages: { vehicleCondition: 4.5, driverBehavior: null, punctuality: 4, cleanliness: null, valueForMoney: 3.2 },
  ...overrides,
});

const review = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  rating: 5,
  dimensions: { vehicleCondition: 5, driverBehavior: 4, punctuality: null },
  title: "Great trip",
  comment: "Driver was lovely",
  isRecommended: true,
  ownerResponse: null,
  createdAt: now,
  tripDate: now,
  customerName: "Ravi",
  customerAvatar: null,
  vehicleId: "veh-1",
  vehicleName: "Lanka Cruiser",
  ...overrides,
});

const renderPage = async () => {
  render(<OwnerReviewsPage />);
  await waitFor(() => expect(owner.getReviews).toHaveBeenCalled());
  await waitFor(() => expect(document.querySelector(".animate-pulse")).toBeNull());
};

describe("OwnerReviewsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.search = "";
    owner.getReviewSummary.mockResolvedValue(summary());
    owner.getReviews.mockResolvedValue({
      reviews: [
        review("r1"),
        review("r2", { rating: 2, title: null, comment: null, isRecommended: false, ownerResponse: "Sorry about that", dimensions: null, customerName: "Mala", vehicleId: "veh-2", vehicleName: "Hill Rider" }),
        review("r3", { isRecommended: null, dimensions: { punctuality: null }, customerName: "Nimal" }),
      ],
    });
    reviewsApi.respond.mockResolvedValue({});
  });

  it("is gated by the guard", () => {
    state.guard = { isLoading: true, isAuthorized: false };
    render(<OwnerReviewsPage />);
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(owner.getReviews).not.toHaveBeenCalled();
  });

  it("renders summary, distribution, dimensions and review cards", async () => {
    await renderPage();
    expect(owner.getReviews).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("4.3")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getAllByText("4.5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3.2").length).toBe(1);
    expect(screen.getAllByText("Driver was lovely").length).toBe(2);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Sorry about that")).toBeTruthy();
    expect(screen.getByText(/notRecommends/)).toBeTruthy();
    expect(screen.getAllByText(/^ ?recommends$/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("5 out of 5 stars").length).toBe(2);
    expect(screen.getAllByText("card.responded").length).toBe(1);
    expect(screen.getByLabelText("card.respond to Ravi")).toBeTruthy();
    expect(screen.queryByLabelText("card.respond to Mala")).toBeNull();
  });

  it("switches tabs with the hasResponse filter and shows tab-specific empty states", async () => {
    await renderPage();
    owner.getReviews.mockResolvedValue({ reviews: [] });
    fireEvent.click(screen.getByText("tabs.pending", { selector: "button" }));
    await waitFor(() => expect(owner.getReviews).toHaveBeenLastCalledWith({ hasResponse: false }));
    expect(await screen.findByText("noReviews.pendingTitle")).toBeTruthy();
    fireEvent.click(screen.getByText("tabs.responded"));
    await waitFor(() => expect(owner.getReviews).toHaveBeenLastCalledWith({ hasResponse: true }));
    expect(await screen.findByText("noReviews.respondedTitle")).toBeTruthy();
    fireEvent.click(screen.getByText("tabs.all"));
    expect(await screen.findByText("noReviews.allTitle")).toBeTruthy();
  });

  it("hides distribution panels when there are no reviews or dimensions", async () => {
    owner.getReviewSummary.mockResolvedValue(
      summary({ totalReviews: 0, pendingResponses: 0, responseRate: 90, ratingDistribution: {}, dimensionAverages: null }),
    );
    owner.getReviews.mockResolvedValue({ reviews: undefined });
    await renderPage();
    expect(screen.queryByText("summary.ratingDistribution")).toBeNull();
    expect(screen.getByText("noReviews.allTitle")).toBeTruthy();
  });

  it("shows distribution without the dimensions panel when all dimensions are null", async () => {
    owner.getReviewSummary.mockResolvedValue(
      summary({ dimensionAverages: { vehicleCondition: null, driverBehavior: null, punctuality: null, cleanliness: null, valueForMoney: null } }),
    );
    await renderPage();
    expect(screen.getByText("summary.ratingDistribution")).toBeTruthy();
    expect(screen.getAllByText("dimensionsTitle").length).toBe(1);
  });

  it("filters to a vehicle from the query string", async () => {
    state.search = "vehicleId=veh-2";
    await renderPage();
    expect(screen.getAllByText("Hill Rider").length).toBe(2);
    expect(screen.queryByText("Driver was lovely")).toBeNull();
    expect(screen.getByText("View all").getAttribute("href")).toBe("/en/owner/reviews");
  });

  it("falls back to a generic vehicle label when nothing matches", async () => {
    state.search = "vehicleId=veh-9";
    await renderPage();
    expect(screen.getByText("this vehicle")).toBeTruthy();
  });

  it.todo("shows an empty state when a vehicle filter matches no reviews (the list is currently blank)");

  it("responds to a review and updates the summary", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("card.respond to Ravi"));
    const box = screen.getByPlaceholderText("card.responsePlaceholder");
    expect(document.activeElement).toBe(box);
    const submit = screen.getByText("card.submit").closest("button") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(box, { target: { value: "  Thank you!  " } });
    await act(async () => fireEvent.click(submit));
    expect(reviewsApi.respond).toHaveBeenCalledWith("r1", "Thank you!");
    expect(screen.getByText("Thank you!")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
  });

  it("reports respond errors and cancels", async () => {
    reviewsApi.respond.mockRejectedValueOnce(new Err("Response too short")).mockRejectedValueOnce(new Error("x"));
    await renderPage();
    fireEvent.click(screen.getByLabelText("card.respond to Nimal"));
    fireEvent.change(screen.getByPlaceholderText("card.responsePlaceholder"), { target: { value: "Ok" } });
    await act(async () => fireEvent.click(screen.getByText("card.submit")));
    expect(screen.getByText("Response too short")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("card.submit")));
    expect(screen.getByText("error.respondFailed")).toBeTruthy();
    fireEvent.click(screen.getByText("card.cancel"));
    expect(screen.queryByPlaceholderText("card.responsePlaceholder")).toBeNull();
  });

  it("responds without a summary loaded and with zero totals", async () => {
    owner.getReviewSummary.mockResolvedValue(summary({ totalReviews: 0, pendingResponses: 0 }));
    await renderPage();
    fireEvent.click(screen.getByLabelText("card.respond to Ravi"));
    fireEvent.change(screen.getByPlaceholderText("card.responsePlaceholder"), { target: { value: "Thanks" } });
    await act(async () => fireEvent.click(screen.getByText("card.submit")));
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it.each([
    [new Err("x", 429), "error.loadFailedRateLimited"],
    [new Err("x", 401), "error.loadFailedUnauthorized"],
    [new Err("x", 403), "error.loadFailedUnauthorized"],
    [new Err("x", 0), "error.loadFailedNetwork"],
    [new Err("x", 418, "NETWORK_ERROR"), "error.loadFailedNetwork"],
    [new Err("x", 503), "error.loadFailedServer"],
    [new Err("Bad filter", 400), "Bad filter"],
    [new Err("", 400), "error.loadFailed"],
    [new Error("boom"), "error.loadFailed"],
  ])("maps load error %# to a message", async (err: unknown, message: string) => {
    owner.getReviewSummary.mockRejectedValueOnce(err);
    await renderPage();
    expect(await screen.findByText(message)).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("error.tryAgain")));
    await waitFor(() => expect(screen.queryByText("error.tryAgain")).toBeNull());
  });
});
