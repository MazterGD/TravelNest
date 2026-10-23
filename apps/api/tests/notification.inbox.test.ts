/**
 * Notification inbox: users only read, mark and remove their own
 * notifications (soft remove, ADR-006); creation helpers fan out and mirror
 * high-value types to email (email sender mocked).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";

const sendNotificationEmail = vi.fn();

vi.mock("../src/modules/notification/email.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/modules/notification/email.service")>();
  return {
    ...actual,
    sendNotificationEmail: (...args: unknown[]) => sendNotificationEmail(...args),
  };
});

const { default: app } = await import("../src/app");
const { config } = await import("../src/config/index");
const notificationService = await import(
  "../src/modules/notification/notification.service"
);

const API_BASE = "/api/v1";
const PREFIX = "notif.inbox";

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("Notifications", () => {
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  const cleanup = async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  beforeAll(async () => {
    await cleanup();
    for (const key of ["alice", "bob", "carol", "gone"]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: "Notif",
          lastName: key,
          role: "CUSTOMER",
          status: "ACTIVE",
          ...(key === "gone" && { isRemoved: true, removedAt: new Date() }),
        },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: "CUSTOMER" },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }
  });

  beforeEach(() => {
    sendNotificationEmail.mockReset();
    sendNotificationEmail.mockResolvedValue(true);
  });

  afterAll(cleanup);

  const as = (key: string) => `Bearer ${tokens[key]}`;

  describe("creation helpers", () => {
    it("defaults the category to System and stores i18n metadata alongside data", async () => {
      const created = await notificationService.createNotification({
        userId: ids.alice,
        type: "system_notice",
        title: "Welcome",
        message: "Hello",
        data: { foo: 1 },
        i18n: { titleKey: "t", messageKey: "m", params: { n: 1 } },
      });

      const row = await prisma.notification.findUnique({ where: { id: created.id } });
      expect(row).toMatchObject({ category: "System", isRead: false });
      expect(row?.data).toEqual({
        foo: 1,
        _i18n: { titleKey: "t", messageKey: "m", params: { n: 1 } },
      });
      await flush();
      expect(sendNotificationEmail).not.toHaveBeenCalled();
    });

    it("stores i18n without data, and no data at all when neither is given", async () => {
      const i18nOnly = await notificationService.createNotification({
        userId: ids.alice,
        type: "quote_sent",
        category: "Quotations",
        title: "Quote",
        message: "New quote",
        i18n: { titleKey: "q.t", messageKey: "q.m" },
      });
      const bare = await notificationService.createNotification({
        userId: ids.alice,
        type: "review_received",
        category: "Reviews",
        title: "Review",
        message: "New review",
      });

      expect(i18nOnly.data).toEqual({ _i18n: { titleKey: "q.t", messageKey: "q.m" } });
      expect(bare.data).toBeNull();
    });

    it("emails booking confirmations with a link to the booking", async () => {
      await notificationService.createNotification({
        userId: ids.alice,
        type: "booking_confirmed",
        category: "Bookings",
        title: "Booking confirmed",
        message: "See you soon",
        data: { bookingId: "bk_123" },
      });
      await vi.waitFor(() =>
        expect(sendNotificationEmail).toHaveBeenCalledWith(
          `${PREFIX}.alice@example.com`,
          "Booking confirmed",
          "See you soon",
          `${config.appUrl}/en/dashboard/bookings/bk_123`,
        ),
      );
    });

    it("emails payment receipts without a link when no booking is attached", async () => {
      await notificationService.createNotification({
        userId: ids.alice,
        type: "payment_received",
        category: "Payments",
        title: "Paid",
        message: "Thanks",
        data: { bookingId: 42 },
      });
      await vi.waitFor(() =>
        expect(sendNotificationEmail).toHaveBeenCalledWith(
          `${PREFIX}.alice@example.com`,
          "Paid",
          "Thanks",
          undefined,
        ),
      );
    });

    it("skips the email for a removed account and survives email failures", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});

      await notificationService.createNotification({
        userId: ids.gone,
        type: "booking_confirmed",
        title: "Hidden",
        message: "Nobody home",
      });
      await flush();
      expect(sendNotificationEmail).not.toHaveBeenCalled();

      sendNotificationEmail.mockRejectedValueOnce(new Error("smtp down"));
      const created = await notificationService.createNotification({
        userId: ids.carol,
        type: "payment_received",
        title: "Paid",
        message: "Thanks",
      });
      expect(created.id).toBeTruthy();
      await vi.waitFor(() =>
        expect(errors).toHaveBeenCalledWith(
          "[notification] email bridge failed (payment_received)",
          expect.any(Error),
        ),
      );
      errors.mockRestore();
      await prisma.notification.deleteMany({ where: { userId: { in: [ids.gone, ids.carol] } } });
    });

    it("creates one notification per user in bulk and skips an empty list", async () => {
      expect(
        await notificationService.createBulkNotifications([], {
          type: "x",
          title: "x",
          message: "x",
        }),
      ).toBe(0);

      const count = await notificationService.createBulkNotifications(
        [ids.bob, ids.carol],
        { type: "promo", title: "Offer", message: "Deal", category: "System", data: { a: 1 } },
      );
      const defaulted = await notificationService.createBulkNotifications([ids.carol], {
        type: "promo2",
        title: "Offer",
        message: "Deal",
      });

      expect(count).toBe(2);
      expect(defaulted).toBe(1);
      const rows = await prisma.notification.findMany({
        where: { userId: { in: [ids.bob, ids.carol] }, type: "promo" },
      });
      expect(rows.map((r) => r.userId).sort()).toEqual([ids.bob, ids.carol].sort());
      expect(rows[0].data).toEqual({ a: 1 });
      await prisma.notification.deleteMany({ where: { userId: ids.carol } });
    });

    it("dispatch helpers log failures instead of throwing", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        notificationService.dispatchNotification({
          userId: "missing-user",
          type: "broken",
          title: "x",
          message: "x",
        }),
      ).not.toThrow();
      expect(() =>
        notificationService.dispatchBulkNotifications(["missing-user"], {
          type: "broken_bulk",
          title: "x",
          message: "x",
        }),
      ).not.toThrow();
      await vi.waitFor(() => {
        expect(errors).toHaveBeenCalledWith(
          "[notification] failed to create (broken)",
          expect.anything(),
        );
        expect(errors).toHaveBeenCalledWith(
          "[notification] failed to create bulk (broken_bulk)",
          expect.anything(),
        );
      });
      errors.mockRestore();
    });

    it("dispatchNotification creates the row on success", async () => {
      notificationService.dispatchNotification({
        userId: ids.carol,
        type: "dispatched",
        title: "Hi",
        message: "There",
      });
      notificationService.dispatchBulkNotifications([ids.carol], {
        type: "dispatched_bulk",
        title: "Hi",
        message: "There",
      });
      await vi.waitFor(async () => {
        expect(
          await prisma.notification.count({
            where: { userId: ids.carol, type: { in: ["dispatched", "dispatched_bulk"] } },
          }),
        ).toBe(2);
      });
      await prisma.notification.deleteMany({ where: { userId: ids.carol } });
    });
  });

  describe("GET /notifications", () => {
    const list = (key: string, query = "") =>
      request(app).get(`${API_BASE}/notifications${query}`).set("Authorization", as(key));

    it("lists only the caller's notifications, newest first", async () => {
      const res = await list("alice");

      expect(res.status).toBe(200);
      const items = res.body.data.notifications;
      expect(items.length).toBe(5);
      expect(items.every((n: { userId: string }) => n.userId === ids.alice)).toBe(true);
      expect(items[0].type).toBe("payment_received");
      expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 20, total: 5, totalPages: 1 });

      const bob = await list("bob");
      expect(bob.body.data.pagination.total).toBe(1);
    });

    it("pages, filters by category and by unread state", async () => {
      const paged = await list("alice", "?page=2&limit=2");
      const reviews = await list("alice", "?category=Reviews");

      expect(paged.body.data.notifications.length).toBe(2);
      expect(paged.body.data.pagination).toMatchObject({ page: 2, limit: 2, totalPages: 3 });
      expect(reviews.body.data.notifications.map((n: { type: string }) => n.type)).toEqual([
        "review_received",
      ]);
    });

    it("rejects an unknown category and an oversized page", async () => {
      expect((await list("alice", "?category=Spam")).status).toBe(422);
      expect((await list("alice", "?limit=500")).status).toBe(422);
      expect((await list("alice", "?page=0")).status).toBe(422);
    });

    it("requires sign-in", async () => {
      expect((await request(app).get(`${API_BASE}/notifications`)).status).toBe(401);
    });
  });

  describe("read state", () => {
    let aliceNote = "";

    beforeAll(async () => {
      const note = await prisma.notification.findFirst({
        where: { userId: ids.alice, type: "review_received" },
      });
      aliceNote = note!.id;
    });

    it("counts unread notifications for the caller", async () => {
      const res = await request(app)
        .get(`${API_BASE}/notifications/unread-count`)
        .set("Authorization", as("alice"));

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(5);
    });

    it("forbids marking someone else's notification as read", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = await request(app)
        .patch(`${API_BASE}/notifications/${aliceNote}/read`)
        .set("Authorization", as("bob"));
      warn.mockRestore();

      expect(res.status).toBe(403);
      const row = await prisma.notification.findUnique({ where: { id: aliceNote } });
      expect(row?.isRead).toBe(false);
    });

    it("404s an unknown notification", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/notifications/nope/read`)
        .set("Authorization", as("alice"));
      expect(res.status).toBe(404);
    });

    it("marks the caller's notification as read", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/notifications/${aliceNote}/read`)
        .set("Authorization", as("alice"));

      expect(res.status).toBe(200);
      expect(res.body.data.notification.isRead).toBe(true);
    });

    it("filters to unread only", async () => {
      const res = await request(app)
        .get(`${API_BASE}/notifications?unreadOnly=true`)
        .set("Authorization", as("alice"));

      expect(res.body.data.pagination.total).toBe(4);
      expect(
        res.body.data.notifications.some((n: { id: string }) => n.id === aliceNote),
      ).toBe(false);
    });

    it("marks all of the caller's unread notifications as read, and only theirs", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/notifications/read-all`)
        .set("Authorization", as("alice"));

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(4);
      expect(res.body.message).toBe("4 notification(s) marked as read");
      expect(await prisma.notification.count({ where: { userId: ids.bob, isRead: false } })).toBe(1);
    });
  });

  describe("removal", () => {
    let bobNote = "";

    beforeAll(async () => {
      const note = await prisma.notification.findFirst({ where: { userId: ids.bob } });
      bobNote = note!.id;
    });

    it("forbids removing someone else's notification", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = await request(app)
        .delete(`${API_BASE}/notifications/${bobNote}`)
        .set("Authorization", as("alice"));
      warn.mockRestore();

      expect(res.status).toBe(403);
      const row = await prisma.notification.findUnique({ where: { id: bobNote } });
      expect(row?.isRemoved).toBe(false);
    });

    it("soft-removes the caller's notification and hides it afterwards", async () => {
      const res = await request(app)
        .delete(`${API_BASE}/notifications/${bobNote}`)
        .set("Authorization", as("bob"));

      expect(res.status).toBe(200);
      const row = await prisma.notification.findUnique({ where: { id: bobNote } });
      expect(row?.isRemoved).toBe(true);
      expect(row?.removedAt).not.toBeNull();

      const again = await request(app)
        .delete(`${API_BASE}/notifications/${bobNote}`)
        .set("Authorization", as("bob"));
      expect(again.status).toBe(404);

      const count = await request(app)
        .get(`${API_BASE}/notifications/unread-count`)
        .set("Authorization", as("bob"));
      expect(count.body.data.unreadCount).toBe(0);
    });

    it("soft-removes all of the caller's notifications and keeps the rows", async () => {
      const res = await request(app)
        .delete(`${API_BASE}/notifications`)
        .set("Authorization", as("alice"));

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(5);
      expect(await prisma.notification.count({ where: { userId: ids.alice } })).toBe(5);
      expect(
        await prisma.notification.count({ where: { userId: ids.alice, isRemoved: false } }),
      ).toBe(0);

      const list = await request(app)
        .get(`${API_BASE}/notifications`)
        .set("Authorization", as("alice"));
      expect(list.body.data.notifications).toEqual([]);
    });
  });
});
