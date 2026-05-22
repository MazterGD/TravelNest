import { prisma, type Prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { parsePagination } from "../types.js";
import type {
  CreateAmenityInput,
  UpdateAmenityInput,
} from "./amenities.schemas.js";

type AmenityFilters = {
  search?: string;
  includeInactive?: boolean;
};

const normalizeCode = (value: string): string =>
  value.trim().toUpperCase().replace(/\s+/g, "_");

const buildAmenityWhere = (filters: AmenityFilters): Prisma.AmenityWhereInput => {
  const where: Prisma.AmenityWhereInput = {};

  if (!filters.includeInactive) {
    where.isActive = true;
  }

  if (filters.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
};

export const listAmenities = async (
  filters: AmenityFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildAmenityWhere(filters);

  const [items, total] = await Promise.all([
    prisma.amenity.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
    prisma.amenity.count({ where }),
  ]);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const createAmenity = async (
  adminId: string,
  payload: CreateAmenityInput,
) => {
  const created = await prisma.amenity.create({
    data: {
      code: normalizeCode(payload.code),
      name: payload.name,
      description: payload.description,
      icon: payload.icon,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
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
    "AMENITY",
    created.id,
    {
      code: created.code,
      name: created.name,
      isActive: created.isActive,
    },
    "Amenity created",
  );

  return created;
};

export const updateAmenity = async (
  adminId: string,
  amenityId: string,
  payload: UpdateAmenityInput,
) => {
  const existing = await prisma.amenity.findUnique({
    where: { id: amenityId },
  });

  if (!existing) {
    throw new ApiError(404, "Amenity not found");
  }

  const updated = await prisma.amenity.update({
    where: { id: amenityId },
    data: {
      ...(payload.code !== undefined ? { code: normalizeCode(payload.code) } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description || null }
        : {}),
      ...(payload.icon !== undefined ? { icon: payload.icon || null } : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
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
    "AMENITY",
    updated.id,
    {
      previous: {
        code: existing.code,
        name: existing.name,
        isActive: existing.isActive,
      },
      next: {
        code: updated.code,
        name: updated.name,
        isActive: updated.isActive,
      },
      updatedFields: Object.keys(payload),
    },
    "Amenity updated",
  );

  return updated;
};

export const deleteAmenity = async (adminId: string, amenityId: string) => {
  const existing = await prisma.amenity.findUnique({
    where: { id: amenityId },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new ApiError(404, "Amenity not found");
  }

  await prisma.amenity.update({
    where: { id: amenityId },
    data: {
      isActive: false,
      updatedBy: adminId,
    },
  });

  await recordAuditLog(
    adminId,
    "DELETE",
    "AMENITY",
    amenityId,
    {
      code: existing.code,
      name: existing.name,
      previousIsActive: existing.isActive,
      nextIsActive: false,
    },
    "Amenity archived",
  );

  return {
    id: amenityId,
    deleted: true,
  };
};
