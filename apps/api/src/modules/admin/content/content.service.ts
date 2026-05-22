import { prisma, type Prisma } from "@travenest/database";
import { recordAuditLog } from "../audit/audit.service.js";
import { parsePagination } from "../types.js";
import type { UpdateContentPageInput } from "./content.schemas.js";

type ContentFilters = {
  search?: string;
  isPublished?: boolean;
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const toTitle = (slug: string): string =>
  slug
    .split(/[-_]/g)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const defaultPagePayload = (slug: string) => {
  const title = toTitle(slug) || "Untitled Page";

  return {
    slug,
    title,
    excerpt: `${title} content page`,
    content: {
      blocks: [
        {
          type: "paragraph",
          text: `${title} content has not been configured yet.`,
        },
      ],
    },
    isPublished: false,
    publishedAt: null,
  } as const;
};

const buildContentWhere = (filters: ContentFilters): Prisma.ContentPageWhereInput => {
  const where: Prisma.ContentPageWhereInput = {};

  if (filters.isPublished !== undefined) {
    where.isPublished = filters.isPublished;
  }

  if (filters.search) {
    where.OR = [
      { slug: { contains: filters.search, mode: "insensitive" } },
      { title: { contains: filters.search, mode: "insensitive" } },
      { excerpt: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
};

export const listContentPages = async (
  filters: ContentFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildContentWhere(filters);

  const [items, total] = await Promise.all([
    prisma.contentPage.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: paging.skip,
      take: paging.limit,
      include: {
        updatedByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            adminRole: true,
          },
        },
      },
    }),
    prisma.contentPage.count({ where }),
  ]);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getContentPageBySlug = async (slug: string) => {
  const existing = await prisma.contentPage.findUnique({
    where: { slug },
    include: {
      updatedByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });

  if (existing) {
    return existing;
  }

  const defaults = defaultPagePayload(slug);

  return prisma.contentPage.create({
    data: {
      slug: defaults.slug,
      title: defaults.title,
      excerpt: defaults.excerpt,
      content: toJsonValue(defaults.content),
      isPublished: defaults.isPublished,
      publishedAt: defaults.publishedAt,
    },
    include: {
      updatedByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });
};

export const updateContentPageBySlug = async (
  adminId: string,
  slug: string,
  payload: UpdateContentPageInput,
) => {
  const existing = await getContentPageBySlug(slug);

  const shouldSetPublishedAt = payload.isPublished === true && !existing.isPublished;
  const shouldClearPublishedAt = payload.isPublished === false;

  const updated = await prisma.contentPage.update({
    where: { id: existing.id },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.content !== undefined
        ? { content: toJsonValue(payload.content) }
        : {}),
      ...(payload.excerpt !== undefined ? { excerpt: payload.excerpt || null } : {}),
      ...(payload.seoTitle !== undefined
        ? { seoTitle: payload.seoTitle || null }
        : {}),
      ...(payload.seoDescription !== undefined
        ? { seoDescription: payload.seoDescription || null }
        : {}),
      ...(payload.isPublished !== undefined
        ? { isPublished: payload.isPublished }
        : {}),
      ...(shouldSetPublishedAt
        ? { publishedAt: new Date() }
        : shouldClearPublishedAt
          ? { publishedAt: null }
          : {}),
      updatedBy: adminId,
    },
    include: {
      updatedByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "CONTENT_PAGE",
    updated.id,
    {
      slug: updated.slug,
      previousIsPublished: existing.isPublished,
      nextIsPublished: updated.isPublished,
      updatedFields: Object.keys(payload),
    },
    `Content page ${updated.slug} updated`,
  );

  return updated;
};
