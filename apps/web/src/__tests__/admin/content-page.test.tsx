/**
 * Admin content management page: page list/filters, slug open + tri-lingual
 * page editor save payload, testimonial moderation/editing, plus FAQ hook
 * actions not surfaced by the page.
 */
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/api", () => ({
  adminService: {
    getContentPages: vi.fn(),
    getFaqs: vi.fn(),
    getTestimonials: vi.fn(),
    getContentPageBySlug: vi.fn(),
    updateContentPage: vi.fn(),
    createFaq: vi.fn(),
    updateFaq: vi.fn(),
    deleteFaq: vi.fn(),
    approveTestimonial: vi.fn(),
    updateTestimonial: vi.fn(),
    deleteTestimonial: vi.fn(),
  },
}));

import { adminService } from "@/lib/api";
import AdminContentPage from "@/app/[locale]/admin/content/page";
import { useContentManagement } from "@/app/[locale]/admin/content/hooks/useContentManagement";

const svc = adminService as any;
const now = "2026-10-01T10:00:00.000Z";

const contentPage = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  slug: "privacy-policy",
  title: "Privacy Policy",
  excerpt: "How we use data",
  content: { en: { body: "English body" }, si: { body: "Sinhala body" } },
  isPublished: true,
  updatedAt: now,
  ...overrides,
});

const testimonial = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  name: "Ravi Kumar",
  role: "Teacher",
  organization: "Royal College",
  quote: "Great trip",
  rating: 5,
  sortOrder: 1,
  isActive: false,
  isRemoved: false,
  ...overrides,
});

const lastCall = (fn: any) => fn.mock.calls.at(-1);

const renderPage = async () => {
  render(<AdminContentPage />);
  await waitFor(() => expect(svc.getContentPages).toHaveBeenCalled());
};

describe("AdminContentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getContentPages.mockResolvedValue({
      items: [contentPage(), contentPage({ id: "p2", slug: "refund-policy", title: "Refunds", isPublished: false })],
    });
    svc.getFaqs.mockResolvedValue({ items: [] });
    svc.getTestimonials.mockResolvedValue({
      items: [
        testimonial(),
        testimonial({ id: "t2", name: "Mala Silva", isActive: true }),
        testimonial({ id: "t3", name: "Gone Person", isRemoved: true }),
      ],
    });
    svc.getContentPageBySlug.mockResolvedValue(contentPage());
    for (const fn of [
      "updateContentPage",
      "createFaq",
      "updateFaq",
      "deleteFaq",
      "approveTestimonial",
      "updateTestimonial",
      "deleteTestimonial",
    ]) {
      svc[fn].mockResolvedValue({});
    }
  });

  it("lists pages and testimonials with status badges", async () => {
    await renderPage();
    expect(await screen.findByText("Refunds")).toBeTruthy();
    expect(screen.getByText("Draft", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Removed")).toBeTruthy();
    expect(screen.getAllByText("Approve").length).toBe(1);
    expect(screen.getAllByLabelText("Delete testimonial").length).toBe(2);
    expect(svc.getTestimonials).toHaveBeenCalledWith({ page: 1, limit: 12, search: undefined, includeInactive: true });
  });

  it("shows empty states and load errors", async () => {
    svc.getContentPages.mockResolvedValueOnce({ items: [] });
    svc.getTestimonials.mockResolvedValueOnce({ items: [] });
    await renderPage();
    expect(await screen.findByText("No pages found")).toBeTruthy();
    expect(screen.getByText("No testimonials")).toBeTruthy();
    svc.getContentPages.mockRejectedValueOnce("x");
    fireEvent.click(screen.getByLabelText("Refresh content"));
    expect(await screen.findByText("Failed to load content management data")).toBeTruthy();
  });

  it("filters by search and publication state", async () => {
    await renderPage();
    await screen.findByText("Refunds");
    fireEvent.change(screen.getByLabelText("Search content"), { target: { value: "  refund " } });
    await waitFor(() => expect(lastCall(svc.getContentPages)[0].search).toBe("refund"));
    expect(lastCall(svc.getFaqs)[0].search).toBe("refund");
    const select = document.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "published" } });
    await waitFor(() => expect(lastCall(svc.getContentPages)[0].isPublished).toBe(true));
    fireEvent.change(select, { target: { value: "draft" } });
    await waitFor(() => expect(lastCall(svc.getContentPages)[0].isPublished).toBe(false));
    fireEvent.change(select, { target: { value: "" } });
    await waitFor(() => expect(lastCall(svc.getContentPages)[0].isPublished).toBeUndefined());
  });

  it("opens a page into the editor and saves the tri-lingual payload", async () => {
    await renderPage();
    await act(async () => fireEvent.click(await screen.findByText("Privacy Policy", { selector: "p" })));
    expect(svc.getContentPageBySlug).toHaveBeenCalledWith("privacy-policy");
    await waitFor(() => expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Privacy Policy"));
    expect((screen.getByLabelText("Body — English") as HTMLTextAreaElement).value).toBe("English body");
    expect((screen.getByLabelText("Body — Tamil") as HTMLTextAreaElement).value).toBe("");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  " } });
    fireEvent.change(screen.getByLabelText("Excerpt"), { target: { value: "  Short  " } });
    fireEvent.change(screen.getByLabelText("Body — Tamil"), { target: { value: "Tamil body" } });
    fireEvent.change(screen.getByLabelText("Body — Sinhala"), { target: { value: "New si" } });
    fireEvent.change(screen.getByLabelText("Body — English"), { target: { value: "New en" } });
    fireEvent.click(screen.getByLabelText("Publish page"));
    await act(async () => fireEvent.click(screen.getByText("Save page")));
    expect(svc.updateContentPage).toHaveBeenCalledWith("privacy-policy", {
      title: "Untitled page",
      excerpt: "Short",
      content: { en: { body: "New en" }, si: { body: "New si" }, ta: { body: "Tamil body" } },
      isPublished: false,
    });
    // the edited page is reloaded after saving
    await waitFor(() => expect(svc.getContentPageBySlug).toHaveBeenCalledTimes(2));
  });

  it("opens pages by slug and via quick links, guarding empty slugs", async () => {
    svc.getContentPageBySlug.mockResolvedValue(
      contentPage({ slug: "faqs", title: "FAQs", excerpt: null, content: null, isPublished: false }),
    );
    await renderPage();
    await screen.findByText("Refunds");
    const slug = screen.getByLabelText("Open by slug") as HTMLInputElement;
    expect(slug.value).toBe("terms-and-conditions");
    fireEvent.change(slug, { target: { value: "   " } });
    expect((screen.getByText("Open").closest("button") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => fireEvent.click(screen.getByText("Save page")));
    expect(svc.updateContentPage).not.toHaveBeenCalled();

    fireEvent.change(slug, { target: { value: " custom-page " } });
    await act(async () => fireEvent.click(screen.getByText("Open")));
    expect(svc.getContentPageBySlug).toHaveBeenCalledWith("custom-page");

    await act(async () => fireEvent.click(screen.getByText("Terms & Conditions")));
    expect(svc.getContentPageBySlug).toHaveBeenLastCalledWith("terms-and-conditions");
    await act(async () => fireEvent.click(screen.getByText("Open FAQs page")));
    expect(svc.getContentPageBySlug).toHaveBeenLastCalledWith("faqs");
    await waitFor(() => expect((screen.getByLabelText("Excerpt") as HTMLTextAreaElement).value).toBe(""));
  });

  it("saves a new page by its typed slug before any page is loaded", async () => {
    await renderPage();
    await screen.findByText("Refunds");
    fireEvent.change(screen.getByLabelText("Page slug"), { target: { value: " new-page " } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: " New " } });
    await act(async () => fireEvent.click(screen.getByText("Save page")));
    expect(svc.updateContentPage).toHaveBeenCalledWith(
      "new-page",
      expect.objectContaining({ title: "New", excerpt: "", isPublished: false }),
    );
  });

  it("reports page load errors", async () => {
    svc.getContentPageBySlug.mockRejectedValueOnce(new Error("Page missing"));
    await renderPage();
    await act(async () => fireEvent.click(await screen.findByText("Refunds")));
    expect(await screen.findByText("Page missing")).toBeTruthy();
    svc.getContentPageBySlug.mockRejectedValueOnce("x");
    await act(async () => fireEvent.click(screen.getByText("Refunds")));
    expect(await screen.findByText("Failed to load content page")).toBeTruthy();
  });

  it("approves, deletes and edits testimonials", async () => {
    await renderPage();
    await screen.findByText("Ravi Kumar");
    await act(async () => fireEvent.click(screen.getByText("Approve")));
    expect(svc.approveTestimonial).toHaveBeenCalledWith("t1", "Approved by admin");
    await act(async () => fireEvent.click(screen.getAllByLabelText("Delete testimonial")[1]));
    expect(svc.deleteTestimonial).toHaveBeenCalledWith("t2");

    fireEvent.click(screen.getAllByText("Edit")[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: " Ravi K " } });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: " Principal " } });
    fireEvent.change(within(dialog).getByLabelText("Organization"), { target: { value: " RC " } });
    const quote = within(dialog).getByLabelText("Quote");
    fireEvent.change(quote, { target: { value: "ok" } });
    expect((within(dialog).getByText("Save testimonial").closest("button") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(quote, { target: { value: " Superb service " } });
    fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, { target: { value: "4" } });
    fireEvent.change(within(dialog).getByLabelText("Sort order"), { target: { value: "abc" } });
    fireEvent.click(within(dialog).getByLabelText("Active (visible on the landing page)"));
    await act(async () => fireEvent.click(within(dialog).getByText("Save testimonial")));
    expect(svc.updateTestimonial).toHaveBeenCalledWith("t1", {
      name: "Ravi K",
      role: "Principal",
      organization: "RC",
      quote: "Superb service",
      rating: 4,
      sortOrder: 0,
      isActive: true,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getAllByText("Edit")[1]);
    const again = await screen.findByRole("dialog");
    fireEvent.change(within(again).getByLabelText("Sort order"), { target: { value: "7" } });
    fireEvent.click(within(again).getByText("Cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("surfaces testimonial mutation errors", async () => {
    svc.deleteTestimonial.mockRejectedValueOnce("x");
    await renderPage();
    await screen.findByText("Ravi Kumar");
    await act(async () => fireEvent.click(screen.getAllByLabelText("Delete testimonial")[0]));
    expect(await screen.findByText("Content management action failed")).toBeTruthy();
  });
});

describe("useContentManagement FAQ actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getContentPages.mockResolvedValue({ items: [] });
    svc.getFaqs.mockResolvedValue({ items: [] });
    svc.getTestimonials.mockResolvedValue({ items: [] });
    svc.getContentPageBySlug.mockResolvedValue(contentPage({ slug: "faqs" }));
  });

  it("creates, updates and deletes FAQs and refreshes the open page", async () => {
    svc.createFaq.mockResolvedValue({});
    svc.updateFaq.mockResolvedValue({});
    svc.deleteFaq.mockResolvedValue({});
    const { result } = renderHook(() => useContentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.loadPage("faqs");
    });
    await act(async () => {
      await result.current.createFaq({ question: "Q?", answer: "A." } as any);
    });
    await act(async () => {
      await result.current.updateFaq("f1", { answer: "B." } as any);
    });
    await act(async () => {
      await result.current.deleteFaq("f1");
    });
    expect(svc.createFaq).toHaveBeenCalledWith({ question: "Q?", answer: "A." });
    expect(svc.updateFaq).toHaveBeenCalledWith("f1", { answer: "B." });
    expect(svc.deleteFaq).toHaveBeenCalledWith("f1");
    expect(svc.getContentPageBySlug).toHaveBeenCalledTimes(4);
    expect(result.current.selectedPage?.slug).toBe("faqs");
  });

  it("records Error messages from failed FAQ actions", async () => {
    svc.deleteFaq.mockRejectedValue(new Error("FAQ locked"));
    const { result } = renderHook(() => useContentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.deleteFaq("f1");
    });
    expect(result.current.error).toBe("FAQ locked");
  });
});
