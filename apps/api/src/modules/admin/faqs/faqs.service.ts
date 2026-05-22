import { prisma, type Prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { parsePagination } from "../types.js";
import type { CreateFaqInput, UpdateFaqInput } from "./faqs.schemas.js";

type FaqFilters = {
  search?: string;
  category?: string;
  isPublished?: boolean;
};

const buildFaqWhere = (filters: FaqFilters): Prisma.FaqWhereInput => {
  const where: Prisma.FaqWhereInput = {};

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.isPublished !== undefined) {
    where.isPublished = filters.isPublished;
  }

  if (filters.search) {
    where.OR = [
      { question: { contains: filters.search, mode: "insensitive" } },
      { answer: { contains: filters.search, mode: "insensitive" } },
      { category: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
};

export const listFaqs = async (
  filters: FaqFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildFaqWhere(filters);

  const [items, total] = await Promise.all([
    prisma.faq.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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
    prisma.faq.count({ where }),
  ]);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const createFaq = async (adminId: string, payload: CreateFaqInput) => {
  const created = await prisma.faq.create({
    data: {
      question: payload.question,
      answer: payload.answer,
      category: payload.category,
      sortOrder: payload.sortOrder ?? 0,
      isPublished: payload.isPublished ?? true,
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
    "CREATE",
    "FAQ",
    created.id,
    {
      question: created.question,
      category: created.category,
      isPublished: created.isPublished,
    },
    "FAQ created",
  );

  return created;
};

export const updateFaq = async (
  adminId: string,
  faqId: string,
  payload: UpdateFaqInput,
) => {
  const existing = await prisma.faq.findUnique({
    where: { id: faqId },
  });

  if (!existing) {
    throw new ApiError(404, "FAQ not found");
  }

  const updated = await prisma.faq.update({
    where: { id: faqId },
    data: {
      ...(payload.question !== undefined ? { question: payload.question } : {}),
      ...(payload.answer !== undefined ? { answer: payload.answer } : {}),
      ...(payload.category !== undefined
        ? { category: payload.category || null }
        : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
      ...(payload.isPublished !== undefined
        ? { isPublished: payload.isPublished }
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
    "FAQ",
    updated.id,
    {
      previous: {
        question: existing.question,
        answer: existing.answer,
        category: existing.category,
        sortOrder: existing.sortOrder,
        isPublished: existing.isPublished,
      },
      next: {
        question: updated.question,
        answer: updated.answer,
        category: updated.category,
        sortOrder: updated.sortOrder,
        isPublished: updated.isPublished,
      },
      updatedFields: Object.keys(payload),
    },
    "FAQ updated",
  );

  return updated;
};

export const deleteFaq = async (adminId: string, faqId: string) => {
  const existing = await prisma.faq.findUnique({
    where: { id: faqId },
    select: {
      id: true,
      question: true,
    },
  });

  if (!existing) {
    throw new ApiError(404, "FAQ not found");
  }

  await prisma.faq.delete({
    where: { id: faqId },
  });

  await recordAuditLog(
    adminId,
    "DELETE",
    "FAQ",
    faqId,
    {
      question: existing.question,
    },
    "FAQ deleted",
  );

  return {
    id: faqId,
    deleted: true,
  };
};
