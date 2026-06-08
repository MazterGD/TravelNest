import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

/**
 * Backfills the editable public content pages (Terms, Privacy, Refund, FAQ) into
 * the ContentPage table as per-locale, published records sourced from the web
 * app's translation files. Idempotent: pages that already have content are left
 * untouched so admin edits are never clobbered.
 *
 * Run standalone: `pnpm --filter @travenest/database backfill:content`
 */

const LOCALES = ["en", "si", "ta"] as const;
type Locale = (typeof LOCALES)[number];

// Resolved from the database package root (cwd when run via tsx or the seed).
const localesDir = path.resolve(
  process.cwd(),
  "../../apps/web/src/i18n/locales",
);

type Messages = Record<string, any>;

const readMessages = (locale: Locale): Messages =>
  JSON.parse(
    fs.readFileSync(path.join(localesDir, locale, "common.json"), "utf8"),
  );

const sectionsToBody = (
  sections: Record<string, { title: string; content: string }>,
  order: string[],
): string =>
  order
    .map((key) => sections?.[key])
    .filter(Boolean)
    .map((section) => `## ${section.title}\n\n${section.content}`)
    .join("\n\n");

const faqToBody = (
  questions: Record<string, { question: string; answer: string }>,
  order: string[],
): string =>
  order
    .map((key) => questions?.[key])
    .filter(Boolean)
    .map((item) => `## ${item.question}\n\n${item.answer}`)
    .join("\n\n");

const ORDERS = {
  terms: ["acceptance", "services", "accounts", "booking", "conduct", "liability", "changes"],
  privacy: ["intro", "collection", "use", "sharing", "security", "rights", "contact"],
  refund: ["overview", "eligibility", "process", "exceptions", "disputes", "contact"],
  faq: ["whatIs", "howToBook", "payment", "cancellation", "verification", "becomeOwner"],
};

export const buildContentPages = () => {
  const msgs = Object.fromEntries(
    LOCALES.map((locale) => [locale, readMessages(locale)]),
  ) as Record<Locale, Messages>;

  const perLocale = (build: (m: Messages) => string) =>
    Object.fromEntries(LOCALES.map((locale) => [locale, { body: build(msgs[locale]) }]));

  return [
    {
      slug: "terms-and-conditions",
      title: msgs.en.legal?.terms?.title ?? "Terms & Conditions",
      content: perLocale((m) => sectionsToBody(m.legal.terms.sections, ORDERS.terms)),
    },
    {
      slug: "privacy-policy",
      title: msgs.en.legal?.privacy?.title ?? "Privacy Policy",
      content: perLocale((m) => sectionsToBody(m.legal.privacy.sections, ORDERS.privacy)),
    },
    {
      slug: "refund-policy",
      title: msgs.en.legal?.refund?.title ?? "Refund Policy",
      content: perLocale((m) => sectionsToBody(m.legal.refund.sections, ORDERS.refund)),
    },
    {
      slug: "faqs",
      title: msgs.en.faq?.title ?? "FAQs",
      content: perLocale((m) => faqToBody(m.faq.questions, ORDERS.faq)),
    },
  ];
};

export const seedContentPages = async (
  prisma: PrismaClient,
  options: { overwrite?: boolean } = {},
) => {
  for (const page of buildContentPages()) {
    const existing = await prisma.contentPage.findUnique({
      where: { slug: page.slug },
      select: { content: true },
    });
    const hasContent = Boolean(
      existing && (existing.content as { en?: { body?: string } } | null)?.en?.body,
    );

    if (hasContent && !options.overwrite) {
      console.log(`[content] ${page.slug} already populated — skipping`);
      continue;
    }

    await prisma.contentPage.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        content: page.content as unknown as object,
        isPublished: true,
        publishedAt: new Date(),
      },
      update: {
        title: page.title,
        content: page.content as unknown as object,
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    console.log(`[content] ${page.slug} backfilled`);
  }
};

const invokedPath = (process.argv[1] ?? "").replace(/\\/g, "/");
const isDirectRun = /backfillContent\.(ts|js)$/.test(invokedPath);

if (isDirectRun) {
  const prisma = new PrismaClient();
  seedContentPages(prisma)
    .then(async () => {
      console.log("Content backfill complete.");
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error("Content backfill failed:", error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
