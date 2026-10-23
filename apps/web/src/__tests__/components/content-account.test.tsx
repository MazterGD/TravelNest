/**
 * Component tests for CMS-backed PolicyContent / FaqContent and the shared
 * AccountDangerZone (soft account removal + data-erasure request).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class ApiError extends Error {}
  return {
    ApiError,
    locale: "en",
    getPage: vi.fn(),
    deleteAccount: vi.fn(),
    requestDataDeletion: vi.fn(),
    stopTokenRefresh: vi.fn(),
    clearAuthRaw: vi.fn(),
    logout: vi.fn(),
    push: vi.fn(),
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => h.locale,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/store", () => ({
  useAuthStore: (sel?: (s: any) => unknown) => (sel ? sel({ logout: h.logout }) : { logout: h.logout }),
}));
vi.mock("@/lib/auth-storage", () => ({ clearAuthRaw: h.clearAuthRaw }));
vi.mock("@/lib/api", () => ({
  ApiError: h.ApiError,
  publicContentService: { getPage: h.getPage },
  userService: { deleteAccount: h.deleteAccount, requestDataDeletion: h.requestDataDeletion },
  api: { stopTokenRefresh: h.stopTokenRefresh },
}));

import { PolicyContent } from "@/components/features/content/PolicyContent";
import { FaqContent } from "@/components/features/content/FaqContent";
import { AccountDangerZone } from "@/components/features/account/AccountDangerZone";

beforeEach(() => {
  h.locale = "en";
  for (const fn of [h.getPage, h.deleteAccount, h.requestDataDeletion, h.stopTokenRefresh, h.clearAuthRaw, h.logout, h.push]) {
    fn.mockReset();
  }
});

const page = (content: any) => ({ page: { content } });

describe("PolicyContent", () => {
  it("renders the localized CMS body with headings and paragraphs", async () => {
    h.locale = "si";
    h.getPage.mockResolvedValue(
      page({ si: { body: "## Refunds\n\nFull refund 7 days out.\nLine two.\n\n\n## Contact\n\nEmail us." } }),
    );
    render(<PolicyContent slug="refund-policy" fallback={<p>Fallback</p>} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Refunds" })).toBeTruthy());
    expect(h.getPage).toHaveBeenCalledWith("refund-policy");
    expect(screen.getByRole("heading", { name: "Contact" })).toBeTruthy();
    expect(screen.getByText(/Full refund 7 days out/).tagName).toBe("P");
    expect(screen.queryByText("Fallback")).toBeNull();
  });

  it.each([
    ["no content", null],
    ["blank body", { en: { body: "   " } }],
    ["non-string body", { en: { body: 5 } }],
    ["other locale only", { ta: { body: "x" } }],
  ])("keeps the fallback for %s", async (_label: any, content: any) => {
    h.getPage.mockResolvedValue(page(content));
    render(<PolicyContent slug="terms" fallback={<p>Fallback</p>} />);
    await act(async () => {});
    expect(screen.getByText("Fallback")).toBeTruthy();
  });

  it("keeps the fallback when the request fails or resolves after unmount", async () => {
    h.getPage.mockRejectedValueOnce(new Error("404"));
    const first = render(<PolicyContent slug="terms" fallback={<p>Fallback</p>} />);
    await act(async () => {});
    expect(screen.getByText("Fallback")).toBeTruthy();
    first.unmount();
    let resolve!: (v: any) => void;
    let reject!: (e: any) => void;
    h.getPage.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const second = render(<PolicyContent slug="a" fallback={<p>F2</p>} />);
    second.unmount();
    await act(async () => resolve(page({ en: { body: "Late" } })));
    h.getPage.mockReturnValueOnce(new Promise((_, rj) => (reject = rj)));
    const third = render(<PolicyContent slug="b" fallback={<p>F3</p>} />);
    third.unmount();
    await act(async () => reject(new Error("x")));
    expect(screen.queryByText("Late")).toBeNull();
  });
});

describe("FaqContent", () => {
  it("parses ## questions into an accordion with the first item open", async () => {
    h.getPage.mockResolvedValue(
      page({ en: { body: "Intro ignored\n## How do I book?\nRequest a quote.\nThen pay.\n## Refunds?\nYes.\n##   \nOrphan" } }),
    );
    render(<FaqContent fallback={<p>Fallback</p>} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "How do I book?" })).toBeTruthy());
    expect(h.getPage).toHaveBeenCalledWith("faqs");
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute("aria-expanded")).toBe("true");
    expect(buttons[1].getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText(/Request a quote\.\s+Then pay\./)).toBeTruthy();
  });

  it.each([
    ["no questions", { en: { body: "Just text" } }],
    ["missing locale", {}],
    ["null content", null],
  ])("falls back for %s", async (_l: any, content: any) => {
    h.getPage.mockResolvedValue(page(content));
    render(<FaqContent fallback={<p>Fallback</p>} />);
    await act(async () => {});
    expect(screen.getByText("Fallback")).toBeTruthy();
  });

  it("falls back on error and ignores late responses", async () => {
    h.getPage.mockRejectedValueOnce(new Error("x"));
    const first = render(<FaqContent fallback={<p>Fallback</p>} />);
    await act(async () => {});
    expect(screen.getByText("Fallback")).toBeTruthy();
    first.unmount();
    let resolve!: (v: any) => void;
    let reject!: (e: any) => void;
    h.getPage.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<FaqContent fallback={<p>F</p>} />).unmount();
    await act(async () => resolve(page({ en: { body: "## Q\nA" } })));
    h.getPage.mockReturnValueOnce(new Promise((_, rj) => (reject = rj)));
    render(<FaqContent fallback={<p>F</p>} />).unmount();
    await act(async () => reject(new Error("y")));
    expect(screen.queryByText("Q")).toBeNull();
  });
});

describe("AccountDangerZone", () => {
  it("removes the account, clears auth and redirects home", async () => {
    h.deleteAccount.mockResolvedValue(undefined);
    render(<AccountDangerZone locale="si" />);
    expect(screen.getByRole("region", { name: "dangerZone" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(screen.getByText("deleteAccountConfirmMessage")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "deleteAccountConfirmAction" }));
    });
    expect(h.deleteAccount).toHaveBeenCalled();
    expect(h.stopTokenRefresh).toHaveBeenCalled();
    expect(h.logout).toHaveBeenCalled();
    expect(h.clearAuthRaw).toHaveBeenCalled();
    expect(h.push).toHaveBeenCalledWith("/si");
  });

  it("shows API and generic errors and cancels", async () => {
    h.deleteAccount.mockRejectedValueOnce(new h.ApiError("You have pending bookings")).mockRejectedValueOnce(new Error("x"));
    render(<AccountDangerZone locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "deleteAccountConfirmAction" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("You have pending bookings");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "deleteAccountConfirmAction" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("deleteAccountFailed");
    expect(h.logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(screen.queryByText("deleteAccountConfirmMessage")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("cannot be dismissed while removal is in flight", async () => {
    let reject!: (e: unknown) => void;
    h.deleteAccount.mockReturnValue(new Promise((_, rj) => (reject = rj)));
    render(<AccountDangerZone locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "deleteAccountConfirmAction" }));
    });
    expect((screen.getByRole("button", { name: "deleteAccountConfirmAction" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText("deleteAccountConfirmMessage")).toBeTruthy();
    await act(async () => reject(new Error("x")));
  });

  it("requests data deletion with a trimmed reason and shows the reference", async () => {
    h.requestDataDeletion.mockResolvedValue({ reference: "DDR-42" });
    render(<AccountDangerZone locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "dataDeletionAction" }));
    const reason = screen.getByLabelText("dataDeletionReasonLabel");
    fireEvent.change(reason, { target: { value: "  Moving abroad  " } });
    expect(screen.getByText("17/1000")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "dataDeletionSubmit" }));
    });
    expect(h.requestDataDeletion).toHaveBeenCalledWith("Moving abroad");
    expect(screen.getByRole("status").textContent).toContain('dataDeletionRequested:{"reference":"DDR-42"}');
    expect(screen.queryByLabelText("dataDeletionReasonLabel")).toBeNull();
  });

  it("sends undefined for an empty reason and surfaces errors, resetting on cancel", async () => {
    h.requestDataDeletion
      .mockRejectedValueOnce(new h.ApiError("Already requested"))
      .mockRejectedValueOnce("boom");
    render(<AccountDangerZone locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "dataDeletionAction" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "dataDeletionSubmit" }));
    });
    expect(h.requestDataDeletion).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole("alert").textContent).toBe("Already requested");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "dataDeletionSubmit" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("dataDeletionFailed");
    fireEvent.change(screen.getByLabelText("dataDeletionReasonLabel"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "dataDeletionAction" }));
    expect((screen.getByLabelText("dataDeletionReasonLabel") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("cannot dismiss the erasure dialog while the request is in flight", async () => {
    let resolve!: (v: any) => void;
    h.requestDataDeletion.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<AccountDangerZone locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "dataDeletionAction" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "dataDeletionSubmit" }));
    });
    expect(screen.getByText("Loading...")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByLabelText("dataDeletionReasonLabel")).toBeTruthy();
    await act(async () => resolve({ reference: "R1" }));
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
