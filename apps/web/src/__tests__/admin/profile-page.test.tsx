/**
 * Admin profile page: loading/error, personal info save, password change
 * (clears on success, keeps on failure), activity and permissions panels.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getAdminProfile: vi.fn(),
    getAdminProfileActivity: vi.fn(),
    getAdminProfilePermissions: vi.fn(),
    updateAdminProfile: vi.fn(),
    changeAdminProfilePassword: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminProfilePage from "@/app/[locale]/admin/profile/page";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const profile = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Ama",
  lastName: "Admin",
  email: "ama@tn.lk",
  phone: "+94771234567",
  adminRole: "SUPER_ADMIN",
  status: "ACTIVE",
  ...overrides,
});

describe("AdminProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getAdminProfile.mockResolvedValue(profile());
    svc.getAdminProfileActivity.mockResolvedValue({
      items: [{ id: "a1", action: "LOGIN", entityType: "SESSION", createdAt: now }],
    });
    svc.getAdminProfilePermissions.mockResolvedValue({ effectivePermissions: ["users.read", "finance.write"] });
    svc.updateAdminProfile.mockResolvedValue({});
    svc.changeAdminProfilePassword.mockResolvedValue({});
  });

  it("loads the profile, activity and permissions", async () => {
    render(<AdminProfilePage />);
    expect(await screen.findByDisplayValue("Ama")).toBeTruthy();
    expect(svc.getAdminProfileActivity).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(screen.getByDisplayValue("ama@tn.lk")).toBeTruthy();
    expect((screen.getByDisplayValue("ama@tn.lk") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("SUPER_ADMIN")).toBeTruthy();
    expect(screen.getByText("LOGIN")).toBeTruthy();
    expect(screen.getByText("finance.write")).toBeTruthy();
  });

  it("shows fallbacks for missing role, phone, activity and permissions", async () => {
    svc.getAdminProfile.mockResolvedValue(profile({ adminRole: null, status: "SUSPENDED", phone: null }));
    svc.getAdminProfileActivity.mockResolvedValue({ items: [] });
    svc.getAdminProfilePermissions.mockResolvedValue({ effectivePermissions: [] });
    render(<AdminProfilePage />);
    expect(await screen.findByText("UNASSIGNED")).toBeTruthy();
    expect(screen.getByText("SUSPENDED")).toBeTruthy();
    expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("No recent activity.")).toBeTruthy();
    expect(screen.getByText("No permissions assigned.")).toBeTruthy();
  });

  it("shows the load error and a spinner when the profile cannot load", async () => {
    svc.getAdminProfile.mockRejectedValue(new Error("Session expired"));
    render(<AdminProfilePage />);
    expect(await screen.findByText("Session expired")).toBeTruthy();
    expect(screen.queryByText("Personal information")).toBeNull();
    svc.getAdminProfile.mockRejectedValue("x");
    await act(async () => fireEvent.click(screen.getByText("Reload")));
    expect(await screen.findByText("Failed to load admin profile")).toBeTruthy();
  });

  it("saves personal information", async () => {
    render(<AdminProfilePage />);
    await screen.findByDisplayValue("Ama");
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Amara" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Perera" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "0770000000" } });
    await act(async () => fireEvent.click(screen.getByText("Save")));
    expect(svc.updateAdminProfile).toHaveBeenCalledWith({ firstName: "Amara", lastName: "Perera", phone: "0770000000" });
    expect(svc.getAdminProfile).toHaveBeenCalledTimes(2);
  });

  it("reports profile save failures", async () => {
    svc.updateAdminProfile.mockRejectedValueOnce(new Error("Phone invalid")).mockRejectedValueOnce("x");
    render(<AdminProfilePage />);
    await screen.findByDisplayValue("Ama");
    await act(async () => fireEvent.click(screen.getByText("Save")));
    expect(await screen.findByText("Phone invalid")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("Save")));
    expect(await screen.findByText("Failed to update profile")).toBeTruthy();
  });

  it("changes the password and clears the fields on success", async () => {
    render(<AdminProfilePage />);
    await screen.findByDisplayValue("Ama");
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "Old123!" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "New123!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "New123!" } });
    await act(async () => fireEvent.click(screen.getByText("Update")));
    expect(svc.changeAdminProfilePassword).toHaveBeenCalledWith({
      currentPassword: "Old123!",
      newPassword: "New123!",
      confirmPassword: "New123!",
    });
    expect((screen.getByLabelText("Current password") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Confirm password") as HTMLInputElement).value).toBe("");
  });

  it("keeps the password fields when the change fails", async () => {
    svc.changeAdminProfilePassword.mockRejectedValueOnce(new Error("Wrong password")).mockRejectedValueOnce("x");
    render(<AdminProfilePage />);
    await screen.findByDisplayValue("Ama");
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "bad" } });
    await act(async () => fireEvent.click(screen.getByText("Update")));
    expect(await screen.findByText("Wrong password")).toBeTruthy();
    expect((screen.getByLabelText("Current password") as HTMLInputElement).value).toBe("bad");
    await act(async () => fireEvent.click(screen.getByText("Update")));
    expect(await screen.findByText("Failed to update password")).toBeTruthy();
  });
});
