import type { NextFunction, Request, Response } from "express";
import prisma, { type AdminRole } from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";

declare global {
  namespace Express {
    interface Request {
      adminRole?: AdminRole;
    }
  }
}

const SUPER_ADMIN: AdminRole = "SUPER_ADMIN";

const resolveAdminRole = async (req: Request): Promise<AdminRole> => {
  if (!req.user) {
    throw ApiError.unauthorized("Authentication required");
  }

  if (req.user.role !== "ADMIN") {
    throw ApiError.forbidden("Admin access required");
  }

  if (req.adminRole) {
    return req.adminRole;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { adminRole: true },
  });

  if (!user?.adminRole) {
    throw ApiError.forbidden("Admin role is not configured");
  }

  req.adminRole = user.adminRole;
  return user.adminRole;
};

export const requireAdminRole = (...allowedRoles: AdminRole[]) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const adminRole = await resolveAdminRole(req);

      if (allowedRoles.length > 0 && !allowedRoles.includes(adminRole)) {
        next(ApiError.forbidden("Insufficient admin role"));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireAdminPermission = (permission: string) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const adminRole = await resolveAdminRole(req);

      if (adminRole === SUPER_ADMIN) {
        next();
        return;
      }

      if (!req.user) {
        next(ApiError.unauthorized("Authentication required"));
        return;
      }

      const permissionRecord = await prisma.adminPermission.findFirst({
        where: {
          adminId: req.user.id,
          permission,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      });

      if (!permissionRecord) {
        next(ApiError.forbidden("Missing admin permission"));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
