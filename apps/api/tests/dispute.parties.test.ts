/**
 * Party-facing disputes: only a booking's customer or vehicle owner can raise,
 * read or reply to a dispute, the counterparty is derived server-side, and
 * internal admin notes never reach the parties.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const EMAILS = {
  customer: "dispute.parties.customer@example.com",
  owner: "dispute.parties.owner@example.com",
  stranger: "dispute.parties.stranger@example.com",
  admin: "dispute.parties.admin@example.com",
};
const PLATE = "DSP-PRT-1";
const DAY = 24 * 60 * 60 * 1000;
const VALID = {
  type: "VEHICLE_CONDITION",
  subject: "Broken air conditioning",
  description: "The AC stopped working an hour into the trip.",
};

describe("Disputes (parties)", () => {
  const tokens = { customer: "", owner: "", stranger: "", admin: "" };
  const ids = { customer: "", owner: "", stranger: "", admin: "" };
  let bookingId = "";

  const cleanup = async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: Object.values(EMAILS) } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.vehicle.deleteMany({ where: { licensePlate: PLATE } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  };

  const as = (token: string) => ({
    post: (path: string) =>
      request(app).post(`${API_BASE}/disputes${path}`).set("Authorization", `Bearer ${token}`),
    get: (path: string) =>
      request(app).get(`${API_BASE}/disputes${path}`).set("Authorization", `Bearer ${token}`),
  });

  const seedDispute = (
    data: Partial<{
      raisedBy: string;
      raisedAgainst: string;
      status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED" | "ESCALATED";
      assignedTo: string;
    }> = {},
  ) =>
    prisma.dispute.create({
      data: {
        disputeCode: `DSP-T${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
        bookingId,
        raisedBy: data.raisedBy ?? ids.customer,
        raisedAgainst: data.raisedAgainst ?? ids.owner,
        type: "OTHER",
        subject: "Seeded dispute",
        description: "Seeded for the party dispute tests.",
        evidenceUrls: [],
        status: data.status ?? "OPEN",
        assignedTo: data.assignedTo,
      },
    });

  beforeAll(async () => {
    await cleanup();
    const roles = {
      customer: "CUSTOMER",
      owner: "VEHICLE_OWNER",
      stranger: "CUSTOMER",
      admin: "ADMIN",
    } as const;
    for (const key of Object.keys(EMAILS) as (keyof typeof EMAILS)[]) {
      const user = await prisma.user.create({
        data: {
          email: EMAILS[key],
          password: "hashed",
          firstName: "Dispute",
          lastName: key,
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
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: ids.owner,
        name: "Dispute Bus",
        type: "ORDINARY",
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
    });
    const start = new Date(Date.now() - 5 * DAY);
    bookingId = (
      await prisma.booking.create({
        data: {
          customerId: ids.customer,
          vehicleId: vehicle.id,
          startDate: start,
          endDate: new Date(start.getTime() + DAY),
          pickupLocation: "Colombo",
          totalAmount: 30000,
          status: "COMPLETED",
        },
      })
    ).id;
  });

  afterAll(cleanup);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("access control", () => {
    it("requires sign-in", async () => {
      const response = await request(app).get(`${API_BASE}/disputes`);
      expect(response.status).toBe(401);
    });

    it("sends admins to the admin disputes module", async () => {
      const response = await as(tokens.admin).get("");
      expect(response.status).toBe(403);
    });
  });

  describe("POST /disputes", () => {
    it("lets the customer raise a dispute against the vehicle owner", async () => {
      const response = await as(tokens.customer)
        .post("")
        .send({ ...VALID, bookingId, evidenceUrls: ["https://example.com/ac.jpg"] });

      expect(response.status).toBe(201);
      expect(response.body.data.dispute).toMatchObject({
        raisedBy: ids.customer,
        raisedAgainst: ids.owner,
        isRaisedByMe: true,
        status: "OPEN",
      });
      expect(response.body.data.dispute.disputeCode).toMatch(/^DSP-[0-9A-F]{8}$/);

      const stored = await prisma.dispute.findUnique({
        where: { id: response.body.data.dispute.id },
      });
      expect(stored?.evidenceUrls).toEqual(["https://example.com/ac.jpg"]);
      const notice = await prisma.notification.findFirst({
        where: { userId: ids.owner, type: "dispute_opened" },
      });
      expect(notice?.message).toContain(stored!.disputeCode);
    });

    it("lets the owner raise a dispute against the customer", async () => {
      const response = await as(tokens.owner).post("").send({ ...VALID, bookingId });

      expect(response.status).toBe(201);
      const stored = await prisma.dispute.findUnique({
        where: { id: response.body.data.dispute.id },
      });
      expect(stored).toMatchObject({
        raisedBy: ids.owner,
        raisedAgainst: ids.customer,
        evidenceUrls: [],
      });
    });

    it("draws a fresh code when the first one is already taken", async () => {
      await prisma.dispute.create({
        data: {
          disputeCode: "DSP-AAAAAAAA",
          bookingId,
          raisedBy: ids.customer,
          raisedAgainst: ids.owner,
          type: "OTHER",
          subject: "Collision holder",
          description: "Holds the code the next draw collides with.",
          evidenceUrls: [],
        },
      });
      const spy = vi
        .spyOn(crypto, "randomBytes")
        .mockImplementationOnce(() => Buffer.from([0xaa, 0xaa, 0xaa, 0xaa]))
        .mockImplementationOnce(() => Buffer.from([0xbb, 0xbb, 0xbb, 0xbb]));

      const response = await as(tokens.customer).post("").send({ ...VALID, bookingId });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(201);
      expect(response.body.data.dispute.disputeCode).toBe("DSP-BBBBBBBB");
    });

    it("refuses someone who is not party to the booking", async () => {
      const before = await prisma.dispute.count({ where: { bookingId } });

      const response = await as(tokens.stranger).post("").send({ ...VALID, bookingId });

      expect(response.status).toBe(403);
      expect(await prisma.dispute.count({ where: { bookingId } })).toBe(before);
    });

    it("returns 404 for an unknown booking", async () => {
      const response = await as(tokens.customer)
        .post("")
        .send({ ...VALID, bookingId: "missing-booking" });
      expect(response.status).toBe(404);
    });

    it.each([
      ["an unknown type", { type: "FRAUD" }],
      ["a too-short description", { description: "Bad" }],
      ["a non-URL evidence entry", { evidenceUrls: ["not a url"] }],
    ])("rejects %s", async (_label, override) => {
      const response = await as(tokens.customer)
        .post("")
        .send({ ...VALID, bookingId, ...override });
      expect(response.status).toBe(422);
    });
  });

  describe("GET /disputes", () => {
    let raisedByOwner = "";
    let resolvedId = "";

    beforeAll(async () => {
      raisedByOwner = (
        await seedDispute({ raisedBy: ids.owner, raisedAgainst: ids.customer })
      ).id;
      resolvedId = (await seedDispute({ status: "RESOLVED" })).id;
    });

    const listIds = (body: { data: { disputes: Array<{ id: string }> } }) =>
      body.data.disputes.map((d) => d.id);

    it("lists disputes on both sides with isRaisedByMe", async () => {
      const response = await as(tokens.customer).get("?limit=50");

      expect(response.status).toBe(200);
      const disputes = response.body.data.disputes as Array<{
        id: string;
        isRaisedByMe: boolean;
      }>;
      expect(disputes.find((d) => d.id === raisedByOwner)?.isRaisedByMe).toBe(false);
      expect(disputes.find((d) => d.id === resolvedId)?.isRaisedByMe).toBe(true);
      expect(response.body.data.pagination).toMatchObject({ page: 1, limit: 50 });
    });

    it("filters to disputes the caller raised", async () => {
      const response = await as(tokens.customer).get("?role=raised&limit=50");
      const listed = listIds(response.body);
      expect(listed).toContain(resolvedId);
      expect(listed).not.toContain(raisedByOwner);
    });

    it("filters to disputes raised against the caller", async () => {
      const response = await as(tokens.customer).get("?role=against&limit=50");
      const listed = listIds(response.body);
      expect(listed).toContain(raisedByOwner);
      expect(listed).not.toContain(resolvedId);
    });

    it("filters by status", async () => {
      const response = await as(tokens.customer).get("?status=RESOLVED");
      expect(listIds(response.body)).toEqual([resolvedId]);
    });

    it("paginates with a default page size of 10", async () => {
      const response = await as(tokens.customer).get("?page=2&limit=1");
      expect(response.body.data.pagination).toMatchObject({ page: 2, limit: 1 });
      expect(response.body.data.disputes).toHaveLength(1);

      const defaults = await as(tokens.customer).get("");
      expect(defaults.body.data.pagination).toMatchObject({ page: 1, limit: 10 });
    });

    it("shows nothing to an uninvolved user", async () => {
      const response = await as(tokens.stranger).get("");
      expect(response.body.data.disputes).toEqual([]);
      expect(response.body.data.pagination.totalPages).toBe(1);
    });

    it("rejects an unknown status", async () => {
      const response = await as(tokens.customer).get("?status=DISPUTED");
      expect(response.status).toBe(422);
    });
  });

  describe("GET /disputes/:disputeId", () => {
    it("returns the thread without internal admin notes, by id or code", async () => {
      const dispute = await seedDispute();
      await prisma.disputeMessage.createMany({
        data: [
          { disputeId: dispute.id, senderId: ids.owner, message: "Visible reply" },
          {
            disputeId: dispute.id,
            senderId: ids.admin,
            message: "Internal note",
            isInternalNote: true,
          },
        ],
      });

      const byId = await as(tokens.owner).get(`/${dispute.id}`);
      const byCode = await as(tokens.customer).get(`/${dispute.disputeCode}`);

      expect(byId.status).toBe(200);
      expect(byId.body.data.dispute.isRaisedByMe).toBe(false);
      expect(
        byId.body.data.dispute.messages.map((m: { message: string }) => m.message),
      ).toEqual(["Visible reply"]);
      expect(byCode.status).toBe(200);
      expect(byCode.body.data.dispute).toMatchObject({
        id: dispute.id,
        isRaisedByMe: true,
      });
    });

    it("hides the dispute from an uninvolved user", async () => {
      const dispute = await seedDispute();
      const response = await as(tokens.stranger).get(`/${dispute.id}`);
      expect(response.status).toBe(404);
    });
  });

  describe("POST /disputes/:disputeId/messages", () => {
    it("posts a reply and notifies the other party and the assigned admin", async () => {
      const dispute = await seedDispute({ assignedTo: ids.admin });

      const response = await as(tokens.customer)
        .post(`/${dispute.id}/messages`)
        .send({ message: "Here are more details." });

      expect(response.status).toBe(201);
      expect(response.body.data.message).toMatchObject({
        senderId: ids.customer,
        isInternalNote: false,
        sender: { id: ids.customer },
      });
      const notified = await prisma.notification.findMany({
        where: {
          type: "dispute_message",
          data: { path: ["disputeId"], equals: dispute.id },
        },
        select: { userId: true },
      });
      expect(notified.map((n) => n.userId).sort()).toEqual(
        [ids.owner, ids.admin].sort(),
      );
    });

    it("notifies only the raiser when the other party replies by code", async () => {
      const dispute = await seedDispute();

      const response = await as(tokens.owner)
        .post(`/${dispute.disputeCode}/messages`)
        .send({ message: "We will look into it." });

      expect(response.status).toBe(201);
      const notified = await prisma.notification.findMany({
        where: {
          type: "dispute_message",
          data: { path: ["disputeId"], equals: dispute.id },
        },
        select: { userId: true },
      });
      expect(notified.map((n) => n.userId)).toEqual([ids.customer]);
    });

    it.each(["RESOLVED", "CLOSED"] as const)(
      "refuses replies once the dispute is %s",
      async (status) => {
        const dispute = await seedDispute({ status });

        const response = await as(tokens.customer)
          .post(`/${dispute.id}/messages`)
          .send({ message: "One more thing." });

        expect(response.status).toBe(400);
        expect(
          await prisma.disputeMessage.count({ where: { disputeId: dispute.id } }),
        ).toBe(0);
      },
    );

    it("hides the dispute from an uninvolved user", async () => {
      const dispute = await seedDispute();

      const response = await as(tokens.stranger)
        .post(`/${dispute.id}/messages`)
        .send({ message: "Let me in." });

      expect(response.status).toBe(404);
    });

    it("rejects a too-short reply", async () => {
      const dispute = await seedDispute();
      const response = await as(tokens.customer)
        .post(`/${dispute.id}/messages`)
        .send({ message: "ok" });
      expect(response.status).toBe(422);
    });
  });
});
