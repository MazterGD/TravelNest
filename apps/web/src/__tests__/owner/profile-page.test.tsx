/**
 * Owner profile page: personal/address forms, avatar upload validation and
 * delete, vehicles tab, documents tab with verification states and NIC
 * document upload/replace/delete.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: null as any,
  updateUser: vi.fn(),
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/owner/profile",
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
vi.mock("@/hooks", async () => {
  const actual = await vi.importActual<any>("@/hooks/useUtils");
  return { useOwnerGuard: () => state.guard, useClickOutside: actual.useClickOutside };
});
vi.mock("@/store", () => ({
  useAuthStore: () => ({ user: state.user, updateUser: state.updateUser }),
}));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {}
  return {
    ApiError,
    vehicleService: { getMyVehicles: vi.fn() },
    ownerService: {
      getDocuments: vi.fn(),
      addDocument: vi.fn(),
      deleteDocument: vi.fn(),
      updatePersonalInfo: vi.fn(),
      updateAddress: vi.fn(),
    },
    landingContentService: { getPublicConfig: vi.fn() },
    storageService: { uploadRegistrationFile: vi.fn() },
  };
});

import { ApiError, landingContentService, ownerService, storageService, vehicleService } from "@/lib/api";
import OwnerProfilePage from "@/app/[locale]/owner/profile/page";

const owner = ownerService as any;
const storage = storageService as any;
const vehicles = vehicleService as any;
const landing = landingContentService as any;
const now = "2026-10-01T10:00:00.000Z";

const baseUser = () => ({
  firstName: "Kamal",
  lastName: "Silva",
  email: "kamal@x.lk",
  phone: "0771234567",
  nicNumber: "901234567V",
  address: "12 Main St",
  city: "Kandy",
  district: "Kandy",
  postalCode: "20000",
  baseLocation: "Kandy town",
  avatar: null,
  isVerified: true,
  status: "ACTIVE",
});

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: "d1",
  type: "NIC",
  url: "https://signed/nic",
  fileName: "nic.pdf",
  fileSize: 100,
  mimeType: "application/pdf",
  status: "PENDING",
  rejectionReason: null,
  verifiedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const file = (name: string, type: string, size = 1000) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

const avatarInput = () => document.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement;
const docInput = () => document.querySelector('input[accept="application/pdf,image/jpeg,image/png"]') as HTMLInputElement;

describe("OwnerProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = baseUser();
    owner.getDocuments.mockResolvedValue([]);
    landing.getPublicConfig.mockResolvedValue({ options: { districts: ["Colombo", "Kandy", "Galle"] } });
    vehicles.getMyVehicles.mockResolvedValue({ vehicles: [] });
    storage.uploadRegistrationFile.mockResolvedValue({ url: "https://store/file" });
    owner.addDocument.mockResolvedValue({});
    owner.deleteDocument.mockResolvedValue({});
    owner.updatePersonalInfo.mockResolvedValue({ firstName: "Updated" });
    owner.updateAddress.mockResolvedValue({ city: "Galle" });
  });

  it("is gated by the guard and user", () => {
    state.user = null;
    render(<OwnerProfilePage />);
    expect(screen.queryByText("title")).toBeNull();
    expect(owner.getDocuments).not.toHaveBeenCalled();
  });

  it("prefills and saves personal information", async () => {
    render(<OwnerProfilePage />);
    expect(screen.getByText("backToDashboard").closest("a")?.getAttribute("href")).toBe("/en/owner/dashboard");
    expect((screen.getByLabelText("First Name") as HTMLInputElement).value).toBe("Kamal");
    fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Kamala" } });
    fireEvent.change(screen.getByLabelText("Last Name"), { target: { value: "Perera" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "k@x.lk" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "0711111111" } });
    fireEvent.change(screen.getByLabelText("NIC Number"), { target: { value: "199012345678" } });
    await act(async () => fireEvent.submit(screen.getByLabelText("First Name").closest("form") as HTMLFormElement));
    expect(owner.updatePersonalInfo).toHaveBeenCalledWith({
      firstName: "Kamala",
      lastName: "Perera",
      phone: "0711111111",
      nicNumber: "199012345678",
    });
    expect(state.updateUser).toHaveBeenCalledWith({ firstName: "Updated" });
    expect(screen.getByText("successPersonal")).toBeTruthy();
  });

  it("shows API and generic errors on personal save and can dismiss them", async () => {
    owner.updatePersonalInfo.mockRejectedValueOnce(new (ApiError as any)("Phone taken")).mockRejectedValueOnce(new Error("x"));
    render(<OwnerProfilePage />);
    const form = screen.getByLabelText("First Name").closest("form") as HTMLFormElement;
    await act(async () => fireEvent.submit(form));
    expect(screen.getByText("Phone taken")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Dismiss error"));
    expect(screen.queryByText("Phone taken")).toBeNull();
    await act(async () => fireEvent.submit(form));
    expect(screen.getByText("uploadError")).toBeTruthy();
  });

  it("edits and saves the address with district options", async () => {
    render(<OwnerProfilePage />);
    fireEvent.click(screen.getByText("tabAddress"));
    await waitFor(() => expect(document.querySelectorAll("option").length).toBe(4));
    fireEvent.change(screen.getByPlaceholderText("addressPlaceholder"), { target: { value: "1 Beach Rd" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Galle" } });
    fireEvent.change(document.querySelector("select") as HTMLSelectElement, { target: { value: "Galle" } });
    fireEvent.change(screen.getByLabelText("Postal Code"), { target: { value: "80000" } });
    fireEvent.change(screen.getByLabelText("Base Location"), { target: { value: "Galle fort" } });
    await act(async () => fireEvent.submit(screen.getByLabelText("City").closest("form") as HTMLFormElement));
    expect(owner.updateAddress).toHaveBeenCalledWith({
      address: "1 Beach Rd",
      city: "Galle",
      district: "Galle",
      postalCode: "80000",
      baseLocation: "Galle fort",
    });
    expect(screen.getByText("successAddress")).toBeTruthy();

    owner.updateAddress.mockRejectedValueOnce(new (ApiError as any)("Bad postal code")).mockRejectedValueOnce("x");
    await act(async () => fireEvent.submit(screen.getByLabelText("City").closest("form") as HTMLFormElement));
    expect(screen.getByText("Bad postal code")).toBeTruthy();
    await act(async () => fireEvent.submit(screen.getByLabelText("City").closest("form") as HTMLFormElement));
    expect(screen.getByText("uploadError")).toBeTruthy();
  });

  it("tolerates district config failures and empty user fields", async () => {
    landing.getPublicConfig.mockRejectedValue(new Error("x"));
    state.user = { isVerified: false };
    render(<OwnerProfilePage />);
    expect((screen.getByLabelText("First Name") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByText("tabAddress"));
    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("");
  });

  it("validates, uploads and deletes the avatar", async () => {
    owner.getDocuments.mockResolvedValue([doc({ id: "p1", type: "PROFILE_PHOTO", url: "https://store/avatar.webp" })]);
    render(<OwnerProfilePage />);
    expect(await screen.findByAltText("profilePhoto")).toBeTruthy();

    fireEvent.change(avatarInput(), { target: { files: [file("a.gif", "image/gif")] } });
    expect(screen.getByText("avatarInvalidType")).toBeTruthy();
    fireEvent.change(avatarInput(), { target: { files: [file("a.png", "image/png", 6 * 1024 * 1024)] } });
    expect(screen.getByText("avatarMaxSize")).toBeTruthy();
    fireEvent.change(avatarInput(), { target: { files: [] } });

    await act(async () => {
      fireEvent.change(avatarInput(), { target: { files: [file("me.png", "image/png")] } });
    });
    expect(storage.uploadRegistrationFile).toHaveBeenCalledWith(expect.any(File), "owner-documents", "PROFILE_PHOTO");
    expect(owner.addDocument).toHaveBeenCalledWith({
      type: "PROFILE_PHOTO",
      url: "https://store/file",
      fileName: "me.png",
      fileSize: 1000,
      mimeType: "image/png",
    });
    expect(await screen.findByText("avatarUpdated")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByLabelText("avatarDelete")));
    expect(owner.deleteDocument).toHaveBeenCalledWith("p1");
    expect(await screen.findByText("avatarDeleted")).toBeTruthy();
  });

  it("reports avatar upload and delete failures", async () => {
    owner.getDocuments.mockResolvedValue([doc({ id: "p1", type: "PROFILE_PHOTO" })]);
    storage.uploadRegistrationFile.mockRejectedValueOnce(new (ApiError as any)("Too big")).mockRejectedValueOnce("x");
    owner.deleteDocument.mockRejectedValueOnce(new (ApiError as any)("Locked")).mockRejectedValueOnce("x");
    render(<OwnerProfilePage />);
    await screen.findByLabelText("avatarDelete");
    await act(async () => fireEvent.change(avatarInput(), { target: { files: [file("a.png", "image/png")] } }));
    expect(screen.getByText("Too big")).toBeTruthy();
    await act(async () => fireEvent.change(avatarInput(), { target: { files: [file("a.png", "image/png")] } }));
    expect(screen.getByText("avatarUploadFailed")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByLabelText("avatarDelete")));
    expect(screen.getByText("Locked")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByLabelText("avatarDelete")));
    expect(screen.getByText("avatarDeleteFailed")).toBeTruthy();
  });

  it("treats a failed document load as no documents", async () => {
    state.user = { ...baseUser(), avatar: "https://store/old.webp" };
    owner.getDocuments.mockRejectedValue(new Error("x"));
    render(<OwnerProfilePage />);
    expect(screen.getByAltText("profilePhoto")).toBeTruthy();
    await waitFor(() => expect(screen.queryByAltText("profilePhoto")).toBeNull());
    expect(screen.queryByLabelText("avatarDelete")).toBeNull();
  });

  it("lists vehicles and shows empty / error states", async () => {
    vehicles.getMyVehicles.mockResolvedValueOnce({
      vehicles: [
        { id: "v1", licensePlate: "NB-1234", brand: "Ashok", model: "Viking", type: "LUXURY_AC", seats: 45, isAvailable: true, isActive: true },
        { id: "v2", licensePlate: "NB-5678", brand: "Isuzu", model: "Journey", type: "ORDINARY", seats: 30, isAvailable: false, isActive: false },
      ],
    });
    render(<OwnerProfilePage />);
    fireEvent.click(screen.getByText("tabVehicles"));
    expect(await screen.findByText("NB-1234")).toBeTruthy();
    expect(screen.getByText('myVehiclesCount:{"count":2}')).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("Pending Verification")).toBeTruthy();
    expect(screen.getAllByText("Edit")[1].closest("a")?.getAttribute("href")).toBe("/en/owner/fleet/v2/edit");

    fireEvent.click(screen.getByText("tabPersonal"));
    vehicles.getMyVehicles.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByText("tabVehicles"));
    expect(await screen.findByText("noVehicles")).toBeTruthy();

    fireEvent.click(screen.getByText("tabPersonal"));
    vehicles.getMyVehicles.mockRejectedValueOnce(new (ApiError as any)("Fleet offline"));
    fireEvent.click(screen.getByText("tabVehicles"));
    expect(await screen.findByText("Fleet offline")).toBeTruthy();

    fireEvent.click(screen.getByText("tabPersonal"));
    vehicles.getMyVehicles.mockRejectedValueOnce(new Error("silent"));
    fireEvent.click(screen.getByText("tabVehicles"));
    await waitFor(() => expect(vehicles.getMyVehicles).toHaveBeenCalledTimes(4));
    expect(screen.queryByText("silent")).toBeNull();
  });

  it("shows verified status and uploads a NIC document", async () => {
    render(<OwnerProfilePage />);
    fireEvent.click(screen.getByText("tabDocuments"));
    expect(await screen.findByText("statusVerified")).toBeTruthy();
    expect(await screen.findByText("noDocument")).toBeTruthy();
    owner.getDocuments.mockResolvedValue([doc()]);
    await act(async () => fireEvent.change(docInput(), { target: { files: [file("nic.pdf", "application/pdf")] } }));
    expect(storage.uploadRegistrationFile).toHaveBeenCalledWith(expect.any(File), "owner-documents", "NIC");
    expect(owner.addDocument).toHaveBeenCalledWith(expect.objectContaining({ type: "NIC", fileName: "nic.pdf" }));
    expect(screen.getByText("docUploaded")).toBeTruthy();
    expect(screen.getByText("nic.pdf")).toBeTruthy();
    expect(screen.getByText("docStatusPending")).toBeTruthy();
    expect(screen.getByText("replaceDocument")).toBeTruthy();
    expect(screen.getByLabelText("viewDocument").getAttribute("href")).toBe("https://signed/nic");

    fireEvent.change(docInput(), { target: { files: [] } });

    await act(async () => fireEvent.click(screen.getByLabelText("deleteDocument")));
    expect(owner.deleteDocument).toHaveBeenCalledWith("d1");
    expect(screen.getByText("docDeleted")).toBeTruthy();
    expect(screen.getByText("noDocument")).toBeTruthy();
  });

  it("shows rejected verification with admin notes and document errors", async () => {
    state.user = { ...baseUser(), isVerified: false, status: "PENDING_VERIFICATION", rejectedAt: now, rejectionReason: "NIC blurry" };
    owner.getDocuments.mockResolvedValue([doc({ status: "REJECTED", rejectionReason: "Unreadable scan" })]);
    owner.deleteDocument.mockRejectedValueOnce(new (ApiError as any)("Cannot delete")).mockRejectedValueOnce("x");
    storage.uploadRegistrationFile.mockRejectedValueOnce(new (ApiError as any)("Upload refused")).mockRejectedValueOnce("x");
    render(<OwnerProfilePage />);
    fireEvent.click(screen.getByText("tabDocuments"));
    expect(screen.getByText("statusRejected")).toBeTruthy();
    expect(screen.getByText("NIC blurry")).toBeTruthy();
    expect(await screen.findByText("Unreadable scan")).toBeTruthy();
    expect(screen.getByText("docStatusRejected")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByLabelText("deleteDocument")));
    expect(screen.getByText("Cannot delete")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByLabelText("deleteDocument")));
    expect(screen.getByText("deleteError")).toBeTruthy();
    await act(async () => fireEvent.change(docInput(), { target: { files: [file("n.pdf", "application/pdf")] } }));
    expect(screen.getByText("Upload refused")).toBeTruthy();
    await act(async () => fireEvent.change(docInput(), { target: { files: [file("n.pdf", "application/pdf")] } }));
    expect(screen.getByText("uploadError")).toBeTruthy();
  });

  it("shows pending verification and hides delete for a verified document", async () => {
    state.user = { ...baseUser(), isVerified: false, status: "PENDING_VERIFICATION" };
    owner.getDocuments.mockResolvedValue([doc({ status: "VERIFIED" })]);
    render(<OwnerProfilePage />);
    fireEvent.click(screen.getByText("tabDocuments"));
    expect(screen.getByText("statusPending")).toBeTruthy();
    expect(await screen.findByText("docStatusVerified")).toBeTruthy();
    expect(screen.queryByLabelText("deleteDocument")).toBeNull();
  });
});
