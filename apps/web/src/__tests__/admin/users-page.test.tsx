/**
 * Admin user management page: list rendering, filters, pagination,
 * moderation actions behind prompt/confirm dialogs and the detail modal tabs.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/admin/users",
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
    getUsers: vi.fn(),
    getUserById: vi.fn(),
    getUserActivity: vi.fn(),
    updateUserStatus: vi.fn(),
    resetUserPassword: vi.fn(),
    deleteUser: vi.fn(),
    createAdmin: vi.fn(),
    exportUsersCsv: vi.fn(),
    getBookings: vi.fn(),
    getAdminVehicles: vi.fn(),
    getOwnerVerificationById: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminUsersPage from "@/app/[locale]/admin/users/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  firstName: "Nimal",
  lastName: "Perera",
  email: "nimal@example.com",
  phone: "+94770000000",
  role: "CUSTOMER",
  status: "ACTIVE",
  adminRole: null,
  isVerified: true,
  isRemoved: false,
  createdAt: now,
  updatedAt: now,
  _count: { bookings: 3, reviews: 1 },
  ...overrides,
});

const listResponse = (users: any[], extra: Record<string, unknown> = {}) => ({
  users,
  total: users.length,
  page: 1,
  limit: 10,
  totalPages: 1,
  ...extra,
});

const detail = (overrides: Record<string, unknown> = {}) => ({
  ...makeUser(),
  address: null,
  city: "Colombo",
  district: "Western",
  postalCode: null,
  baseLocation: "Colombo Fort",
  avatar: null,
  _count: { bookings: 3, reviews: 1, notifications: 5 },
  ...overrides,
});

const renderPage = async () => {
  render(<AdminUsersPage />);
  await waitFor(() => expect(svc.getUsers).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Users")).toBeTruthy());
};

const clickDialogButton = async (label: string) => {
  const dialog = screen.getAllByRole("dialog").pop() as HTMLElement;
  await act(async () => {
    fireEvent.click(within(dialog).getByText(label));
  });
};

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    svc.getUsers.mockResolvedValue(
      listResponse([
        makeUser(),
        makeUser({
          id: "user-2",
          firstName: "Kamala",
          lastName: "Silva",
          email: "kamala@example.com",
          status: "SUSPENDED",
          role: "VEHICLE_OWNER",
        }),
        makeUser({
          id: "user-3",
          firstName: "Gone",
          lastName: "User",
          email: "gone@example.com#removed-123",
          isRemoved: true,
          adminRole: "MODERATOR",
          status: "WEIRD",
        }),
      ]),
    );
    svc.getUserById.mockResolvedValue(detail());
    svc.getUserActivity.mockResolvedValue({ logs: [], total: 0, page: 1, limit: 10, totalPages: 1 });
    svc.updateUserStatus.mockResolvedValue({});
    svc.resetUserPassword.mockResolvedValue({});
    svc.deleteUser.mockResolvedValue({});
    svc.createAdmin.mockResolvedValue({});
    svc.exportUsersCsv.mockResolvedValue(undefined);
  });

  it("renders users with role/status badges and the range summary", async () => {
    await renderPage();
    expect(await screen.findByText("Nimal Perera")).toBeTruthy();
    expect(screen.getByText("Kamala Silva")).toBeTruthy();
    expect(screen.getByText("1–3 of 3")).toBeTruthy();
    expect(screen.getByText("MODERATOR")).toBeTruthy();
    expect(screen.getAllByText("Removed").length).toBe(1);
    expect(screen.getByText("gone@example.com")).toBeTruthy();
    // suspend is only offered for active, non-removed users
    expect(screen.getByLabelText("Suspend Nimal Perera")).toBeTruthy();
    expect(screen.queryByLabelText("Suspend Kamala Silva")).toBeNull();
    expect(screen.queryByLabelText("Reset password for Gone User")).toBeNull();
  });

  it("seeds the search filter from the query string", async () => {
    nav.search = "search=kamala";
    await renderPage();
    expect(svc.getUsers).toHaveBeenCalledWith(expect.objectContaining({ search: "kamala", page: 1 }));
    expect((screen.getByLabelText("Search users") as HTMLInputElement).value).toBe("kamala");
  });

  it("shows the empty state and the error banner", async () => {
    svc.getUsers.mockResolvedValueOnce(listResponse([]));
    await renderPage();
    expect(await screen.findByText("No users found")).toBeTruthy();

    svc.getUsers.mockRejectedValueOnce(new Error("DB down"));
    fireEvent.click(screen.getByLabelText("Refresh user list"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/DB down/)).toBeTruthy();
  });

  it("applies quick filters, search, role and page size filters", async () => {
    await renderPage();
    await screen.findByText("Nimal Perera");

    fireEvent.click(screen.getByText("Suspended", { selector: "p" }));
    await waitFor(() =>
      expect(svc.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ status: "SUSPENDED", page: 1 })),
    );

    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "  nim  " } });
    await waitFor(() =>
      expect(svc.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ search: "nim" })),
    );

    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "VEHICLE_OWNER" } });
    await waitFor(() =>
      expect(svc.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ role: "VEHICLE_OWNER" })),
    );
    fireEvent.change(selects[0], { target: { value: "" } });
    await waitFor(() =>
      expect(svc.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ role: undefined })),
    );
    fireEvent.change(selects[1], { target: { value: "50" } });
    await waitFor(() =>
      expect(svc.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, page: 1 })),
    );
  });

  it("paginates when there are multiple pages", async () => {
    svc.getUsers.mockResolvedValue(
      listResponse([makeUser()], { total: 25, page: 2, totalPages: 3 }),
    );
    await renderPage();
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expect(screen.getByText("11–20 of 25")).toBeTruthy();
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() =>
      expect(svc.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })),
    );
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() =>
      expect(svc.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })),
    );
  });

  it("exports CSV with the active filters and reports export errors", async () => {
    await renderPage();
    await screen.findByText("Nimal Perera");
    await act(async () => fireEvent.click(screen.getByLabelText("Export users as CSV")));
    expect(svc.exportUsersCsv).toHaveBeenCalledWith({
      search: undefined,
      role: undefined,
      status: undefined,
      adminRole: undefined,
    });

    svc.exportUsersCsv.mockRejectedValueOnce("boom");
    await act(async () => fireEvent.click(screen.getByLabelText("Export users as CSV")));
    expect(await screen.findByText(/Failed to export users CSV/)).toBeTruthy();
  });

  it("suspends a user only after a reason is given", async () => {
    await renderPage();
    await screen.findByText("Nimal Perera");

    fireEvent.click(screen.getByLabelText("Suspend Nimal Perera"));
    expect(await screen.findByText("Suspend User Account")).toBeTruthy();
    await clickDialogButton("cancel");
    expect(svc.updateUserStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Suspend Nimal Perera"));
    await screen.findByText("Suspend User Account");
    fireEvent.change(screen.getByPlaceholderText("e.g. Policy violation, suspicious activity"), {
      target: { value: "Fraud" },
    });
    await clickDialogButton("Suspend");
    await waitFor(() =>
      expect(svc.updateUserStatus).toHaveBeenCalledWith("user-1", "SUSPENDED", "Fraud"),
    );
    await waitFor(() => expect(svc.getUsers).toHaveBeenCalledTimes(2));
  });

  it("enforces the minimum password length when resetting a password", async () => {
    await renderPage();
    await screen.findByText("Nimal Perera");
    fireEvent.click(screen.getByLabelText("Reset password for Nimal Perera"));
    await screen.findByText("Reset User Password");
    const input = screen.getByPlaceholderText("Temporary password");
    fireEvent.change(input, { target: { value: "short" } });
    await clickDialogButton("Reset Password");
    expect(screen.getByText("Minimum 8 characters required.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "LongEnough1" } });
    await clickDialogButton("Reset Password");
    await waitFor(() => expect(svc.resetUserPassword).toHaveBeenCalledWith("user-1", "LongEnough1"));
  });

  it("removes a user after confirmation and shows mutation errors", async () => {
    await renderPage();
    await screen.findByText("Nimal Perera");
    svc.deleteUser.mockRejectedValueOnce(new Error("Cannot remove"));
    fireEvent.click(screen.getByLabelText("Remove account for Nimal Perera"));
    await screen.findByText("Remove User Account");
    await clickDialogButton("Remove");
    await waitFor(() => expect(svc.deleteUser).toHaveBeenCalledWith("user-1"));
    expect(await screen.findByText(/Cannot remove/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Remove account for Nimal Perera"));
    await screen.findByText("Remove User Account");
    await clickDialogButton("cancel");
    expect(svc.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("creates an admin with the selected role and omits an empty phone", async () => {
    await renderPage();
    await screen.findByText("Nimal Perera");
    fireEvent.click(screen.getAllByText("Create Admin")[0]);
    expect(await screen.findByText("Create Admin Account")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ama" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Fernando" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ama@tn.lk" } });
    fireEvent.change(screen.getByLabelText("Temporary password"), { target: { value: "Secret123" } });
    const dialog = screen.getByRole("dialog");
    fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, {
      target: { value: "FINANCE_ADMIN" },
    });
    await act(async () => {
      fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    });
    expect(svc.createAdmin).toHaveBeenCalledWith({
      firstName: "Ama",
      lastName: "Fernando",
      email: "ama@tn.lk",
      password: "Secret123",
      phone: undefined,
      adminRole: "FINANCE_ADMIN",
    });
    await waitFor(() => expect(screen.queryByText("Create Admin Account")).toBeNull());

    fireEvent.click(screen.getAllByText("Create Admin")[0]);
    fireEvent.change(screen.getByLabelText("Phone (optional)"), { target: { value: "0771234567" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByText("Cancel"));
    fireEvent.click(screen.getAllByText("Create Admin")[0]);
    expect((screen.getByLabelText("Phone (optional)") as HTMLInputElement).value).toBe("");
  });

  it("opens customer details with overview, bookings and activity tabs", async () => {
    svc.getUserActivity.mockResolvedValue({
      logs: [
        { id: "log-1", action: "LOGIN", entityType: "USER", createdAt: now, status: "success" },
        { id: "log-2", action: "PAYMENT", entityType: "BOOKING", createdAt: now, status: "failure" },
      ],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    svc.getBookings.mockResolvedValue({
      bookings: [
        {
          id: "bk-1",
          pickupLocation: "Colombo",
          startDate: now,
          status: "CONFIRMED",
          totalAmount: 45000,
          vehicle: { name: "Coach A" },
        },
        {
          id: "bk-2",
          pickupLocation: "Kandy",
          startDate: now,
          status: "STRANGE",
          totalAmount: 1000,
          vehicle: null,
        },
      ],
    });
    await renderPage();
    await screen.findByText("Nimal Perera");
    await act(async () => fireEvent.click(screen.getByLabelText("View details for Nimal Perera")));

    const dialog = await screen.findByRole("dialog");
    expect(svc.getUserById).toHaveBeenCalledWith("user-1");
    expect(svc.getUserActivity).toHaveBeenCalledWith("user-1", { page: 1, limit: 10 });
    expect(within(dialog).getByText("Colombo, Western")).toBeTruthy();
    expect(within(dialog).getByText("Colombo Fort")).toBeTruthy();
    expect(within(dialog).getByText("Reviews")).toBeTruthy();
    expect(within(dialog).queryByText("Vehicles")).toBeNull();

    fireEvent.click(within(dialog).getByText("Bookings", { selector: "span" }));
    expect(within(dialog).getByText("Bookings where this user is the customer.")).toBeTruthy();
    await act(async () => fireEvent.click(within(dialog).getByText("Load Bookings")));
    expect(svc.getBookings).toHaveBeenCalledWith({ search: "nimal@example.com", limit: 10 });
    expect(await within(dialog).findByText("Coach A")).toBeTruthy();
    expect(within(dialog).getByText("—")).toBeTruthy();
    expect(within(dialog).getByText("LKR 45,000")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Activity", { selector: "span" }));
    expect(within(dialog).getByText("LOGIN")).toBeTruthy();
    expect(within(dialog).getByText("failure")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Overview", { selector: "span" }));
    fireEvent.click(within(dialog).getByText("Suspend Account"));
    await screen.findByText("Suspend User Account");
    await clickDialogButton("cancel");

    fireEvent.click(within(dialog).getByText("Reset Password"));
    await screen.findByText("Reset User Password");
    await clickDialogButton("cancel");

    fireEvent.click(within(dialog).getByText("Remove Account"));
    await screen.findByText("Remove User Account");
    await clickDialogButton("Remove");
    await waitFor(() => expect(svc.deleteUser).toHaveBeenCalledWith("user-1"));
    await waitFor(() => expect(screen.queryByText("Colombo Fort")).toBeNull());
  });

  it("shows empty booking results and empty activity", async () => {
    svc.getUserById.mockResolvedValue(
      detail({ status: "SUSPENDED", phone: null, city: null, baseLocation: null, avatar: "https://x/a.png" }),
    );
    svc.getBookings.mockRejectedValue(new Error("nope"));
    await renderPage();
    await screen.findByText("Nimal Perera");
    await act(async () => fireEvent.click(screen.getByLabelText("View details for Nimal Perera")));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img")).toBeTruthy();
    expect(within(dialog).queryByText("Suspend Account")).toBeNull();
    expect(within(dialog).getByText("Suspended")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Bookings", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Bookings")));
    expect(await within(dialog).findByText("No bookings found")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Activity", { selector: "span" }));
    expect(within(dialog).getByText("No activity found")).toBeTruthy();
  });

  it("shows owner-only vehicles and documents tabs", async () => {
    svc.getUserById.mockResolvedValue(
      detail({
        id: "user-2",
        role: "VEHICLE_OWNER",
        ownerBookingCount: 7,
        _count: { bookings: 0, reviews: 0, notifications: 1, vehicles: 2 },
      }),
    );
    svc.getAdminVehicles.mockResolvedValue({
      vehicles: [
        { id: "v1", name: "Bus One", licensePlate: "NB-1111", type: "ORDINARY", isActive: true },
        { id: "v2", name: "Bus Two", licensePlate: "NB-2222", type: "SEMI_LUXURY", isActive: false },
        { id: "v3", name: "Bus Three", licensePlate: "NB-3333", type: "LUXURY_AC", isActive: true },
        { id: "v4", name: "Bus Four", licensePlate: "NB-4444", type: "OTHER", isActive: true },
      ],
    });
    svc.getOwnerVerificationById.mockResolvedValue({
      documents: [
        { id: "d1", type: "NIC", fileName: "nic.pdf", status: "VERIFIED", createdAt: now, url: "https://signed/nic" },
        { id: "d2", type: "LICENSE", fileName: "lic.pdf", status: "REJECTED", rejectionReason: "Blurry", createdAt: now, url: null },
        { id: "d3", type: "INSURANCE", fileName: "ins.pdf", status: "PENDING", createdAt: now, url: null },
      ],
    });
    await renderPage();
    await screen.findByText("Kamala Silva");
    await act(async () => fireEvent.click(screen.getByLabelText("View details for Kamala Silva")));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText("7").length).toBeGreaterThan(0);

    fireEvent.click(within(dialog).getByText("Bookings", { selector: "span" }));
    expect(within(dialog).getByText("Bookings where this owner's vehicles were chartered.")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Vehicles", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Vehicles")));
    expect(svc.getAdminVehicles).toHaveBeenCalledWith({ ownerId: "user-2", limit: 20 });
    expect(await within(dialog).findByText("Semi Luxury")).toBeTruthy();
    expect(within(dialog).getByText("Luxury AC")).toBeTruthy();
    expect(within(dialog).getByText("OTHER")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Documents", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Documents")));
    expect(svc.getOwnerVerificationById).toHaveBeenCalledWith("user-2");
    expect(await within(dialog).findByText("Blurry")).toBeTruthy();
    expect(within(dialog).getByLabelText("Open nic.pdf in a new tab").getAttribute("href")).toBe(
      "https://signed/nic",
    );
    expect(within(dialog).getAllByText("Unavailable").length).toBe(2);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows empty owner vehicles/documents and a removed owner without actions", async () => {
    svc.getUserById.mockResolvedValue(
      detail({
        role: "VEHICLE_OWNER",
        isRemoved: true,
        removedAt: now,
        _count: { bookings: 0, reviews: 0, notifications: 0 },
      }),
    );
    svc.getAdminVehicles.mockRejectedValue(new Error("x"));
    svc.getOwnerVerificationById.mockRejectedValue(new Error("x"));
    await renderPage();
    await screen.findByText("Nimal Perera");
    await act(async () => fireEvent.click(screen.getByLabelText("View details for Nimal Perera")));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Removed/)).toBeTruthy();
    expect(within(dialog).queryByText("Reset Password")).toBeNull();

    fireEvent.click(within(dialog).getByText("Vehicles", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Vehicles")));
    expect(await within(dialog).findByText("No vehicles found")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Documents", { selector: "span" }));
    await act(async () => fireEvent.click(within(dialog).getByText("Load Documents")));
    expect(await within(dialog).findByText("No documents found")).toBeTruthy();
  });

  it("surfaces a detail load failure in the error banner", async () => {
    svc.getUserById.mockRejectedValue("bad");
    await renderPage();
    await screen.findByText("Nimal Perera");
    await act(async () => fireEvent.click(screen.getByLabelText("View details for Nimal Perera")));
    expect(await screen.findByText(/Failed to load user details/)).toBeTruthy();
    expect(screen.getByText("Loading user details…")).toBeTruthy();
  });
});
