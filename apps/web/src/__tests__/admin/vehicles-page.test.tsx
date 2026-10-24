/**
 * Admin vehicle management page: list, filters, pagination, suspend /
 * reactivate flows and the lazily-loaded detail modal tabs.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/vehicles",
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getAdminVehicles: vi.fn(),
    suspendVehicle: vi.fn(),
    activateVehicle: vi.fn(),
    getBookings: vi.fn(),
    getVehicleVerificationById: vi.fn(),
  },
  reviewService: {
    getByVehicle: vi.fn(),
  },
}));

import { adminService, reviewService } from "@/lib/api";
import AdminVehiclesPage from "@/app/[locale]/admin/vehicles/page";

const svc = adminService as any;
const reviews = reviewService as any;
const now = "2026-10-01T10:00:00.000Z";

const makeVehicle = (overrides: Record<string, unknown> = {}) => ({
  id: "veh-1",
  name: "Lanka Cruiser",
  licensePlate: "NB-1234",
  type: "LUXURY_AC",
  seats: 45,
  isActive: true,
  isAvailable: true,
  isRemoved: false,
  brand: "Ashok Leyland",
  model: "Viking",
  year: 2020,
  acType: "FULL_AC",
  color: "White",
  condition: "excellent",
  location: "Colombo",
  pricePerDay: 30000,
  pricePerKm: 80,
  driverAllowance: 2500,
  photos: [{ url: "https://img/bus.webp" }],
  owner: { id: "own-1", firstName: "Sunil", lastName: "Owner", email: "sunil@example.com" },
  createdAt: now,
  _count: { bookings: 4, reviews: 2 },
  ...overrides,
});

const response = (vehicles: any[], pagination: Record<string, unknown> = {}) => ({
  vehicles,
  pagination: { page: 1, limit: 10, total: vehicles.length, totalPages: 1, ...pagination },
});

const lastDialog = () => screen.getAllByRole("dialog").pop() as HTMLElement;

const renderPage = async () => {
  render(<AdminVehiclesPage />);
  await waitFor(() => expect(svc.getAdminVehicles).toHaveBeenCalled());
};

describe("AdminVehiclesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getAdminVehicles.mockResolvedValue(
      response([
        makeVehicle(),
        makeVehicle({
          id: "veh-2",
          name: "Hill Rider",
          licensePlate: "NC-9999",
          type: "ORDINARY",
          isActive: false,
          owner: null,
        }),
        makeVehicle({
          id: "veh-3",
          name: "Ghost Bus",
          licensePlate: "ND-0000#removed-1",
          type: "MYSTERY",
          isRemoved: true,
        }),
      ]),
    );
    svc.suspendVehicle.mockResolvedValue({});
    svc.activateVehicle.mockResolvedValue({});
  });

  it("renders the vehicle table with owners, statuses and actions", async () => {
    await renderPage();
    expect(await screen.findByText("Lanka Cruiser")).toBeTruthy();
    expect(screen.getByText("1–3 of 3")).toBeTruthy();
    expect(screen.getByText("MYSTERY")).toBeTruthy();
    expect(screen.getAllByText("Sunil Owner")[0].closest("a")?.getAttribute("href")).toBe(
      "/en/admin/users?search=sunil%40example.com",
    );
    expect(screen.getByLabelText("Suspend Lanka Cruiser")).toBeTruthy();
    expect(screen.getByLabelText("Reactivate Hill Rider")).toBeTruthy();
    expect(screen.getByLabelText("View verification for Hill Rider").getAttribute("href")).toBe(
      "/en/admin/verifications/vehicles?search=NC-9999",
    );
    expect(screen.queryByLabelText("Suspend Ghost Bus")).toBeNull();
    expect(screen.queryByLabelText("Reactivate Ghost Bus")).toBeNull();
  });

  it("uses the search query param and shows empty + error states", async () => {
    nav.search = "search=NB";
    svc.getAdminVehicles.mockResolvedValueOnce(response([]));
    await renderPage();
    expect(svc.getAdminVehicles).toHaveBeenCalledWith(expect.objectContaining({ search: "NB" }));
    expect(await screen.findByText("No vehicles found")).toBeTruthy();

    svc.getAdminVehicles.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByLabelText("Refresh vehicle list"));
    expect(await screen.findByText(/Failed to load vehicles/)).toBeTruthy();
  });

  it("applies quick filters and select filters", async () => {
    await renderPage();
    await screen.findByText("Lanka Cruiser");

    fireEvent.click(screen.getByText("Suspended", { selector: "p" }));
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: false, page: 1 })),
    );
    fireEvent.click(screen.getByText("Active", { selector: "p" }));
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: true })),
    );

    fireEvent.change(screen.getByLabelText("Search vehicles"), { target: { value: " NB " } });
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(expect.objectContaining({ search: "NB" })),
    );

    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "SEMI_LUXURY" } });
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(expect.objectContaining({ type: "SEMI_LUXURY" })),
    );
    fireEvent.change(selects[0], { target: { value: "" } });
    fireEvent.change(selects[1], { target: { value: "false" } });
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(
        expect.objectContaining({ isActive: false, type: undefined }),
      ),
    );
    fireEvent.change(selects[1], { target: { value: "" } });
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: undefined })),
    );
    fireEvent.change(selects[2], { target: { value: "25" } });
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 25 })),
    );
  });

  it("paginates", async () => {
    svc.getAdminVehicles.mockResolvedValue(
      response([makeVehicle()], { page: 2, total: 30, totalPages: 3 }),
    );
    await renderPage();
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })),
    );
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() =>
      expect(svc.getAdminVehicles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })),
    );
  });

  it("suspends a vehicle after a reason and reactivates after confirmation", async () => {
    await renderPage();
    await screen.findByText("Lanka Cruiser");

    fireEvent.click(screen.getByLabelText("Suspend Lanka Cruiser"));
    await screen.findByText("Suspend Vehicle");
    fireEvent.change(screen.getByPlaceholderText("e.g. Failed inspection, documents expired"), {
      target: { value: "Expired insurance" },
    });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Suspend")));
    await waitFor(() => expect(svc.suspendVehicle).toHaveBeenCalledWith("veh-1", "Expired insurance"));

    fireEvent.click(screen.getByLabelText("Reactivate Hill Rider"));
    await screen.findByText("Reactivate Vehicle");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Reactivate")));
    await waitFor(() => expect(svc.activateVehicle).toHaveBeenCalledWith("veh-2"));

    fireEvent.click(screen.getByLabelText("Reactivate Hill Rider"));
    await screen.findByText("Reactivate Vehicle");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("cancel")));
    expect(svc.activateVehicle).toHaveBeenCalledTimes(1);
  });

  it("shows mutation errors", async () => {
    svc.activateVehicle.mockRejectedValue(new Error("Owner unverified"));
    await renderPage();
    await screen.findByText("Hill Rider");
    fireEvent.click(screen.getByLabelText("Reactivate Hill Rider"));
    await screen.findByText("Reactivate Vehicle");
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Reactivate")));
    expect(await screen.findByText(/Owner unverified/)).toBeTruthy();
  });

  it("shows the detail overview and lazily loads bookings, reviews and documents", async () => {
    svc.getBookings.mockResolvedValue({
      bookings: [
        {
          id: "bk-1",
          pickupLocation: "Galle",
          startDate: now,
          status: "ONGOING",
          totalAmount: 50000,
          customer: { firstName: "Ravi", lastName: "Kumar" },
        },
        {
          id: "bk-2",
          pickupLocation: "Jaffna",
          startDate: now,
          status: "ODD",
          totalAmount: 100,
          customer: null,
        },
      ],
    });
    reviews.getByVehicle.mockResolvedValue({
      reviews: [
        { id: "r1", rating: 4.4, title: "Great ride", comment: "Clean bus", customerName: "Ravi", customerAvatar: null, createdAt: now },
        { id: "r2", rating: 2, title: null, comment: null, customerName: "Mala", customerAvatar: null, createdAt: now },
      ],
    });
    svc.getVehicleVerificationById.mockResolvedValue({
      documents: [
        { id: "d1", type: "INSURANCE", fileName: "ins.pdf", status: "APPROVED", createdAt: now, url: "https://signed/ins" },
        { id: "d2", type: "CUSTOM_DOC", fileName: "c.pdf", status: "REJECTED", rejectionReason: "Expired", createdAt: now, url: null },
      ],
    });
    await renderPage();
    await screen.findByText("Lanka Cruiser");
    fireEvent.click(screen.getByLabelText("View details for Lanka Cruiser"));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByAltText("Lanka Cruiser").getAttribute("src")).toBe("https://img/bus.webp");
    expect(within(dialog).getByText("Ashok Leyland Viking (2020)")).toBeTruthy();
    expect(within(dialog).getByText("Excellent")).toBeTruthy();
    expect(within(dialog).getByText("LKR 2,500")).toBeTruthy();
    expect(within(dialog).getByText("View user")).toBeTruthy();
    expect(within(dialog).getByText("Suspend Vehicle")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Bookings", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Bookings")));
    expect(svc.getBookings).toHaveBeenCalledWith({ search: "NB-1234", limit: 20 });
    expect(await within(dialog).findByText("Ravi Kumar")).toBeTruthy();
    expect(within(dialog).getByText("Ongoing")).toBeTruthy();
    expect(within(dialog).getByText("—")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Reviews", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Reviews")));
    expect(reviews.getByVehicle).toHaveBeenCalledWith("veh-1", { limit: 20 });
    expect(await within(dialog).findByText("Great ride")).toBeTruthy();
    expect(within(dialog).getByLabelText("4.4 out of 5")).toBeTruthy();
    expect(within(dialog).getByLabelText("View Mala's review in moderation")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Documents", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Documents")));
    expect(svc.getVehicleVerificationById).toHaveBeenCalledWith("veh-1");
    expect(await within(dialog).findByText("Insurance")).toBeTruthy();
    expect(within(dialog).getByText("CUSTOM_DOC")).toBeTruthy();
    expect(within(dialog).getByText("Expired")).toBeTruthy();
    expect(within(dialog).getByText("Unavailable")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    fireEvent.click(within(dialog).getByText("Suspend Vehicle"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    fireEvent.change(screen.getByPlaceholderText("e.g. Failed inspection, documents expired"), {
      target: { value: "Inspection" },
    });
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Suspend")));
    await waitFor(() => expect(svc.suspendVehicle).toHaveBeenCalledWith("veh-1", "Inspection"));
    // the selected vehicle flips to suspended in place
    expect(await within(screen.getByRole("dialog")).findByText("Reactivate Vehicle")).toBeTruthy();
  });

  it("shows empty lazy sections and the minimal overview for a suspended vehicle", async () => {
    svc.getBookings.mockRejectedValue(new Error("x"));
    reviews.getByVehicle.mockRejectedValue(new Error("x"));
    svc.getVehicleVerificationById.mockRejectedValue(new Error("x"));
    await renderPage();
    await screen.findByText("Hill Rider");
    svc.getAdminVehicles.mockResolvedValue(
      response([
        makeVehicle({
          id: "veh-2",
          name: "Hill Rider",
          isActive: false,
          isAvailable: false,
          photos: [],
          color: null,
          condition: null,
          acType: null,
          pricePerKm: null,
          driverAllowance: null,
          owner: null,
          _count: { bookings: 0, reviews: 0 },
        }),
      ]),
    );
    fireEvent.click(screen.getByLabelText("Refresh vehicle list"));
    await waitFor(() => expect(svc.getAdminVehicles).toHaveBeenCalledTimes(2));
    await screen.findByLabelText("View details for Hill Rider");
    fireEvent.click(screen.getByLabelText("View details for Hill Rider"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Unavailable")).toBeTruthy();
    expect(within(dialog).queryByText("Per km")).toBeNull();
    expect(within(dialog).queryByText("View user")).toBeNull();
    expect(within(dialog).getByText("View Verification")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Reactivate Vehicle"));
    await waitFor(() => expect(screen.getAllByRole("dialog").length).toBe(2));
    await act(async () => fireEvent.click(within(lastDialog()).getByText("Reactivate")));
    await waitFor(() => expect(svc.activateVehicle).toHaveBeenCalledWith("veh-2"));

    fireEvent.click(within(dialog).getByText("Bookings", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Bookings")));
    expect(await within(dialog).findByText("No bookings found")).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Reviews", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Reviews")));
    expect(await within(dialog).findByText("No reviews found")).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Documents", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Documents")));
    expect(await within(dialog).findByText("No documents found")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("hides quick actions for a removed vehicle", async () => {
    await renderPage();
    await screen.findByText("Ghost Bus");
    fireEvent.click(screen.getByLabelText("View details for Ghost Bus"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("ND-0000")).toBeTruthy();
    expect(within(dialog).getByText("Removed")).toBeTruthy();
    expect(within(dialog).queryByText("Suspend Vehicle")).toBeNull();
  });
});
