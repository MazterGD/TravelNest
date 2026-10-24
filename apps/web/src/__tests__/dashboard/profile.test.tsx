/**
 * Customer profile page: profile load, edit/validate/save, avatar upload and
 * delete with type/size guards, and success/error banners.
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  t: (key: string) => key,
  store: { user: null as any, setUser: vi.fn() },
}));

vi.mock("next-intl", () => ({ useTranslations: () => h.t, useLocale: () => "en" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/dashboard/profile",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
}));
vi.mock("@/store", () => ({ useAuthStore: () => h.store }));
vi.mock("@/components/features/account/AccountDangerZone", () => ({
  AccountDangerZone: ({ locale }: any) => <div data-testid="danger">{locale}</div>,
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  userService: { getProfile: vi.fn(), uploadAvatar: vi.fn(), deleteAvatar: vi.fn(), updatePersonalInfo: vi.fn() },
}));

import { ProfilePageContent } from "@/app/[locale]/dashboard/profile/ProfilePageContent";
import { ApiError, userService } from "@/lib/api";

const svc = userService as any;

const user = (over: Record<string, any> = {}) => ({
  id: "u1",
  firstName: "Nimal",
  lastName: "Silva",
  phone: "0771234567",
  email: "nimal@example.lk",
  avatar: "https://cdn/avatar.webp",
  isVerified: true,
  createdAt: "2025-01-15T00:00:00Z",
  ...over,
});

const inputByLabel = (label: string) =>
  screen.getByText(label, { selector: "label" }).parentElement!.querySelector("input") as HTMLInputElement;

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const chooseFile = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });

beforeEach(() => {
  vi.clearAllMocks();
  h.store.user = user();
});

describe("ProfilePageContent", () => {
  it("renders the signed-in user's profile without refetching when an avatar is present", () => {
    render(<ProfilePageContent locale="si" />);
    expect(svc.getProfile).not.toHaveBeenCalled();
    expect(screen.getByText("Nimal Silva")).toBeTruthy();
    expect(screen.getByText("nimal@example.lk")).toBeTruthy();
    expect(screen.getByText("verified")).toBeTruthy();
    expect(screen.getByText("memberSince", { exact: false })).toBeTruthy();
    expect(screen.getByAltText("profilePhoto").getAttribute("src")).toBe("https://cdn/avatar.webp");
    expect(inputByLabel("firstName").value).toBe("Nimal");
    expect(inputByLabel("firstName").disabled).toBe(true);
    expect(screen.getByTestId("danger").textContent).toBe("si");
  });

  it("loads the profile from the API when there is no user yet", async () => {
    h.store.user = null;
    svc.getProfile.mockResolvedValue(user({ avatar: null, phone: null, isVerified: false, createdAt: null }));
    render(<ProfilePageContent locale="en" />);
    await waitFor(() => expect(inputByLabel("firstName").value).toBe("Nimal"));
    expect(h.store.setUser).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
    expect(screen.getByText("Nimal Silva")).toBeTruthy();
    expect(inputByLabel("phone").value).toBe("");
    expect(screen.queryByText("verified")).toBeNull();
  });

  it("refreshes a user that has no avatar and handles empty profile fields", async () => {
    h.store.user = user({ avatar: null, firstName: null, lastName: null, phone: null });
    svc.getProfile.mockResolvedValue({});
    render(<ProfilePageContent locale="en" />);
    await waitFor(() => expect(svc.getProfile).toHaveBeenCalled());
    expect(inputByLabel("firstName").value).toBe("");
  });

  it("shows load errors", async () => {
    h.store.user = null;
    svc.getProfile.mockRejectedValueOnce(new ApiError(401, "Session expired"));
    const first = render(<ProfilePageContent locale="en" />);
    expect((await screen.findByRole("alert")).textContent).toBe("Session expired");
    first.unmount();
    svc.getProfile.mockRejectedValueOnce(new Error("x"));
    render(<ProfilePageContent locale="en" />);
    expect((await screen.findByRole("alert")).textContent).toBe("Failed to load profile");
  });

  it("validates required fields before saving", async () => {
    render(<ProfilePageContent locale="en" />);
    fireEvent.click(screen.getByText("edit"));
    fireEvent.change(inputByLabel("firstName"), { target: { value: " " } });
    fireEvent.change(inputByLabel("lastName"), { target: { value: "" } });
    fireEvent.change(inputByLabel("phone"), { target: { value: "" } });
    fireEvent.click(screen.getByText("saveChanges"));
    expect(screen.getByText("firstNameRequired")).toBeTruthy();
    expect(screen.getByText("lastNameRequired")).toBeTruthy();
    expect(screen.getByText("phoneRequired")).toBeTruthy();
    expect(svc.updatePersonalInfo).not.toHaveBeenCalled();
    fireEvent.change(inputByLabel("firstName"), { target: { value: "Kamal" } });
    expect(screen.queryByText("firstNameRequired")).toBeNull();
  });

  it("saves trimmed changes and updates the store", async () => {
    svc.updatePersonalInfo.mockResolvedValue({ firstName: "Kamal", lastName: "Perera", phone: "0711111111" });
    render(<ProfilePageContent locale="en" />);
    fireEvent.click(screen.getByText("edit"));
    fireEvent.change(inputByLabel("firstName"), { target: { value: " Kamal " } });
    fireEvent.change(inputByLabel("lastName"), { target: { value: "Perera" } });
    fireEvent.change(inputByLabel("phone"), { target: { value: "0711111111" } });
    fireEvent.click(screen.getByText("saveChanges"));
    expect((await screen.findByRole("status")).textContent).toBe("profileUpdated");
    expect(svc.updatePersonalInfo).toHaveBeenCalledWith({ firstName: "Kamal", lastName: "Perera", phone: "0711111111" });
    expect(h.store.setUser).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Kamal", email: "nimal@example.lk" }));
    expect(screen.getByText("edit")).toBeTruthy();
  });

  it("saves without a store user and surfaces save errors", async () => {
    h.store.user = null;
    svc.getProfile.mockResolvedValue(user({ avatar: null }));
    svc.updatePersonalInfo
      .mockRejectedValueOnce(new ApiError(400, "Phone invalid"))
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce({});
    render(<ProfilePageContent locale="en" />);
    await waitFor(() => expect(inputByLabel("firstName").value).toBe("Nimal"));
    fireEvent.click(screen.getByText("edit"));
    fireEvent.click(screen.getByText("saveChanges"));
    expect((await screen.findByRole("alert")).textContent).toBe("Phone invalid");
    fireEvent.click(screen.getByText("saveChanges"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Failed to update profile"));
    fireEvent.click(screen.getByText("saveChanges"));
    expect((await screen.findByRole("status")).textContent).toBe("profileUpdated");
    expect(h.store.setUser).toHaveBeenCalledTimes(1);
  });

  it("cancelling an edit restores the stored values", () => {
    render(<ProfilePageContent locale="en" />);
    fireEvent.click(screen.getByText("edit"));
    fireEvent.change(inputByLabel("firstName"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByText("cancel"));
    expect(inputByLabel("firstName").value).toBe("Nimal");
    expect(inputByLabel("firstName").disabled).toBe(true);
  });

  it("cancel falls back to blanks when there is no user", async () => {
    h.store.user = null;
    svc.getProfile.mockResolvedValue(user());
    render(<ProfilePageContent locale="en" />);
    await waitFor(() => expect(inputByLabel("firstName").value).toBe("Nimal"));
    fireEvent.click(screen.getByText("edit"));
    fireEvent.click(screen.getByText("cancel"));
    expect(inputByLabel("firstName").value).toBe("");
  });

  it("rejects avatar files of the wrong type or size", () => {
    render(<ProfilePageContent locale="en" />);
    chooseFile(new File(["x"], "a.gif", { type: "image/gif" }));
    expect(screen.getByRole("alert").textContent).toBe("avatarInvalidType");
    const big = new File(["x"], "a.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    chooseFile(big);
    expect(screen.getByRole("alert").textContent).toBe("avatarMaxSize");
    fireEvent.change(fileInput(), { target: { files: [] } });
    expect(svc.uploadAvatar).not.toHaveBeenCalled();
  });

  it("uploads a new avatar", async () => {
    svc.uploadAvatar.mockResolvedValue(user({ avatar: "https://cdn/new.webp" }));
    render(<ProfilePageContent locale="en" />);
    chooseFile(new File(["x"], "a.webp", { type: "image/webp" }));
    expect((await screen.findByRole("status")).textContent).toBe("avatarUpdated");
    expect(screen.getByAltText("profilePhoto").getAttribute("src")).toBe("https://cdn/new.webp");
  });

  it("handles an upload response without an avatar and upload errors", async () => {
    svc.uploadAvatar
      .mockResolvedValueOnce(user({ avatar: null }))
      .mockRejectedValueOnce(new ApiError(413, "Too big"))
      .mockRejectedValueOnce(new Error("x"));
    render(<ProfilePageContent locale="en" />);
    chooseFile(new File(["x"], "a.png", { type: "image/png" }));
    await screen.findByRole("status");
    expect(screen.queryByAltText("profilePhoto")).toBeNull();
    chooseFile(new File(["x"], "a.png", { type: "image/png" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Too big");
    chooseFile(new File(["x"], "a.png", { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("avatarUploadFailed"));
  });

  it("deletes the avatar and reports failures", async () => {
    svc.deleteAvatar
      .mockRejectedValueOnce(new ApiError(500, "Storage down"))
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce(user({ avatar: null }));
    render(<ProfilePageContent locale="en" />);
    fireEvent.click(screen.getByLabelText("avatarDelete"));
    expect((await screen.findByRole("alert")).textContent).toBe("Storage down");
    fireEvent.click(screen.getByLabelText("avatarDelete"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("avatarDeleteFailed"));
    fireEvent.click(screen.getByLabelText("avatarDelete"));
    expect((await screen.findByRole("status")).textContent).toBe("avatarDeleted");
    expect(screen.queryByLabelText("avatarDelete")).toBeNull();
  });

  it("sends 'Change password' to the settings form and offers no unbuilt 2FA", () => {
    render(<ProfilePageContent locale="en" />);

    expect(screen.getByText("changePassword").closest("a")!.getAttribute("href")).toBe(
      "/en/dashboard/settings#change-password",
    );
    expect(screen.queryByText("twoFactor")).toBeNull();
  });
});
