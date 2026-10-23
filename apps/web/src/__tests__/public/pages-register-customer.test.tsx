/**
 * Customer registration: live field validation, password strength, required
 * fields and terms, email OTP verification and account creation.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/register/customer",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
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
  // Stand-in for the OTP modal that surfaces verify errors like the real one.
  function OtpVerificationModal({ isOpen, destination, onVerify, onResend, onClose }: any) {
    const [err, setErr] = useState("");
    if (!isOpen) return null;
    return (
      <div role="dialog">
        <p>otp-to:{destination}</p>
        <button onClick={() => onVerify("123456").catch((e: Error) => setErr(e.message))}>verify-otp</button>
        <button onClick={() => onResend()}>resend-otp</button>
        <button onClick={onClose}>close-otp</button>
        {err && <p>otp-error:{err}</p>}
      </div>
    );
  }
  return { ...actual, OtpVerificationModal };
});

const services = vi.hoisted(() => ({
  authService: { sendOtp: vi.fn(), verifyOtp: vi.fn(), register: vi.fn() },
}));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { ...services, ApiError };
});

import CustomerRegistrationPage from "@/app/[locale]/register/customer/page";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store";
import { UserRole, type User } from "@/types";

const { authService } = services;

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
const change = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const check = (name: string) => fireEvent.click(field(name));
const submit = async () => {
  await act(async () => {
    fireEvent.submit(field("firstName").closest("form")!);
  });
};
const fillValid = () => {
  change("firstName", "Nimal");
  change("lastName", "Perera");
  change("email", "nimal@x.lk");
  change("phone", "0771234567");
  change("address", "12 Temple Road");
  change("city", "Kandy");
  change("password", "Secret123");
  change("confirmPassword", "Secret123");
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("customer registration", () => {
  it("redirects signed-in users away", async () => {
    useAuthStore.setState({ user: { id: "c", role: UserRole.CUSTOMER } as User, isAuthenticated: true });
    render(<CustomerRegistrationPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/dashboard"));
    expect(field("firstName")).toBeNull();
  });

  it("validates fields as the user types and rates the password", async () => {
    render(<CustomerRegistrationPage />);
    await screen.findByPlaceholderText("fields.firstName.placeholder");

    change("firstName", "N");
    expect(screen.getByText("errors.requiredField")).toBeTruthy();
    change("firstName", "Nimal");
    expect(screen.queryByText("errors.requiredField")).toBeNull();

    change("email", "bad");
    expect(screen.getByText("Invalid email address")).toBeTruthy();
    for (const [name, bad] of [["lastName", "P"], ["phone", "077"], ["address", "abc"], ["city", "K"]]) {
      change(name, bad);
    }
    expect(screen.getAllByText("errors.requiredField").length).toBe(4);

    change("postalCode", "20000");
    expect(field("postalCode").value).toBe("20000");

    change("password", "abc");
    expect(screen.getByText("passwordStrength.weak")).toBeTruthy();
    change("password", "abcdefgH");
    expect(screen.getByText("passwordStrength.medium")).toBeTruthy();
    change("password", "abcdefgH1!");
    expect(screen.getByText("passwordStrength.strong")).toBeTruthy();

    change("confirmPassword", "nope");
    expect(screen.getByText("errors.passwordMismatch")).toBeTruthy();
    change("confirmPassword", "abcdefgH1!");
    expect(screen.queryByText("errors.passwordMismatch")).toBeNull();
    change("password", "abcdefgH1?");
    expect(screen.getByText("errors.passwordMismatch")).toBeTruthy();
    change("password", "abcdefgH1!");
    expect(screen.queryByText("errors.passwordMismatch")).toBeNull();

    const toggles = Array.from(document.querySelectorAll('button[type="button"]')) as HTMLButtonElement[];
    toggles.forEach((b) => fireEvent.click(b));
    expect(field("password").type).toBe("text");
    expect(field("confirmPassword").type).toBe("text");
  });

  it("blocks submission until required fields, matching passwords and terms are provided", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CustomerRegistrationPage />);
    await screen.findByPlaceholderText("fields.firstName.placeholder");

    await submit();
    expect(screen.getByText("errors.requiredFields")).toBeTruthy();
    expect(screen.getAllByText("errors.requiredField").length).toBe(8);
    act(() => vi.advanceTimersByTime(60));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    fillValid();
    change("confirmPassword", "Different1");
    await submit();
    expect(screen.getByText("errors.passwordMismatch")).toBeTruthy();

    change("confirmPassword", "Secret123");
    await submit();
    expect(screen.getByText("errors.acceptTerms")).toBeTruthy();
    check("termsAccepted");
    await submit();
    expect(screen.getByText("errors.acceptTerms")).toBeTruthy();
    expect(authService.sendOtp).not.toHaveBeenCalled();
  });

  it("sends an OTP, verifies it, registers and signs the customer in", async () => {
    authService.sendOtp.mockResolvedValue({});
    authService.verifyOtp.mockResolvedValue({ registrationToken: "reg-tok" });
    authService.register.mockResolvedValue({
      user: { id: "c1", role: UserRole.CUSTOMER } as User,
      accessToken: "tok",
    });
    render(<CustomerRegistrationPage />);
    await screen.findByPlaceholderText("fields.firstName.placeholder");
    fillValid();
    check("termsAccepted");
    check("privacyAccepted");

    await submit();
    expect(authService.sendOtp).toHaveBeenCalledWith({ identifier: "nimal@x.lk", purpose: "REGISTRATION" });
    expect(screen.getByText("otp-to:nimal@x.lk")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText("resend-otp"));
    });
    expect(authService.sendOtp).toHaveBeenCalledTimes(2);

    await act(async () => {
      fireEvent.click(screen.getByText("verify-otp"));
    });
    expect(authService.verifyOtp).toHaveBeenCalledWith({
      identifier: "nimal@x.lk",
      code: "123456",
      purpose: "REGISTRATION",
    });
    expect(authService.register).toHaveBeenCalledWith({
      registrationToken: "reg-tok",
      email: "nimal@x.lk",
      password: "Secret123",
      confirmPassword: "Secret123",
      firstName: "Nimal",
      lastName: "Perera",
      phone: "0771234567",
      role: "customer",
    });
    expect(useAuthStore.getState().token).toBe("tok");
    expect(router.push).toHaveBeenCalledWith("/en/dashboard");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("surfaces OTP verification errors inside the modal", async () => {
    authService.sendOtp.mockResolvedValue({});
    render(<CustomerRegistrationPage />);
    await screen.findByPlaceholderText("fields.firstName.placeholder");
    fillValid();
    check("termsAccepted");
    check("privacyAccepted");
    await submit();

    authService.verifyOtp.mockRejectedValueOnce(new ApiError(400, "Code expired"));
    await act(async () => {
      fireEvent.click(screen.getByText("verify-otp"));
    });
    expect(screen.getByText("otp-error:Code expired")).toBeTruthy();

    authService.verifyOtp.mockResolvedValueOnce({});
    authService.register.mockRejectedValueOnce(new Error("x"));
    await act(async () => {
      fireEvent.click(screen.getByText("verify-otp"));
    });
    expect(screen.getByText("otp-error:errors.unexpected")).toBeTruthy();
    expect(authService.register.mock.calls[0][0].registrationToken).toBe("");

    fireEvent.click(screen.getByText("close-otp"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("maps OTP send failures to field, API and generic errors", async () => {
    render(<CustomerRegistrationPage />);
    await screen.findByPlaceholderText("fields.firstName.placeholder");
    fillValid();
    check("termsAccepted");
    check("privacyAccepted");

    authService.sendOtp.mockRejectedValueOnce(
      new ApiError(422, "Invalid", "VALIDATION_ERROR", [{ field: "email", message: "Email already registered" }]),
    );
    await submit();
    expect(screen.getByText("Email already registered")).toBeTruthy();

    authService.sendOtp.mockRejectedValueOnce(new ApiError(429, "Too many codes"));
    await submit();
    expect(screen.getByText("Too many codes")).toBeTruthy();

    authService.sendOtp.mockRejectedValueOnce(new Error("x"));
    await submit();
    expect(screen.getByText("errors.unexpected")).toBeTruthy();
  });

  it("omits an empty phone from the registration payload", async () => {
    authService.sendOtp.mockResolvedValue({});
    authService.verifyOtp.mockResolvedValue({ registrationToken: "r" });
    authService.register.mockResolvedValue({ user: { id: "c", role: UserRole.CUSTOMER } as User, accessToken: "t" });
    render(<CustomerRegistrationPage />);
    await screen.findByPlaceholderText("fields.firstName.placeholder");
    fillValid();
    check("termsAccepted");
    check("privacyAccepted");
    await submit();
    // Phone is required client-side, so clear it only after the OTP was sent.
    change("phone", "");
    await act(async () => {
      fireEvent.click(screen.getByText("verify-otp"));
    });
    expect(authService.register.mock.calls[0][0].phone).toBeUndefined();
  });

  it.todo(
    "sends the required address/city (and optional postal code) with the registration — register/customer/page.tsx:54-63 drops them and the API register schema has no fields for them",
  );
});
