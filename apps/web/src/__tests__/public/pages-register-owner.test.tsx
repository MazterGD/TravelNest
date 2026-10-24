/**
 * Bus-owner registration wizard: per-step validation (identity, address,
 * vehicles with photos/documents, password, terms), live field checks, the
 * email OTP gate, file uploads to registration storage and the final payload.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/register/owner",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}|${Object.values(values).join("|")}` : key,
  useLocale: () => "en",
}));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }));
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/ui", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  function FileUpload({ label, value, onChange, error }: any) {
    return (
      <div>
        <button
          type="button"
          onClick={() =>
            onChange({ file: new File(["doc"], `${label}.pdf`, { type: "application/pdf" }), preview: "" })
          }
        >
          upload:{label}
        </button>
        <button type="button" onClick={() => onChange(null)}>
          clear:{label}
        </button>
        {value && <span>has:{label}</span>}
        {error && <p>{error}</p>}
      </div>
    );
  }
  function OtpVerificationModal({ isOpen, onVerify, onResend, onClose }: any) {
    const [err, setErr] = useState("");
    if (!isOpen) return null;
    return (
      <div role="dialog">
        <button onClick={() => onVerify("654321").catch((e: Error) => setErr(e.message))}>verify-otp</button>
        <button onClick={() => onResend()}>resend-otp</button>
        <button onClick={onClose}>close-otp</button>
        {err && <p>otp-error:{err}</p>}
      </div>
    );
  }
  return { ...actual, FileUpload, OtpVerificationModal };
});

const services = vi.hoisted(() => ({
  authService: { sendOtp: vi.fn(), verifyOtp: vi.fn() },
  ownerRegistrationService: { register: vi.fn() },
  storageService: { uploadRegistrationFile: vi.fn() },
  landingContentService: { getPublicConfig: vi.fn() },
}));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { ...services, ApiError };
});

import OwnerRegistrationPage from "@/app/[locale]/register/owner/page";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store";
import { UserRole, type User } from "@/types";

const { authService, ownerRegistrationService, storageService, landingContentService } = services;

const config = {
  options: {
    vehicleTypes: [
      { value: "ORDINARY", label: "Ordinary" },
      { value: "SEMI_LUXURY", label: "Semi" },
      { value: "LUXURY_AC", label: "Lux" },
      { value: "MINI", label: "Mini" },
    ],
    acTypes: [
      { value: "FULL_AC", label: "Full" },
      { value: "AC", label: "AC" },
      { value: "NON_AC", label: "Non" },
      { value: "SOLAR", label: "Solar" },
    ],
    conditions: [
      { value: "EXCELLENT", label: "Excellent" },
      { value: "GOOD", label: "Good" },
      { value: "FAIR", label: "Fair" },
      { value: "NEEDS_REPAIR", label: "Needs repair" },
      { value: "SCRAP", label: "Scrap" },
    ],
    amenities: ["wifi", "ac", "music", "usb", "tv", "reclining", "reading", "gps", "bar"].map((id) => ({
      id,
      label: id.toUpperCase(),
    })),
    districts: ["Kandy", "Matale"],
  },
};

const ph = (key: string) => screen.getAllByPlaceholderText(key);
const type = (key: string, value: string, i = 0) => fireEvent.change(ph(key)[i], { target: { value } });
const click = (text: string) => fireEvent.click(screen.getByText(text));
const next = () => act(() => click("actions.continue"));
const selects = () => Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
const fileInputs = () => Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
const pickFile = (input: HTMLInputElement, name: string) =>
  fireEvent.change(input, { target: { files: [new File(["img"], name, { type: "image/jpeg" })] } });

const fillStep1 = () => {
  type("fields.firstName.placeholder", "Sunil");
  type("fields.lastName.placeholder", "Perera");
  type("fields.email.placeholder", "sunil@x.lk");
  type("fields.phone.placeholder", "0771234567");
  type("fields.nicNumber.placeholder", "199012345678");
  pickFile(fileInputs()[0], "me.jpg");
  click("upload:fields.nicDocument.label");
};
const fillStep2 = () => {
  type("fields.address.placeholder", "12 Temple Road");
  type("fields.city.placeholder", "Kandy");
  fireEvent.change(selects()[0], { target: { value: "Kandy" } });
  type("fields.postalCode.placeholder", "20000");
  type("fields.baseLocation.placeholder", "Kandy");
};
const fillVehicle = (i: number) => {
  const regKey = screen.getAllByText("fields.registrationNumber.label")[i]
    .closest("div")!
    .querySelector("input")!;
  fireEvent.change(regKey, { target: { value: `WP-12${i}4` } });
  type("fields.make.placeholder", "Ashok", i);
  type("fields.model.placeholder", "Viking", i);
  type("fields.year.placeholder", "2020", i);
  fireEvent.change(screen.getAllByText("fields.seatingCapacity.label")[i].closest("div")!.querySelector("input")!, {
    target: { value: "45" },
  });
  type("fields.color.placeholder", "Blue", i);
  pickFile(fileInputs()[i], `bus${i}.jpg`);
  for (const doc of ["drivingLicense", "insuranceCertificate", "registrationCertificate"]) {
    fireEvent.click(screen.getAllByText(`upload:fields.documents.${doc}.label`)[i]);
  }
};
const vehicleSelects = () => selects();
const fillStep4 = () => {
  type("fields.password.placeholder", "Secret123!");
  type("fields.confirmPassword.placeholder", "Secret123!");
};

const renderPage = async () => {
  render(<OwnerRegistrationPage />);
  await screen.findByPlaceholderText("fields.firstName.placeholder");
  await waitFor(() => expect(landingContentService.getPublicConfig).toHaveBeenCalled());
};

const toStep3 = async () => {
  await renderPage();
  fillStep1();
  next();
  fillStep2();
  next();
  await screen.findByText("sections.vehicleInfo");
};
const fillVehicleSelects = (i: number) => {
  // Each vehicle card has vehicle-type, AC-type and condition selects, in that order.
  const s = vehicleSelects();
  fireEvent.change(s[i * 3], { target: { value: "LUXURY_AC" } });
  fireEvent.change(s[i * 3 + 1], { target: { value: "FULL_AC" } });
  fireEvent.change(s[i * 3 + 2], { target: { value: "EXCELLENT" } });
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  landingContentService.getPublicConfig.mockResolvedValue(config);
  storageService.uploadRegistrationFile.mockImplementation(async (file: File, category: string) => ({
    url: `storage://${category}/${file.name}`,
  }));
  (URL as any).createObjectURL = vi.fn(() => "blob:preview");
  window.scrollTo = vi.fn() as any;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("owner registration", () => {
  it("redirects signed-in users away", async () => {
    useAuthStore.setState({ user: { id: "o", role: UserRole.CUSTOMER } as User, isAuthenticated: true });
    render(<OwnerRegistrationPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/dashboard"));
  });

  it("validates step 1: required fields, email format and identity documents", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderPage();
    next();
    expect(screen.getAllByText("errors.requiredFields").length).toBeGreaterThan(1);
    act(() => vi.advanceTimersByTime(60));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    type("fields.firstName.placeholder", "S");
    type("fields.lastName.placeholder", "Perera");
    type("fields.email.placeholder", "sunil@x");
    type("fields.phone.placeholder", "0771234567");
    type("fields.nicNumber.placeholder", "1234567890123");
    expect(screen.getByText("NIC number must be 12 characters or less")).toBeTruthy();
    type("fields.nicNumber.placeholder", "199012345678");
    type("fields.firstName.placeholder", "Sunil");
    next();
    expect(screen.getByText("errors.invalidEmail")).toBeTruthy();

    type("fields.email.placeholder", "sunil@x.lk");
    next();
    expect(screen.getByText("errors.identityDocsRequired")).toBeTruthy();
    expect(screen.getByText("errors.profilePhotoRequired")).toBeTruthy();
    expect(screen.getByText("errors.nicDocumentRequired")).toBeTruthy();

    pickFile(fileInputs()[0], "me.jpg");
    expect(screen.getByAltText("fields.ownerPhoto.alt")).toBeTruthy();
    fireEvent.click(screen.getByText("×"));
    expect(screen.queryByAltText("fields.ownerPhoto.alt")).toBeNull();
    fireEvent.change(fileInputs()[0], { target: { files: [] } });
    pickFile(fileInputs()[0], "me.jpg");
    next();
    expect(screen.getByText("errors.identityDocsRequired")).toBeTruthy();
    click("upload:fields.nicDocument.label");
    next();
    expect(await screen.findByText("sections.addressInfo")).toBeTruthy();
  });

  it("validates the address step and goes back to step 1", async () => {
    await renderPage();
    fillStep1();
    next();
    next();
    expect(screen.getAllByText("errors.requiredAddressFields").length).toBeGreaterThan(1);
    type("fields.address.placeholder", "abc");
    type("fields.city.placeholder", "K");
    fireEvent.change(selects()[0], { target: { value: "" } });
    type("fields.baseLocation.placeholder", "K");
    expect(screen.getAllByText("errors.requiredAddressFields").length).toBeGreaterThan(1);
    expect(screen.getAllByText("kandy").length).toBeGreaterThan(0);

    click("actions.previous");
    expect(screen.getByPlaceholderText("fields.firstName.placeholder")).toBeTruthy();
    next();
    fillStep2();
    next();
    expect(await screen.findByText("sections.vehicleInfo")).toBeTruthy();
  });

  it("validates vehicles, photos and documents and manages multiple vehicles", async () => {
    await toStep3();
    next();
    expect(screen.getAllByText("errors.requiredVehicleFields|1").length).toBeGreaterThan(1);
    expect(screen.getByText("errors.requiredVehiclePhotos|1")).toBeTruthy();
    expect(screen.getByText("errors.requiredVehicleDocs|1")).toBeTruthy();

    const reg = screen.getByText("fields.registrationNumber.label").closest("div")!.querySelector("input")!;
    fireEvent.change(reg, { target: { value: "bad" } });
    expect(screen.getByText("Format must be like WP-1234 or ABC-1234")).toBeTruthy();
    type("fields.make.placeholder", "A");
    expect(screen.getByText("Make must be at least 2 characters")).toBeTruthy();
    type("fields.model.placeholder", "V");
    type("fields.model.placeholder", "");
    expect(screen.getByText("Model is required")).toBeTruthy();
    type("fields.year.placeholder", "1980");
    expect(screen.getByText("Year must be 1990 or later")).toBeTruthy();
    const seats = screen.getByText("fields.seatingCapacity.label").closest("div")!.querySelector("input")!;
    fireEvent.change(seats, { target: { value: "5" } });
    expect(screen.getByText("Must have at least 10 seats")).toBeTruthy();

    fillVehicle(0);
    fillVehicleSelects(0);
    expect(screen.queryByText("Format must be like WP-1234 or ABC-1234")).toBeNull();
    type("fields.description.placeholder", "Clean bus");
    const allowance = ph("fields.driverAllowance.placeholder")[0];
    fireEvent.change(allowance, { target: { value: "2500" } });

    const amenityBoxes = Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    fireEvent.click(amenityBoxes[0]);
    expect(amenityBoxes[0].checked).toBe(true);
    fireEvent.click(amenityBoxes[0]);
    expect(amenityBoxes[0].checked).toBe(false);

    pickFile(fileInputs()[0], "inside.jpg");
    expect(screen.getAllByLabelText("Remove photo").length).toBe(2);
    fireEvent.click(screen.getAllByText("Interior")[1]);
    fireEvent.click(screen.getAllByLabelText("Remove photo")[1]);
    expect(screen.getAllByLabelText("Remove photo").length).toBe(1);
    fireEvent.change(fileInputs()[0], { target: { files: [] } });

    click("clear:fields.documents.insuranceCertificate.label");
    next();
    expect(screen.getByText("errors.requiredVehicleDocs|1")).toBeTruthy();
    click("upload:fields.documents.insuranceCertificate.label");

    click("vehicle.addAnother");
    expect(screen.getAllByText("fields.registrationNumber.label").length).toBe(2);
    next();
    expect(screen.getAllByText("errors.requiredVehicleFields|2").length).toBeGreaterThan(1);
    fireEvent.click(screen.getAllByText("vehicle.remove")[1]);
    expect(screen.getAllByText("fields.registrationNumber.label").length).toBe(1);

    next();
    expect(await screen.findByText("sections.password")).toBeTruthy();
  });

  it("enforces password presence, match and strength, then terms", async () => {
    await toStep3();
    fillVehicle(0);
    fillVehicleSelects(0);
    next();
    await screen.findByText("sections.password");

    next();
    expect(screen.getAllByText("errors.passwordRequired").length).toBeGreaterThan(1);
    type("fields.password.placeholder", "abc");
    expect(screen.getByText("passwordStrength.weak")).toBeTruthy();
    type("fields.confirmPassword.placeholder", "abd");
    next();
    expect(screen.getByText("errors.passwordMismatch")).toBeTruthy();
    type("fields.confirmPassword.placeholder", "abc");
    next();
    expect(screen.getAllByText("errors.weakPassword").length).toBeGreaterThan(0);
    type("fields.password.placeholder", "abcdefgH");
    expect(screen.getByText("passwordStrength.medium")).toBeTruthy();
    fillStep4();
    expect(screen.getByText("passwordStrength.strong")).toBeTruthy();
    next();
    expect(await screen.findByText("sections.terms")).toBeTruthy();

    await act(async () => {
      click("actions.completeRegistration");
    });
    expect(screen.getByText("errors.acceptTerms")).toBeTruthy();
    expect(authService.sendOtp).not.toHaveBeenCalled();
  });

  const completeWizard = async () => {
    await toStep3();
    fillVehicle(0);
    fillVehicleSelects(0);
    next();
    await screen.findByText("sections.password");
    fillStep4();
    next();
    await screen.findByText("sections.terms");
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    boxes.forEach((b) => fireEvent.click(b));
    await act(async () => {
      click("actions.completeRegistration");
    });
  };

  it("uploads every file privately and registers the owner after OTP", async () => {
    authService.sendOtp.mockResolvedValue({});
    authService.verifyOtp.mockResolvedValue({ registrationToken: "reg-tok" });
    ownerRegistrationService.register.mockResolvedValue({
      user: { id: "o1", role: UserRole.VEHICLE_OWNER, isVerified: false } as User,
      accessToken: "tok",
    });
    await completeWizard();
    expect(authService.sendOtp).toHaveBeenCalledWith({ identifier: "sunil@x.lk", purpose: "REGISTRATION" });

    await act(async () => {
      click("resend-otp");
    });
    expect(authService.sendOtp).toHaveBeenCalledTimes(2);
    await act(async () => {
      click("verify-otp");
    });

    expect(authService.verifyOtp).toHaveBeenCalledWith({
      identifier: "sunil@x.lk",
      code: "654321",
      purpose: "REGISTRATION",
    });
    const categories = storageService.uploadRegistrationFile.mock.calls.map((c: any[]) => [c[1], c[2]]);
    expect(categories).toEqual(
      expect.arrayContaining([
        ["owner-documents", "NIC"],
        ["owner-documents", "PROFILE_PHOTO"],
        ["vehicle-photos", undefined],
        ["vehicle-documents", "DRIVING_LICENSE"],
        ["vehicle-documents", "INSURANCE"],
        ["vehicle-documents", "REGISTRATION_CERTIFICATE"],
      ]),
    );
    const payload = ownerRegistrationService.register.mock.calls[0][0];
    expect(payload).toMatchObject({
      registrationToken: "reg-tok",
      firstName: "Sunil",
      email: "sunil@x.lk",
      nicNumber: "199012345678",
      password: "Secret123!",
      address: {
        address: "12 Temple Road",
        city: "Kandy",
        district: "Kandy",
        postalCode: "20000",
        baseLocation: "Kandy",
      },
    });
    expect(payload.ownerDocuments.map((d: any) => d.type)).toEqual(["NIC", "PROFILE_PHOTO"]);
    expect(payload.vehicles[0]).toMatchObject({
      registrationNumber: "WP-1204",
      vehicleType: "LUXURY_AC",
      make: "Ashok",
      year: 2020,
      seatingCapacity: 45,
      acType: "FULL_AC",
      color: "Blue",
    });
    expect(payload.vehicles[0].description).toBeUndefined();
    expect(payload.vehicles[0].amenities).toBeUndefined();
    expect(payload.vehicles[0].photos[0]).toMatchObject({ isPrimary: true, tag: "EXTERIOR", url: "storage://vehicle-photos/bus0.jpg" });
    expect(useAuthStore.getState().token).toBe("tok");
    expect(router.push).toHaveBeenCalledWith("/en/owner/pending-approval");
  });

  it("reports registration failures after a valid OTP", async () => {
    authService.sendOtp.mockResolvedValue({});
    authService.verifyOtp.mockResolvedValue({});
    await completeWizard();

    ownerRegistrationService.register.mockRejectedValueOnce(
      new ApiError(422, "Invalid", "VALIDATION_ERROR", [{ field: "email", message: "Email taken" }]),
    );
    await act(async () => {
      click("verify-otp");
    });
    expect(ownerRegistrationService.register.mock.calls[0][0].registrationToken).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Email taken")).toBeTruthy();

    await act(async () => {
      click("actions.completeRegistration");
    });
    ownerRegistrationService.register.mockRejectedValueOnce(new ApiError(409, "Plate already registered"));
    await act(async () => {
      click("verify-otp");
    });
    expect(screen.getByText("Plate already registered")).toBeTruthy();

    await act(async () => {
      click("actions.completeRegistration");
    });
    storageService.uploadRegistrationFile.mockRejectedValueOnce(new Error("upload failed"));
    await act(async () => {
      click("verify-otp");
    });
    expect(screen.getByText("errors.unexpected")).toBeTruthy();
  });

  it("surfaces OTP send and verify errors", async () => {
    authService.sendOtp.mockRejectedValueOnce(new ApiError(429, "Too many codes"));
    await completeWizard();
    expect(screen.getByText("Too many codes")).toBeTruthy();

    authService.sendOtp.mockRejectedValueOnce(new Error("x"));
    await act(async () => {
      click("actions.completeRegistration");
    });
    expect(screen.getByText("errors.otpSendFailed")).toBeTruthy();

    authService.sendOtp.mockResolvedValue({});
    await act(async () => {
      click("actions.completeRegistration");
    });
    authService.verifyOtp.mockRejectedValueOnce(new ApiError(400, "Wrong code"));
    await act(async () => {
      click("verify-otp");
    });
    expect(screen.getByText("otp-error:Wrong code")).toBeTruthy();
    authService.verifyOtp.mockRejectedValueOnce("x");
    await act(async () => {
      click("verify-otp");
    });
    expect(screen.getByText("otp-error:errors.invalidOtp")).toBeTruthy();
    click("close-otp");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("localizes option labels and survives a config failure", async () => {
    await toStep3();
    expect(screen.getAllByText("filters.vehicleTypes.luxuryAc").length).toBeGreaterThan(0);
    expect(screen.getByText("Mini")).toBeTruthy();
    expect(screen.getByText("filters.acTypes.nonAc")).toBeTruthy();
    expect(screen.getByText("Solar")).toBeTruthy();
    expect(screen.getByText("Scrap")).toBeTruthy();
    expect(screen.getByText("BAR")).toBeTruthy();
  });

  it("keeps working without public options", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    landingContentService.getPublicConfig.mockRejectedValueOnce(new Error("x"));
    await renderPage();
    await waitFor(() =>
      expect(log).toHaveBeenCalledWith("Failed to fetch owner registration config:", expect.any(Error)),
    );
    log.mockRestore();
  });

});
