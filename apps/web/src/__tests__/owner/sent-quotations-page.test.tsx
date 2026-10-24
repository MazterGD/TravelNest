/**
 * Owner sent quotations list: status tabs (server status param + counts),
 * client-side search, validity countdown, status badges/actions and the
 * empty states.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/quotations/sent",
  useSearchParams: () => new URLSearchParams(),
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
vi.mock("@/store", () => ({ useAuthStore: () => ({ user: state.user }) }));
vi.mock("@/lib/api/services", () => ({
  quotationService: { getOwnerSentQuotations: vi.fn() },
  landingContentService: { getPublicConfig: vi.fn() },
}));

import { landingContentService, quotationService } from "@/lib/api/services";
import SentQuotationsPage from "@/app/[locale]/owner/quotations/sent/page";

const quotes = quotationService as any;
const landing = landingContentService as any;
const DAY = 86400000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const quotation = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  quotationId: `QUO-${id}`,
  status: "SENT",
  customer: { firstName: "Nimal", lastName: "Perera" },
  pickupLocation: "Colombo",
  dropoffLocation: "Kandy",
  startDate: "2026-11-01T00:00:00.000Z",
  sentAt: ago(1),
  viewedAt: null,
  respondedAt: null,
  validityDays: 7,
  totalAmount: 55000,
  vehicleType: "LUXURY_AC",
  ...overrides,
});

const renderPage = async () => {
  render(<SentQuotationsPage />);
  await waitFor(() => expect(quotes.getOwnerSentQuotations).toHaveBeenCalled());
  await waitFor(() => expect(document.querySelector(".animate-spin")).toBeNull());
};

describe("SentQuotationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    landing.getPublicConfig.mockResolvedValue({ options: { vehicleTypes: [{ value: "ORDINARY", label: "Ordinary" }] } });
    quotes.getOwnerSentQuotations.mockResolvedValue({
      quotations: [
        quotation("1"),
        quotation("2", { status: "VIEWED", viewedAt: ago(0.5), sentAt: ago(6.5), customer: { firstName: "Mala" } }),
        quotation("3", { status: "ACCEPTED", respondedAt: ago(0.1), customer: null, pickupLocation: "Galle", totalAmount: null }),
        quotation("4", { status: "EXPIRED", sentAt: ago(10) }),
        quotation("5", { status: "REJECTED", sentAt: ago(7), validityDays: 7 }),
        quotation("6", { status: "SENT", sentAt: null, validityDays: null }),
      ],
    });
  });

  it("is gated by guard and user", () => {
    state.user = null;
    render(<SentQuotationsPage />);
    expect(screen.queryByText("title")).toBeNull();
  });

  it("renders cards with countdowns, timestamps and status-specific actions", async () => {
    await renderPage();
    expect(quotes.getOwnerSentQuotations).toHaveBeenCalledWith({ status: undefined });
    expect(screen.getByText('quotationCount:{"count":6}')).toBeTruthy();
    expect(screen.getByText("tabs.all (6)")).toBeTruthy();
    expect(screen.getByText("tabs.SENT (2)")).toBeTruthy();
    expect(screen.getAllByText('card.daysLeft:{"days":6}').length).toBe(2);
    expect(screen.getByText('card.daysLeft:{"days":1}')).toBeTruthy();
    expect(screen.getByText("card.expired")).toBeTruthy();
    expect(screen.getAllByText("card.expiresToday").length).toBe(2);
    expect(screen.getByText("card.unknownCustomer")).toBeTruthy();
    expect(screen.getByText(/card.notSent/)).toBeTruthy();
    expect(screen.getByText("LKR 0")).toBeTruthy();
    expect(screen.getAllByText("card.timestamps.viewed:").length).toBe(1);
    expect(screen.getAllByText("card.timestamps.responded:").length).toBe(1);
    expect(screen.getByText("card.resend").closest("a")?.getAttribute("href")).toBe("/en/owner/quotations");
    expect(screen.getByText("card.bookingCreated")).toBeTruthy();
    expect(screen.getAllByText("card.viewDetails")[0].closest("a")?.getAttribute("href")).toBe("/en/owner/quotations/sent/1");
    for (const s of ["SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]) {
      expect(screen.getAllByText(`status.${s}`).length).toBeGreaterThan(0);
    }
  });

  it("requests a status per tab and shows filtered empty states", async () => {
    await renderPage();
    quotes.getOwnerSentQuotations.mockResolvedValue({ quotations: [quotation("9", { status: "VIEWED" })] });
    fireEvent.click(screen.getByText(/^tabs.ACCEPTED/));
    await waitFor(() => expect(quotes.getOwnerSentQuotations).toHaveBeenLastCalledWith({ status: "ACCEPTED" }));
    expect(await screen.findByText('empty.title:{"status":"ACCEPTED"}')).toBeTruthy();
    expect(screen.getByText('empty.filteredDescription:{"status":"ACCEPTED"}')).toBeTruthy();
    fireEvent.click(screen.getByText(/^tabs.VIEWED/));
    expect(await screen.findByText("QUO-9")).toBeTruthy();
  });

  it("searches by customer, id and route", async () => {
    await renderPage();
    const search = screen.getByPlaceholderText("searchPlaceholder");
    fireEvent.change(search, { target: { value: "mala" } });
    expect(screen.getByText('quotationCount:{"count":1}')).toBeTruthy();
    fireEvent.change(search, { target: { value: "quo-4" } });
    expect(screen.getByText("QUO-4")).toBeTruthy();
    fireEvent.change(search, { target: { value: "galle" } });
    expect(screen.getByText("QUO-3")).toBeTruthy();
    fireEvent.change(search, { target: { value: "kandy" } });
    expect(screen.getByText('quotationCount:{"count":6}')).toBeTruthy();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("empty.allTitle")).toBeTruthy();
  });

  it("toggles the filter panel with vehicle type options", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("filters"));
    expect(await screen.findByText("Ordinary")).toBeTruthy();
    expect(screen.getByText("filterPanel.expiringSoon")).toBeTruthy();
    fireEvent.click(screen.getByText("filters"));
    expect(screen.queryByText("filterPanel.allTime")).toBeNull();
  });

  it.todo("applies the date range, vehicle type and sort selections in the filter panel (they are unbound and do nothing)");
  it.todo("searches without crashing when a sent quotation has no dropoff location (dropoffLocation.toLowerCase on null)");

  it("tolerates load and config failures", async () => {
    quotes.getOwnerSentQuotations.mockRejectedValue(new Error("x"));
    landing.getPublicConfig.mockRejectedValue(new Error("x"));
    await renderPage();
    expect(screen.getByText("empty.allTitle")).toBeTruthy();
    expect(screen.getByText("empty.viewRequests").closest("a")?.getAttribute("href")).toBe("/en/owner/quotations");
  });

  it("handles responses without quotation arrays or vehicle types", async () => {
    quotes.getOwnerSentQuotations.mockResolvedValue({});
    landing.getPublicConfig.mockResolvedValue({ options: {} });
    await renderPage();
    expect(screen.getByText("tabs.all (0)")).toBeTruthy();
  });
});
