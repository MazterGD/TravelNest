import { prisma } from "@travenest/database";
import bcrypt from "bcryptjs";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { buildCsv, parsePagination } from "../types.js";
import type { CreateAdminInput, UserStatusUpdateInput } from "./users.schemas.js";

type UserListFilters = {
  search?: string;
  role?: "CUSTOMER" | "VEHICLE_OWNER" | "ADMIN";
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  adminRole?: "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN";
};

const buildUserWhere = (filters: UserListFilters) => {
  const where: Record<string, unknown> = {};

  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.adminRole) {
    where.adminRole = filters.adminRole;
  }

  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
};

export const getUsers = async (
  filters: UserListFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildUserWhere(filters);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        adminRole: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            bookings: true,
            reviews: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getUserDetails = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      role: true,
      status: true,
      adminRole: true,
      isVerified: true,
      address: true,
      city: true,
      district: true,
      postalCode: true,
      baseLocation: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          bookings: true,
          reviews: true,
          notifications: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

export const getUserActivity = async (
  userId: string,
  page?: number,
  limit?: number,
) => {
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!userExists) {
    throw new ApiError(404, "User not found");
  }

  const paging = parsePagination(page, limit);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        OR: [
          { adminId: userId },
          { entityType: "USER", entityId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.limit,
    }),
    prisma.auditLog.count({
      where: {
        OR: [
          { adminId: userId },
          { entityType: "USER", entityId: userId },
        ],
      },
    }),
  ]);

  return {
    logs,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const updateUserStatus = async (
  adminId: string,
  userId: string,
  payload: UserStatusUpdateInput,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      role: true,
      adminRole: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "ADMIN" && user.adminRole === "SUPER_ADMIN") {
    throw new ApiError(403, "Cannot change SUPER_ADMIN status");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: payload.status },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      role: true,
      adminRole: true,
      updatedAt: true,
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "USER",
    userId,
    {
      previousStatus: user.status,
      newStatus: payload.status,
      reason: payload.reason,
    },
    `User status updated to ${payload.status}`,
  );

  return updated;
};

export const createAdminUser = async (adminId: string, payload: CreateAdminInput) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new ApiError(409, "Email is already in use");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);

  const created = await prisma.user.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email.toLowerCase(),
      phone: payload.phone,
      password: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE",
      adminRole: payload.adminRole,
      isVerified: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      adminRole: true,
      createdAt: true,
    },
  });

  if (payload.permissions?.length) {
    await prisma.adminPermission.createMany({
      data: payload.permissions.map((permission) => ({
        adminId: created.id,
        permission,
        grantedBy: adminId,
      })),
      skipDuplicates: true,
    });
  }

  await recordAuditLog(
    adminId,
    "CREATE",
    "ADMIN_USER",
    created.id,
    {
      adminRole: payload.adminRole,
      permissions: payload.permissions ?? [],
    },
    `Created admin user ${created.email}`,
  );

  return created;
};

export const resetUserPassword = async (
  adminId: string,
  userId: string,
  newPassword: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      adminRole: true,
      tokenVersion: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "ADMIN" && user.adminRole === "SUPER_ADMIN") {
    throw new ApiError(403, "Cannot reset SUPER_ADMIN password from this endpoint");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      tokenVersion: user.tokenVersion + 1,
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "USER_PASSWORD",
    userId,
    {
      previousTokenVersion: user.tokenVersion,
      nextTokenVersion: user.tokenVersion + 1,
    },
    `Password reset for ${user.email}`,
  );

  return { success: true };
};

export const deleteUser = async (adminId: string, userId: string) => {
  if (adminId === userId) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      adminRole: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "ADMIN" && user.adminRole === "SUPER_ADMIN") {
    throw new ApiError(403, "Cannot delete SUPER_ADMIN account");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  await recordAuditLog(
    adminId,
    "DELETE",
    "USER",
    userId,
    {
      email: user.email,
      role: user.role,
      adminRole: user.adminRole,
    },
    `Deleted user ${user.email}`,
  );

  return {
    id: userId,
    deleted: true,
  };
};

export const exportUsersCsv = async (filters: UserListFilters) => {
  const where = buildUserWhere(filters);
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      adminRole: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const rows = users.map((user) => [
    user.id,
    user.firstName,
    user.lastName,
    user.email,
    user.phone ?? "",
    user.role,
    user.status,
    user.adminRole ?? "",
    user.isVerified ? "yes" : "no",
    user.createdAt.toISOString(),
    user.updatedAt.toISOString(),
  ]);

  return buildCsv(
    [
      "id",
      "firstName",
      "lastName",
      "email",
      "phone",
      "role",
      "status",
      "adminRole",
      "isVerified",
      "createdAt",
      "updatedAt",
    ],
    rows,
  );
};
