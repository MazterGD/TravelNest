/**
 * Socket.IO server: handshake authentication, conversation rooms and the
 * emit helpers. The socket.io Server is replaced with a recorder so the
 * handlers can be driven directly.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import { config } from "../src/config/index";

const recorder = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
  middleware: null as null | ((socket: unknown, next: (err?: Error) => void) => Promise<void>),
  onConnection: null as null | ((socket: unknown) => void),
  emits: [] as Array<{ room: string; event: string; payload: unknown }>,
}));

vi.mock("socket.io", () => ({
  Server: class {
    constructor(_server: unknown, options: Record<string, unknown>) {
      recorder.options = options;
    }
    use(fn: typeof recorder.middleware) {
      recorder.middleware = fn;
    }
    on(event: string, handler: (socket: unknown) => void) {
      if (event === "connection") recorder.onConnection = handler;
    }
    to(room: string) {
      return {
        emit: (event: string, payload: unknown) => recorder.emits.push({ room, event, payload }),
      };
    }
  },
}));

const { initSocketServer, emitToConversation, emitToUser, getIO } = await import(
  "../src/realtime/socket"
);

const PREFIX = `socket-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;

const fakeSocket = (handshake: { auth?: Record<string, unknown>; headers?: Record<string, string> }) => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    handshake: { auth: handshake.auth ?? {}, headers: handshake.headers ?? {} },
    data: {} as Record<string, unknown>,
    rooms: new Set<string>(),
    join(room: string) {
      this.rooms.add(room);
    },
    leave(room: string) {
      this.rooms.delete(room);
    },
    on(event: string, handler: (...args: unknown[]) => unknown) {
      handlers[event] = handler;
    },
    handlers,
  };
};

describe("Socket server", () => {
  const users = { customer: "", owner: "", stranger: "", suspended: "" };
  let conversationId = "";

  const tokenFor = (id: string, extra: Record<string, unknown> = {}) =>
    jwt.sign({ id, email: `${id}@example.com`, role: "CUSTOMER", ...extra }, config.jwt.secret, {
      expiresIn: "1h",
    });

  const authenticate = async (handshake: Parameters<typeof fakeSocket>[0]) => {
    const socket = fakeSocket(handshake);
    const next = vi.fn();
    await recorder.middleware!(socket, next);
    return { socket, error: next.mock.calls[0]?.[0] as Error | undefined };
  };

  const cleanup = async () => {
    const ids = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.conversation.deleteMany({ where: { booking: { customerId: { in: ids } } } });
    await prisma.booking.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
    await cleanup();
    for (const key of Object.keys(users) as Array<keyof typeof users>) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: key,
          lastName: "Tester",
          role: key === "owner" ? "VEHICLE_OWNER" : "CUSTOMER",
          status: key === "suspended" ? "SUSPENDED" : "ACTIVE",
          tokenVersion: 2,
        },
      });
      users[key] = user.id;
    }
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: users.owner,
        name: `${PREFIX} bus`,
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: "SKZ-7788",
        seats: 40,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
      },
    });
    const booking = await prisma.booking.create({
      data: {
        customerId: users.customer,
        vehicleId: vehicle.id,
        startDate: new Date(Date.now() + 10 * DAY),
        endDate: new Date(Date.now() + 11 * DAY),
        pickupLocation: "Colombo",
        totalAmount: 10000,
        status: "CONFIRMED",
      },
    });
    conversationId = (await prisma.conversation.create({ data: { bookingId: booking.id } })).id;

    initSocketServer({} as HttpServer);
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(() => {
    recorder.emits.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("is configured for the web origin with credentials", () => {
    expect(recorder.options).toMatchObject({
      path: "/socket.io",
      cors: { origin: config.corsOrigin, credentials: true },
    });
    expect(getIO()).not.toBeNull();
  });

  describe("handshake authentication", () => {
    it("accepts a valid token from the auth payload or the access cookie", async () => {
      const fromAuth = await authenticate({ auth: { token: tokenFor(users.customer, { tokenVersion: 2 }) } });
      const fromCookie = await authenticate({
        headers: { cookie: `other=1; accessToken=${tokenFor(users.owner)}` },
      });

      expect(fromAuth.error).toBeUndefined();
      expect(fromAuth.socket.data).toMatchObject({ userId: users.customer, role: "CUSTOMER" });
      expect(fromCookie.error).toBeUndefined();
      expect(fromCookie.socket.data.userId).toBe(users.owner);
    });

    it.each([
      ["no token at all", {}, "UNAUTHORIZED"],
      ["a cookie header without the access cookie", { headers: { cookie: "theme=light" } }, "UNAUTHORIZED"],
      ["a forged token", { auth: { token: jwt.sign({ id: "x" }, "wrong-secret") } }, "UNAUTHORIZED"],
      ["a token with no user id", { auth: { token: jwt.sign({ email: "a@b.c" }, config.jwt.secret) } }, "UNAUTHORIZED"],
    ])("rejects %s", async (_label, handshake, message) => {
      const { error } = await authenticate(handshake);

      expect(error?.message).toBe(message);
    });

    it("rejects unknown, suspended and revoked sessions", async () => {
      const unknown = await authenticate({ auth: { token: tokenFor("no-such-user") } });
      const suspended = await authenticate({ auth: { token: tokenFor(users.suspended) } });
      const revoked = await authenticate({ auth: { token: tokenFor(users.customer, { tokenVersion: 1 }) } });

      expect(unknown.error?.message).toBe("UNAUTHORIZED");
      expect(suspended.error?.message).toBe("UNAUTHORIZED");
      expect(revoked.error?.message).toBe("TOKEN_INVALIDATED");
    });
  });

  describe("conversation rooms", () => {
    const connect = async (userId: string) => {
      const { socket } = await authenticate({ auth: { token: tokenFor(userId) } });
      recorder.onConnection!(socket);
      return socket;
    };

    it("puts every socket in its user room", async () => {
      const socket = await connect(users.customer);

      expect(socket.rooms.has(`user:${users.customer}`)).toBe(true);
    });

    it("lets booking participants join and leave the conversation", async () => {
      for (const userId of [users.customer, users.owner]) {
        const socket = await connect(userId);
        const ack = vi.fn();

        await socket.handlers["conversation:join"](conversationId, ack);
        expect(ack).toHaveBeenCalledWith(true);
        expect(socket.rooms.has(`conversation:${conversationId}`)).toBe(true);

        socket.handlers["conversation:leave"](conversationId);
        expect(socket.rooms.has(`conversation:${conversationId}`)).toBe(false);
      }
    });

    it("keeps outsiders out and ignores malformed ids", async () => {
      const socket = await connect(users.stranger);
      const ack = vi.fn();

      await socket.handlers["conversation:join"](conversationId, ack);
      await socket.handlers["conversation:join"]("missing-conversation", ack);
      await socket.handlers["conversation:join"](42, ack);
      await socket.handlers["conversation:join"]("");
      socket.handlers["conversation:leave"](42);

      expect(ack.mock.calls).toEqual([[false], [false], [false]]);
      expect([...socket.rooms]).toEqual([`user:${users.stranger}`]);
    });
  });

  it("emits to conversation and user rooms", () => {
    emitToConversation("c1", "message:new", { id: "m1" });
    emitToUser("u1", "notification:new", { id: "n1" });

    expect(recorder.emits).toEqual([
      { room: "conversation:c1", event: "message:new", payload: { id: "m1" } },
      { room: "user:u1", event: "notification:new", payload: { id: "n1" } },
    ]);
  });
});
