import bcrypt from "bcryptjs";
import prisma from "@travenest/database";
import xss from "xss";
import { ApiError } from "../../../middleware/errorHandler.js";
import { parsePagination } from "../types.js";
import { recordAuditLog } from "../audit/audit.service.js";
import type {
  ChangeAdminPasswordInput,
  UpdateAdminProfileInput,
} from "./profile.schemas.js";

const sanitizeText = (value: string): string =>
  xss(value.trim(), {
    whiteList: {},
    stripIgnoreTag: true,
  });

export const getAdminProfile = async (adminId: string) => {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      role: true,
      adminRole: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      _count: {
        select: {
          adminPermissions: true,
          auditLogs: true,
        },
      },
    },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw ApiError.notFound("Admin profile");
  }

  return admin;
};

export const updateAdminProfile = async (
  adminId: string,
  payload: UpdateAdminProfileInput,
) => {
  const updateData: Record<string, string> = {};

  if (payload.firstName !== undefined) {
    updateData.firstName = sanitizeText(payload.firstName);
  }

  if (payload.lastName !== undefined) {
    updateData.lastName = sanitizeText(payload.lastName);
  }

  if (payload.phone !== undefined) {
    updateData.phone = sanitizeText(payload.phone);
  }

  const updated = await prisma.user.update({
    where: { id: adminId },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      adminRole: true,
      updatedAt: true,
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "ADMIN_PROFILE",
    adminId,
    {
      updatedFields: Object.keys(updateData),
    },
    "Admin profile updated",
  );

  return updated;
};

export const changeAdminPassword = async (
  adminId: string,
  payload: ChangeAdminPasswordInput,
) => {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      password: true,
      tokenVersion: true,
      role: true,
    },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw ApiError.notFound("Admin profile");
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    payload.currentPassword,
    admin.password,
  );

  if (!isCurrentPasswordValid) {
    throw ApiError.badRequest("Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: { id: adminId },
    data: {
      password: hashedPassword,
      tokenVersion: admin.tokenVersion + 1,
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "ADMIN_PASSWORD",
    adminId,
    {
      tokenVersionUpdated: true,
    },
    "Admin password changed",
  );

  return {
    message: "Password changed successfully",
  };
};

export const getAdminActivity = async (
  adminId: string,
  pageInput?: number,
  limitInput?: number,
  action?: string,
  status?: "success" | "failure",
) => {
  const paging = parsePagination(pageInput, limitInput);

  const where = {
    adminId,
    ...(action ? { action } : {}),
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getAdminPermissions = async (adminId: string) => {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      email: true,
      adminRole: true,
      role: true,
      adminPermissions: {
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { permission: "asc" },
        select: {
          permission: true,
          grantedAt: true,
          grantedBy: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw ApiError.notFound("Admin profile");
  }

  const explicitPermissions = admin.adminPermissions.map((entry) => entry.permission);
  const effectivePermissions =
    admin.adminRole === "SUPER_ADMIN"
      ? ["*"]
      : explicitPermissions;

  return {
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.adminRole,
    },
    explicitPermissions: admin.adminPermissions,
    effectivePermissions,
  };
};
