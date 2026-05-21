import prisma from "@travenest/database";
import { ApiError } from "../../middleware/errorHandler.js";
import { emitToConversation, emitToUser } from "../../realtime/socket.js";

export interface ConversationSummary {
  id: string;
  bookingId: string;
  unreadCount: number;
  lastMessageAt: Date | null;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: Date;
  } | null;
  counterpart: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    role: "CUSTOMER" | "VEHICLE_OWNER";
  };
  booking: {
    id: string;
    status: string;
    startDate: Date;
    endDate: Date;
    pickupLocation: string;
    dropoffLocation: string | null;
    vehicle: {
      id: string;
      name: string;
      type: string;
    };
  };
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}

const conversationInclude = {
  booking: {
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      pickupLocation: true,
      dropoffLocation: true,
      customerId: true,
      customer: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
      vehicle: {
        select: {
          id: true,
          name: true,
          type: true,
          ownerId: true,
          owner: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
      },
    },
  },
} as const;

interface ConversationForSummary {
  id: string;
  bookingId: string;
  lastMessageAt: Date | null;
  booking: {
    id: string;
    status: string;
    startDate: Date;
    endDate: Date;
    pickupLocation: string;
    dropoffLocation: string | null;
    customerId: string;
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      avatar: string | null;
    };
    vehicle: {
      id: string;
      name: string;
      type: string;
      ownerId: string;
      owner: {
        id: string;
        firstName: string;
        lastName: string;
        avatar: string | null;
      };
    };
  };
}

type LastMessage = {
  id: string;
  content: string;
  senderId: string;
  createdAt: Date;
} | null;

const resolveParticipants = (booking: {
  customerId: string;
  vehicle: { ownerId: string };
}) => ({
  customerId: booking.customerId,
  ownerId: booking.vehicle.ownerId,
});

const assertParticipant = (
  userId: string,
  booking: { customerId: string; vehicle: { ownerId: string } },
): "CUSTOMER" | "VEHICLE_OWNER" => {
  const { customerId, ownerId } = resolveParticipants(booking);
  if (userId === customerId) return "CUSTOMER";
  if (userId === ownerId) return "VEHICLE_OWNER";
  throw ApiError.forbidden("You are not a participant in this conversation");
};

// P2002 = Prisma unique-constraint violation. Checked structurally to avoid
// importing the Prisma namespace, mirroring the global error handler.
const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Error &&
  err.name === "PrismaClientKnownRequestError" &&
  (err as { code?: string }).code === "P2002";

// Pure projection — the last message and unread count are resolved by the
// caller so that list loads can batch them instead of issuing per-row queries.
const buildSummary = (
  conversation: ConversationForSummary,
  viewerId: string,
  lastMessage: LastMessage,
  unreadCount: number,
): ConversationSummary => {
  const isCustomer = viewerId === conversation.booking.customerId;
  const counterpartUser = isCustomer
    ? conversation.booking.vehicle.owner
    : conversation.booking.customer;
  const counterpartRole: "CUSTOMER" | "VEHICLE_OWNER" = isCustomer
    ? "VEHICLE_OWNER"
    : "CUSTOMER";

  return {
    id: conversation.id,
    bookingId: conversation.bookingId,
    unreadCount,
    lastMessageAt: conversation.lastMessageAt,
    lastMessage,
    counterpart: {
      id: counterpartUser.id,
      firstName: counterpartUser.firstName,
      lastName: counterpartUser.lastName,
      avatar: counterpartUser.avatar,
      role: counterpartRole,
    },
    booking: {
      id: conversation.booking.id,
      status: conversation.booking.status,
      startDate: conversation.booking.startDate,
      endDate: conversation.booking.endDate,
      pickupLocation: conversation.booking.pickupLocation,
      dropoffLocation: conversation.booking.dropoffLocation,
      vehicle: {
        id: conversation.booking.vehicle.id,
        name: conversation.booking.vehicle.name,
        type: conversation.booking.vehicle.type,
      },
    },
  };
};

// Single-conversation summary — used by the detail/open endpoints where the
// extra two queries are negligible (the list path batches instead).
const summarizeOne = async (
  conversation: ConversationForSummary,
  viewerId: string,
): Promise<ConversationSummary> => {
  const [lastMessage, unreadCount] = await Promise.all([
    prisma.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, content: true, senderId: true, createdAt: true },
    }),
    prisma.message.count({
      where: {
        conversationId: conversation.id,
        readAt: null,
        senderId: { not: viewerId },
      },
    }),
  ]);

  return buildSummary(conversation, viewerId, lastMessage, unreadCount);
};

export const listConversations = async (
  userId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  const where = {
    booking: {
      OR: [{ customerId: userId }, { vehicle: { ownerId: userId } }],
    },
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        ...conversationInclude,
        // Pull the latest message inline so the list does not need an extra
        // findFirst per conversation (former N+1 against the <2 s load target).
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true },
        },
      },
      orderBy: [
        { lastMessageAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  // One grouped query resolves unread counts for the whole page.
  const ids = conversations.map((c) => c.id);
  const unreadGroups = ids.length
    ? await prisma.message.groupBy({
        by: ["conversationId"],
        where: {
          conversationId: { in: ids },
          readAt: null,
          senderId: { not: userId },
        },
        _count: true,
      })
    : [];
  const unreadByConversation = new Map(
    unreadGroups.map((g) => [g.conversationId, g._count]),
  );

  const items = conversations.map((c) =>
    buildSummary(c, userId, c.messages[0] ?? null, unreadByConversation.get(c.id) ?? 0),
  );

  return {
    conversations: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getConversation = async (userId: string, conversationId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) {
    throw ApiError.notFound("Conversation");
  }

  assertParticipant(userId, conversation.booking);
  return summarizeOne(conversation, userId);
};

export const getMessages = async (
  userId: string,
  conversationId: string,
  page: number,
  limit: number,
) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) {
    throw ApiError.notFound("Conversation");
  }

  assertParticipant(userId, conversation.booking);

  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  return {
    // Reversed so each page reads oldest→newest; the client prepends older pages.
    messages: messages.reverse() as MessageResponse[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const sendMessage = async (
  userId: string,
  conversationId: string,
  content: string,
): Promise<MessageResponse> => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) {
    throw ApiError.notFound("Conversation");
  }

  assertParticipant(userId, conversation.booking);

  // Chat stays open on every booking status by design — coordinating refunds
  // after a CANCELLED trip or follow-ups after a COMPLETED one still needs the
  // thread, so there is intentionally no booking-status gate here.

  // Messages and the conversation timestamp must move in lockstep so the
  // conversation-list ordering never lags behind the latest reply.
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  const payload: MessageResponse = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    readAt: message.readAt,
    createdAt: message.createdAt,
  };

  emitToConversation(conversationId, "message:new", payload);

  // Wake the recipient's user-room so their conversation-list badge updates
  // even if they don't have the thread open.
  const { customerId, ownerId } = resolveParticipants(conversation.booking);
  const recipientId = userId === customerId ? ownerId : customerId;
  emitToUser(recipientId, "conversation:updated", {
    conversationId,
    lastMessage: payload,
  });

  return payload;
};

export const markConversationRead = async (
  userId: string,
  conversationId: string,
): Promise<number> => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) {
    throw ApiError.notFound("Conversation");
  }

  assertParticipant(userId, conversation.booking);

  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  if (result.count > 0) {
    emitToConversation(conversationId, "messages:read", {
      conversationId,
      readerId: userId,
      readAt: new Date(),
    });
  }

  return result.count;
};

export const openConversationForBooking = async (
  userId: string,
  bookingId: string,
): Promise<ConversationSummary> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      vehicle: { select: { ownerId: true } },
    },
  });

  if (!booking) {
    throw ApiError.notFound("Booking");
  }

  assertParticipant(userId, booking);

  const existing = await prisma.conversation.findUnique({
    where: { bookingId },
    include: conversationInclude,
  });

  if (existing) {
    return summarizeOne(existing, userId);
  }

  try {
    const created = await prisma.conversation.create({
      data: { bookingId },
      include: conversationInclude,
    });
    return summarizeOne(created, userId);
  } catch (err) {
    // A concurrent open for the same booking can slip between the findUnique
    // above and this create, tripping the bookingId @unique constraint. Treat
    // that as success and return the row the other request created.
    if (isUniqueViolation(err)) {
      const fallback = await prisma.conversation.findUnique({
        where: { bookingId },
        include: conversationInclude,
      });
      if (fallback) {
        return summarizeOne(fallback, userId);
      }
    }
    throw err;
  }
};

export const getTotalUnreadCount = async (userId: string): Promise<number> => {
  return prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      conversation: {
        booking: {
          OR: [{ customerId: userId }, { vehicle: { ownerId: userId } }],
        },
      },
    },
  });
};

export const getConversationParticipantIds = async (
  conversationId: string,
): Promise<{ customerId: string; ownerId: string } | null> => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      booking: {
        select: { customerId: true, vehicle: { select: { ownerId: true } } },
      },
    },
  });

  if (!conversation) return null;
  return resolveParticipants(conversation.booking);
};
