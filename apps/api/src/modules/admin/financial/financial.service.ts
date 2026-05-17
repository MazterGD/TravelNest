import {
  decryptSettlementBankValue,
  maskSettlementBankAccountName,
  maskSettlementBankAccountNumber,
  maskSettlementBankCode,
  prisma,
  type Prisma,
} from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { parsePagination } from "../types.js";
import type {
  CreateCommissionRuleInput,
  ProcessSettlementInput,
  SettlementStatus,
  UpdateCommissionRuleInput,
} from "./financial.schemas.js";

type SettlementFilters = {
  search?: string;
  status?: SettlementStatus;
  period?: string;
  ownerId?: string;
};

type SettlementBankFields = {
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankCode: string | null;
};

const safeDecryptSettlementBankField = (value: string | null) => {
  try {
    return decryptSettlementBankValue(value);
  } catch {
    return value;
  }
};

const sanitizeSettlementBankFields = <T extends SettlementBankFields>(
  settlement: T,
) => {
  const decryptedAccountName = safeDecryptSettlementBankField(
    settlement.bankAccountName,
  );
  const decryptedAccountNumber = safeDecryptSettlementBankField(
    settlement.bankAccountNumber,
  );
  const decryptedBankCode = safeDecryptSettlementBankField(settlement.bankCode);

  return {
    ...settlement,
    bankAccountName: maskSettlementBankAccountName(decryptedAccountName),
    bankAccountNumber: maskSettlementBankAccountNumber(decryptedAccountNumber),
    bankCode: maskSettlementBankCode(decryptedBankCode),
  };
};

const buildSettlementWhere = (
  filters: SettlementFilters,
): Prisma.SettlementWhereInput => {
  const where: Prisma.SettlementWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.period) {
    where.period = filters.period;
  }

  if (filters.ownerId) {
    where.ownerId = filters.ownerId;
  }

  if (filters.search) {
    where.OR = [
      { settlementCode: { contains: filters.search, mode: "insensitive" } },
      { period: { contains: filters.search, mode: "insensitive" } },
      {
        owner: {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  return where;
};

const resolveSettlementWhere = (
  settlementId: string,
): Prisma.SettlementWhereInput => ({
  OR: [{ id: settlementId }, { settlementCode: settlementId }],
});

export const getSettlements = async (
  filters: SettlementFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildSettlementWhere(filters);

  const [items, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
      ],
      skip: paging.skip,
      take: paging.limit,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        processedByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            adminRole: true,
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    }),
    prisma.settlement.count({ where }),
  ]);

  return {
    items: items.map((settlement) => sanitizeSettlementBankFields(settlement)),
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getSettlementDetails = async (settlementId: string) => {
  const settlement = await prisma.settlement.findFirst({
    where: resolveSettlementWhere(settlementId),
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          isVerified: true,
        },
      },
      processedByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
      bookings: {
        include: {
          booking: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              pickupLocation: true,
              dropoffLocation: true,
              totalAmount: true,
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  licensePlate: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!settlement) {
    throw new ApiError(404, "Settlement not found");
  }

  return sanitizeSettlementBankFields(settlement);
};

export const processSettlement = async (
  adminId: string,
  settlementId: string,
  payload: ProcessSettlementInput,
) => {
  const settlement = await prisma.settlement.findFirst({
    where: resolveSettlementWhere(settlementId),
    select: {
      id: true,
      settlementCode: true,
      ownerId: true,
      status: true,
      processedBy: true,
      notes: true,
    },
  });

  if (!settlement) {
    throw new ApiError(404, "Settlement not found");
  }

  const nextStatus = payload.status ?? "COMPLETED";

  if (settlement.status === "COMPLETED" && nextStatus === "COMPLETED") {
    throw new ApiError(400, "Settlement has already been completed");
  }

  const processed = await prisma.$transaction(async (tx) => {
    const updated = await tx.settlement.update({
      where: { id: settlement.id },
      data: {
        status: nextStatus,
        processedBy: adminId,
        processedAt: new Date(),
        notes: payload.notes ?? settlement.notes,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        processedByAdmin: {
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

    await tx.notification.create({
      data: {
        userId: settlement.ownerId,
        type: "settlement_update",
        title: "Settlement updated",
        message: `Settlement ${settlement.settlementCode} has been marked as ${nextStatus}.`,
        data: {
          settlementId: settlement.id,
          settlementCode: settlement.settlementCode,
          status: nextStatus,
        },
      },
    });

    return updated;
  });

  await recordAuditLog(
    adminId,
    "PROCESS",
    "SETTLEMENT",
    settlement.id,
    {
      previousStatus: settlement.status,
      newStatus: nextStatus,
      previousProcessedBy: settlement.processedBy,
      newProcessedBy: adminId,
      notes: payload.notes,
    },
    `Settlement ${settlement.settlementCode} processed`,
  );

  return processed;
};

export const getSettlementHistory = async (
  filters: SettlementFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildSettlementWhere(filters);

  where.status = filters.status ?? {
    in: ["COMPLETED", "FAILED", "CANCELLED"],
  };

  const [items, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      orderBy: {
        processedAt: "desc",
      },
      skip: paging.skip,
      take: paging.limit,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        processedByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            adminRole: true,
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    }),
    prisma.settlement.count({ where }),
  ]);

  return {
    items: items.map((settlement) => sanitizeSettlementBankFields(settlement)),
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getCommissionRules = async (includeInactive?: boolean) => {
  return prisma.commissionRule.findMany({
    where: includeInactive
      ? undefined
      : {
          isActive: true,
        },
    orderBy: [
      { isActive: "desc" },
      { createdAt: "desc" },
    ],
  });
};

const mapCommissionRuleInputToData = (
  payload: CreateCommissionRuleInput | UpdateCommissionRuleInput,
) => ({
  ...(payload.name !== undefined ? { name: payload.name } : {}),
  ...(payload.type !== undefined ? { type: payload.type } : {}),
  ...(payload.percentage !== undefined ? { percentage: payload.percentage } : {}),
  ...(payload.fixedAmount !== undefined ? { fixedAmount: payload.fixedAmount } : {}),
  ...(payload.minAmount !== undefined ? { minAmount: payload.minAmount } : {}),
  ...(payload.maxAmount !== undefined ? { maxAmount: payload.maxAmount } : {}),
  ...(payload.tiers !== undefined
    ? { tiers: payload.tiers as unknown as Prisma.InputJsonValue }
    : {}),
  ...(payload.appliesFrom !== undefined ? { appliesFrom: payload.appliesFrom } : {}),
  ...(payload.appliesTo !== undefined ? { appliesTo: payload.appliesTo } : {}),
  ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
});

export const createCommissionRule = async (
  adminId: string,
  payload: CreateCommissionRuleInput,
) => {
  const mappedData = mapCommissionRuleInputToData(payload);

  const created = await prisma.commissionRule.create({
    data: {
      ...mappedData,
      name: payload.name,
      type: payload.type,
      createdBy: adminId,
      updatedBy: adminId,
    },
  });

  await recordAuditLog(
    adminId,
    "CREATE",
    "COMMISSION_RULE",
    created.id,
    {
      type: created.type,
      percentage: created.percentage,
      fixedAmount: created.fixedAmount,
      minAmount: created.minAmount,
      maxAmount: created.maxAmount,
      isActive: created.isActive,
    },
    `Commission rule ${created.name} created`,
  );

  return created;
};

export const updateCommissionRule = async (
  adminId: string,
  ruleId: string,
  payload: UpdateCommissionRuleInput,
) => {
  const existing = await prisma.commissionRule.findUnique({
    where: { id: ruleId },
  });

  if (!existing) {
    throw new ApiError(404, "Commission rule not found");
  }

  const updated = await prisma.commissionRule.update({
    where: { id: ruleId },
    data: {
      ...mapCommissionRuleInputToData(payload),
      updatedBy: adminId,
    },
  });

  await recordAuditLog(
    adminId,
    "UPDATE",
    "COMMISSION_RULE",
    updated.id,
    {
      previous: {
        name: existing.name,
        type: existing.type,
        percentage: existing.percentage,
        fixedAmount: existing.fixedAmount,
        minAmount: existing.minAmount,
        maxAmount: existing.maxAmount,
        isActive: existing.isActive,
      },
      next: {
        name: updated.name,
        type: updated.type,
        percentage: updated.percentage,
        fixedAmount: updated.fixedAmount,
        minAmount: updated.minAmount,
        maxAmount: updated.maxAmount,
        isActive: updated.isActive,
      },
    },
    `Commission rule ${updated.name} updated`,
  );

  return updated;
};

export const deleteCommissionRule = async (adminId: string, ruleId: string) => {
  const existing = await prisma.commissionRule.findUnique({
    where: { id: ruleId },
    select: {
      id: true,
      name: true,
      isActive: true,
      appliesTo: true,
    },
  });

  if (!existing) {
    throw new ApiError(404, "Commission rule not found");
  }

  const archived = await prisma.commissionRule.update({
    where: { id: ruleId },
    data: {
      isActive: false,
      updatedBy: adminId,
      appliesTo: existing.appliesTo ?? new Date(),
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      appliesTo: true,
      updatedAt: true,
    },
  });

  await recordAuditLog(
    adminId,
    "DELETE",
    "COMMISSION_RULE",
    archived.id,
    {
      previousIsActive: existing.isActive,
      newIsActive: archived.isActive,
      archivedAt: archived.appliesTo,
    },
    `Commission rule ${archived.name} archived`,
  );

  return {
    id: archived.id,
    deleted: true,
  };
};
