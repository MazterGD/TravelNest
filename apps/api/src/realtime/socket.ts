import type { Server as HttpServer } from "http";
import type { Socket } from "socket.io";
import { Server as SocketServer } from "socket.io";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import prisma from "@travenest/database";
import { config } from "../config/index.js";

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  tokenVersion?: number;
  iat: number;
  exp: number;
}

let io: SocketServer | null = null;

const extractToken = (socket: Socket): string | null => {
  const fromAuth =
    typeof socket.handshake.auth?.token === "string"
      ? (socket.handshake.auth.token as string)
      : null;
  if (fromAuth) return fromAuth;

  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return null;
  const parsed = cookie.parse(cookieHeader);
  return parsed.accessToken ?? null;
};

// Lightweight structured logging consistent with the rest of the API, which
// uses console (see middleware/errorHandler.ts). Socket events bypass the
// Express error handler, so auth/authorization failures must be logged here.
const logSocketEvent = (
  level: "warn" | "info",
  event: string,
  detail: Record<string, unknown>,
): void => {
  console[level](`[socket] ${event}`, detail);
};

const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  try {
    const token = extractToken(socket);
    if (!token) {
      logSocketEvent("warn", "auth:rejected", { reason: "missing_token" });
      return next(new Error("UNAUTHORIZED"));
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // tokenVersion check mirrors the REST authenticate middleware so that
    // a password change or admin-revoked token can't keep a socket alive.
    if (decoded.tokenVersion !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true, status: true },
      });
      if (!user || user.status !== "ACTIVE") {
        logSocketEvent("warn", "auth:rejected", {
          reason: "inactive_user",
          userId: decoded.id,
        });
        return next(new Error("UNAUTHORIZED"));
      }
      if (user.tokenVersion !== decoded.tokenVersion) {
        logSocketEvent("warn", "auth:rejected", {
          reason: "token_invalidated",
          userId: decoded.id,
        });
        return next(new Error("TOKEN_INVALIDATED"));
      }
    }

    socket.data.userId = decoded.id;
    socket.data.role = decoded.role;
    next();
  } catch {
    logSocketEvent("warn", "auth:rejected", { reason: "invalid_token" });
    next(new Error("UNAUTHORIZED"));
  }
};

const assertParticipant = async (
  userId: string,
  conversationId: string,
): Promise<boolean> => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      booking: {
        select: { customerId: true, vehicle: { select: { ownerId: true } } },
      },
    },
  });
  if (!conversation) return false;
  return (
    conversation.booking.customerId === userId ||
    conversation.booking.vehicle.ownerId === userId
  );
};

export const initSocketServer = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on("conversation:join", async (conversationId: string, ack?: (ok: boolean) => void) => {
      if (typeof conversationId !== "string" || !conversationId) {
        ack?.(false);
        return;
      }
      const allowed = await assertParticipant(userId, conversationId);
      if (!allowed) {
        logSocketEvent("warn", "join:forbidden", { userId, conversationId });
        ack?.(false);
        return;
      }
      socket.join(`conversation:${conversationId}`);
      ack?.(true);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      if (typeof conversationId === "string" && conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });
  });

  return io;
};

export const emitToConversation = (
  conversationId: string,
  event: string,
  payload: unknown,
): void => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
};

export const emitToUser = (
  userId: string,
  event: string,
  payload: unknown,
): void => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
};

export const getIO = (): SocketServer | null => io;
