/**
 * Owner settings (password change, language switch, notification toggle)
 * and trip package pages (list + delete, create, edit).
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: { isLoading: false, isAuthorized: true },
  user: { firstName: "Kamal" } as any,
  params: { locale: "en", id: "pkg-1" } as any,
  pathname: "/en/owner/settings",
  push: vi.fn(),
  formProps: null as any,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => state.params,
  useRouter: () => ({ push: state.push, replace: vi.fn() }),
  usePathname: () => state.pathname,
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
vi.mock("@/components/features/account/AccountDangerZone", () => ({
  AccountDangerZone: ({ locale }: { locale: string }) => <div data-testid="danger-zone">{locale}</div>,
}));
vi.mock("@/components/features/owner/TripPackageForm", () => ({
  TripPackageForm: (props: any) => {
    state.formProps = props;
    return <div data-testid="package-form">{props.initialData?.title ?? "new"}</div>;
  },
}));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {}
  return {
    ApiError,
    authService: { changePassword: vi.fn() },
    tripPackageService: { getMyPackages: vi.fn(), delete: vi.fn(), create: vi.fn(), getById: vi.fn(), update: vi.fn() },
    vehicleService: { getMyVehicles: vi.fn() },
  };
});

import { ApiError, authService, tripPackageService, vehicleService } from "@/lib/api";
import OwnerSettingsPage from "@/app/[locale]/owner/settings/page";
import OwnerPackagesPage from "@/app/[locale]/owner/packages/page";
import NewTripPackagePage from "@/app/[locale]/owner/packages/new/page";
import EditTripPackagePage from "@/app/[locale]/owner/packages/[id]/edit/page";

const auth = authService as any;
const packages = tripPackageService as any;
const vehicles = vehicleService as any;
const Err = ApiError as any;

const pkg = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Package ${id}`,
  startLocation: "Colombo",
  endLocation: "Ella",
  durationDays: 3,
  minPassengers: 10,
  maxPassengers: 40,
  price: 150000,
  isActive: true,
  vehicle: { name: "Lanka Cruiser", photos: [{ url: "https://img/p2.webp", isPrimary: false }, { url: "https://img/p1.webp", isPrimary: true }] },
  ...overrides,
});

const pkgData = {
  vehicleId: "veh-1",
  title: "Hill country",
  startLocation: "Kandy",
  endLocation: "Ella",
  durationDays: 2,
  price: 90000,
  minPassengers: 5,
  maxPassengers: 30,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.guard = { isLoading: false, isAuthorized: true };
  state.user = { firstName: "Kamal" };
  state.params = { locale: "en", id: "pkg-1" };
  state.pathname = "/en/owner/settings";
  state.formProps = null;
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OwnerSettingsPage", () => {
  const fill = (current: string, next: string, confirm: string) => {
    const [a, b, c] = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    fireEvent.change(a, { target: { value: current } });
    fireEvent.change(b, { target: { value: next } });
    fireEvent.change(c, { target: { value: confirm } });
  };

  it("rejects mismatched passwords without calling the API", async () => {
    render(<OwnerSettingsPage />);
    expect((screen.getByText("updatePassword").closest("button") as HTMLButtonElement).disabled).toBe(true);
    fill("Old123!", "New123!", "Other123!");
    await act(async () => fireEvent.click(screen.getByText("updatePassword")));
    expect(screen.getByText(/errors.passwordMismatch/)).toBeTruthy();
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it("changes the password and clears the form", async () => {
    auth.changePassword.mockResolvedValue({});
    render(<OwnerSettingsPage />);
    fill("Old123!", "New123!", "New123!");
    await act(async () => fireEvent.click(screen.getByText("updatePassword")));
    expect(auth.changePassword).toHaveBeenCalledWith("Old123!", "New123!");
    expect(screen.getByText("passwordChanged")).toBeTruthy();
    expect((document.querySelector('input[type="password"]') as HTMLInputElement).value).toBe("");
  });

  it("shows API and unexpected password errors", async () => {
    auth.changePassword.mockRejectedValueOnce(new Err("Current password is wrong")).mockRejectedValueOnce(new Error("x"));
    render(<OwnerSettingsPage />);
    fill("bad", "New123!", "New123!");
    await act(async () => fireEvent.click(screen.getByText("updatePassword")));
    expect(screen.getByText("Current password is wrong")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("updatePassword")));
    expect(screen.getByText(/errors.unexpected/)).toBeTruthy();
  });

  it("switches language, offers no unsaved preferences and renders the danger zone", async () => {
    state.params = { locale: "en" };
    state.pathname = "/en/owner/settings";
    render(<OwnerSettingsPage />);
    const language = screen.getAllByLabelText("language")[0] as HTMLSelectElement;
    fireEvent.change(language, { target: { value: "en" } });
    expect(state.push).not.toHaveBeenCalled();
    await act(async () => fireEvent.change(language, { target: { value: "si" } }));
    expect(state.push).toHaveBeenCalledWith("/si/owner/settings");
    expect(screen.queryByLabelText("emailNotifications")).toBeNull();
    expect(screen.queryByLabelText("currency")).toBeNull();
    expect(screen.getByTestId("danger-zone").textContent).toBe("en");
  });

  it("defaults the locale when the param is missing", () => {
    state.params = {};
    render(<OwnerSettingsPage />);
    expect((screen.getAllByLabelText("language")[0] as HTMLSelectElement).value).toBe("en");
  });
});

describe("OwnerPackagesPage", () => {
  beforeEach(() => {
    packages.getMyPackages.mockResolvedValue({
      packages: [
        pkg("1"),
        pkg("2", { isActive: false, vehicle: { name: null, images: ["https://img/legacy.jpg"] } }),
        pkg("3", { vehicle: null }),
      ],
    });
    packages.delete.mockResolvedValue({});
  });

  it("is gated by guard and user", () => {
    state.user = null;
    render(<OwnerPackagesPage />);
    expect(packages.getMyPackages).not.toHaveBeenCalled();
  });

  it("lists packages with images, status and links", async () => {
    render(<OwnerPackagesPage />);
    expect(await screen.findByText("Package 1")).toBeTruthy();
    expect(screen.getByText('count:{"count":3}')).toBeTruthy();
    expect(screen.getByAltText("Lanka Cruiser").getAttribute("src")).toBe("https://img/p1.webp");
    expect(screen.getAllByAltText("vehicleFallback")[0].getAttribute("src")).toBe("https://img/legacy.jpg");
    expect(screen.getByText("inactive")).toBeTruthy();
    expect(screen.getAllByText("LKR 150,000").length).toBe(3);
    expect(screen.getAllByText("edit")[0].closest("a")?.getAttribute("href")).toBe("/en/owner/packages/1/edit");
  });

  it("shows the empty state, singular count and load errors", async () => {
    packages.getMyPackages.mockResolvedValueOnce({});
    const first = render(<OwnerPackagesPage />);
    expect(await screen.findByText("empty")).toBeTruthy();
    first.unmount();

    packages.getMyPackages.mockResolvedValueOnce({ packages: [pkg("1")] });
    const second = render(<OwnerPackagesPage />);
    expect(await screen.findByText('count:{"count":1}')).toBeTruthy();
    second.unmount();

    packages.getMyPackages.mockRejectedValueOnce(new Err("Packages offline"));
    const third = render(<OwnerPackagesPage />);
    expect(await screen.findByText("Packages offline")).toBeTruthy();
    third.unmount();

    packages.getMyPackages.mockRejectedValueOnce(new Error("x"));
    render(<OwnerPackagesPage />);
    expect(await screen.findByText("errors.load")).toBeTruthy();
  });

  it("deletes after confirmation and explains failures on the page", async () => {
    packages.delete.mockRejectedValueOnce(new Err("Package has bookings")).mockRejectedValueOnce(new Error("x"));
    render(<OwnerPackagesPage />);
    await screen.findByText("Package 1");
    const confirmDelete = async () => {
      fireEvent.click(screen.getAllByText("delete")[0].closest("button")!);
      const dialog = await screen.findByRole("dialog");
      await act(async () => fireEvent.click(within(dialog).getByText("delete", { selector: "button" })));
    };
    await confirmDelete();
    expect(screen.getByRole("alert").textContent).toBe("Package has bookings");
    await confirmDelete();
    expect(screen.getByRole("alert").textContent).toBe("errors.delete");
    await confirmDelete();
    expect(packages.delete).toHaveBeenLastCalledWith("1");
    expect(packages.getMyPackages).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getAllByText("delete")[0].closest("button")!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("NewTripPackagePage", () => {
  it("is gated by the guard", () => {
    state.guard = { isLoading: true, isAuthorized: false };
    render(<NewTripPackagePage />);
    expect(vehicles.getMyVehicles).not.toHaveBeenCalled();
  });

  it("asks for a vehicle first when the fleet is empty", async () => {
    vehicles.getMyVehicles.mockResolvedValue({});
    render(<NewTripPackagePage />);
    expect(await screen.findByText("needVehicle")).toBeTruthy();
    expect(screen.getByText("addVehicle").closest("a")?.getAttribute("href")).toBe("/en/owner/fleet/add");
  });

  it("shows vehicle load errors", async () => {
    vehicles.getMyVehicles.mockRejectedValueOnce(new Err("Fleet offline"));
    const first = render(<NewTripPackagePage />);
    expect(await screen.findByText("Fleet offline")).toBeTruthy();
    first.unmount();
    vehicles.getMyVehicles.mockRejectedValueOnce(new Error("x"));
    render(<NewTripPackagePage />);
    expect(await screen.findByText("errors.vehicles")).toBeTruthy();
  });

  it("creates a package and redirects, explaining failures on the page", async () => {
    vehicles.getMyVehicles.mockResolvedValue({ vehicles: [{ id: "veh-1" }] });
    packages.create.mockRejectedValueOnce(new Err("Title taken")).mockRejectedValueOnce(new Error("x")).mockResolvedValue({});
    render(<NewTripPackagePage />);
    expect(await screen.findByTestId("package-form")).toBeTruthy();
    expect(state.formProps.vehicles).toEqual([{ id: "veh-1" }]);
    await act(async () => state.formProps.onSubmit(pkgData));
    expect(screen.getByRole("alert").textContent).toBe("Title taken");
    await act(async () => state.formProps.onSubmit(pkgData));
    expect(screen.getByRole("alert").textContent).toBe("errors.create");
    await act(async () => state.formProps.onSubmit(pkgData));
    expect(packages.create).toHaveBeenLastCalledWith(pkgData);
    expect(state.push).toHaveBeenCalledWith("/en/owner/packages");
  });
});

describe("EditTripPackagePage", () => {
  it("is gated by the guard", () => {
    state.guard = { isLoading: false, isAuthorized: false };
    render(<EditTripPackagePage />);
    expect(packages.getById).not.toHaveBeenCalled();
  });

  it("loads the package and updates it", async () => {
    vehicles.getMyVehicles.mockResolvedValue({});
    packages.getById.mockResolvedValue({ tripPackage: pkg("pkg-1") });
    packages.update.mockRejectedValueOnce(new Err("Invalid price")).mockRejectedValueOnce(new Error("x")).mockResolvedValue({});
    render(<EditTripPackagePage />);
    expect((await screen.findByTestId("package-form")).textContent).toBe("Package pkg-1");
    expect(packages.getById).toHaveBeenCalledWith("pkg-1");
    expect(state.formProps.vehicles).toEqual([]);
    await act(async () => state.formProps.onSubmit(pkgData));
    expect(screen.getByRole("alert").textContent).toBe("Invalid price");
    await act(async () => state.formProps.onSubmit(pkgData));
    expect(screen.getByRole("alert").textContent).toBe("errors.update");
    await act(async () => state.formProps.onSubmit(pkgData));
    expect(packages.update).toHaveBeenLastCalledWith("pkg-1", pkgData);
    expect(state.push).toHaveBeenCalledWith("/en/owner/packages");
  });

  it("shows not-found and load errors", async () => {
    vehicles.getMyVehicles.mockResolvedValue({ vehicles: [] });
    packages.getById.mockResolvedValueOnce({ tripPackage: null });
    const first = render(<EditTripPackagePage />);
    expect(await screen.findByText("notFound")).toBeTruthy();
    first.unmount();

    packages.getById.mockRejectedValueOnce(new Err("Not yours"));
    const second = render(<EditTripPackagePage />);
    expect(await screen.findByText("Not yours")).toBeTruthy();
    second.unmount();

    packages.getById.mockRejectedValueOnce(new Error("x"));
    render(<EditTripPackagePage />);
    expect(await screen.findByText("errors.details")).toBeTruthy();
  });
});
