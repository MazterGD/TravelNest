import { prisma, type Prisma } from "@travenest/database";
import { ApiError } from "../../../middleware/errorHandler.js";
import { recordAuditLog } from "../audit/audit.service.js";
import { parsePagination } from "../types.js";
import type {
  AddDisputeMessageInput,
  AssignDisputeInput,
  DisputePriority,
  DisputeStatus,
  DisputeType,
  ResolveDisputeInput,
} from "./disputes.schemas.js";

type DisputeFilters = {
  search?: string;
  status?: DisputeStatus;
  priority?: DisputePriority;
  type?: DisputeType;
  assignedTo?: string;
};

const buildDisputeWhere = (filters: DisputeFilters): Prisma.DisputeWhereInput => {
  const where: Prisma.DisputeWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.assignedTo) {
    where.assignedTo = filters.assignedTo;
  }

  if (filters.search) {
    where.OR = [
      { disputeCode: { contains: filters.search, mode: "insensitive" } },
      { subject: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      {
        booking: {
          OR: [
            { id: { contains: filters.search, mode: "insensitive" } },
            { pickupLocation: { contains: filters.search, mode: "insensitive" } },
            { dropoffLocation: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      },
      {
        raisedByUser: {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      },
      {
        againstUser: {
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

const resolveDisputeWhere = (disputeId: string): Prisma.DisputeWhereInput => ({
  OR: [{ id: disputeId }, { disputeCode: disputeId }],
});

export const listDisputes = async (
  filters: DisputeFilters,
  page?: number,
  limit?: number,
) => {
  const paging = parsePagination(page, limit);
  const where = buildDisputeWhere(filters);

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      skip: paging.skip,
      take: paging.limit,
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
        raisedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        againstUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedAdmin: {
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
            messages: true,
          },
        },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

export const getDisputeDetails = async (disputeId: string) => {
  const dispute = await prisma.dispute.findFirst({
    where: resolveDisputeWhere(disputeId),
    include: {
      booking: {
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              name: true,
              licensePlate: true,
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
              refundAmount: true,
              refundReason: true,
            },
          },
        },
      },
      raisedByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      againstUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      assignedAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          adminRole: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              adminRole: true,
            },
          },
        },
      },
    },
  });

  if (!dispute) {
    throw new ApiError(404, "Dispute not found");
  }

  return dispute;
};

export const assignDispute = async (
  adminId: string,
  disputeId: string,
  payload: AssignDisputeInput,
) => {
  const [dispute, adminTarget] = await Promise.all([
    prisma.dispute.findFirst({
      where: resolveDisputeWhere(disputeId),
      select: {
        id: true,
        disputeCode: true,
        assignedTo: true,
        status: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: payload.assignedTo },
      select: {
        id: true,
        role: true,
        adminRole: true,
      },
    }),
  ]);

  if (!dispute) {
    throw new ApiError(404, "Dispute not found");
  }

  if (!adminTarget || adminTarget.role !== "ADMIN" || !adminTarget.adminRole) {
    throw new ApiError(422, "Assigned admin user is invalid");
  }

  const nextStatus = dispute.status === "OPEN" ? "INVESTIGATING" : dispute.status;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDispute = await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        assignedTo: payload.assignedTo,
        status: nextStatus,
      },
      include: {
        assignedAdmin: {
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

    if (payload.note) {
      await tx.disputeMessage.create({
        data: {
          disputeId: dispute.id,
          senderId: adminId,
          message: payload.note,
          isInternalNote: true,
        },
      });
    }

    return updatedDispute;
  });

  await recordAuditLog(
    adminId,
    "ASSIGN",
    "DISPUTE",
    dispute.id,
    {
      previousAssignedTo: dispute.assignedTo,
      newAssignedTo: payload.assignedTo,
      previousStatus: dispute.status,
      newStatus: nextStatus,
      note: payload.note,
    },
    `Dispute ${dispute.disputeCode} assigned`,
  );

  return updated;
};

export const updateDisputePriority = async (
  adminId: string,
  disputeId: string,
  priority: DisputePriority,
  note?: string,
) => {
  const dispute = await prisma.dispute.findFirst({
    where: resolveDisputeWhere(disputeId),
    select: {
      id: true,
      disputeCode: true,
      priority: true,
    },
  });

  if (!dispute) {
    throw new ApiError(404, "Dispute not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDispute = await tx.dispute.update({
      where: { id: dispute.id },
      data: { priority },
      select: {
        id: true,
        disputeCode: true,
        priority: true,
        updatedAt: true,
      },
    });

    if (note) {
      await tx.disputeMessage.create({
        data: {
          disputeId: dispute.id,
          senderId: adminId,
          message: note,
          isInternalNote: true,
        },
      });
    }

    return updatedDispute;
  });

  await recordAuditLog(
    adminId,
    "UPDATE_PRIORITY",
    "DISPUTE",
    dispute.id,
    {
      previousPriority: dispute.priority,
      newPriority: priority,
      note,
    },
    `Dispute ${dispute.disputeCode} priority updated`,
  );

  return updated;
};

export const updateDisputeStatus = async (
  adminId: string,
  disputeId: string,
  status: DisputeStatus,
  note?: string,
) => {
  const dispute = await prisma.dispute.findFirst({
    where: resolveDisputeWhere(disputeId),
    select: {
      id: true,
      disputeCode: true,
      status: true,
    },
  });

  if (!dispute) {
    throw new ApiError(404, "Dispute not found");
  }

  const closedAt = status === "RESOLVED" || status === "CLOSED" ? new Date() : null;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDispute = await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status,
        closedAt,
      },
      select: {
        id: true,
        disputeCode: true,
        status: true,
        closedAt: true,
        updatedAt: true,
      },
    });

    if (note) {
      await tx.disputeMessage.create({
        data: {
          disputeId: dispute.id,
          senderId: adminId,
          message: note,
          isInternalNote: true,
        },
      });
    }

    return updatedDispute;
  });

  await recordAuditLog(
    adminId,
    "UPDATE_STATUS",
    "DISPUTE",
    dispute.id,
    {
      previousStatus: dispute.status,
      newStatus: status,
      note,
    },
    `Dispute ${dispute.disputeCode} status updated`,
  );

  return updated;
};

export const addDisputeMessage = async (
  adminId: string,
  disputeId: string,
  payload: AddDisputeMessageInput,
) => {
  const dispute = await prisma.dispute.findFirst({
    where: resolveDisputeWhere(disputeId),
    select: {
      id: true,
      disputeCode: true,
      raisedBy: true,
      raisedAgainst: true,
    },
  });

  if (!dispute) {
    throw new ApiError(404, "Dispute not found");
  }

  const isInternalNote = payload.isInternalNote ?? true;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: adminId,
        message: payload.message,
        isInternalNote,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            adminRole: true,
          },
        },
      },
    });

    if (!isInternalNote) {
      const recipients = Array.from(new Set([dispute.raisedBy, dispute.raisedAgainst]));
      await tx.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          type: "dispute_message",
          title: "Dispute update",
          message: "A new update was posted by the admin team in your dispute thread.",
          data: {
            disputeId: dispute.id,
            disputeCode: dispute.disputeCode,
          },
        })),
      });
    }

    return created;
  });

  await recordAuditLog(
    adminId,
    "MESSAGE",
    "DISPUTE",
    dispute.id,
    {
      isInternalNote,
    },
    `Message posted to dispute ${dispute.disputeCode}`,
  );

  return message;
};

export const resolveDispute = async (
  adminId: string,
  disputeId: string,
  payload: ResolveDisputeInput,
) => {
  const dispute = await prisma.dispute.findFirst({
    where: resolveDisputeWhere(disputeId),
    select: {
      id: true,
      disputeCode: true,
      status: true,
      raisedBy: true,
      raisedAgainst: true,
    },
  });

  if (!dispute) {
    throw new ApiError(404, "Dispute not found");
  }

  const resolved = await prisma.$transaction(async (tx) => {
    const updated = await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: "RESOLVED",
        resolution: payload.resolution,
        resolutionType: payload.resolutionType,
        resolutionAmount: payload.resolutionAmount,
        closedAt: new Date(),
      },
      select: {
        id: true,
        disputeCode: true,
        status: true,
        resolution: true,
        resolutionType: true,
        resolutionAmount: true,
        closedAt: true,
        updatedAt: true,
      },
    });

    await tx.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: adminId,
        message: `Resolution: ${payload.resolution}`,
        isInternalNote: true,
      },
    });

    await tx.notification.createMany({
      data: [dispute.raisedBy, dispute.raisedAgainst].map((userId) => ({
        userId,
        type: "dispute_resolved",
        title: "Dispute resolved",
        message: `Your dispute ${dispute.disputeCode} has been resolved by the admin team.`,
        data: {
          disputeId: dispute.id,
          disputeCode: dispute.disputeCode,
          resolutionType: payload.resolutionType,
          resolutionAmount: payload.resolutionAmount,
        },
      })),
    });

    return updated;
  });

  await recordAuditLog(
    adminId,
    "RESOLVE",
    "DISPUTE",
    dispute.id,
    {
      previousStatus: dispute.status,
      newStatus: "RESOLVED",
      resolution: payload.resolution,
      resolutionType: payload.resolutionType,
      resolutionAmount: payload.resolutionAmount,
    },
    `Dispute ${dispute.disputeCode} resolved`,
  );

  return resolved;
};
