/**
 * Customer settings page: change-password validation/submit, language switch
 * routing and the notification toggle.
 */
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Generous async timeout: these suites run alongside other heavy jsdom suites.
configure({ asyncUtilTimeout: 5000 });

const h = vi.hoisted(() => ({
  push: vi.fn(),
  params: { locale: "en" } as Record<string, string>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values && "defaultValue" in values ? `${key}|${values.defaultValue}` : key,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  usePathname: () => "/en/dashboard/settings",
  useParams: () => h.params,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/[locale]/dashboard/DashboardLayoutClient", () => ({
  DashboardLayoutClient: ({ children }: any) => <>{children}</>,
}));
vi.mock("@/lib/api", async (importOriginal: any) => ({
  ...(await importOriginal()),
  authService: { changePassword: vi.fn() },
}));

import CustomerSettingsPage from "@/app/[locale]/dashboard/settings/page";
import { ApiError, authService } from "@/lib/api";

const change = authService.changePassword as any;

const passwordInputs = () => Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
const fill = (current: string, next: string, confirm: string) => {
  const [a, b, c] = passwordInputs();
  fireEvent.change(a, { target: { value: current } });
  fireEvent.change(b, { target: { value: next } });
  fireEvent.change(c, { target: { value: confirm } });
};
const submit = () => fireEvent.submit(document.querySelector("form")!);

beforeEach(() => {
  vi.clearAllMocks();
  h.params = { locale: "en" };
});

describe("CustomerSettingsPage", () => {
  it("keeps the update button disabled until all password fields are filled", () => {
    render(<CustomerSettingsPage params={{ locale: "en" }} />);
    const button = screen.getByText("updatePassword").closest("button")!;
    expect(button.disabled).toBe(true);
    fill("old", "new", "new");
    expect(button.disabled).toBe(false);
  });

  it("rejects mismatched new passwords without calling the API", () => {
    render(<CustomerSettingsPage params={{ locale: "en" }} />);
    fill("old", "Secret123", "Secret124");
    submit();
    expect(screen.getByText("errors.passwordMismatch|New passwords do not match.")).toBeTruthy();
    expect(change).not.toHaveBeenCalled();
  });

  it("changes the password and clears the form", async () => {
    change.mockResolvedValue({});
    render(<CustomerSettingsPage params={{ locale: "en" }} />);
    fill("OldPass1!", "NewPass1!", "NewPass1!");
    submit();
    expect(await screen.findByText("passwordChanged")).toBeTruthy();
    expect(change).toHaveBeenCalledWith("OldPass1!", "NewPass1!");
    expect(passwordInputs().map((i) => i.value)).toEqual(["", "", ""]);
  });

  it("shows API and unexpected errors", async () => {
    change.mockRejectedValueOnce(new ApiError(401, "Current password is wrong")).mockRejectedValueOnce(new Error("x"));
    render(<CustomerSettingsPage params={{ locale: "en" }} />);
    fill("bad", "NewPass1!", "NewPass1!");
    submit();
    expect(await screen.findByText("Current password is wrong")).toBeTruthy();
    submit();
    await waitFor(() =>
      expect(screen.getByText("errors.unexpected|An unexpected error occurred while changing your password.")).toBeTruthy(),
    );
  });

  it("switches language by rewriting the locale segment, ignoring the current one", () => {
    render(<CustomerSettingsPage params={{ locale: "en" }} />);
    const select = screen.getByLabelText("language") as HTMLSelectElement;
    expect(select.value).toBe("en");
    fireEvent.change(select, { target: { value: "en" } });
    expect(h.push).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: "si" } });
    expect(h.push).toHaveBeenCalledWith("/si/dashboard/settings");
  });

  it("falls back to the prop locale and toggles email notifications", () => {
    h.params = {};
    render(<CustomerSettingsPage params={{ locale: "ta" }} />);
    expect((screen.getByLabelText("language") as HTMLSelectElement).value).toBe("ta");
    const toggle = screen.getByLabelText("emailNotifications") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
  });

  it.todo("persists the email-notification preference to the API (the toggle is currently local state only and resets on reload)");
});
