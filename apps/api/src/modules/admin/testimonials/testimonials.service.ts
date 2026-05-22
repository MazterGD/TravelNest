import { prisma, type Prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { parsePagination } from "../types.js";
import type { UpdateTestimonialInput } from "./testimonials.schemas.js";

type TestimonialFilters = {
  includeInactive?: boolean;
  search?: string;
};

const buildTestimonialWhere = (
  filters: TestimonialFilters,
): Prisma.TestimonialWhereInput => {
  const where: Prisma.TestimonialWhereInput = {};

  if (!filters.includeInactive) {
    where.isActive = true;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { role: { contains: filters.search, mode: "insensitive" } },
      { organization: { contains: filters.search, mode: "insensitive" } },
      { quote: { contains: filters.search, mode: "insensitive" } },
      { tripDetails: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
};

export const listTestimonials = async (
  filters: TestimonialFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildTestimonialWhere(filters);

  const [items, total] = await Promise.all([
    prisma.testimonial.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: paging.skip,
      take: paging.limit,
    }),
    prisma.testimonial.count({ where }),
  ]);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const approveTestimonial = async (
  adminId: string,
  testimonialId: string,
  note?: string,
) => {
  const existing = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new ApiError(404, "Testimonial not found");
  }

  const updated = await prisma.testimonial.update({
    where: { id: testimonialId },
    data: {
      isActive: true,
    },
  });

  await recordAuditLog(
    adminId,
    "APPROVE",
    "TESTIMONIAL",
    updated.id,
    {
      previousIsActive: existing.isActive,
      nextIsActive: updated.isActive,
      note,
    },
    `Testimonial ${updated.id} approved`,
  );

  return updated;
};

export const updateTestimonial = async (
  adminId: string,
  testimonialId: string,
  payload: UpdateTestimonialInput,
) => {
  const existing = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
  });

  if (!existing) {
    throw new ApiError(404, "Testimonial not found");
  }

  const updated = await prisma.testimonial.update({
    where: { id: testimonialId },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.role !== undefined ? { role: payload.role } : {}),
      ...(payload.organization !== undefined
        ? { organization: payload.organization }
        : {}),
      ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
      ...(payload.rating !== undefined ? { rating: payload.rating } : {}),
      ...(payload.quote !== undefined ? { quote: payload.quote } : {}),
      ...(payload.tripDetails !== undefined
        ? { tripDetails: payload.tripDetails || null }
        : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "TESTIMONIAL",
    updated.id,
    {
      previous: {
        name: existing.name,
        role: existing.role,
        organization: existing.organization,
        isActive: existing.isActive,
      },
      next: {
        name: updated.name,
        role: updated.role,
        organization: updated.organization,
        isActive: updated.isActive,
      },
      updatedFields: Object.keys(payload),
    },
    "Testimonial updated",
  );

  return updated;
};

export const deleteTestimonial = async (adminId: string, testimonialId: string) => {
  const existing = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!existing) {
    throw new ApiError(404, "Testimonial not found");
  }

  await prisma.testimonial.delete({
    where: { id: testimonialId },
  });

  await recordAuditLog(
    adminId,
    "DELETE",
    "TESTIMONIAL",
    testimonialId,
    {
      name: existing.name,
    },
    "Testimonial deleted",
  );

  return {
    id: testimonialId,
    deleted: true,
  };
};
