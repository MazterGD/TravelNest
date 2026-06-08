"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { publicContentService } from "@/lib/api";

function PolicyBody({ body }: { body: string }) {
  // Lightweight renderer: blocks split by blank lines; a "## " prefix is a heading.
  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {blocks.map((block, index) =>
        block.startsWith("## ") ? (
          <h2
            key={index}
            className="text-xl font-semibold text-foreground mb-3"
          >
            {block.slice(3).trim()}
          </h2>
        ) : (
          <p
            key={index}
            className="text-muted-foreground leading-relaxed whitespace-pre-line"
          >
            {block}
          </p>
        ),
      )}
    </div>
  );
}

/**
 * Renders admin-published, per-locale content for a slug when available, falling
 * back to the bundled (translated) content otherwise. This keeps the tri-lingual
 * experience intact: each locale shows its own DB content, or its translation.
 */
export function PolicyContent({
  slug,
  fallback,
}: {
  slug: string;
  fallback: React.ReactNode;
}) {
  const locale = useLocale();
  const [body, setBody] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    publicContentService
      .getPage(slug)
      .then((res) => {
        const localized = (
          res.page.content as Record<string, { body?: string }> | null
        )?.[locale];
        const text =
          typeof localized?.body === "string" && localized.body.trim()
            ? localized.body
            : null;
        if (active) setBody(text);
      })
      .catch(() => {
        // No published DB content for this slug — keep the translation fallback.
        if (active) setBody(null);
      });
    return () => {
      active = false;
    };
  }, [slug, locale]);

  if (body) {
    return <PolicyBody body={body} />;
  }
  return <>{fallback}</>;
}
