/**
 * Admin platform settings page: loading/error states, tab navigation,
 * client-side validation and the merged payload sent to the API.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getPlatformSettings: vi.fn(),
    updatePlatformSettings: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminSettingsPage from "@/app/[locale]/admin/settings/page";

const svc = adminService as any;

const baseSettings = (overrides: Record<string, unknown> = {}) => ({
  id: "settings-1",
  generalSettings: {
    platformName: "TraveNest",
    supportEmail: "help@travenest.lk",
    extraGeneral: "keep-me",
  },
  notificationSettings: { emailEnabled: true, smsEnabled: false, inAppEnabled: true },
  paymentSettings: { provider: "payhere", settlementWindowDays: "10" },
  bookingSettings: { autoCancelUnpaidHours: 12, refundWindowHours: "bad" },
  securitySettings: { requireStrongPasswords: true, sessionTimeoutMinutes: 30 },
  mapSettings: { defaultCountry: "LK", defaultCity: "Kandy" },
  pricingSettings: {
    ORDINARY: { pricePerDay: 20000, pricePerKm: "60", fuelCostPerKm: 22 },
  },
  maintenanceMode: false,
  maintenanceMessage: null,
  updatedAt: "2026-10-01T10:00:00.000Z",
  updatedByAdmin: { firstName: "Super", lastName: "Admin" },
  ...overrides,
});

const getSaveButton = () => screen.getByText("actions.save").closest("button") as HTMLButtonElement;

const renderLoaded = async (settings = baseSettings()) => {
  svc.getPlatformSettings.mockResolvedValue(settings);
  render(<AdminSettingsPage />);
  await screen.findByText("title");
};

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a spinner while loading, then the form", async () => {
    let resolve: (value: unknown) => void = () => {};
    svc.getPlatformSettings.mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = render(<AdminSettingsPage />);
    expect(screen.queryByText("title")).toBeNull();
    expect(container.querySelector(".animate-spin, svg")).toBeTruthy();
    await act(async () => resolve(baseSettings()));
    expect(screen.getByText("title")).toBeTruthy();
    expect(screen.getByText("lastUpdated")).toBeTruthy();
  });

  it("shows the API error when settings cannot be loaded", async () => {
    svc.getPlatformSettings.mockRejectedValue(new Error("Settings offline"));
    render(<AdminSettingsPage />);
    expect(await screen.findByText("Settings offline")).toBeTruthy();
  });

  it("falls back to a generic error for non-Error rejections", async () => {
    svc.getPlatformSettings.mockRejectedValue("nope");
    render(<AdminSettingsPage />);
    expect(await screen.findByText("Failed to load platform settings")).toBeTruthy();
  });

  it("hydrates the general tab from settings with defaults for missing keys", async () => {
    await renderLoaded();
    expect((screen.getByDisplayValue("TraveNest") as HTMLInputElement).value).toBe("TraveNest");
    expect(screen.getByDisplayValue("help@travenest.lk")).toBeTruthy();
    expect(screen.getByDisplayValue("+94 11 234 5678")).toBeTruthy();
    expect(getSaveButton().disabled).toBe(true);
    expect(screen.queryByText("badges.unsaved")).toBeNull();
  });

  it("hides last-updated info when neither timestamp nor admin exists", async () => {
    await renderLoaded(baseSettings({ updatedAt: null, updatedByAdmin: null }));
    expect(screen.queryByText("lastUpdated")).toBeNull();
  });

  it("marks the form dirty, reverts and reloads", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "TN" } });
    expect(screen.getByText("badges.unsaved")).toBeTruthy();
    expect(getSaveButton().disabled).toBe(false);

    fireEvent.click(screen.getByText("actions.revert"));
    expect(screen.getByDisplayValue("TraveNest")).toBeTruthy();
    expect(screen.queryByText("badges.unsaved")).toBeNull();

    fireEvent.click(screen.getByText("actions.reload"));
    await waitFor(() => expect(svc.getPlatformSettings).toHaveBeenCalledTimes(2));
  });

  it("validates platform name and support email", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "  " } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(screen.getByText("errors.platformNameRequired")).toBeTruthy();

    fireEvent.change(document.querySelector('input[maxlength="120"]') as HTMLInputElement, { target: { value: "TN" } });
    fireEvent.change(screen.getByDisplayValue("help@travenest.lk"), { target: { value: "bad-email" } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(screen.getByText("errors.supportEmailInvalid")).toBeTruthy();
    expect(svc.updatePlatformSettings).not.toHaveBeenCalled();
  });

  it("validates the settlement window and jumps to the payment tab", async () => {
    await renderLoaded(baseSettings({ paymentSettings: { settlementWindowDays: 90 } }));
    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "TN2" } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(screen.getByText("errors.settlementWindowRange")).toBeTruthy();
    expect(screen.getByText("payment.provider.label")).toBeTruthy();
  });

  it("validates booking refund windows", async () => {
    await renderLoaded(
      baseSettings({ bookingSettings: { refundFullHours: 10, refundPartialHours: 20 } }),
    );
    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "TN2" } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(screen.getByText("errors.bookingHoursInvalid")).toBeTruthy();
    expect(screen.getByText("booking.autoCancel.label")).toBeTruthy();
  });

  it("validates the session timeout", async () => {
    await renderLoaded(baseSettings({ securitySettings: { sessionTimeoutMinutes: 2 } }));
    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "TN2" } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(screen.getByText("errors.sessionTimeoutRange")).toBeTruthy();
    expect(screen.getByText("security.strongPasswords.label")).toBeTruthy();
  });

  it("validates the maintenance message length", async () => {
    await renderLoaded(
      baseSettings({ maintenanceMode: true, maintenanceMessage: "x".repeat(1001) }),
    );
    expect(screen.getByText("maintenance.activeWarning")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "TN2" } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(screen.getByText("errors.maintenanceMessageTooLong")).toBeTruthy();
  });

  it("validates vehicle pricing", async () => {
    await renderLoaded(
      baseSettings({ pricingSettings: { SEMI_LUXURY: { pricePerDay: 0 } } }),
    );
    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "TN2" } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(screen.getByText("errors.pricingInvalid")).toBeTruthy();
    expect(screen.getByText("pricing.intro")).toBeTruthy();
  });

  it("edits every tab and saves a merged payload", async () => {
    await renderLoaded();
    const updated = baseSettings({ updatedAt: "2026-10-02T10:00:00.000Z" });
    svc.updatePlatformSettings.mockResolvedValue(updated);

    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "TraveNest LK" } });
    fireEvent.change(screen.getByDisplayValue("+94 11 234 5678"), { target: { value: "+94 77 000 0000" } });
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "si" } });
    fireEvent.change(selects[1], { target: { value: "USD" } });

    fireEvent.click(screen.getByText("tabs.notifications"));
    const toggles = screen.getAllByRole("checkbox");
    // first checkbox is the maintenance switch; the three toggles follow
    fireEvent.click(toggles[1]);
    fireEvent.click(toggles[2]);
    fireEvent.click(toggles[3]);

    fireEvent.click(screen.getByText("tabs.payment"));
    fireEvent.change(document.querySelector("select") as HTMLSelectElement, {
      target: { value: "bank_transfer" },
    });
    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "14" } });

    fireEvent.click(screen.getByText("tabs.booking"));
    const bookingInputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(bookingInputs[0], { target: { value: "6" } });
    fireEvent.change(bookingInputs[1], { target: { value: "" } });
    fireEvent.change(bookingInputs[2], { target: { value: "400" } });
    fireEvent.change(bookingInputs[3], { target: { value: "100" } });
    fireEvent.change(bookingInputs[4], { target: { value: "40" } });

    fireEvent.click(screen.getByText("tabs.security"));
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.change(screen.getByDisplayValue("30"), { target: { value: "45" } });

    fireEvent.click(screen.getByText("tabs.map"));
    fireEvent.change(screen.getByDisplayValue("LK"), { target: { value: "IN" } });
    fireEvent.change(screen.getByDisplayValue("Kandy"), { target: { value: "Galle" } });

    fireEvent.click(screen.getByText("tabs.pricing"));
    const priceInputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(priceInputs).toHaveLength(9);
    fireEvent.change(priceInputs[0], { target: { value: "21000" } });
    fireEvent.change(priceInputs[1], { target: { value: "-5" } });
    fireEvent.change(priceInputs[2], { target: { value: "abc" } });

    const maintenance = screen.getByLabelText("maintenance.toggleLabel");
    fireEvent.click(maintenance);
    fireEvent.change(screen.getByPlaceholderText("maintenance.messagePlaceholder"), {
      target: { value: "  Back soon  " },
    });

    await act(async () => fireEvent.click(getSaveButton()));

    expect(svc.updatePlatformSettings).toHaveBeenCalledTimes(1);
    const payload = svc.updatePlatformSettings.mock.calls[0][0];
    expect(payload.generalSettings).toEqual({
      platformName: "TraveNest LK",
      supportEmail: "help@travenest.lk",
      supportPhone: "+94 77 000 0000",
      defaultLocale: "si",
      defaultCurrency: "USD",
      extraGeneral: "keep-me",
    });
    expect(payload.notificationSettings).toEqual({
      emailEnabled: false,
      smsEnabled: true,
      inAppEnabled: false,
    });
    expect(payload.paymentSettings).toEqual({ provider: "bank_transfer", settlementWindowDays: 14 });
    expect(payload.bookingSettings).toEqual({
      autoCancelUnpaidHours: 6,
      refundWindowHours: 48,
      refundFullHours: 400,
      refundPartialHours: 100,
      refundPartialPercent: 40,
    });
    expect(payload.securitySettings).toEqual({ requireStrongPasswords: false, sessionTimeoutMinutes: 45 });
    expect(payload.mapSettings).toEqual({ defaultCountry: "IN", defaultCity: "Galle" });
    expect(payload.pricingSettings.ORDINARY).toEqual({ pricePerDay: 21000, pricePerKm: 0, fuelCostPerKm: 0 });
    expect(payload.pricingSettings.LUXURY_AC).toEqual({ pricePerDay: 32000, pricePerKm: 80, fuelCostPerKm: 32 });
    expect(payload.maintenanceMode).toBe(true);
    expect(payload.maintenanceMessage).toBe("Back soon");
  });

  it("surfaces a server error after a failed save", async () => {
    await renderLoaded(
      baseSettings({
        generalSettings: null,
        notificationSettings: null,
        paymentSettings: null,
        bookingSettings: null,
        securitySettings: null,
        mapSettings: null,
        pricingSettings: null,
        maintenanceMode: undefined,
      }),
    );
    svc.updatePlatformSettings.mockRejectedValue(new Error("Save exploded"));
    fireEvent.change(screen.getByDisplayValue("TravelNest"), { target: { value: "TN" } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(await screen.findByText("Save exploded")).toBeTruthy();
  });

  it("uses a generic save error for non-Error rejections", async () => {
    await renderLoaded();
    svc.updatePlatformSettings.mockRejectedValue("x");
    fireEvent.change(screen.getByDisplayValue("TraveNest"), { target: { value: "TN" } });
    await act(async () => fireEvent.click(getSaveButton()));
    expect(await screen.findByText("Failed to update platform settings")).toBeTruthy();
  });
});
