/**
 * Owner fleet list: status tabs and counts, search + advanced filters and
 * sorting, grid/table views, pending banner, status toggles and delete with
 * confirmation, error/retry and empty states.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  usePathname: () => "/en/owner/fleet",
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
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));
vi.mock("@/hooks", () => ({ useOwnerGuard: () => state.guard }));
vi.mock("@/store", () => ({ useAuthStore: () => ({ user: state.user }) }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {}
  return {
    ApiError,
    vehicleService: {
      getMyVehicles: vi.fn(),
      delete: vi.fn(),
      setAvailability: vi.fn(),
      requestActivation: vi.fn(),
      cancelActivation: vi.fn(),
    },
    landingContentService: { getPublicConfig: vi.fn() },
  };
});

import { ApiError, landingContentService, vehicleService } from "@/lib/api";
import FleetManagementPage from "@/app/[locale]/owner/fleet/page";

const vehicles = vehicleService as any;
const landing = landingContentService as any;

const v = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  images: [],
  photos: [],
  licensePlate: `NB-${id}`,
  type: "ORDINARY",
  brand: "Ashok",
  model: "Viking",
  year: 2020,
  seats: 40,
  averageRating: 0,
  totalBookings: 0,
  isActive: true,
  isAvailable: true,
  acType: "ac",
  ...overrides,
});

const fleet = () => [
  v("A1", { seats: 18, averageRating: 4.5, totalBookings: 3, photos: [{ url: "https://img/a-2.webp", isPrimary: false }, { url: "https://img/a.webp", isPrimary: true }] }),
  v("B2", { seats: 28, type: "SEMI_LUXURY", brand: "Isuzu", isAvailable: false, totalBookings: 9, photos: [{ url: "https://img/b.webp", isPrimary: false }] }),
  v("C3", { seats: 44, type: "LUXURY_AC", acType: "full-ac", isActive: false, isAvailable: false, images: ["https://img/legacy.jpg"], averageRating: 3 }),
  v("D4", { seats: 50, isActive: false, isAvailable: true, photos: undefined }),
];

const plates = () =>
  Array.from(document.querySelectorAll("article h3, tbody tr td:first-child div div:first-child")).map((n) => n.textContent);

const renderPage = async () => {
  render(<FleetManagementPage />);
  await waitFor(() => expect(vehicles.getMyVehicles).toHaveBeenCalled());
  await screen.findByText(/tabAll \(/);
  await waitFor(() => expect(document.querySelector(".animate-spin")).toBeNull());
};

const confirmDialog = async (label: string) => {
  const dialog = await screen.findByRole("dialog");
  await act(async () => fireEvent.click(within(dialog).getByText(label, { selector: "button" })));
};

describe("FleetManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    vehicles.getMyVehicles.mockResolvedValue({ vehicles: fleet() });
    landing.getPublicConfig.mockResolvedValue({
      options: {
        vehicleTypes: [
          { value: "ORDINARY", label: "Ordinary" },
          { value: "LUXURY_AC", label: "Luxury AC" },
        ],
      },
    });
    vehicles.delete.mockResolvedValue({});
    vehicles.setAvailability.mockResolvedValue({});
    vehicles.requestActivation.mockResolvedValue({});
    vehicles.cancelActivation.mockResolvedValue({});
  });

  it("is gated by guard and user", () => {
    state.user = null;
    render(<FleetManagementPage />);
    expect(screen.queryByText("title")).toBeNull();
    expect(vehicles.getMyVehicles).not.toHaveBeenCalled();
  });

  it("renders the grid with images, status badges, stats and tab counts", async () => {
    await renderPage();
    expect(screen.getByText("4 vehicles")).toBeTruthy();
    expect(screen.getByText("tabAll (4)")).toBeTruthy();
    expect(screen.getByText("tabActive (1)")).toBeTruthy();
    expect(screen.getByText("tabInactive (2)")).toBeTruthy();
    expect(screen.getByText("tabPending (1)")).toBeTruthy();
    expect(screen.getByAltText("NB-A1").getAttribute("src")).toBe("https://img/a.webp");
    expect(screen.getByAltText("NB-B2").getAttribute("src")).toBe("https://img/b.webp");
    expect(screen.getByAltText("NB-C3").getAttribute("src")).toBe("https://img/legacy.jpg");
    expect(screen.queryByAltText("NB-D4")).toBeNull();
    expect(screen.getByText("4.5/5")).toBeTruthy();
    expect(screen.getByText("pendingApproval")).toBeTruthy();
    expect(screen.getByText(/pendingActivationAlert/)).toBeTruthy();
    expect(screen.getByLabelText("actionPause")).toBeTruthy();
    expect(screen.getByLabelText("actionResume")).toBeTruthy();
    expect(screen.getByLabelText("actionRequestActivation")).toBeTruthy();
    expect(screen.getByLabelText("actionCancelRequest")).toBeTruthy();
  });

  it("filters by tab, banner, search, type, capacity, AC and sorts", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("actionView", { selector: "button" }));
    expect(plates()).toEqual(["NB-D4"]);
    fireEvent.click(screen.getByText("tabInactive (2)"));
    expect(plates()).toEqual(["NB-B2", "NB-C3"]);
    fireEvent.click(screen.getByText("tabActive (1)"));
    expect(plates()).toEqual(["NB-A1"]);
    fireEvent.click(screen.getByText("tabAll (4)"));

    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: "isuzu" } });
    expect(plates()).toEqual(["NB-B2"]);
    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: "luxury" } });
    expect(plates()).toEqual(["NB-B2", "NB-C3"]);
    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: "nb-a" } });
    expect(plates()).toEqual(["NB-A1"]);
    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: "" } });

    fireEvent.click(screen.getByText("filters"));
    await screen.findByText("Luxury AC");
    const [typeSel, capSel, acSel, sortSel] = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
    fireEvent.change(typeSel, { target: { value: "LUXURY_AC" } });
    expect(plates()).toEqual(["NB-C3"]);
    fireEvent.change(typeSel, { target: { value: "" } });
    for (const [bucket, expected] of [
      ["0-20", ["NB-A1"]],
      ["21-30", ["NB-B2"]],
      ["31-45", ["NB-C3"]],
      ["45+", ["NB-D4"]],
    ] as const) {
      fireEvent.change(capSel, { target: { value: bucket } });
      expect(plates()).toEqual(expected);
    }
    fireEvent.change(capSel, { target: { value: "" } });
    fireEvent.change(acSel, { target: { value: "full-ac" } });
    expect(plates()).toEqual(["NB-C3"]);
    fireEvent.change(acSel, { target: { value: "" } });

    fireEvent.change(sortSel, { target: { value: "rating" } });
    expect(plates()[0]).toBe("NB-A1");
    fireEvent.change(sortSel, { target: { value: "bookings" } });
    expect(plates()[0]).toBe("NB-B2");
    fireEvent.change(sortSel, { target: { value: "capacity" } });
    expect(plates()).toEqual(["NB-D4", "NB-C3", "NB-B2", "NB-A1"]);
    fireEvent.click(screen.getByText("filters"));
    expect(document.querySelectorAll("select").length).toBe(0);
  });

  it("shows empty states with reset and add actions", async () => {
    await renderPage();
    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), { target: { value: "zzz" } });
    expect(screen.getByText("emptyDescAll")).toBeTruthy();
    fireEvent.click(screen.getByText("tabPending (1)"));
    expect(screen.getByText('emptyDescFiltered:{"status":"tabPending"}')).toBeTruthy();
    fireEvent.click(screen.getByText("resetFilters"));
    expect(plates().length).toBe(4);
  });

  it("offers adding the first vehicle when the fleet is empty", async () => {
    vehicles.getMyVehicles.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByText("0 vehicles")).toBeTruthy();
    expect(screen.getByText("addFirstVehicle").closest("a")?.getAttribute("href")).toBe("/en/owner/fleet/add");
  });

  it("shows a singular count and retries load errors", async () => {
    vehicles.getMyVehicles.mockRejectedValueOnce(new (ApiError as any)("Fleet offline"));
    render(<FleetManagementPage />);
    expect(await screen.findByText("Fleet offline")).toBeTruthy();
    vehicles.getMyVehicles.mockRejectedValueOnce(new Error("x"));
    await act(async () => fireEvent.click(screen.getByText("errorRetry")));
    expect(await screen.findByText("errorLoad")).toBeTruthy();
    vehicles.getMyVehicles.mockResolvedValueOnce({ vehicles: [v("Z9", { isActive: false, isAvailable: true })] });
    await act(async () => fireEvent.click(screen.getByText("errorRetry")));
    expect(await screen.findByText("1 vehicle")).toBeTruthy();
  });

  it("renders the table view", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("viewTable"));
    expect(screen.getByText("colVehicle")).toBeTruthy();
    expect(screen.getByText("SEMI_LUXURY")).toBeTruthy();
    expect(screen.queryAllByText("40 seats").length).toBe(0);
    expect(screen.getByText("50 seats")).toBeTruthy();
    expect(screen.getByText("4.5")).toBeTruthy();
    expect(screen.getAllByLabelText("actionEdit")[0].getAttribute("href")).toBe("/en/owner/fleet/A1/edit");
    fireEvent.click(screen.getByLabelText("actionResume"));
    await confirmDialog("actionResume");
    expect(vehicles.setAvailability).toHaveBeenCalledWith("B2", true);
    fireEvent.click(screen.getAllByLabelText("actionDelete")[0]);
    await confirmDialog("actionDelete");
    expect(vehicles.delete).toHaveBeenCalledWith("A1");
    fireEvent.click(screen.getByLabelText("viewGrid"));
    expect(document.querySelectorAll("article").length).toBe(3);
  });

  it("runs each status toggle with the right API and toast", async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText("actionPause"));
    expect(await screen.findByText("confirmPauseTitle")).toBeTruthy();
    await confirmDialog("actionPause");
    expect(vehicles.setAvailability).toHaveBeenCalledWith("A1", false);
    expect(await screen.findByText("pauseSuccess")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("actionRequestActivation"));
    await confirmDialog("actionRequestActivation");
    expect(vehicles.requestActivation).toHaveBeenCalledWith("C3");
    expect(await screen.findByText("activationRequestSent")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("actionCancelRequest"));
    await confirmDialog("actionCancelRequest");
    expect(vehicles.cancelActivation).toHaveBeenCalledWith("D4");
    expect(await screen.findByText("activationRequestCancelled")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("actionResume"));
    await confirmDialog("actionResume");
    expect(await screen.findByText("resumeSuccess")).toBeTruthy();
    expect(vehicles.getMyVehicles).toHaveBeenCalledTimes(5);

    fireEvent.click(screen.getByLabelText("close"));
    expect(screen.queryByText("resumeSuccess")).toBeNull();
  });

  it("reports toggle failures and can dismiss the dialog", async () => {
    vehicles.setAvailability.mockRejectedValueOnce(new (ApiError as any)("Has bookings")).mockRejectedValueOnce(new Error("x"));
    await renderPage();
    fireEvent.click(screen.getByLabelText("actionPause"));
    await confirmDialog("actionPause");
    expect(await screen.findByText("Has bookings")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("actionPause"));
    await confirmDialog("actionPause");
    expect(await screen.findByText("toggleError")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("actionPause"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("deletes a vehicle and reports delete failures", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vehicles.delete.mockRejectedValueOnce(new Error("x"));
    await renderPage();
    fireEvent.click(screen.getAllByLabelText("actionDelete")[0]);
    await confirmDialog("actionDelete");
    expect(await screen.findByText("deleteError")).toBeTruthy();
    expect(plates().length).toBe(4);
    fireEvent.click(screen.getAllByLabelText("actionDelete")[0]);
    await confirmDialog("actionDelete");
    expect(await screen.findByText("deleteSuccess")).toBeTruthy();
    expect(plates()).not.toContain("NB-A1");
    await act(async () => {
      vi.advanceTimersByTime(3600);
    });
    expect(screen.queryByText("deleteSuccess")).toBeNull();
    fireEvent.click(screen.getAllByLabelText("actionDelete")[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("cancel"));
    vi.useRealTimers();
  });

  it("tolerates a config failure", async () => {
    landing.getPublicConfig.mockRejectedValue(new Error("x"));
    await renderPage();
    fireEvent.click(screen.getByText("filters"));
    expect(document.querySelectorAll("select")[0].querySelectorAll("option").length).toBe(1);
  });

  it("tolerates config without vehicle types", async () => {
    landing.getPublicConfig.mockResolvedValue({ options: {} });
    await renderPage();
    fireEvent.click(screen.getByText("filters"));
    expect(document.querySelectorAll("select")[0].querySelectorAll("option").length).toBe(1);
  });
});
