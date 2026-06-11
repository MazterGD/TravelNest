import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";

/**
 * Public read of a published content page. The `content` JSON is locale-keyed
 * (`{ en: {...}, si: {...}, ta: {...} }`); the web layer picks the active locale
 * and falls back to bundled translations when a locale is absent.
 */
export const getPublishedContentPage = async (slug: string) => {
  const page = await prisma.contentPage.findFirst({
    where: { slug, isPublished: true },
    select: {
      slug: true,
      title: true,
      content: true,
      updatedAt: true,
    },
  });

  if (!page) {
    throw ApiError.notFound("Content page");
  }

  return page;
};
