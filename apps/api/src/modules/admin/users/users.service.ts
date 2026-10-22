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
  const [user, ownerBookingCount] = await Promise.all([
    prisma.user.findUnique({
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
            vehicles: true,
          },
        },
      },
    }),
    // Count bookings where this user's vehicles were chartered (0 for non-owners)
    prisma.booking.count({ where: { vehicle: { ownerId: userId } } }),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return { ...user, ownerBookingCount };
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

/**
 * Status, password and delete actions on admin accounts are reserved for
 * SUPER_ADMIN; otherwise any admin with user permissions could reset a peer
 * admin's password and act as them (e.g. a moderator taking over finance).
 */
const assertCanManageUser = (
  actorAdminRole: string | undefined,
  target: { role: string; adminRole: string | null },
) => {
  if (target.role === "ADMIN" && actorAdminRole !== "SUPER_ADMIN") {
    throw new ApiError(403, "Only super admins can manage admin accounts");
  }
};

export const updateUserStatus = async (
  adminId: string,
  userId: string,
  payload: UserStatusUpdateInput,
  actorAdminRole?: string,
) => {
  if (adminId === userId) {
    throw new ApiError(400, "You cannot change your own account status");
  }

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
  assertCanManageUser(actorAdminRole, user);

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
  actorAdminRole?: string,
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
  assertCanManageUser(actorAdminRole, user);

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

export const deleteUser = async (
  adminId: string,
  userId: string,
  actorAdminRole?: string,
) => {
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
  assertCanManageUser(actorAdminRole, user);

  // Deleting cascades to vehicles, bookings, payments, settlements and
  // disputes, so accounts with any transaction history are suspended instead.
  const [bookings, payments, settlements, disputes] = await Promise.all([
    prisma.booking.count({
      where: { OR: [{ customerId: userId }, { vehicle: { ownerId: userId } }] },
    }),
    prisma.payment.count({ where: { userId } }),
    prisma.settlement.count({ where: { ownerId: userId } }),
    prisma.dispute.count({
      where: { OR: [{ raisedBy: userId }, { raisedAgainst: userId }] },
    }),
  ]);
  if (bookings + payments + settlements + disputes > 0) {
    throw new ApiError(
      409,
      "This account has bookings or payment history, so it can't be deleted. Suspend it instead.",
    );
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

// Matches the audit-log export cap; keeps exports bounded on a small VM.
const MAX_EXPORT_ROWS = 5000;

export const exportUsersCsv = async (filters: UserListFilters) => {
  const where = buildUserWhere(filters);
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS,
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
