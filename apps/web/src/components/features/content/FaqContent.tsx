"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Accordion, AccordionItem } from "@/components/ui";
import { publicContentService } from "@/lib/api";

interface QA {
  question: string;
  answer: string;
}

/** Parse a per-locale FAQ body: each "## Question" line starts a Q&A entry. */
function parseFaqBody(body: string): QA[] {
  const items: QA[] = [];
  let current: QA | null = null;
  const answerLines: string[] = [];

  const flush = () => {
    if (current) {
      current.answer = answerLines.join("\n").trim();
      items.push(current);
    }
  };

  for (const line of body.split("\n")) {
    if (line.trim().startsWith("## ")) {
      flush();
      current = { question: line.trim().slice(3).trim(), answer: "" };
      answerLines.length = 0;
    } else if (current) {
      answerLines.push(line);
    }
  }
  flush();

  return items.filter((item) => item.question);
}

/**
 * Renders admin-published, per-locale FAQs (from the `faqs` content page) when
 * available, otherwise the bundled translated FAQ accordion.
 */
export function FaqContent({ fallback }: { fallback: React.ReactNode }) {
  const locale = useLocale();
  const [items, setItems] = useState<QA[] | null>(null);

  useEffect(() => {
    let active = true;
    publicContentService
      .getPage("faqs")
      .then((res) => {
        const localized = (
          res.page.content as Record<string, { body?: string }> | null
        )?.[locale];
        const parsed =
          typeof localized?.body === "string"
            ? parseFaqBody(localized.body)
            : [];
        if (active) setItems(parsed.length > 0 ? parsed : null);
      })
      .catch(() => {
        if (active) setItems(null);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  if (items && items.length > 0) {
    return (
      <Accordion>
        {items.map((item, index) => (
          <AccordionItem
            key={index}
            title={item.question}
            defaultOpen={index === 0}
          >
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {item.answer}
            </p>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }

  return <>{fallback}</>;
}
