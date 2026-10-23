/**
 * Small public pages: landing, locale layout and error page, FAQ and legal
 * pages, how-it-works (server page, signed image loader, tabbed content),
 * payment return/cancel, OAuth callback, register chooser and forgot password.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const nav = vi.hoisted(() => ({
  params: { locale: "en" } as Record<string, string>,
  search: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => nav.params,
  useSearchParams: () => nav.search,
  usePathname: () => "/en",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({}),
}));
vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "font-inter" }) }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} className={rest.className}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/features/content/FaqContent", () => ({
  FaqContent: ({ fallback }: { fallback: ReactNode }) => <>{fallback}</>,
}));
vi.mock("@/components/features/content/PolicyContent", () => ({
  PolicyContent: ({ slug, fallback }: { slug: string; fallback: ReactNode }) => (
    <section data-slug={slug}>{fallback}</section>
  ),
}));
vi.mock("@/components/landing", () => {
  const stub = (name: string, listProp?: string) => {
    const Stub = (props: Record<string, unknown>) => (
      <div data-testid={name}>
        {listProp ? `${name}:${(props[listProp] as unknown[]).length}` : name}
      </div>
    );
    Stub.displayName = name;
    return Stub;
  };
  return {
    SearchSection: stub("SearchSection"),
    TrustIndicators: stub("TrustIndicators", "stats"),
    PopularPackages: stub("PopularPackages", "packages"),
    PopularRoutes: stub("PopularRoutes", "routes"),
    FeaturedVehicles: stub("FeaturedVehicles", "vehicles"),
    HowItWorks: stub("HowItWorks"),
    Testimonials: stub("Testimonials", "testimonials"),
    FAQ: stub("FAQ"),
    OwnerCTA: stub("OwnerCTA"),
  };
});

const supabase = vi.hoisted(() => ({ createSignedUrl: vi.fn(), createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: supabase.createClient }));

const services = vi.hoisted(() => ({
  landingContentService: { getLandingData: vi.fn() },
  paymentService: { getPaymentById: vi.fn() },
  authService: { refreshToken: vi.fn(), me: vi.fn(), forgotPassword: vi.fn() },
  api: { startTokenRefresh: vi.fn(), stopTokenRefresh: vi.fn() },
}));
vi.mock("@/lib/api", async () => {
  const { ApiError } = await import("@/lib/api/client");
  return { ...services, ApiError };
});

import Home from "@/app/[locale]/page";
import LocaleLayout, { generateStaticParams } from "@/app/[locale]/layout";
import ErrorPage from "@/app/[locale]/error";
import FAQPage from "@/app/[locale]/faq/page";
import PrivacyPolicyPage from "@/app/[locale]/privacy/page";
import TermsOfServicePage from "@/app/[locale]/terms/page";
import RefundPolicyPage from "@/app/[locale]/refund-policy/page";
import HowItWorksPage, { generateMetadata } from "@/app/[locale]/how-it-works/page";
import HowItWorksContent from "@/app/[locale]/how-it-works/HowItWorksContent";
import { getHowItWorksImages, HOW_IT_WORKS_PATHS } from "@/app/[locale]/how-it-works/actions";
import PaymentCancelPage from "@/app/[locale]/payments/cancel/page";
import PaymentReturnPage from "@/app/[locale]/payments/return/page";
import OAuthCallbackPage from "@/app/[locale]/auth/callback/page";
import RegisterPage from "@/app/[locale]/register/page";
import ForgotPasswordPage from "@/app/[locale]/forgot-password/page";
import VehicleDetailsPage from "@/app/[locale]/vehicles/[id]/page";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store";
import { UserRole, type User } from "@/types";

vi.mock("@/app/[locale]/vehicles/[id]/VehicleDetailsPageContent", () => ({
  default: ({ locale, vehicleId }: { locale: string; vehicleId: string }) => (
    <p>
      vehicle {vehicleId} in {locale}
    </p>
  ),
}));

const params = (p: Record<string, string>) => Promise.resolve(p) as any;

beforeEach(() => {
  vi.clearAllMocks();
  nav.params = { locale: "en" };
  nav.search = new URLSearchParams();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("landing page", () => {
  it("passes landing data to each section", async () => {
    services.landingContentService.getLandingData.mockResolvedValue({
      stats: [1, 2],
      popularPackages: [1],
      popularRoutes: [1, 2, 3],
      featuredVehicles: [],
      testimonials: [1],
      trustedPartners: [],
    });
    render(<Home />);
    expect(screen.getByText("TrustIndicators:0")).toBeTruthy();
    expect(await screen.findByText("TrustIndicators:2")).toBeTruthy();
    expect(screen.getByText("PopularRoutes:3")).toBeTruthy();
    expect(screen.getByText("Testimonials:1")).toBeTruthy();
  });

  it("keeps empty sections when landing data fails to load", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    services.landingContentService.getLandingData.mockRejectedValueOnce(new ApiError(500, "down"));
    const { unmount } = render(<Home />);
    await waitFor(() => expect(log).toHaveBeenCalledWith("Failed to fetch landing data:", "down"));
    unmount();
    services.landingContentService.getLandingData.mockRejectedValueOnce("weird");
    render(<Home />);
    await waitFor(() => expect(log).toHaveBeenLastCalledWith("Failed to fetch landing data:", "weird"));
    expect(screen.getByText("FeaturedVehicles:0")).toBeTruthy();
  });
});

describe("locale layout and error page", () => {
  it("lists static locales, renders children and rejects unknown locales", async () => {
    expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "si" }, { locale: "ta" }]);
    const el = await LocaleLayout({ children: <p>child</p>, params: params({ locale: "si" }) });
    expect(el.props.lang).toBe("si");
    await expect(
      LocaleLayout({ children: null, params: params({ locale: "fr" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("logs the error, offers retry and shows details only in development", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const err = Object.assign(new Error("broke"), { digest: "d1" });
    const { unmount } = render(<ErrorPage error={err} reset={reset} />);
    expect(log).toHaveBeenCalledWith("Page error:", err);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalled();
    expect(screen.queryByText(/Digest/)).toBeNull();
    unmount();

    vi.stubEnv("NODE_ENV", "development");
    render(<ErrorPage error={err} reset={reset} />);
    expect(screen.getByText(/Digest: d1/)).toBeTruthy();
  });
});

describe("content pages", () => {
  it("renders FAQ fallback questions with the first one open and a contact link", () => {
    const { container } = render(<FAQPage />);
    expect(screen.getByText("questions.whatIs.question")).toBeTruthy();
    expect(screen.getByText("questions.becomeOwner.question")).toBeTruthy();
    expect(container.querySelector('a[href="/en/contact"]')).toBeTruthy();
  });

  it.each([
    [PrivacyPolicyPage, "privacy-policy", "sections.contact.title"],
    [TermsOfServicePage, "terms-and-conditions", "sections.acceptance.title"],
    [RefundPolicyPage, "refund-policy", "sections.overview.title"],
  ])("renders policy fallback sections (%#)", (Page: () => React.JSX.Element, slug: string, heading: string) => {
    const { container } = render(<Page />);
    expect(container.querySelector("[data-slug]")?.getAttribute("data-slug")).toBe(slug);
    expect(screen.getByText(new RegExp(heading.replace(/\./g, "\\.")))).toBeTruthy();
  });
});

describe("how it works", () => {
  it("returns empty image slots without Supabase config", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const imgs = await getHowItWorksImages();
    expect(imgs.customer).toEqual(Array(6).fill(null));
    expect(supabase.createClient).not.toHaveBeenCalled();
  });

  it("signs each image path and nulls failures", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "key");
    const createSignedUrl = vi.fn(async (path: string) => {
      if (path.endsWith("01-search.webp")) return { data: { signedUrl: "signed-1" }, error: null };
      if (path.endsWith("02-request.webp")) return { data: null, error: new Error("nf") };
      if (path.endsWith("03-compare.webp")) throw new Error("network");
      return { data: {}, error: null };
    });
    supabase.createClient.mockReturnValue({ storage: { from: () => ({ createSignedUrl }) } });

    const imgs = await getHowItWorksImages();

    expect(imgs.customer.slice(0, 4)).toEqual(["signed-1", null, null, null]);
    expect(createSignedUrl).toHaveBeenCalledTimes(
      HOW_IT_WORKS_PATHS.customer.length + HOW_IT_WORKS_PATHS.owner.length,
    );
    expect(createSignedUrl).toHaveBeenCalledWith("how-it-works/customer/01-search.webp", 3600);

    supabase.createClient.mockImplementationOnce(() => {
      throw new Error("bad config");
    });
    expect((await getHowItWorksImages()).owner).toEqual(Array(6).fill(null));
  });

  it("builds metadata and renders the server page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const meta = await generateMetadata({ params: params({ locale: "en" }) });
    expect(meta.title).toBe("hero.title | TravelNest");
    const el = await HowItWorksPage({ params: params({ locale: "en" }) });
    render(el);
    expect(screen.getByText("hero.subtitle")).toBeTruthy();
    expect(screen.getByText("customer.steps.search.title")).toBeTruthy();
  });

  it("switches between customer and owner steps with images or fallbacks", () => {
    const customer = ["/c1.webp", null, null, null, null, null];
    const { container } = render(
      <HowItWorksContent locale="si" images={{ customer, owner: Array(6).fill(null) }} />,
    );
    expect(screen.getByAltText("customer.steps.search.title")).toBeTruthy();
    expect(container.querySelector('a[href="/si/search"]')).toBeTruthy();

    fireEvent.click(screen.getByText("owner.title"));
    expect(screen.getByText("owner.steps.manage.title")).toBeTruthy();
    expect(screen.queryByText("customer.steps.search.title")).toBeNull();
    expect(container.querySelector('a[href="/si/register"]')).toBeTruthy();

    fireEvent.click(screen.getByText("customer.title"));
    expect(screen.getByText("customer.steps.travel.title")).toBeTruthy();
  });
});

describe("payment result pages", () => {
  it("offers a way back to payment only when a booking id is present", () => {
    const { container, unmount } = render(<PaymentCancelPage />);
    expect(screen.getByText("title")).toBeTruthy();
    expect(container.querySelector("a")).toBeNull();
    unmount();
    nav.search = new URLSearchParams("bookingId=b1");
    const again = render(<PaymentCancelPage />);
    expect(again.container.querySelector('a[href="/en/dashboard/bookings/b1/payment"]')).toBeTruthy();
  });

  it("shows success for a completed payment with booking links", async () => {
    nav.search = new URLSearchParams("order_id=p1");
    services.paymentService.getPaymentById.mockResolvedValue({
      payment: { id: "p1", bookingId: "b1", status: "completed" },
    });
    const { container } = render(<PaymentReturnPage />);
    expect(await screen.findByText("success.title")).toBeTruthy();
    expect(services.paymentService.getPaymentById).toHaveBeenCalledWith("p1");
    expect(container.querySelector('a[href="/en/dashboard/bookings/b1"]')).toBeTruthy();
  });

  it("shows pending, missing-reference and verification errors", async () => {
    nav.search = new URLSearchParams("payment_id=p2");
    services.paymentService.getPaymentById.mockResolvedValueOnce({
      payment: { id: "p2", bookingId: "", status: "pending" },
    });
    const a = render(<PaymentReturnPage />);
    expect(await screen.findByText("pending.message")).toBeTruthy();
    a.unmount();

    nav.search = new URLSearchParams();
    const b = render(<PaymentReturnPage />);
    expect(await screen.findByText("errors.missingReference")).toBeTruthy();
    b.unmount();

    nav.search = new URLSearchParams("order_id=p3");
    services.paymentService.getPaymentById.mockRejectedValueOnce(new ApiError(404, "Payment not found"));
    const c = render(<PaymentReturnPage />);
    expect(await screen.findByText("Payment not found")).toBeTruthy();
    c.unmount();

    services.paymentService.getPaymentById.mockRejectedValueOnce(new Error("x"));
    render(<PaymentReturnPage />);
    expect(await screen.findByText("errors.verifyFailed")).toBeTruthy();
  });
});

describe("OAuth callback", () => {
  it("exchanges the refresh cookie, signs in and redirects to the dashboard", async () => {
    services.authService.refreshToken.mockResolvedValue({ accessToken: "tok" });
    services.authService.me.mockResolvedValue({
      user: { id: "o", role: UserRole.VEHICLE_OWNER, isVerified: true } as User,
    });
    render(<OAuthCallbackPage />);
    expect(screen.getByText("loading")).toBeTruthy();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/owner/dashboard"));
    expect(useAuthStore.getState().token).toBe("tok");
    expect(services.api.startTokenRefresh).toHaveBeenCalled();
  });

  it("shows provider errors, missing tokens and finalize failures", async () => {
    nav.search = new URLSearchParams("error=access_denied");
    const a = render(<OAuthCallbackPage />);
    expect(screen.getByText("errors.access_denied")).toBeTruthy();
    expect(a.container.querySelector('a[href="/en/login"]')).toBeTruthy();
    expect(services.authService.refreshToken).not.toHaveBeenCalled();
    a.unmount();

    nav.search = new URLSearchParams();
    services.authService.refreshToken.mockResolvedValueOnce({ accessToken: "" });
    const b = render(<OAuthCallbackPage />);
    expect(await screen.findByText("errors.missingToken")).toBeTruthy();
    b.unmount();

    services.authService.refreshToken.mockRejectedValueOnce(new Error("no cookie"));
    render(<OAuthCallbackPage />);
    expect(await screen.findByText("errors.finalizeFailed")).toBeTruthy();
    expect(useAuthStore.getState().token).toBeNull();
  });
});

describe("register chooser", () => {
  it("links to customer and owner registration for guests", async () => {
    const { container } = render(<RegisterPage />);
    expect(await screen.findByText("customerCard.cta")).toBeTruthy();
    expect(container.querySelector('a[href="/en/register/customer"]')).toBeTruthy();
    expect(container.querySelector('a[href="/en/register/owner"]')).toBeTruthy();
  });

  it("redirects signed-in users and shows a spinner meanwhile", async () => {
    useAuthStore.setState({
      user: { id: "c", role: UserRole.CUSTOMER } as User,
      isAuthenticated: true,
    });
    render(<RegisterPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/dashboard"));
    expect(screen.queryByText("customerCard.cta")).toBeNull();
  });
});

describe("forgot password", () => {
  const submit = (email: string) => {
    fireEvent.change(screen.getByPlaceholderText("auth.forgotPassword.emailPlaceholder"), {
      target: { value: email },
    });
    fireEvent.submit(screen.getByRole("button").closest("form")!);
  };

  it("sends the reset email and confirms the address", async () => {
    services.authService.forgotPassword.mockResolvedValue({});
    render(<ForgotPasswordPage />);
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    expect(services.authService.forgotPassword).not.toHaveBeenCalled();
    submit("nimal@x.lk");
    expect(await screen.findByText("auth.forgotPassword.successTitle")).toBeTruthy();
    expect(services.authService.forgotPassword).toHaveBeenCalledWith("nimal@x.lk");
    expect(screen.getByText("nimal@x.lk")).toBeTruthy();
  });

  it("shows API and unexpected errors", async () => {
    services.authService.forgotPassword.mockRejectedValueOnce(new ApiError(429, "Too many requests"));
    render(<ForgotPasswordPage />);
    submit("a@b.lk");
    expect(await screen.findByText("Too many requests")).toBeTruthy();
    services.authService.forgotPassword.mockRejectedValueOnce(new Error("x"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button").closest("form")!);
    });
    expect(await screen.findByText("auth.forgotPassword.errors.unexpected")).toBeTruthy();
  });
});

describe("vehicle details route", () => {
  it("passes locale and id to the client content", async () => {
    render(await VehicleDetailsPage({ params: params({ locale: "ta", id: "v7" }) }));
    expect(screen.getByText("vehicle v7 in ta")).toBeTruthy();
  });
});
