/**
 * Owner add-vehicle wizard: per-step validation, platform pricing lookup,
 * photo tagging, required documents, amenities, draft save and the full
 * publish sequence (create -> documents -> photos -> redirect).
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
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
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: state.push, replace: vi.fn() }),
  usePathname: () => "/en/owner/fleet/add",
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
      return <div data-testid={`upload-${props.label}`}>{props.value ? props.value.file.name : "empty"}</div>;
    },
    LocationAutocomplete: (props: any) => {
      state.location = props;
      return <input aria-label="location" value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
    },
  };
});
vi.mock("@/lib/api", () => ({
  vehicleService: {
    getTypePricing: vi.fn(),
    create: vi.fn(),
    uploadDocuments: vi.fn(),
    uploadPhotos: vi.fn(),
  },
  landingContentService: { getPublicConfig: vi.fn() },
}));

import { landingContentService, vehicleService } from "@/lib/api";
import AddVehiclePage from "@/app/[locale]/owner/fleet/add/page";

const vehicles = vehicleService as any;
const landing = landingContentService as any;

const config = {
  options: {
    vehicleTypes: [
      { value: "ORDINARY", label: "Ordinary" },
      { value: "LUXURY_AC", label: "Luxury AC" },
    ],
    acTypes: [
      { value: "FULL_AC", label: "Full AC" },
      { value: "NON_AC", label: "Non AC" },
    ],
    conditions: [{ value: "good", label: "Good" }],
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

const selects = () => document.querySelectorAll("select");
const next = () => fireEvent.click(screen.getByText("next"));

const fillBasics = async () => {
  await screen.findByText("Ordinary");
  fireEvent.change(screen.getByLabelText("fieldBusName"), { target: { value: "Lanka Cruiser" } });
  fireEvent.change(screen.getByLabelText("fieldRegistration"), { target: { value: "nb-1234" } });
  fireEvent.change(selects()[0], { target: { value: "ORDINARY" } });
  fireEvent.change(screen.getByLabelText("fieldMake"), { target: { value: "Ashok" } });
  fireEvent.change(screen.getByLabelText("fieldModel"), { target: { value: "Viking" } });
  fireEvent.change(screen.getByLabelText("fieldYear"), { target: { value: "2021" } });
  fireEvent.change(screen.getByLabelText("fieldCapacity"), { target: { value: "45" } });
  fireEvent.change(screen.getByLabelText("fieldColor"), { target: { value: "Blue" } });
  fireEvent.change(selects()[1], { target: { value: "non-ac" } });
  fireEvent.change(selects()[2], { target: { value: "good" } });
  fireEvent.change(screen.getByLabelText("location"), { target: { value: "Col" } });
  act(() => state.location.onSelectLocation({ city: "Colombo", displayName: "Colombo, Western", lat: 6.9, lng: 79.8 }));
  fireEvent.change(screen.getByLabelText("fieldDescription"), { target: { value: "Clean bus" } });
};

const docFiles = {
  license: new File(["l"], "license.pdf", { type: "application/pdf" }),
  insurance: new File(["i"], "insurance.pdf", { type: "application/pdf" }),
  reg: new File(["r"], "reg.pdf", { type: "application/pdf" }),
};

describe("AddVehiclePage", () => {
  beforeAll(() => {
    (URL as any).createObjectURL = vi.fn(() => "blob:preview");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.guard = { isLoading: false, isAuthorized: true };
    state.user = { firstName: "Kamal" };
    state.fileUploads = {};
    landing.getPublicConfig.mockResolvedValue(config);
    vehicles.getTypePricing.mockResolvedValue({ pricing });
    vehicles.create.mockResolvedValue({ id: "veh-new" });
    vehicles.uploadDocuments.mockResolvedValue({});
    vehicles.uploadPhotos.mockResolvedValue({});
  });

  it("waits for an authorised user", () => {
    state.guard = { isLoading: false, isAuthorized: false };
    render(<AddVehiclePage />);
    expect(screen.queryByText("addTitle")).toBeNull();
  });

  it("validates required basics before moving on", async () => {
    render(<AddVehiclePage />);
    await screen.findByText("Ordinary");
    next();
    expect(screen.getAllByText("errorRequired").length).toBe(9);
    expect(screen.getByText("busDetailsTitle")).toBeTruthy();
  });

  it("walks every step, validating photos and documents, then publishes", async () => {
    render(<AddVehiclePage />);
    await fillBasics();
    fireEvent.change(selects()[0], { target: { value: "LUXURY_AC" } });
    expect((selects()[1] as HTMLSelectElement).value).toBe("full-ac");
    next();

    expect(screen.getByText("pricingTitle")).toBeTruthy();
    expect(screen.getByText("LKR 32,000")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("fieldDriverAllowance"), { target: { value: "2500" } });
    fireEvent.click(screen.getByText("back"));
    expect(screen.getByText("busDetailsTitle")).toBeTruthy();
    next();
    next();

    expect(screen.getByText("photosTitle")).toBeTruthy();
    next();
    expect(screen.getByText("errorPhotosRequired")).toBeTruthy();
    const input = document.getElementById("photo-upload") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByText("uploadZoneTitle").closest("button") as HTMLButtonElement);
    expect(clickSpy).toHaveBeenCalled();
    fireEvent.change(input, {
      target: {
        files: [
          new File(["a"], "a.jpg", { type: "image/jpeg" }),
          new File(["b"], "b.jpg", { type: "image/jpeg" }),
          new File(["c"], "c.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.change(input, { target: { files: null } });
    expect(screen.getByText("photoPrimary")).toBeTruthy();
    fireEvent.click(screen.getAllByText("photoTagFront")[0]);
    fireEvent.click(screen.getAllByText("photoTagInterior")[1]);
    fireEvent.click(screen.getAllByText("photoTagRear")[2]);
    fireEvent.click(screen.getAllByText("photoTagSeats")[2]);
    fireEvent.click(screen.getAllByText("photoTagOther")[2]);
    fireEvent.click(screen.getAllByText("photoTagExterior")[2]);
    fireEvent.click(screen.getAllByLabelText("Remove photo")[2]);
    next();

    expect(screen.getByText("documentsTitle")).toBeTruthy();
    next();
    expect(screen.getByText("errorDocRequired")).toBeTruthy();
    act(() => state.fileUploads.docLicense.onChange({ file: docFiles.license }));
    act(() => state.fileUploads.docInsurance.onChange({ file: docFiles.insurance }));
    act(() => state.fileUploads.docRegistration.onChange({ file: docFiles.reg }));
    expect(screen.getByTestId("upload-docRegistration").textContent).toBe("reg.pdf");
    next();

    expect(screen.getByText("amenitiesTitle")).toBeTruthy();
    fireEvent.click(screen.getByText("Wi-Fi"));
    fireEvent.click(screen.getByText("TV"));
    fireEvent.click(screen.getByText("TV"));
    const custom = screen.getByPlaceholderText("customAmenityPlaceholder");
    fireEvent.change(custom, { target: { value: " Charging " } });
    fireEvent.keyDown(custom, { key: "Enter" });
    fireEvent.change(custom, { target: { value: "Charging" } });
    fireEvent.click(screen.getByLabelText("addCustomAmenity"));
    fireEvent.keyDown(custom, { key: "x" });
    fireEvent.click(screen.getByText("Charging"));
    fireEvent.click(screen.getByText("Charging"));
    fireEvent.click(screen.getByRole("checkbox"));

    await act(async () => fireEvent.submit(document.querySelector("form") as HTMLFormElement));
    expect(vehicles.create).toHaveBeenCalledWith({
      name: "Lanka Cruiser",
      licensePlate: "NB-1234",
      type: "LUXURY_AC",
      brand: "Ashok",
      model: "Viking",
      year: 2021,
      seats: 45,
      color: "Blue",
      acType: "full-ac",
      condition: "good",
      fuelType: "DIESEL",
      transmission: "MANUAL",
      driverAllowance: 2500,
      location: "Colombo",
      latitude: 6.9,
      longitude: 79.8,
      description: "Clean bus",
      amenities: ["wifi", "Charging"],
      features: { gpsEnabled: true },
    });
    expect(vehicles.uploadDocuments).toHaveBeenCalledWith("veh-new", [
      { file: docFiles.license, type: "DRIVING_LICENSE" },
      { file: docFiles.insurance, type: "INSURANCE" },
      { file: docFiles.reg, type: "REGISTRATION_CERTIFICATE" },
    ]);
    expect(vehicles.uploadPhotos.mock.calls[0][1].map((p: any) => [p.file.name, p.isPrimary, p.tag])).toEqual([
      ["a.jpg", true, "FRONT"],
      ["b.jpg", false, "INTERIOR"],
    ]);
    expect(state.push).toHaveBeenCalledWith("/en/owner/fleet");
  });

  it("saves a draft from the last step and surfaces errors", async () => {
    vehicles.create.mockRejectedValueOnce(new Error("Plate exists")).mockRejectedValueOnce({});
    render(<AddVehiclePage />);
    await fillBasics();
    fireEvent.change(screen.getByLabelText("location"), { target: { value: "Galle" } });
    next();
    expect(screen.getByText("LKR 18,000")).toBeTruthy();
    next();
    fireEvent.change(document.getElementById("photo-upload") as HTMLInputElement, {
      target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" })] },
    });
    next();
    act(() => state.fileUploads.docLicense.onChange({ file: docFiles.license }));
    act(() => state.fileUploads.docInsurance.onChange({ file: docFiles.insurance }));
    act(() => state.fileUploads.docRegistration.onChange({ file: docFiles.reg }));
    next();

    await act(async () => fireEvent.click(screen.getByText("saveDraft")));
    expect(screen.getByText("Plate exists")).toBeTruthy();
    expect(vehicles.create.mock.calls[0][0]).toMatchObject({ location: "Galle", latitude: undefined, driverAllowance: undefined });
    await act(async () => fireEvent.click(screen.getByText("saveDraft")));
    expect(screen.getByText("errorCreate")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("saveDraft")));
    expect(vehicles.uploadDocuments).not.toHaveBeenCalled();
    expect(state.push).toHaveBeenCalledWith("/en/owner/fleet");
  });

  it("returns to the documents step if documents are cleared before publishing and reports publish errors", async () => {
    vehicles.create.mockRejectedValueOnce(new Error("Server busy"));
    render(<AddVehiclePage />);
    await fillBasics();
    next();
    next();
    fireEvent.change(document.getElementById("photo-upload") as HTMLInputElement, {
      target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" })] },
    });
    next();
    act(() => state.fileUploads.docLicense.onChange({ file: docFiles.license }));
    act(() => state.fileUploads.docInsurance.onChange({ file: docFiles.insurance }));
    act(() => state.fileUploads.docRegistration.onChange({ file: docFiles.reg }));
    next();
    expect(screen.getByText("amenitiesTitle")).toBeTruthy();
    await act(async () => fireEvent.submit(document.querySelector("form") as HTMLFormElement));
    expect(screen.getByText("Server busy")).toBeTruthy();

    fireEvent.click(screen.getByText("back"));
    act(() => state.fileUploads.docInsurance.onChange(null));
    fireEvent.click(screen.getByText("back"));
    fireEvent.click(screen.getByText("next"));
    fireEvent.click(screen.getByText("next"));
    expect(screen.getByText("errorDocRequired")).toBeTruthy();
  });

  it("blocks publish without documents even when submitted directly", async () => {
    render(<AddVehiclePage />);
    await screen.findByText("Ordinary");
    await act(async () => fireEvent.submit(document.querySelector("form") as HTMLFormElement));
    expect(screen.getByText("documentsTitle")).toBeTruthy();
    expect(screen.getByText("errorDocRequired")).toBeTruthy();
    expect(vehicles.create).not.toHaveBeenCalled();
  });

  it("tolerates config and pricing failures", async () => {
    landing.getPublicConfig.mockRejectedValue(new Error("x"));
    vehicles.getTypePricing.mockResolvedValue(null);
    render(<AddVehiclePage />);
    expect(screen.getByText("addTitle")).toBeTruthy();
  });

  it("tolerates empty config options and a pricing error", async () => {
    landing.getPublicConfig.mockResolvedValue({ options: {} });
    vehicles.getTypePricing.mockRejectedValue(new Error("x"));
    render(<AddVehiclePage />);
    expect(screen.getByText("addTitle")).toBeTruthy();
  });
});
