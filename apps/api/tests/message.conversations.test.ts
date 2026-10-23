/**
 * Booking-scoped messaging: only the booking's customer and vehicle owner can
 * open, read or post to its conversation, sends update the list ordering and
 * push realtime events, and read receipts only cover the counterpart's
 * messages.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import db from "@travenest/database";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { emitToConversation, emitToUser } from "../src/realtime/socket";

vi.mock("../src/realtime/socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/realtime/socket")>()),
  emitToConversation: vi.fn(),
  emitToUser: vi.fn(),
}));

const API_BASE = "/api/v1";
const EMAILS = {
  customer: "message.conv.customer@example.com",
  owner: "message.conv.owner@example.com",
  stranger: "message.conv.stranger@example.com",
};
const PLATE = "MSG-CNV-1";
const DAY = 24 * 60 * 60 * 1000;

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed on bookingId"), {
    name: "PrismaClientKnownRequestError",
    code: "P2002",
  });

describe("Messaging", () => {
  const tokens = { customer: "", owner: "", stranger: "" };
  const ids = { customer: "", owner: "", stranger: "" };
  let vehicleId = "";
  let dayOffset = 30;

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: PLATE } });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(EMAILS) } },
    });
  };

  const makeBooking = async () => {
    dayOffset += 3;
    const startDate = new Date(Date.now() + dayOffset * DAY);
    return prisma.booking.create({
      data: {
        customerId: ids.customer,
        vehicleId,
        startDate,
        endDate: new Date(startDate.getTime() + DAY),
        pickupLocation: "Colombo",
        dropoffLocation: "Galle",
        totalAmount: 30000,
        status: "CONFIRMED",
      },
    });
  };

  const makeConversation = async () => {
    const booking = await makeBooking();
    return prisma.conversation.create({ data: { bookingId: booking.id } });
  };

  const addMessage = (
    conversationId: string,
    senderId: string,
    content: string,
    createdAt: Date,
    readAt: Date | null = null,
  ) =>
    prisma.message.create({
      data: { conversationId, senderId, content, createdAt, readAt },
    });

  const as = (token: string) => ({
    get: (path: string) =>
      request(app).get(`${API_BASE}/messages${path}`).set("Authorization", `Bearer ${token}`),
    post: (path: string) =>
      request(app).post(`${API_BASE}/messages${path}`).set("Authorization", `Bearer ${token}`),
    patch: (path: string) =>
      request(app).patch(`${API_BASE}/messages${path}`).set("Authorization", `Bearer ${token}`),
  });

  beforeAll(async () => {
    await cleanup();
    const roles = {
      customer: "CUSTOMER",
      owner: "VEHICLE_OWNER",
      stranger: "VEHICLE_OWNER",
    } as const;
    for (const key of Object.keys(EMAILS) as (keyof typeof EMAILS)[]) {
      const user = await prisma.user.create({
        data: {
          email: EMAILS[key],
          password: "hashed",
          firstName: `Msg${key}`,
          lastName: "User",
          role: roles[key],
          status: "ACTIVE",
          isVerified: true,
        },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }
    vehicleId = (
      await prisma.vehicle.create({
        data: {
          ownerId: ids.owner,
          name: "Message Bus",
          type: "LUXURY_AC",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: PLATE,
          seats: 30,
          fuelType: "DIESEL",
          transmission: "MANUAL",
          pricePerDay: 15000,
          location: "Colombo",
          images: [],
          amenities: [],
        },
      })
    ).id;
  });

  afterAll(cleanup);

  beforeEach(() => {
    vi.mocked(emitToConversation).mockClear();
    vi.mocked(emitToUser).mockClear();
  });

  it("requires sign-in", async () => {
    const response = await request(app).get(`${API_BASE}/messages/conversations`);
    expect(response.status).toBe(401);
  });

  describe("POST /messages/conversations", () => {
    it("opens one conversation per booking and reuses it", async () => {
      const booking = await makeBooking();

      const first = await as(tokens.customer).post("/conversations").send({
        bookingId: booking.id,
      });
      const second = await as(tokens.owner).post("/conversations").send({
        bookingId: booking.id,
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data.conversation.id).toBe(first.body.data.conversation.id);
      expect(first.body.data.conversation).toMatchObject({
        bookingId: booking.id,
        unreadCount: 0,
        lastMessage: null,
        counterpart: { id: ids.owner, role: "VEHICLE_OWNER" },
        booking: { vehicle: { id: vehicleId, type: "LUXURY_AC" } },
      });
      expect(second.body.data.conversation.counterpart).toMatchObject({
        id: ids.customer,
        role: "CUSTOMER",
      });
      expect(
        await prisma.conversation.count({ where: { bookingId: booking.id } }),
      ).toBe(1);
    });

    it("refuses a user outside the booking", async () => {
      const booking = await makeBooking();

      const response = await as(tokens.stranger).post("/conversations").send({
        bookingId: booking.id,
      });

      expect(response.status).toBe(403);
      expect(
        await prisma.conversation.count({ where: { bookingId: booking.id } }),
      ).toBe(0);
    });

    it("returns 404 for an unknown booking", async () => {
      const response = await as(tokens.customer)
        .post("/conversations")
        .send({ bookingId: "missing-booking" });
      expect(response.status).toBe(404);
    });

    it("requires a booking id", async () => {
      const response = await as(tokens.customer).post("/conversations").send({});
      expect(response.status).toBe(422);
    });

    describe("concurrent open race", () => {
      it("returns the row a concurrent request created", async () => {
        const booking = await makeBooking();
        vi.spyOn(db.conversation, "create").mockImplementationOnce((async () => {
          await prisma.conversation.create({ data: { bookingId: booking.id } });
          throw uniqueViolation();
        }) as never);

        const response = await as(tokens.customer).post("/conversations").send({
          bookingId: booking.id,
        });

        expect(response.status).toBe(200);
        const stored = await prisma.conversation.findUnique({
          where: { bookingId: booking.id },
        });
        expect(response.body.data.conversation.id).toBe(stored?.id);
      });

      it("surfaces the error when the conflicting row cannot be found", async () => {
        const booking = await makeBooking();
        vi.spyOn(db.conversation, "create").mockImplementationOnce((async () => {
          throw uniqueViolation();
        }) as never);

        const response = await as(tokens.customer).post("/conversations").send({
          bookingId: booking.id,
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(
          await prisma.conversation.count({ where: { bookingId: booking.id } }),
        ).toBe(0);
      });

      it("surfaces unrelated database errors", async () => {
        const booking = await makeBooking();
        vi.spyOn(db.conversation, "create").mockImplementationOnce((async () => {
          throw new Error("connection reset");
        }) as never);

        const response = await as(tokens.customer).post("/conversations").send({
          bookingId: booking.id,
        });

        expect(response.status).toBe(500);
      });
    });
  });

  describe("GET /messages/conversations", () => {
    let readConvId = "";
    let unreadConvId = "";

    beforeAll(async () => {
      const t = Date.now();
      const read = await makeConversation();
      await addMessage(read.id, ids.owner, "Read already", new Date(t - 5000), new Date());
      await prisma.conversation.update({
        where: { id: read.id },
        data: { lastMessageAt: new Date(t - 5000) },
      });
      readConvId = read.id;

      const unread = await makeConversation();
      await addMessage(unread.id, ids.customer, "Question", new Date(t - 2000), new Date());
      await addMessage(unread.id, ids.owner, "Answer one", new Date(t - 1000));
      await addMessage(unread.id, ids.owner, "Answer two", new Date(t));
      await prisma.conversation.update({
        where: { id: unread.id },
        data: { lastMessageAt: new Date(t) },
      });
      unreadConvId = unread.id;
    });

    type Summary = {
      id: string;
      unreadCount: number;
      lastMessage: { content: string } | null;
      counterpart: { id: string };
    };

    it("lists the caller's conversations newest first with unread counts", async () => {
      const response = await as(tokens.customer).get("/conversations?limit=50");

      expect(response.status).toBe(200);
      const items = response.body.data.conversations as Summary[];
      const position = (id: string) => items.findIndex((c) => c.id === id);
      expect(position(unreadConvId)).toBeLessThan(position(readConvId));
      expect(items[position(unreadConvId)]).toMatchObject({
        unreadCount: 2,
        lastMessage: { content: "Answer two" },
        counterpart: { id: ids.owner },
      });
      expect(items[position(readConvId)].unreadCount).toBe(0);
      expect(response.body.data.pagination).toMatchObject({ page: 1, limit: 50 });
    });

    it("counts unread from the owner's side separately", async () => {
      const response = await as(tokens.owner).get("/conversations?limit=50");
      const items = response.body.data.conversations as Summary[];
      expect(items.find((c) => c.id === unreadConvId)?.unreadCount).toBe(0);
    });

    it("filters to conversations with unread messages", async () => {
      const response = await as(tokens.customer).get("/conversations?unreadOnly=true&limit=50");
      const listed = (response.body.data.conversations as Summary[]).map((c) => c.id);
      expect(listed).toContain(unreadConvId);
      expect(listed).not.toContain(readConvId);
    });

    it("paginates with a default page size of 20", async () => {
      const page = await as(tokens.customer).get("/conversations?page=2&limit=1");
      expect(page.body.data.conversations).toHaveLength(1);
      expect(page.body.data.pagination.totalPages).toBe(page.body.data.pagination.total);

      const defaults = await as(tokens.customer).get("/conversations");
      expect(defaults.body.data.pagination).toMatchObject({ page: 1, limit: 20 });
    });

    it("returns nothing to a user with no bookings", async () => {
      const response = await as(tokens.stranger).get("/conversations");
      expect(response.body.data.conversations).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it("rejects a page size above 50", async () => {
      const response = await as(tokens.customer).get("/conversations?limit=51");
      expect(response.status).toBe(422);
    });

    it("totals unread messages across conversations", async () => {
      const customer = await as(tokens.customer).get("/unread-count");
      const stranger = await as(tokens.stranger).get("/unread-count");

      expect(customer.status).toBe(200);
      const expected = await prisma.message.count({
        where: {
          readAt: null,
          senderId: { not: ids.customer },
          conversation: { booking: { customerId: ids.customer } },
        },
      });
      expect(customer.body.data.unreadCount).toBe(expected);
      expect(expected).toBeGreaterThanOrEqual(2);
      expect(stranger.body.data.unreadCount).toBe(0);
    });
  });

  describe("GET /messages/conversations/:id", () => {
    it("returns the summary to a participant", async () => {
      const conv = await makeConversation();
      await addMessage(conv.id, ids.customer, "Hello", new Date());

      const response = await as(tokens.owner).get(`/conversations/${conv.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.conversation).toMatchObject({
        id: conv.id,
        unreadCount: 1,
        lastMessage: { content: "Hello", senderId: ids.customer },
      });
    });

    it("refuses a non-participant", async () => {
      const conv = await makeConversation();
      const response = await as(tokens.stranger).get(`/conversations/${conv.id}`);
      expect(response.status).toBe(403);
    });

    it("returns 404 for an unknown conversation", async () => {
      const response = await as(tokens.customer).get("/conversations/missing-conv");
      expect(response.status).toBe(404);
    });

    it("stays available after the vehicle is soft-removed (ADR-006)", async () => {
      const conv = await makeConversation();
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { isRemoved: true, removedAt: new Date() },
      });
      try {
        const response = await as(tokens.customer).get(`/conversations/${conv.id}`);
        expect(response.status).toBe(200);
        expect(response.body.data.conversation.counterpart.id).toBe(ids.owner);
      } finally {
        await prisma.vehicle.update({
          where: { id: vehicleId },
          data: { isRemoved: false, removedAt: null },
        });
      }
    });
  });

  describe("GET /messages/conversations/:id/messages", () => {
    it("pages newest first while each page reads oldest to newest", async () => {
      const conv = await makeConversation();
      const t = Date.now();
      for (let i = 1; i <= 5; i += 1) {
        await addMessage(conv.id, ids.customer, `m${i}`, new Date(t + i * 1000));
      }

      const latest = await as(tokens.owner).get(`/conversations/${conv.id}/messages?limit=2`);
      const older = await as(tokens.owner).get(
        `/conversations/${conv.id}/messages?limit=2&page=2`,
      );
      const defaults = await as(tokens.customer).get(`/conversations/${conv.id}/messages`);

      expect(latest.status).toBe(200);
      const contents = (body: { data: { messages: Array<{ content: string }> } }) =>
        body.data.messages.map((m) => m.content);
      expect(contents(latest.body)).toEqual(["m4", "m5"]);
      expect(contents(older.body)).toEqual(["m2", "m3"]);
      expect(latest.body.data.pagination).toMatchObject({ total: 5, totalPages: 3 });
      expect(defaults.body.data.pagination).toMatchObject({ page: 1, limit: 30 });
      expect(contents(defaults.body)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    });

    it("refuses a non-participant", async () => {
      const conv = await makeConversation();
      await addMessage(conv.id, ids.customer, "Private", new Date());

      const response = await as(tokens.stranger).get(`/conversations/${conv.id}/messages`);

      expect(response.status).toBe(403);
      expect(response.body.data?.messages).toBeUndefined();
    });

    it("returns 404 for an unknown conversation", async () => {
      const response = await as(tokens.customer).get("/conversations/missing-conv/messages");
      expect(response.status).toBe(404);
    });

    it("rejects a page size above 100", async () => {
      const conv = await makeConversation();
      const response = await as(tokens.customer).get(
        `/conversations/${conv.id}/messages?limit=101`,
      );
      expect(response.status).toBe(422);
    });
  });

  describe("POST /messages/conversations/:id/messages", () => {
    it("stores the message, bumps lastMessageAt and notifies the owner", async () => {
      const conv = await makeConversation();

      const response = await as(tokens.customer)
        .post(`/conversations/${conv.id}/messages`)
        .send({ content: "  Can we leave at 6am?  " });

      expect(response.status).toBe(201);
      const message = response.body.data.message;
      expect(message).toMatchObject({
        conversationId: conv.id,
        senderId: ids.customer,
        content: "  Can we leave at 6am?  ",
        readAt: null,
      });
      const stored = await prisma.message.findUnique({ where: { id: message.id } });
      expect(stored?.content).toBe(message.content);
      const updated = await prisma.conversation.findUnique({ where: { id: conv.id } });
      expect(updated?.lastMessageAt).not.toBeNull();

      expect(emitToConversation).toHaveBeenCalledWith(
        conv.id,
        "message:new",
        expect.objectContaining({ id: message.id }),
      );
      expect(emitToUser).toHaveBeenCalledWith(
        ids.owner,
        "conversation:updated",
        expect.objectContaining({ conversationId: conv.id }),
      );
    });

    it("notifies the customer when the owner replies", async () => {
      const conv = await makeConversation();

      const response = await as(tokens.owner)
        .post(`/conversations/${conv.id}/messages`)
        .send({ content: "Yes, 6am works." });

      expect(response.status).toBe(201);
      expect(emitToUser).toHaveBeenCalledWith(
        ids.customer,
        "conversation:updated",
        expect.anything(),
      );
    });

    it("refuses a non-participant and stores nothing", async () => {
      const conv = await makeConversation();

      const response = await as(tokens.stranger)
        .post(`/conversations/${conv.id}/messages`)
        .send({ content: "Let me in" });

      expect(response.status).toBe(403);
      expect(await prisma.message.count({ where: { conversationId: conv.id } })).toBe(0);
      expect(emitToConversation).not.toHaveBeenCalled();
    });

    it("returns 404 for an unknown conversation", async () => {
      const response = await as(tokens.customer)
        .post("/conversations/missing-conv/messages")
        .send({ content: "Hello?" });
      expect(response.status).toBe(404);
    });

    it.each([
      ["a blank message", "   "],
      ["a message over 2000 characters", "x".repeat(2001)],
    ])("rejects %s", async (_label, content) => {
      const conv = await makeConversation();
      const response = await as(tokens.customer)
        .post(`/conversations/${conv.id}/messages`)
        .send({ content });
      expect(response.status).toBe(422);
    });
  });

  describe("PATCH /messages/conversations/:id/read", () => {
    it("marks only the counterpart's unread messages and broadcasts once", async () => {
      const conv = await makeConversation();
      const t = Date.now();
      const own = await addMessage(conv.id, ids.customer, "Mine", new Date(t));
      await addMessage(conv.id, ids.owner, "Theirs 1", new Date(t + 1000));
      await addMessage(conv.id, ids.owner, "Theirs 2", new Date(t + 2000));

      const response = await as(tokens.customer).patch(`/conversations/${conv.id}/read`);

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(2);
      expect(
        await prisma.message.count({
          where: { conversationId: conv.id, senderId: ids.owner, readAt: null },
        }),
      ).toBe(0);
      const mine = await prisma.message.findUnique({ where: { id: own.id } });
      expect(mine?.readAt).toBeNull();
      expect(emitToConversation).toHaveBeenCalledWith(
        conv.id,
        "messages:read",
        expect.objectContaining({ readerId: ids.customer }),
      );

      vi.mocked(emitToConversation).mockClear();
      const again = await as(tokens.customer).patch(`/conversations/${conv.id}/read`);
      expect(again.body.data.count).toBe(0);
      expect(emitToConversation).not.toHaveBeenCalled();
    });

    it("refuses a non-participant and leaves messages unread", async () => {
      const conv = await makeConversation();
      await addMessage(conv.id, ids.owner, "Unread", new Date());

      const response = await as(tokens.stranger).patch(`/conversations/${conv.id}/read`);

      expect(response.status).toBe(403);
      expect(
        await prisma.message.count({ where: { conversationId: conv.id, readAt: null } }),
      ).toBe(1);
    });

    it("returns 404 for an unknown conversation", async () => {
      const response = await as(tokens.customer).patch("/conversations/missing-conv/read");
      expect(response.status).toBe(404);
    });
  });
});
