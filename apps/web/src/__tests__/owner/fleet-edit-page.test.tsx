/**
 * Owner edit-vehicle page: hydration from the API (documents, photos,
 * features), section navigation, platform pricing lookup, photo staging and
 * removal, document uploads, amenities and the update/upload sequence.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  push: vi.fn(),
  fileUploads: {} as Record<string, any>,
  location: null as any,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en", id: "veh-1" }),
  useRouter: () => ({ push: state.push, replace: vi.fn() }),
  usePathname: () => "/en/owner/fleet/veh-1/edit",
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
vi.mock("@/store", () => ({ useAuthStore: () => ({ user: state.user }) }));
vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<any>("@/components/ui");
  return {
    ...actual,
    FileUpload: (props: any) => {
      state.fileUploads[props.label] = props;
      return (
        <div data-testid={`upload-${props.label}`}>
          {props.existingFile ? `existing:${props.existingFile.fileName}` : "none"}
          {props.value ? `new:${props.value.file.name}` : ""}
        </div>
      );
    },
    LocationAutocomplete: (props: any) => {
      state.location = props;
      return <input aria-label="location" value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
    },
  };
});
vi.mock("@/lib/api", () => {
  class ApiError extends Error {}
  return {
    ApiError,
    vehicleService: {
      getById: vi.fn(),
      getTypePricing: vi.fn(),
      update: vi.fn(),
      uploadDocuments: vi.fn(),
      deletePhoto: vi.fn(),
      uploadPhotos: vi.fn(),
    },
    landingContentService: { getPublicConfig: vi.fn() },
  };
});

import { ApiError, landingContentService, vehicleService } from "@/lib/api";
import EditVehiclePage from "@/app/[locale]/owner/fleet/[id]/edit/page";

const vehicles = vehicleService as any;
const landing = landingContentService as any;

const vehicle = (overrides: Record<string, unknown> = {}) => ({
  name: "Lanka Cruiser",
  licensePlate: "NB-1234",
  type: "SEMI_LUXURY",
  brand: "Ashok",
  model: "Viking",
  year: 2020,
  seats: 45,
  color: "White",
  acType: "ac",
  condition: "good",
  description: "Comfortable coach",
  driverAllowance: 2500,
  location: "Colombo",
  latitude: 6.9,
  longitude: 79.8,
  features: { gpsEnabled: true },
  amenities: ["wifi"],
  documents: [
    { type: "DRIVING_LICENSE", url: "u1", fileName: "license.pdf", fileSize: 1, status: "VERIFIED" },
    { type: "INSURANCE", url: "u2", fileName: "insurance.pdf", fileSize: 1, status: "PENDING" },
    { type: "REGISTRATION_CERTIFICATE", url: "u3", fileName: "reg.pdf", fileSize: 1, status: "PENDING" },
    { type: "OTHER", url: "u4", fileName: "other.pdf", fileSize: 1, status: "PENDING" },
  ],
  photos: [
    { id: "p1", url: "https://img/1.webp", fileName: "front.webp", isPrimary: true, sortOrder: 0, tag: "FRONT" },
    { id: "p2", url: "https://img/2.webp", fileName: "rear.webp" },
  ],
  ...overrides,
});

const config = {
  options: {
    vehicleTypes: [
      { value: "ORDINARY", label: "Ordinary" },
      { value: "SEMI_LUXURY", label: "Semi Luxury" },
      { value: "LUXURY_AC", label: "Luxury AC" },
    ],
    acTypes: [
      { value: "FULL_AC", label: "Full AC" },
      { value: "AC", label: "AC" },
      { value: "NON_AC", label: "Non AC" },
    ],
    conditions: [
      { value: "excellent", label: "Excellent" },
      { value: "good", label: "Good" },
    ],
    amenities: [
      { id: "wifi", label: "Wi-Fi" },
      { id: "tv", label: "TV" },
    ],
  },
};

const pricing = {
  ORDINARY: { pricePerDay: 18000, pricePerKm: 55, fuelCostPerKm: 20 },
  SEMI_LUXURY: { pricePerDay: 24000, pricePerKm: 65, fuelCostPerKm: 24 },
  LUXURY_AC: { pricePerDay: 32000, pricePerKm: 80, fuelCostPerKm: 32 },
};

const saveButton = () => screen.getByText("saveChanges").closest("button") as HTMLButtonElement;
const form = () => document.querySelector("form") as HTMLFormElement;
const selects = () => document.querySelectorAll("select");

const renderPage = async () => {
  render(<EditVehiclePage />);
  await screen.findByText(/editTitle/);
};

describe("EditVehiclePage", () => {
  beforeAll(() => {
    (URL as any).createObjectURL = vi.fn(() => "blob:preview");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    state.fileUploads = {};
    vehicles.getById.mockResolvedValue({ vehicle: vehicle() });
    vehicles.getTypePricing.mockResolvedValue({ pricing });
    landing.getPublicConfig.mockResolvedValue(config);
    vehicles.update.mockResolvedValue({});
    vehicles.uploadDocuments.mockResolvedValue({});
    vehicles.deletePhoto.mockResolvedValue({});
    vehicles.uploadPhotos.mockResolvedValue({});
  });

  it("shows a spinner without a user", () => {
    state.user = null;
    render(<EditVehiclePage />);
    expect(screen.queryByText(/editTitle/)).toBeNull();
  });

  it("hydrates the form from the vehicle and keeps save disabled until dirty", async () => {
    await renderPage();
    expect(vehicles.getById).toHaveBeenCalledWith("veh-1");
    expect(screen.getByText("editTitle — NB-1234")).toBeTruthy();
    expect((screen.getByLabelText("fieldBusName") as HTMLInputElement).value).toBe("Lanka Cruiser");
    expect((screen.getByLabelText("fieldYear") as HTMLInputElement).value).toBe("2020");
    await waitFor(() => expect(selects()[1].querySelectorAll("option").length).toBe(4));
    expect((selects()[1] as HTMLSelectElement).value).toBe("ac");
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("backToFleet").closest("a")?.getAttribute("href")).toBe("/en/owner/fleet");
  });

  it("accepts a bare vehicle response and reports load failures", async () => {
    vehicles.getById.mockResolvedValueOnce(vehicle({ documents: null, photos: null, year: null, seats: null, driverAllowance: null, features: null, amenities: null, latitude: undefined }));
    const first = render(<EditVehiclePage />);
    expect(await screen.findByText("editTitle — NB-1234")).toBeTruthy();
    first.unmount();

    vehicles.getById.mockRejectedValueOnce(new (ApiError as any)("Vehicle not found"));
    const second = render(<EditVehiclePage />);
    expect(await screen.findByText("Vehicle not found")).toBeTruthy();
    second.unmount();

    vehicles.getById.mockRejectedValueOnce(new Error("x"));
    render(<EditVehiclePage />);
    expect(await screen.findByText("errorUpdate")).toBeTruthy();
  });

  it("tolerates missing config and pricing", async () => {
    landing.getPublicConfig.mockResolvedValue({ options: {} });
    vehicles.getTypePricing.mockRejectedValue(new Error("x"));
    await renderPage();
    fireEvent.click(screen.getByText("sectionPricing"));
    expect(screen.getByText("platformPriceSelectType")).toBeTruthy();
  });

  it("tolerates a config failure", async () => {
    landing.getPublicConfig.mockRejectedValue(new Error("x"));
    vehicles.getTypePricing.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByText("busDetailsTitle")).toBeTruthy();
  });

  it("edits basic fields, locks AC for luxury, and saves without new uploads", async () => {
    await renderPage();
    await waitFor(() => expect(selects()[0].querySelectorAll("option").length).toBe(4));
    fireEvent.change(screen.getByLabelText("fieldBusName"), { target: { value: "Hill Cruiser" } });
    fireEvent.change(screen.getByLabelText("fieldDescription"), { target: { value: "Updated" } });
    fireEvent.change(selects()[2], { target: { value: "excellent" } });
    fireEvent.change(selects()[1], { target: { value: "non-ac" } });
    fireEvent.change(selects()[0], { target: { value: "LUXURY_AC" } });
    expect((selects()[1] as HTMLSelectElement).value).toBe("full-ac");
    expect((selects()[1] as HTMLSelectElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("location"), { target: { value: "Kan" } });
    act(() => state.location.onSelectLocation({ city: "", displayName: "Kandy, Central", lat: 7.29, lng: 80.63 }));
    expect((screen.getByLabelText("location") as HTMLInputElement).value).toBe("Kandy");

    fireEvent.click(screen.getByText("sectionPricing"));
    expect(screen.getByText("LKR 32,000")).toBeTruthy();
    expect(screen.getByText("LKR 80")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("fieldDriverAllowance"), { target: { value: "3000" } });

    await act(async () => fireEvent.click(saveButton()));
    expect(vehicles.update).toHaveBeenCalledWith("veh-1", {
      name: "Hill Cruiser",
      licensePlate: "NB-1234",
      type: "LUXURY_AC",
      brand: "Ashok",
      model: "Viking",
      year: 2020,
      seats: 45,
      color: "White",
      acType: "full-ac",
      condition: "excellent",
      description: "Updated",
      driverAllowance: 3000,
      location: "Kandy",
      latitude: 7.29,
      longitude: 80.63,
      amenities: ["wifi"],
      features: { gpsEnabled: true },
    });
    expect(vehicles.uploadDocuments).not.toHaveBeenCalled();
    expect(vehicles.deletePhoto).not.toHaveBeenCalled();
    expect(vehicles.uploadPhotos).not.toHaveBeenCalled();
    expect(state.push).toHaveBeenCalledWith("/en/owner/fleet");
  });

  it("removes and adds photos, retags them, uploads documents and saves", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("sectionPhotos"));
    expect(screen.getByText("Current Photos (2)")).toBeTruthy();
    expect(screen.getByText("Front")).toBeTruthy();
    expect(screen.getByText("photoPrimary")).toBeTruthy();

    const input = document.getElementById("photo-upload-edit") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByText("uploadZoneTitle").closest("button") as HTMLButtonElement);
    expect(clickSpy).toHaveBeenCalled();

    fireEvent.change(input, {
      target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.jpg", { type: "image/jpeg" })] },
    });
    expect(screen.getAllByAltText(/Vehicle \d/).length).toBe(2);
    fireEvent.click(screen.getAllByText("photoTagInterior")[1]);
    fireEvent.click(screen.getAllByText("photoTagSeats")[0]);
    fireEvent.click(screen.getAllByText("photoTagRear")[0]);
    fireEvent.click(screen.getAllByText("photoTagFront")[0]);
    fireEvent.click(screen.getAllByText("photoTagOther")[0]);
    fireEvent.click(screen.getAllByText("photoTagExterior")[0]);
    fireEvent.change(input, { target: { files: [new File(["c"], "c.jpg", { type: "image/jpeg" })] } });
    fireEvent.change(input, { target: { files: null } });
    const removeButtons = screen.getAllByLabelText("Remove photo");
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    fireEvent.click(screen.getAllByLabelText("Remove photo")[0]);
    expect(screen.getByText("Current Photos (1)")).toBeTruthy();

    fireEvent.click(screen.getByText("sectionDocuments"));
    expect(screen.getByTestId("upload-docLicense").textContent).toBe("existing:license.pdf");
    expect(screen.getByTestId("upload-docRegistration").textContent).toBe("existing:reg.pdf");
    const licenseFile = new File(["l"], "new-license.pdf", { type: "application/pdf" });
    const insuranceFile = new File(["i"], "new-ins.pdf", { type: "application/pdf" });
    const regFile = new File(["r"], "new-reg.pdf", { type: "application/pdf" });
    act(() => state.fileUploads.docLicense.onChange({ file: licenseFile }));
    act(() => state.fileUploads.docInsurance.onChange({ file: insuranceFile }));
    act(() => state.fileUploads.docRegistration.onChange({ file: regFile }));
    expect(screen.getByTestId("upload-docInsurance").textContent).toContain("new:new-ins.pdf");

    await act(async () => fireEvent.click(saveButton()));
    expect(vehicles.uploadDocuments).toHaveBeenCalledWith("veh-1", [
      { file: licenseFile, type: "DRIVING_LICENSE" },
      { file: insuranceFile, type: "INSURANCE" },
      { file: regFile, type: "REGISTRATION_CERTIFICATE" },
    ]);
    expect(vehicles.deletePhoto).toHaveBeenCalledWith("veh-1", "p1");
    const uploaded = vehicles.uploadPhotos.mock.calls[0][1];
    expect(uploaded.map((p: any) => [p.file.name, p.isPrimary, p.tag])).toEqual([
      ["a.jpg", false, "EXTERIOR"],
      ["b.jpg", false, "INTERIOR"],
    ]);
    expect(state.push).toHaveBeenCalledWith("/en/owner/fleet");
  });

  it("requires at least one photo and marks the first new photo primary when none remain", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("sectionPhotos"));
    fireEvent.click(screen.getAllByLabelText("Remove photo")[0]);
    fireEvent.click(screen.getAllByLabelText("Remove photo")[0]);
    expect(screen.getByText("errorPhotosRequired")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);

    await act(async () => fireEvent.submit(form()));
    expect(screen.getAllByText("errorPhotosRequired").length).toBe(2);
    expect(vehicles.deletePhoto).not.toHaveBeenCalled();
    expect(vehicles.update).not.toHaveBeenCalled();
    expect(vehicles.uploadDocuments).not.toHaveBeenCalled();
    expect(state.push).not.toHaveBeenCalled();

    const input = document.getElementById("photo-upload-edit") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["a"], "new.jpg", { type: "image/jpeg" })] } });
    await act(async () => fireEvent.click(saveButton()));
    expect(vehicles.deletePhoto).toHaveBeenCalledTimes(2);
    expect(vehicles.uploadPhotos.mock.calls[0][1][0]).toMatchObject({ isPrimary: true, tag: "EXTERIOR" });
  });

  it("manages amenities and GPS, and reports save errors", async () => {
    vehicles.update.mockRejectedValueOnce(new (ApiError as any)("Plate already registered")).mockRejectedValueOnce("x");
    await renderPage();
    fireEvent.click(screen.getByText("sectionAmenities"));
    await screen.findByText("TV");
    fireEvent.click(screen.getByText("TV"));
    fireEvent.click(screen.getByText("Wi-Fi"));
    const custom = screen.getByPlaceholderText("customAmenityPlaceholder");
    fireEvent.change(custom, { target: { value: "  USB  " } });
    fireEvent.keyDown(custom, { key: "Enter" });
    fireEvent.change(custom, { target: { value: "USB" } });
    fireEvent.click(screen.getByLabelText("addCustomAmenity"));
    fireEvent.change(custom, { target: { value: "Fridge" } });
    fireEvent.keyDown(custom, { key: "a" });
    fireEvent.click(screen.getByLabelText("addCustomAmenity"));
    fireEvent.change(custom, { target: { value: "   " } });
    fireEvent.click(screen.getByLabelText("addCustomAmenity"));
    fireEvent.click(screen.getByText("Fridge"));
    fireEvent.click(screen.getByRole("checkbox"));

    await act(async () => fireEvent.click(saveButton()));
    expect(vehicles.update.mock.calls[0][1]).toMatchObject({
      amenities: ["tv", "USB"],
      features: { gpsEnabled: false },
    });
    expect(screen.getByText("Plate already registered")).toBeTruthy();
    await act(async () => fireEvent.click(saveButton()));
    expect(screen.getByText("errorUpdate")).toBeTruthy();
  });

  it("sends undefined optionals when cleared", async () => {
    vehicles.getById.mockResolvedValueOnce({
      vehicle: vehicle({ color: "", condition: "", description: "", driverAllowance: null, latitude: null, longitude: null }),
    });
    await renderPage();
    fireEvent.change(screen.getByLabelText("fieldModel"), { target: { value: "Viking II" } });
    await act(async () => fireEvent.submit(form()));
    expect(vehicles.update.mock.calls[0][1]).toMatchObject({
      model: "Viking II",
      color: undefined,
      condition: undefined,
      description: undefined,
      driverAllowance: undefined,
      latitude: undefined,
      longitude: undefined,
    });
  });
});
