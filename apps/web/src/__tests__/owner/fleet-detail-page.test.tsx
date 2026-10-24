/**
 * Owner vehicle detail page: loading/error/retry, status-dependent toggle
 * actions with confirmation, active-bookings block dialog, toasts, delete,
 * specs/pricing/amenity formatting, photos and recent reviews.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  usePathname: () => "/en/owner/fleet/veh-1",
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
      getById: vi.fn(),
      delete: vi.fn(),
      setAvailability: vi.fn(),
      requestActivation: vi.fn(),
      cancelActivation: vi.fn(),
    },
  };
});

import { ApiError, vehicleService } from "@/lib/api";
import OwnerFleetVehicleDetailsPage from "@/app/[locale]/owner/fleet/[id]/page";

const vehicles = vehicleService as any;
const now = "2026-10-01T10:00:00.000Z";

const vehicle = (overrides: Record<string, unknown> = {}) => ({
  id: "veh-1",
  name: "Lanka Cruiser",
  licensePlate: "NB-1234",
  brand: "Ashok",
  model: "Viking",
  year: 2020,
  type: "SEMI_LUXURY",
  seats: 45,
  acType: "FULL_AC",
  condition: "good",
  location: "Colombo",
  description: "Comfortable coach",
  isActive: true,
  isAvailable: true,
  totalBookings: 12,
  quotationCount: 4,
  averageRating: 4.25,
  reviewCount: 8,
  pricePerKm: 80,
  pricePerDay: 30000,
  driverAllowance: null,
  amenities: ["wifi", "usb_charging", "mini_fridge", "dvd-player", ""],
  photos: [
    { id: "p1", url: "https://img/primary.webp", isPrimary: true },
    { id: "p2", url: "https://img/2.webp", fileName: "side.webp", tag: "INTERIOR" },
    { url: "https://img/3.webp" },
    { id: "p4", url: null },
  ],
  reviews: [
    { id: "r1", rating: 5, comment: "Excellent driver", createdAt: now, customer: { firstName: "Ravi", lastName: "Kumar" } },
    { id: "r2", rating: 3, comment: null, createdAt: now, customer: { firstName: "Mala" } },
    { id: "r3", rating: 1, createdAt: now, customer: null },
    { id: "r4", rating: 4, createdAt: now },
  ],
  ...overrides,
});

const renderPage = async () => {
  render(<OwnerFleetVehicleDetailsPage />);
  await screen.findAllByText(/detailsStatusOverview|detailsNotFound|detailsErrorLoad/);
};

const confirmIn = async (label: string) => {
  const dialog = await screen.findByRole("dialog");
  await act(async () => fireEvent.click(within(dialog).getByText(label, { selector: "button" })));
};

describe("OwnerFleetVehicleDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    state.params = { locale: "en", id: "veh-1" };
    vehicles.getById.mockResolvedValue({ vehicle: vehicle() });
    vehicles.delete.mockResolvedValue({});
    vehicles.setAvailability.mockResolvedValue({});
    vehicles.requestActivation.mockResolvedValue({});
    vehicles.cancelActivation.mockResolvedValue({});
  });

  it("waits for the guard and user", () => {
    state.user = null;
    render(<OwnerFleetVehicleDetailsPage />);
    expect(vehicles.getById).not.toHaveBeenCalled();
  });

  it("renders vehicle specs, pricing, amenities, photos and reviews", async () => {
    await renderPage();
    expect(vehicles.getById).toHaveBeenCalledWith("veh-1");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Lanka Cruiser");
    expect(screen.getByText("Ashok Viking • 2020")).toBeTruthy();
    expect(screen.getByAltText("NB-1234").getAttribute("src")).toBe("https://img/primary.webp");
    expect(screen.getByAltText("side.webp")).toBeTruthy();
    expect(screen.getByAltText("Photo 3")).toBeTruthy();
    expect(screen.getByText("Interior")).toBeTruthy();
    expect(screen.getByText("Semi Luxury")).toBeTruthy();
    expect(screen.getByText("Full Ac")).toBeTruthy();
    expect(screen.getByText("Wi-Fi")).toBeTruthy();
    expect(screen.getByText("USB Charging")).toBeTruthy();
    expect(screen.getByText("Mini Fridge")).toBeTruthy();
    expect(screen.getByText("Dvd Player")).toBeTruthy();
    expect(screen.getByText("currency 80")).toBeTruthy();
    expect(screen.getByText("currency 30,000")).toBeTruthy();
    expect(screen.getByText("detailsNotProvided")).toBeTruthy();
    expect(screen.getByText("4.3/5")).toBeTruthy();
    expect(screen.getByText("(8)")).toBeTruthy();
    expect(screen.getByText("Excellent driver")).toBeTruthy();
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
    expect(screen.queryByText("r4")).toBeNull();
    expect(screen.getAllByText("statusActive").length).toBe(2);
    expect(
      screen.getAllByText("detailsViewAllBookings")[0].closest("a")?.getAttribute("href"),
    ).toBe("/en/owner/bookings?vehicleId=veh-1&vehicleReg=NB-1234");
    expect(screen.getByText("Comfortable coach")).toBeTruthy();
  });

  it("renders fallbacks for a sparse vehicle", async () => {
    vehicles.getById.mockResolvedValue(
      vehicle({
        name: "",
        year: null,
        type: "CUSTOM_COACH",
        acType: null,
        brand: " ",
        condition: null,
        description: "  ",
        averageRating: 0,
        reviewCount: 0,
        totalBookings: undefined,
        quotationCount: undefined,
        pricePerKm: undefined,
        amenities: null,
        photos: [],
        images: [],
        reviews: undefined,
      }),
    );
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("NB-1234");
    expect(screen.getByText("Custom Coach")).toBeTruthy();
    expect(screen.getByText("detailsNoPhotos")).toBeTruthy();
    expect(screen.getByText("detailsNoAmenities")).toBeTruthy();
    expect(screen.getByText("detailsNoRecentReviews")).toBeTruthy();
    expect(screen.getByText("na")).toBeTruthy();
    expect(screen.queryByText("fieldDescription")).toBeNull();
    expect(screen.getAllByText("detailsNotProvided").length).toBeGreaterThan(3);
  });

  it("uses a legacy image when there are no photos and hides the gallery when only a primary exists", async () => {
    vehicles.getById.mockResolvedValue(vehicle({ photos: "nope", images: ["https://img/legacy.jpg"] }));
    await renderPage();
    expect(screen.getByAltText("NB-1234").getAttribute("src")).toBe("https://img/legacy.jpg");
  });

  it("shows only the primary photo without a thumbnail strip", async () => {
    vehicles.getById.mockResolvedValue(vehicle({ photos: [{ id: "p1", url: "https://img/p.webp", isPrimary: true }] }));
    await renderPage();
    expect(screen.queryByText("photosTitle")).toBeNull();
    expect(screen.queryByText("detailsNoPhotos")).toBeNull();
  });

  it("shows a not-found state without an id and retries load errors", async () => {
    state.params = { locale: undefined, id: undefined };
    const first = render(<OwnerFleetVehicleDetailsPage />);
    expect(await screen.findByText("detailsNotFound")).toBeTruthy();
    first.unmount();

    state.params = { locale: "en", id: ["veh-1", "x"] };
    vehicles.getById.mockRejectedValueOnce(new (ApiError as any)("Vehicle gone"));
    render(<OwnerFleetVehicleDetailsPage />);
    expect(await screen.findByText("Vehicle gone")).toBeTruthy();
    vehicles.getById.mockRejectedValueOnce(new Error("x"));
    await act(async () => fireEvent.click(screen.getByText("errorRetry")));
    expect(await screen.findByText("detailsErrorLoad")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("errorRetry")));
    expect(await screen.findByText("detailsStatusOverview")).toBeTruthy();
  });

  it("pauses an active vehicle and shows a success toast", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("actionPause", { selector: "button" }));
    expect(await screen.findByText("confirmPauseTitle")).toBeTruthy();
    await confirmIn("actionPause");
    expect(vehicles.setAvailability).toHaveBeenCalledWith("veh-1", false);
    expect(await screen.findByText("pauseSuccess")).toBeTruthy();
    expect(vehicles.getById).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByLabelText("close"));
    expect(screen.queryByText("pauseSuccess")).toBeNull();
  });

  it("shows the active-bookings dialog when pausing is blocked", async () => {
    vehicles.setAvailability.mockRejectedValueOnce(new (ApiError as any)("Vehicle has 2 upcoming bookings"));
    await renderPage();
    fireEvent.click(screen.getByText("actionPause", { selector: "button" }));
    await confirmIn("actionPause");
    expect(await screen.findByText("hasActiveBookingsTitle")).toBeTruthy();
    expect(screen.getByText("Vehicle has 2 upcoming bookings")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("OK")));
    await waitFor(() => expect(screen.queryByText("hasActiveBookingsTitle")).toBeNull());
  });

  it("resumes an unavailable vehicle and toasts generic errors", async () => {
    vehicles.getById.mockResolvedValue(vehicle({ isAvailable: false }));
    vehicles.setAvailability.mockRejectedValueOnce(new Error("x"));
    await renderPage();
    expect(screen.getAllByText("statusUnavailable").length).toBe(2);
    fireEvent.click(screen.getByText("actionResume", { selector: "button" }));
    await confirmIn("actionResume");
    expect(vehicles.setAvailability).toHaveBeenCalledWith("veh-1", true);
    expect(await screen.findByText("toggleError")).toBeTruthy();

    fireEvent.click(screen.getByText("actionResume", { selector: "button" }));
    await confirmIn("actionResume");
    expect(await screen.findByText("resumeSuccess")).toBeTruthy();
  });

  it("requests activation for an inactive vehicle", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vehicles.getById.mockResolvedValue(vehicle({ isActive: false, isAvailable: false }));
    await renderPage();
    fireEvent.click(screen.getByText("actionRequestActivation", { selector: "button" }));
    await confirmIn("actionRequestActivation");
    expect(vehicles.requestActivation).toHaveBeenCalledWith("veh-1");
    expect(await screen.findByText("activationRequestSent")).toBeTruthy();
    // toast auto-dismisses
    await act(async () => {
      vi.advanceTimersByTime(3600);
    });
    expect(screen.queryByText("activationRequestSent")).toBeNull();
    vi.useRealTimers();
  });

  it("cancels a pending activation request and surfaces API errors as toasts", async () => {
    vehicles.getById.mockResolvedValue(vehicle({ isActive: false, isAvailable: true }));
    vehicles.cancelActivation.mockRejectedValueOnce(new (ApiError as any)("Already reviewed"));
    await renderPage();
    expect(screen.getByText("pendingActivationAlert")).toBeTruthy();
    fireEvent.click(screen.getAllByText("actionCancelRequest", { selector: "button" })[1]);
    await confirmIn("actionCancelRequest");
    expect(await screen.findByText("Already reviewed")).toBeTruthy();

    fireEvent.click(screen.getAllByText("actionCancelRequest", { selector: "button" })[0]);
    expect(await screen.findByText("confirmCancelRequestTitle")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByText("cancel"));
    await waitFor(() => expect(screen.queryByText("confirmCancelRequestTitle")).toBeNull());

    fireEvent.click(screen.getAllByText("actionCancelRequest", { selector: "button" })[0]);
    await confirmIn("actionCancelRequest");
    expect(await screen.findByText("activationRequestCancelled")).toBeTruthy();
  });

  it("deletes the vehicle after confirmation and recovers from failures", async () => {
    vehicles.delete.mockRejectedValueOnce(new Error("x"));
    await renderPage();
    fireEvent.click(screen.getByLabelText("actionDelete"));
    expect(await screen.findByText("confirmDeleteTitle")).toBeTruthy();
    await confirmIn("actionDelete");
    expect(vehicles.delete).toHaveBeenCalledWith("veh-1");
    await waitFor(() => expect(screen.queryByText("confirmDeleteTitle")).toBeNull());
    expect(screen.getByText("deleteError")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("actionDelete"));
    await confirmIn("actionDelete");
    expect(vehicles.delete).toHaveBeenCalledTimes(2);
  });

});
