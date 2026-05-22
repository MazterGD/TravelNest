"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, Input, LoadingSpinner, Select, TextArea } from "@/components/ui";
import { useContentManagement } from "./hooks/useContentManagement";

const publishedOptions = [
  { value: "", label: "All pages" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

const parseContentDraft = (value: string) => {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {
      blocks: [
        {
          type: "paragraph",
          text: value,
        },
      ],
    };
  }
};

export default function AdminContentPage() {
  const {
    isLoading,
    isMutating,
    error,
    filters,
    pagesData,
    faqData,
    testimonialData,
    selectedPage,
    setFilters,
    loadPage,
    savePage,
    createFaq,
    updateFaq,
    deleteFaq,
    approveTestimonial,
    updateTestimonial,
    deleteTestimonial,
    refetch,
  } = useContentManagement();

  const [slugInput, setSlugInput] = useState("terms-and-conditions");
  const [titleDraft, setTitleDraft] = useState("");
  const [excerptDraft, setExcerptDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("{}");
  const [isPublishedDraft, setIsPublishedDraft] = useState(false);

  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqCategory, setFaqCategory] = useState("GENERAL");

  useEffect(() => {
    if (!selectedPage) {
      return;
    }

    setSlugInput(selectedPage.slug);
    setTitleDraft(selectedPage.title);
    setExcerptDraft(selectedPage.excerpt || "");
    setContentDraft(JSON.stringify(selectedPage.content ?? {}, null, 2));
    setIsPublishedDraft(selectedPage.isPublished);
  }, [selectedPage]);

  const pages = pagesData?.items || [];
  const faqs = faqData?.items || [];
  const testimonials = testimonialData?.items || [];

  const saveSelectedPage = async () => {
    const slug = (selectedPage?.slug || slugInput).trim();
    if (!slug) {
      return;
    }

    await savePage(slug, {
      title: titleDraft.trim() || "Untitled page",
      excerpt: excerptDraft.trim(),
      content: parseContentDraft(contentDraft),
      isPublished: isPublishedDraft,
    });
  };

  const addFaq = async () => {
    if (faqQuestion.trim().length < 5 || faqAnswer.trim().length < 5) {
      return;
    }

    await createFaq({
      question: faqQuestion.trim(),
      answer: faqAnswer.trim(),
      category: faqCategory.trim() || "GENERAL",
      isPublished: true,
      sortOrder: 0,
    });

    setFaqQuestion("");
    setFaqAnswer("");
  };

  return (
    <div className="space-y-6">
      <Card className="bg-background">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-3">
            <Input
              label="Search content"
              placeholder="Slug, title, excerpt"
              value={filters.search || ""}
              onChange={(event) => setFilters({ search: event.target.value })}
            />
          </div>
          <div>
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
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void refetch()}
              disabled={isLoading || isMutating}
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => void loadPage(slugInput.trim())}
              disabled={isMutating}
            >
              <Eye className="h-4 w-4" />
              Open slug
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-error-border bg-error-bg py-4">
          <p className="text-sm font-medium text-error-text">{error}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <Card className="bg-background">
          <h2 className="text-base font-semibold text-foreground">Content pages</h2>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : pages.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No pages found.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => void loadPage(page.slug)}
                  className="w-full rounded-xl border border-border bg-muted/50 p-3 text-left transition hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{page.title}</p>
                    <Badge variant={page.isPublished ? "success" : "secondary"}>
                      {page.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{page.slug}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(page.updatedAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-background">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Page editor</h2>
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
            <TextArea
              label="Content JSON"
              rows={12}
              value={contentDraft}
              onChange={(event) => setContentDraft(event.target.value)}
            />
            <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={isPublishedDraft}
                onChange={(event) => setIsPublishedDraft(event.target.checked)}
                className="h-4 w-4 rounded border border-border"
              />
              Publish page
            </label>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="bg-background">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">FAQ manager</h2>
            <Button variant="secondary" onClick={() => void addFaq()} disabled={isMutating}>
              <Plus className="h-4 w-4" />
              Add FAQ
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-3">
              <Input
                label="Question"
                value={faqQuestion}
                onChange={(event) => setFaqQuestion(event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <TextArea
                label="Answer"
                rows={4}
                value={faqAnswer}
                onChange={(event) => setFaqAnswer(event.target.value)}
              />
            </div>
            <div>
              <Input
                label="Category"
                value={faqCategory}
                onChange={(event) => setFaqCategory(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {faqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No FAQs available.</p>
            ) : (
              faqs.slice(0, 25).map((faq) => (
                <div
                  key={faq.id}
                  className="rounded-xl border border-border bg-muted/50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{faq.question}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void updateFaq(faq.id, { isPublished: !faq.isPublished })
                        }
                        disabled={isMutating}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {faq.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void deleteFaq(faq.id)}
                        disabled={isMutating}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{faq.answer}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="bg-background">
          <h2 className="text-base font-semibold text-foreground">Testimonials approval</h2>
          <div className="mt-4 space-y-2">
            {testimonials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No testimonials available.</p>
            ) : (
              testimonials.slice(0, 16).map((testimonial) => (
                <div
                  key={testimonial.id}
                  className="rounded-xl border border-border bg-muted/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                    <Badge variant={testimonial.isActive ? "success" : "warning"}>
                      {testimonial.isActive ? "Active" : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{testimonial.quote}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!testimonial.isActive && (
                      <Button
                        size="sm"
                        onClick={() => void approveTestimonial(testimonial.id, "Approved by admin")}
                        disabled={isMutating}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Approve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void updateTestimonial(testimonial.id, {
                          quote: `${testimonial.quote} (updated)`,
                        })
                      }
                      disabled={isMutating}
                    >
                      Update quote
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void deleteTestimonial(testimonial.id)}
                      disabled={isMutating}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
