/**
 * Login (password, OTP, OAuth, rate limiting) and reset-password pages.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const nav = vi.hoisted(() => ({ search: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => nav.search,
  usePathname: () => "/en/login",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values && "seconds" in values ? `${key}:${values.seconds}` : key,
  useLocale: () => "en",
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const services = vi.hoisted(() => ({
  authService: {
    login: vi.fn(),
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    resetPassword: vi.fn(),
  },
  landingContentService: { getPublicConfig: vi.fn() },
}));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { ...services, ApiError };
});

import LoginPage from "@/app/[locale]/login/page";
import ResetPasswordPage from "@/app/[locale]/reset-password/page";
import { ApiError } from "@/lib/api/client";
import { isRemembered } from "@/lib/auth-storage";
import { useAuthStore } from "@/store";
import { UserRole, type User } from "@/types";

const { authService, landingContentService } = services;
const customer = { id: "c1", role: UserRole.CUSTOMER, isVerified: true } as User;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  nav.search = new URLSearchParams();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, token: null });
  landingContentService.getPublicConfig.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderLogin = async () => {
  const utils = render(<LoginPage />);
  await screen.findByText("title");
  return utils;
};
const type = (placeholder: string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
const submit = async () => {
  await act(async () => {
    fireEvent.submit(screen.getByPlaceholderText("emailOrPhonePlaceholder").closest("form")!);
  });
};

describe("login page", () => {
  it("shows a spinner and redirects when already signed in", async () => {
    useAuthStore.setState({ user: customer, isAuthenticated: true });
    render(<LoginPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/dashboard"));
    expect(screen.queryByText("title")).toBeNull();
  });

  it("loads marketing stats with per-field defaults and survives config errors", async () => {
    landingContentService.getPublicConfig.mockResolvedValueOnce({
      loginMarketingStats: { verifiedBuses: "900+", happyCustomers: "", averageRating: "" },
    });
    const { unmount } = await renderLogin();
    expect(await screen.findByText("900+")).toBeTruthy();
    expect(screen.getByText("5000+")).toBeTruthy();
    unmount();

    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    landingContentService.getPublicConfig.mockRejectedValueOnce(new Error("x"));
    await renderLogin();
    await waitFor(() => expect(log).toHaveBeenCalled());
    expect(screen.getByText("500+")).toBeTruthy();
  });

  it.each([
    ["/en/dashboard/packages?book=pkg1", "/en/dashboard/packages?book=pkg1"],
    ["https://evil.example.com/steal", "/en/dashboard"],
    ["//evil.example.com", "/en/dashboard"],
    ["/si/dashboard", "/en/dashboard"],
  ])("after sign-in, returnUrl %s leads to %s", async (returnUrl: string, destination: string) => {
    nav.search = new URLSearchParams({ returnUrl });
    authService.login.mockResolvedValue({ user: customer, accessToken: "tok" });
    await renderLogin();
    type("emailOrPhonePlaceholder", "nimal@x.lk");
    type("passwordPlaceholder", "Secret123");

    await submit();

    expect(router.push).toHaveBeenCalledWith(destination);
  });

  it("signs in with a password, honouring remember-me, and redirects by role", async () => {
    authService.login.mockResolvedValue({ user: customer, accessToken: "tok" });
    await renderLogin();
    type("emailOrPhonePlaceholder", "nimal@x.lk");
    type("passwordPlaceholder", "Secret123");
    fireEvent.click(screen.getByLabelText("Show password"));
    expect((screen.getByPlaceholderText("passwordPlaceholder") as HTMLInputElement).type).toBe("text");
    fireEvent.click(screen.getByLabelText("Hide password"));
    fireEvent.click(screen.getByRole("checkbox"));

    await submit();

    expect(authService.login).toHaveBeenCalledWith({
      email: "nimal@x.lk",
      password: "Secret123",
      rememberMe: false,
    });
    expect(isRemembered()).toBe(false);
    expect(useAuthStore.getState().token).toBe("tok");
    expect(router.push).toHaveBeenCalledWith("/en/dashboard");
  });

  it("shows API and unexpected login errors", async () => {
    await renderLogin();
    authService.login.mockRejectedValueOnce(new ApiError(401, "Invalid email or password"));
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Invalid email or password");

    authService.login.mockRejectedValueOnce(new Error("x"));
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("errors.unexpected");
  });

  it("locks the form for a cooldown after rate limiting", async () => {
    await renderLogin();
    vi.useFakeTimers();
    authService.login.mockRejectedValueOnce(new ApiError(429, "slow down"));
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("errors.rateLimited");
    expect(screen.getByText("errors.cooldown:30")).toBeTruthy();

    await submit();
    expect(authService.login).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText("submit")).toBeTruthy();
  });

  it("logs in with an emailed OTP, including resend and cooldown", async () => {
    authService.sendOtp.mockResolvedValue({ destination: "n***@x.lk" });
    authService.verifyOtp.mockResolvedValue({ user: customer, accessToken: "otp-tok" });
    await renderLogin();
    fireEvent.click(screen.getByText("otpLogin"));
    expect(screen.queryByPlaceholderText("passwordPlaceholder")).toBeNull();
    expect(screen.getByText("sendOtp")).toBeTruthy();
    type("emailOrPhonePlaceholder", " nimal@x.lk ");

    vi.useFakeTimers();
    await submit();
    expect(authService.sendOtp).toHaveBeenCalledWith({ identifier: "nimal@x.lk", purpose: "LOGIN" });
    expect(screen.getByText("Code sent to n***@x.lk")).toBeTruthy();
    expect(screen.getByText("Resend OTP in 60s")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("Resend OTP in 59s")).toBeTruthy();
    act(() => vi.advanceTimersByTime(59_000));
    vi.useRealTimers();

    await act(async () => {
      fireEvent.click(screen.getByText("Resend OTP"));
    });
    expect(authService.sendOtp).toHaveBeenCalledTimes(2);

    type("Enter 6-digit OTP", "12a34-56");
    expect((screen.getByPlaceholderText("Enter 6-digit OTP") as HTMLInputElement).value).toBe("123456");
    await submit();
    expect(authService.verifyOtp).toHaveBeenCalledWith({
      identifier: "nimal@x.lk",
      code: "123456",
      purpose: "LOGIN",
    });
    expect(isRemembered()).toBe(true);
    expect(router.push).toHaveBeenCalledWith("/en/dashboard");
  });

  it("rejects incomplete OTP verification and reports resend failures", async () => {
    authService.sendOtp.mockResolvedValueOnce({ destination: "" });
    await renderLogin();
    fireEvent.click(screen.getByText("otpLogin"));
    type("emailOrPhonePlaceholder", "a@b.lk");
    await submit();
    expect(screen.getByText("Code sent to a@b.lk")).toBeTruthy();

    authService.verifyOtp.mockResolvedValueOnce({ verified: true });
    type("Enter 6-digit OTP", "111111");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Unable to complete OTP login");
    expect(screen.getByText("Verify OTP")).toBeTruthy();
  });

  it("handles resend errors once the cooldown has expired", async () => {
    authService.sendOtp.mockResolvedValueOnce({ destination: "d" });
    await renderLogin();
    fireEvent.click(screen.getByText("otpLogin"));
    type("emailOrPhonePlaceholder", "a@b.lk");
    vi.useFakeTimers();
    await submit();
    act(() => vi.advanceTimersByTime(60_000));
    vi.useRealTimers();

    const resend = async (err: unknown) => {
      authService.sendOtp.mockRejectedValueOnce(err);
      await act(async () => {
        fireEvent.click(screen.getByText(/Resend OTP/));
      });
    };
    await resend(new ApiError(400, "Bad identifier"));
    expect(screen.getByRole("alert").textContent).toBe("Bad identifier");
    await resend(new Error("x"));
    expect(screen.getByRole("alert").textContent).toBe("Failed to resend OTP. Please try again.");
    await resend(new ApiError(429, "slow"));
    expect(screen.getByRole("alert").textContent).toBe("errors.rateLimited");
    expect(screen.getByText("Resend OTP in 60s")).toBeTruthy();

    // A cooling-down or empty identifier never re-sends.
    const calls = authService.sendOtp.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByText(/Resend OTP/));
    });
    expect(authService.sendOtp.mock.calls.length).toBe(calls);
  });

  it("starts OAuth with a callback return URL and links to registration", async () => {
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "http://app.test", href: "" },
    });
    await renderLogin();
    fireEvent.click(screen.getByText("social.google"));
    const url = new URL(window.location.href);
    expect(url.pathname).toBe("/api/v1/auth/oauth/google");
    expect(url.searchParams.get("returnTo")).toBe("http://app.test/en/auth/callback");
    Object.defineProperty(window, "location", { configurable: true, value: original });

    fireEvent.click(screen.getByText("passwordLogin"));
    expect(screen.getByText("forgotPassword").closest("a")?.getAttribute("href")).toBe(
      "/en/forgot-password",
    );
  });
});

describe("reset password page", () => {
  const fill = (pw: string, confirm: string) => {
    fireEvent.change(screen.getByPlaceholderText("auth.resetPassword.newPasswordPlaceholder"), {
      target: { value: pw },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.resetPassword.confirmPasswordPlaceholder"), {
      target: { value: confirm },
    });
  };
  const submitReset = async () => {
    await act(async () => {
      fireEvent.submit(
        screen.getByPlaceholderText("auth.resetPassword.newPasswordPlaceholder").closest("form")!,
      );
    });
  };

  it("explains an invalid link when the token is missing", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText("auth.resetPassword.errors.invalidLink")).toBeTruthy();
    expect(screen.getByText("auth.forgotPassword.title").closest("a")?.getAttribute("href")).toBe(
      "/en/forgot-password",
    );
  });

  it("rates password strength and blocks mismatched passwords", async () => {
    nav.search = new URLSearchParams("token=t1");
    render(<ResetPasswordPage />);
    fill("abc", "");
    expect(screen.getByText("auth.register.passwordStrength.weak")).toBeTruthy();
    fill("abcdefgH", "");
    expect(screen.getByText("auth.register.passwordStrength.medium")).toBeTruthy();
    fill("abcdefgH1!", "different");
    expect(screen.getByText("auth.register.passwordStrength.strong")).toBeTruthy();

    const toggles = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("type") === "button");
    fireEvent.click(toggles[0]);
    fireEvent.click(toggles[1]);
    expect(
      (screen.getByPlaceholderText("auth.resetPassword.confirmPasswordPlaceholder") as HTMLInputElement).type,
    ).toBe("text");

    await submitReset();
    expect(screen.getByText("auth.resetPassword.errors.passwordMismatch")).toBeTruthy();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it("resets the password and links to login", async () => {
    nav.search = new URLSearchParams("token=t1");
    authService.resetPassword.mockResolvedValue({});
    render(<ResetPasswordPage />);
    fill("NewPass1!", "NewPass1!");
    await submitReset();
    expect(authService.resetPassword).toHaveBeenCalledWith("t1", "NewPass1!");
    expect(screen.getByText("auth.resetPassword.successTitle")).toBeTruthy();
  });

  it("shows API and unexpected reset errors", async () => {
    nav.search = new URLSearchParams("token=t1");
    render(<ResetPasswordPage />);
    fill("NewPass1!", "NewPass1!");
    authService.resetPassword.mockRejectedValueOnce(new ApiError(400, "Token expired"));
    await submitReset();
    expect(screen.getByText("Token expired")).toBeTruthy();
    authService.resetPassword.mockRejectedValueOnce(new Error("x"));
    await submitReset();
    expect(screen.getByText("auth.resetPassword.errors.unexpected")).toBeTruthy();
  });
});
