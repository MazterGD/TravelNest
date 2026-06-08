"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  FileText,
  HelpCircle,
  Quote,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Badge,
  Button,
  Card,
  EmptyBoxIcon,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonList,
  TextArea,
} from "@/components/ui";
import type { AdminTestimonial } from "@/lib/api";
import { useContentManagement } from "./hooks/useContentManagement";

const publishedOptions = [
  { value: "", label: "All pages" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

const ratingOptions = [1, 2, 3, 4, 5].map((value) => ({
  value: String(value),
  label: `${value} star${value === 1 ? "" : "s"}`,
}));

interface TestimonialEditState {
  id: string;
  name: string;
  role: string;
  organization: string;
  quote: string;
  rating: number;
  sortOrder: number;
  isActive: boolean;
}

export default function AdminContentPage() {
  const {
    isLoading,
    isMutating,
    error,
    filters,
    pagesData,
    testimonialData,
    selectedPage,
    setFilters,
    loadPage,
    savePage,
    approveTestimonial,
    updateTestimonial,
    deleteTestimonial,
    refetch,
  } = useContentManagement();

  const [slugInput, setSlugInput] = useState("terms-and-conditions");
  const [titleDraft, setTitleDraft] = useState("");
  const [excerptDraft, setExcerptDraft] = useState("");
  // Per-locale body content (en/si/ta) stored under content[locale].body.
  const [bodyEn, setBodyEn] = useState("");
  const [bodySi, setBodySi] = useState("");
  const [bodyTa, setBodyTa] = useState("");
  const [isPublishedDraft, setIsPublishedDraft] = useState(false);

  const [testimonialEdit, setTestimonialEdit] =
    useState<TestimonialEditState | null>(null);

  useEffect(() => {
    if (!selectedPage) {
      return;
    }

    setSlugInput(selectedPage.slug);
    setTitleDraft(selectedPage.title);
    setExcerptDraft(selectedPage.excerpt || "");
    const localized = (selectedPage.content ?? {}) as Record<
      string,
      { body?: string } | undefined
    >;
    setBodyEn(localized.en?.body ?? "");
    setBodySi(localized.si?.body ?? "");
    setBodyTa(localized.ta?.body ?? "");
    setIsPublishedDraft(selectedPage.isPublished);
  }, [selectedPage]);

  const pages = pagesData?.items || [];
  const testimonials = testimonialData?.items || [];

  const saveSelectedPage = async () => {
    const slug = (selectedPage?.slug || slugInput).trim();
    if (!slug) {
      return;
    }

    await savePage(slug, {
      title: titleDraft.trim() || "Untitled page",
      excerpt: excerptDraft.trim(),
      content: {
        en: { body: bodyEn },
        si: { body: bodySi },
        ta: { body: bodyTa },
      },
      isPublished: isPublishedDraft,
    });
  };

  const openCanonicalPage = (slug: string) => {
    setSlugInput(slug);
    void loadPage(slug);
  };

  const openTestimonialEditor = (testimonial: AdminTestimonial) => {
    setTestimonialEdit({
      id: testimonial.id,
      name: testimonial.name,
      role: testimonial.role,
      organization: testimonial.organization,
      quote: testimonial.quote,
      rating: testimonial.rating,
      sortOrder: testimonial.sortOrder,
      isActive: testimonial.isActive,
    });
  };

  const saveTestimonialEditor = async () => {
    if (!testimonialEdit) return;

    await updateTestimonial(testimonialEdit.id, {
      name: testimonialEdit.name.trim(),
      role: testimonialEdit.role.trim(),
      organization: testimonialEdit.organization.trim(),
      quote: testimonialEdit.quote.trim(),
      rating: testimonialEdit.rating,
      sortOrder: testimonialEdit.sortOrder,
      isActive: testimonialEdit.isActive,
    });
    setTestimonialEdit(null);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Content Management
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage static pages, FAQs and customer testimonials shown across the platform.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading || isMutating}
          aria-label="Refresh content"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filter bar */}
      <Card className="bg-[var(--color-bg-base)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search content"
              placeholder="Slug, title or excerpt"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div className="w-full sm:w-[160px]">
            <Select
              label="Publication"
              options={publishedOptions}
              value={
                filters.isPublished === undefined
                  ? ""
                  : filters.isPublished
                    ? "published"
                    : "draft"
              }
              onChange={(value) =>
                setFilters({
                  isPublished:
                    value === "published"
                      ? true
                      : value === "draft"
                        ? false
                        : undefined,
                })
              }
            />
          </div>
          <div className="flex w-full items-end gap-2 sm:w-auto">
            <div className="min-w-[180px] flex-1">
              <Input
                label="Open by slug"
                placeholder="terms-and-conditions"
                value={slugInput}
                onChange={(event) => setSlugInput(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => void loadPage(slugInput.trim())}
              disabled={isMutating || slugInput.trim().length === 0}
            >
              <Eye className="h-4 w-4" />
              Open
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick-open canonical legal pages */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
          Quick open:
        </span>
        {[
          { slug: "terms-and-conditions", label: "Terms & Conditions" },
          { slug: "privacy-policy", label: "Privacy Policy" },
          { slug: "refund-policy", label: "Refund Policy" },
          { slug: "faqs", label: "FAQs (## per question)" },
        ].map((page) => (
          <button
            key={page.slug}
            type="button"
            onClick={() => openCanonicalPage(page.slug)}
            disabled={isMutating}
            className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-action-primary)]/60 hover:bg-[var(--color-bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] disabled:opacity-50"
          >
            {page.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-[20px] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-5 py-4"
        >
          <p className="text-sm font-semibold text-[var(--color-error-text)]">
            Could not complete the content action.
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-error-text)]/80">{error}</p>
        </div>
      )}

      {/* Pages + editor */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <Card className="bg-[var(--color-bg-base)]">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
            <FileText className="h-4 w-4 text-[var(--color-action-primary)]" />
            Content pages
          </h2>

          {isLoading ? (
            <div className="mt-4">
              <SkeletonList count={4} />
            </div>
          ) : pages.length === 0 ? (
            <EmptyState
              icon={<EmptyBoxIcon />}
              title="No pages found"
              description="Open a page by slug to create and configure it."
            />
          ) : (
            <div className="mt-4 space-y-2">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => void loadPage(page.slug)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]",
                    selectedPage?.slug === page.slug
                      ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5"
                      : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] hover:border-[var(--color-action-primary)]/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {page.title}
                    </p>
                    <Badge variant={page.isPublished ? "success" : "secondary"} dot>
                      {page.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-[var(--color-text-tertiary)]">
                    {page.slug}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    Updated {new Date(page.updatedAt).toLocaleString("en-GB")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-[var(--color-bg-base)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Page editor
            </h2>
            <Button onClick={() => void saveSelectedPage()} disabled={isMutating}>
              <Save className="h-4 w-4" />
              Save page
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <Input
              label="Page slug"
              value={slugInput}
              onChange={(event) => setSlugInput(event.target.value)}
            />
            <Input
              label="Title"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
            <TextArea
              label="Excerpt"
              rows={3}
              value={excerptDraft}
              onChange={(event) => setExcerptDraft(event.target.value)}
            />
            <div className="space-y-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Body content per language. Separate paragraphs with a blank line;
                start a line with <code className="font-mono">##</code> for a heading.
                A language left blank falls back to the built-in translation on the
                public page.
              </p>
              <TextArea
                label="Body — English"
                rows={6}
                value={bodyEn}
                onChange={(event) => setBodyEn(event.target.value)}
              />
              <TextArea
                label="Body — Sinhala"
                rows={6}
                value={bodySi}
                onChange={(event) => setBodySi(event.target.value)}
              />
              <TextArea
                label="Body — Tamil"
                rows={6}
                value={bodyTa}
                onChange={(event) => setBodyTa(event.target.value)}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={isPublishedDraft}
                onChange={(event) => setIsPublishedDraft(event.target.checked)}
                className="h-4 w-4 rounded border border-[var(--color-border-default)]"
              />
              Publish page
            </label>
          </div>
        </Card>
      </div>

      {/* FAQ + testimonials */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="bg-[var(--color-bg-base)]">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
            <HelpCircle className="h-4 w-4 text-[var(--color-action-primary)]" />
            FAQs
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            FAQs are managed per language as a content page so they stay
            tri-lingual. Open the FAQs page, then add one entry per question on a
            line starting with <code className="font-mono">##</code> for the
            question, followed by its answer.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => openCanonicalPage("faqs")}
            disabled={isMutating}
          >
            <Eye className="h-4 w-4" />
            Open FAQs page
          </Button>
        </Card>

        <Card className="bg-[var(--color-bg-base)]">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
            <Quote className="h-4 w-4 text-[var(--color-action-primary)]" />
            Testimonials
          </h2>
          <div className="mt-4 space-y-2">
            {testimonials.length === 0 ? (
              <EmptyState
                icon={<EmptyBoxIcon />}
                title="No testimonials"
                description="Customer testimonials awaiting approval will appear here."
              />
            ) : (
              testimonials.slice(0, 16).map((testimonial) => (
                <div
                  key={testimonial.id}
                  className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {testimonial.name}
                    </p>
                    <Badge variant={testimonial.isActive ? "success" : "warning"} size="sm">
                      {testimonial.isActive ? "Active" : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                    “{testimonial.quote}”
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {!testimonial.isActive && (
                      <Button
                        size="sm"
                        onClick={() =>
                          void approveTestimonial(testimonial.id, "Approved by admin")
                        }
                        disabled={isMutating}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Approve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTestimonialEditor(testimonial)}
                      disabled={isMutating}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void deleteTestimonial(testimonial.id)}
                      disabled={isMutating}
                      aria-label="Delete testimonial"
                      className="text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Testimonial editor modal */}
      <Modal
        isOpen={Boolean(testimonialEdit)}
        onClose={() => setTestimonialEdit(null)}
        title="Edit testimonial"
        size="sm"
      >
        {testimonialEdit && (
          <div className="space-y-3">
            <Input
              label="Name"
              value={testimonialEdit.name}
              onChange={(event) =>
                setTestimonialEdit((prev) =>
                  prev ? { ...prev, name: event.target.value } : prev,
                )
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Role"
                value={testimonialEdit.role}
                onChange={(event) =>
                  setTestimonialEdit((prev) =>
                    prev ? { ...prev, role: event.target.value } : prev,
                  )
                }
              />
              <Input
                label="Organization"
                value={testimonialEdit.organization}
                onChange={(event) =>
                  setTestimonialEdit((prev) =>
                    prev ? { ...prev, organization: event.target.value } : prev,
                  )
                }
              />
            </div>
            <TextArea
              label="Quote"
              rows={4}
              value={testimonialEdit.quote}
              onChange={(event) =>
                setTestimonialEdit((prev) =>
                  prev ? { ...prev, quote: event.target.value } : prev,
                )
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Rating"
                options={ratingOptions}
                value={String(testimonialEdit.rating)}
                onChange={(value) =>
                  setTestimonialEdit((prev) =>
                    prev ? { ...prev, rating: Number(value) } : prev,
                  )
                }
              />
              <Input
                label="Sort order"
                type="number"
                value={String(testimonialEdit.sortOrder)}
                onChange={(event) =>
                  setTestimonialEdit((prev) =>
                    prev
                      ? { ...prev, sortOrder: Number(event.target.value) || 0 }
                      : prev,
                  )
                }
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={testimonialEdit.isActive}
                onChange={(event) =>
                  setTestimonialEdit((prev) =>
                    prev ? { ...prev, isActive: event.target.checked } : prev,
                  )
                }
                className="h-4 w-4 rounded border border-[var(--color-border-default)]"
              />
              Active (visible on the landing page)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTestimonialEdit(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => void saveTestimonialEditor()}
                isLoading={isMutating}
                disabled={isMutating || testimonialEdit.quote.trim().length < 3}
              >
                <Save className="h-4 w-4" />
                Save testimonial
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
