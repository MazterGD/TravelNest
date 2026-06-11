import crypto from "crypto";
import { prisma, type Prisma } from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import type { CreateDisputeInput, ListMyDisputesQuery } from "./dispute.schemas.js";

const generateDisputeCode = (): string =>
  `DSP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const partySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} as const;

const senderSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

// Summary shape for list views — no message thread.
const listInclude = {
  booking: {
    select: {
      id: true,
      startDate: true,
      endDate: true,
      vehicle: { select: { id: true, name: true, licensePlate: true } },
    },
  },
  raisedByUser: { select: partySelect },
  againstUser: { select: partySelect },
} as const;

const partyWhere = (userId: string): Prisma.DisputeWhereInput => ({
  OR: [{ raisedBy: userId }, { raisedAgainst: userId }],
});

/**
 * Raise a dispute on a booking the caller is party to. The counterparty
 * (raisedAgainst) is derived: a customer disputes the vehicle owner and vice
 * versa, so callers can never target an unrelated user.
 */
export const createDispute = async (userId: string, data: CreateDisputeInput) => {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    select: {
      id: true,
      customerId: true,
      vehicle: { select: { ownerId: true } },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking not found");
  }

  const ownerId = booking.vehicle.ownerId;
  let raisedAgainst: string;

  if (userId === booking.customerId) {
    raisedAgainst = ownerId;
  } else if (userId === ownerId) {
    raisedAgainst = booking.customerId;
  } else {
    throw ApiError.forbidden("You are not a participant in this booking");
  }

  // Retry on the (astronomically unlikely) code collision.
  let disputeCode = generateDisputeCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await prisma.dispute.findUnique({
      where: { disputeCode },
      select: { id: true },
    });
    if (!existing) break;
    disputeCode = generateDisputeCode();
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: {
        disputeCode,
        bookingId: booking.id,
        raisedBy: userId,
        raisedAgainst,
        type: data.type,
        subject: data.subject,
        description: data.description,
        evidenceUrls: data.evidenceUrls ?? [],
      },
      include: listInclude,
    });

    await tx.notification.create({
      data: {
        userId: raisedAgainst,
        type: "dispute_opened",
        category: "System",
        title: "A dispute was opened",
        message: `A dispute (${created.disputeCode}) was opened regarding one of your bookings.`,
        data: { disputeId: created.id, disputeCode: created.disputeCode },
      },
    });

    return { ...created, isRaisedByMe: true };
  });
};

export const listMyDisputes = async (
  userId: string,
  query: ListMyDisputesQuery,
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const roleFilter: Prisma.DisputeWhereInput =
    query.role === "raised"
      ? { raisedBy: userId }
      : query.role === "against"
        ? { raisedAgainst: userId }
        : partyWhere(userId);

  const where: Prisma.DisputeWhereInput = {
    ...roleFilter,
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: listInclude,
    }),
    prisma.dispute.count({ where }),
  ]);

  return {
    disputes: items.map((dispute) => ({
      ...dispute,
      isRaisedByMe: dispute.raisedBy === userId,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getMyDisputeDetails = async (userId: string, disputeId: string) => {
  const dispute = await prisma.dispute.findFirst({
    where: {
      AND: [
        { OR: [{ id: disputeId }, { disputeCode: disputeId }] },
        partyWhere(userId),
      ],
    },
    include: {
      booking: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
          pickupLocation: true,
          dropoffLocation: true,
          totalAmount: true,
          vehicle: { select: { id: true, name: true, licensePlate: true } },
        },
      },
      raisedByUser: { select: partySelect },
      againstUser: { select: partySelect },
      // Parties never see internal admin notes.
      messages: {
        where: { isInternalNote: false },
        orderBy: { createdAt: "asc" },
        include: { sender: { select: senderSelect } },
      },
    },
  });

  if (!dispute) {
    throw ApiError.notFound("Dispute not found");
  }

  return { ...dispute, isRaisedByMe: dispute.raisedBy === userId };
};

export const replyToDispute = async (
  userId: string,
  disputeId: string,
  message: string,
) => {
  const dispute = await prisma.dispute.findFirst({
    where: {
      AND: [
        { OR: [{ id: disputeId }, { disputeCode: disputeId }] },
        partyWhere(userId),
      ],
    },
    select: {
      id: true,
      disputeCode: true,
      status: true,
      raisedBy: true,
      raisedAgainst: true,
      assignedTo: true,
    },
  });

  if (!dispute) {
    throw ApiError.notFound("Dispute not found");
  }

  if (dispute.status === "RESOLVED" || dispute.status === "CLOSED") {
    throw ApiError.badRequest(
      "This dispute is closed and can no longer receive replies",
    );
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: userId,
        message,
        isInternalNote: false,
      },
      include: { sender: { select: senderSelect } },
    });

    const otherParty =
      dispute.raisedBy === userId ? dispute.raisedAgainst : dispute.raisedBy;
    const recipients = Array.from(
      new Set([otherParty, ...(dispute.assignedTo ? [dispute.assignedTo] : [])]),
    );

    await tx.notification.createMany({
      data: recipients.map((recipientId) => ({
        userId: recipientId,
        type: "dispute_message",
        category: "System",
        title: "New dispute reply",
        message: `A new reply was posted in dispute ${dispute.disputeCode}.`,
        data: { disputeId: dispute.id, disputeCode: dispute.disputeCode },
      })),
    });

    return created;
  });
};
