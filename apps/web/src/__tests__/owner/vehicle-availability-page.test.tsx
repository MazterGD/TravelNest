/**
 * Owner vehicle availability calendar: month navigation with per-month
 * fetches, booked/blocked/past day states (ISO vs date-key normalisation),
 * selecting days and the block-dates modal, removing blocks, and errors.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  params: { locale: "en", id: "veh-1" } as any,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => state.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/fleet/veh-1/availability",
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
vi.mock("@/lib/api", () => {
  class ApiError extends Error {}
  return { ApiError, vehicleService: { getById: vi.fn(), getAvailability: vi.fn() } };
});

import { ApiError, vehicleService } from "@/lib/api";
import VehicleAvailabilityPage from "@/app/[locale]/owner/fleet/[id]/availability/page";

const vehicles = vehicleService as any;

const day = (n: number) =>
  Array.from(document.querySelectorAll("button[type='button']")).find(
    (b) => b.textContent === String(n) && !b.getAttribute("aria-label"),
  ) as HTMLButtonElement;

const renderPage = async () => {
  render(<VehicleAvailabilityPage />);
  await screen.findAllByText(/pageTitle|errorNotFound|errorLoad|Vehicle gone/);
};

describe("VehicleAvailabilityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Only Date is faked so "today" is stable; timers stay real.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 9, 0, 0));
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    state.params = { locale: "en", id: "veh-1" };
    vehicles.getById.mockResolvedValue({ vehicle: { id: "veh-1", licensePlate: "NB-1234", type: "LUXURY_AC" } });
    vehicles.getAvailability.mockResolvedValue({
      blocked: [{ id: "b1", startDate: "2026-11-20T00:00:00", endDate: "2026-11-21T00:00:00", reason: "Maintenance" }, { id: "b2", startDate: "2026-11-25", endDate: "2026-11-25", reason: null }],
      booked: [{ id: "k1", startDate: "2026-11-15T08:00:00", endDate: "2026-11-16T18:00:00", status: "CONFIRMED" }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is gated by the guard and user", () => {
    state.user = null;
    render(<VehicleAvailabilityPage />);
    expect(screen.queryByText("pageTitle")).toBeNull();
  });

  it("shows not-found without an id", async () => {
    state.params = { locale: undefined, id: undefined };
    await renderPage();
    expect(screen.getByText("errorNotFound")).toBeTruthy();
    expect(vehicles.getById).not.toHaveBeenCalled();
  });

  it("stops loading without fetching when unauthorised", () => {
    state.guard = { isLoading: false, isAuthorized: false };
    render(<VehicleAvailabilityPage />);
    expect(vehicles.getById).not.toHaveBeenCalled();
  });

  it("shows API and generic load errors", async () => {
    vehicles.getById.mockRejectedValueOnce(new (ApiError as any)("Vehicle gone"));
    const first = render(<VehicleAvailabilityPage />);
    expect(await screen.findByText("Vehicle gone")).toBeTruthy();
    first.unmount();
    vehicles.getAvailability.mockRejectedValueOnce(new Error("x"));
    render(<VehicleAvailabilityPage />);
    expect(await screen.findByText("errorLoad")).toBeTruthy();
  });

  it("renders the month with booked, blocked and past days", async () => {
    await renderPage();
    expect(vehicles.getAvailability).toHaveBeenCalledWith("veh-1", "2026-11");
    expect(screen.getByText("NB-1234 • LUXURY_AC")).toBeTruthy();
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(day(5).disabled).toBe(true);
    expect(day(15).disabled).toBe(true);
    expect(day(16).disabled).toBe(true);
    expect(day(17).disabled).toBe(false);
    expect(day(20).className).toContain("bg-muted");
    expect(day(25).className).toContain("bg-muted");
    expect(screen.getByText("Maintenance")).toBeTruthy();
    expect(screen.getByText("CONFIRMED")).toBeTruthy();
    expect(screen.getByText("backToFleet").closest("a")?.getAttribute("href")).toBe("/en/owner/fleet");
  });

  it("navigates months and refetches", async () => {
    await renderPage();
    await act(async () => fireEvent.click(screen.getByLabelText("Next month")));
    await screen.findByText("December 2026");
    expect(vehicles.getAvailability).toHaveBeenLastCalledWith("veh-1", "2026-12");
    await act(async () => fireEvent.click(screen.getByLabelText("Previous month")));
    await act(async () => fireEvent.click(screen.getByLabelText("Previous month")));
    await screen.findByText("October 2026");
    expect(vehicles.getAvailability).toHaveBeenLastCalledWith("veh-1", "2026-10");
  });

  it("selects days, blocks them with a reason and removes blocks", async () => {
    vehicles.getAvailability.mockResolvedValue({ blocked: [], booked: [] });
    await renderPage();
    expect(screen.queryByText("blockedPeriodsTitle")).toBeNull();
    fireEvent.click(day(5));
    expect(screen.queryByText(/blockDates/)).toBeNull();
    fireEvent.click(day(18));
    fireEvent.click(day(12));
    fireEvent.click(day(14));
    fireEvent.click(day(14));
    expect(screen.getByText(/blockDates \(2\)/)).toBeTruthy();
    expect(day(12).className).toContain("bg-primary");

    fireEvent.click(screen.getByText(/blockDates \(2\)/));
    expect(screen.getByText("modalTitle")).toBeTruthy();
    fireEvent.click(screen.getByText("modalCancel"));
    expect(screen.queryByText("modalTitle")).toBeNull();

    fireEvent.click(screen.getByText(/blockDates \(2\)/));
    const confirm = screen.getByText("modalConfirm").closest("button") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(document.querySelector("select") as HTMLSelectElement, { target: { value: "Repairs" } });
    fireEvent.change(screen.getByPlaceholderText("modalNotesPlaceholder"), { target: { value: "Engine work" } });
    fireEvent.click(confirm);

    expect(screen.getByText("blockedPeriodsTitle")).toBeTruthy();
    expect(screen.getByText("Repairs")).toBeTruthy();
    expect(screen.getByText("Engine work")).toBeTruthy();
    expect(day(15).className).toContain("bg-muted");
    expect(screen.queryByText(/blockDates \(/)).toBeNull();

    fireEvent.click(screen.getByLabelText("Remove block"));
    expect(screen.queryByText("blockedPeriodsTitle")).toBeNull();
  });

  it.todo("persists blocked periods (and their removal) to the API instead of only updating local state");

  it("accepts an array id param", async () => {
    state.params = { locale: "en", id: ["veh-9", "x"] };
    await renderPage();
    expect(vehicles.getById).toHaveBeenCalledWith("veh-9");
  });

  it("accepts a bare vehicle response", async () => {
    vehicles.getById.mockResolvedValue({ id: "veh-1", licensePlate: "NB-7777", type: "ORDINARY" });
    await renderPage();
    await waitFor(() => expect(screen.getByText("NB-7777 • ORDINARY")).toBeTruthy());
  });
});
