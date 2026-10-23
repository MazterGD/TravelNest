/**
 * Notification retention: the daily sweep soft-removes (ADR-006) read
 * notifications older than 90 days and never lets a failure escape the timer.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { prisma } from "./setup";

const purgeSpy = vi.fn();

vi.mock("../src/modules/notification/notification.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/modules/notification/notification.service")>();
  purgeSpy.mockImplementation(actual.purgeReadNotifications);
  return {
    ...actual,
    purgeReadNotifications: (...args: [number?]) => purgeSpy(...args),
  };
});

const { startNotificationRetentionJob } = await import("../src/jobs/notificationRetention");
const { purgeReadNotifications } = await import(
  "../src/modules/notification/notification.service"
);

const EMAIL = "jobs.notif.retention@example.com";
const DAY = 24 * 60 * 60 * 1000;

describe("purgeReadNotifications", () => {
  let userId = "";
  const rows: Record<string, string> = {};

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        password: "hashed",
        firstName: "Retention",
        lastName: "Job",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    userId = user.id;

    const make = async (key: string, daysAgo: number, isRead: boolean, isRemoved = false) => {
      const row = await prisma.notification.create({
        data: {
          userId,
          type: "retention_test",
          title: key,
          message: key,
          isRead,
          isRemoved,
          removedAt: isRemoved ? new Date(Date.now() - DAY) : null,
          createdAt: new Date(Date.now() - daysAgo * DAY),
        },
      });
      rows[key] = row.id;
    };
    await make("oldRead", 100, true);
    await make("oldUnread", 100, false);
    await make("recentRead", 10, true);
    await make("alreadyRemoved", 200, true, true);
    await make("borderRead", 50, true);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  const state = async (key: string) =>
    prisma.notification.findUnique({ where: { id: rows[key] } });

  it("soft-removes only read notifications past the cutoff", async () => {
    const removed = await purgeReadNotifications(90);

    expect(removed).toBeGreaterThanOrEqual(1);
    const oldRead = await state("oldRead");
    expect(oldRead?.isRemoved).toBe(true);
    expect(oldRead?.removedAt).not.toBeNull();
    expect((await state("oldUnread"))?.isRemoved).toBe(false);
    expect((await state("recentRead"))?.isRemoved).toBe(false);
    expect((await state("borderRead"))?.isRemoved).toBe(false);
  });

  it("keeps the original removal time of already-removed rows", async () => {
    const before = await state("alreadyRemoved");
    await purgeReadNotifications();
    const after = await state("alreadyRemoved");

    expect(after?.removedAt?.getTime()).toBe(before?.removedAt?.getTime());
  });

  it("honours a shorter retention window", async () => {
    await purgeReadNotifications(30);

    expect((await state("borderRead"))?.isRemoved).toBe(true);
    expect((await state("recentRead"))?.isRemoved).toBe(false);
    expect(await prisma.notification.count({ where: { userId } })).toBe(5);
  });
});

describe("startNotificationRetentionJob", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sweeps a minute after boot and then daily with a 90-day window", async () => {
    vi.useFakeTimers();
    purgeSpy.mockReset();
    purgeSpy.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    startNotificationRetentionJob();
    expect(purgeSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(purgeSpy).toHaveBeenCalledTimes(1);
    expect(purgeSpy).toHaveBeenCalledWith(90);
    expect(info).toHaveBeenCalledWith(
      "[job:notification-retention] purged 3 read notification(s) older than 90 days",
    );

    await vi.advanceTimersByTimeAsync(DAY - 60 * 1000);
    expect(purgeSpy).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledTimes(1);

    vi.clearAllTimers();
  });

  it("logs and swallows a failed sweep", async () => {
    vi.useFakeTimers();
    purgeSpy.mockReset();
    purgeSpy.mockRejectedValue(new Error("db down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    startNotificationRetentionJob();
    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(error).toHaveBeenCalledWith(
      "[job:notification-retention] purge failed",
      expect.any(Error),
    );
    vi.clearAllTimers();
  });
});
