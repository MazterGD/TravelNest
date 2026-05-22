import { purgeReadNotifications } from "../modules/notification/notification.service.js";

const RETENTION_DAYS = 90;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const INITIAL_DELAY_MS = 60 * 1000; // first sweep ~1 min after boot

const runPurge = async (): Promise<void> => {
  try {
    const removed = await purgeReadNotifications(RETENTION_DAYS);
    if (removed > 0) {
      console.info(
        `[job:notification-retention] purged ${removed} read notification(s) older than ${RETENTION_DAYS} days`,
      );
    }
  } catch (err) {
    console.error("[job:notification-retention] purge failed", err);
  }
};

/**
 * Schedule the notification retention sweep. A plain interval is sufficient for
 * the single-instance API — no external cron/scheduler dependency is added.
 * Timers are unref'd so they never hold the process open during shutdown.
 */
export const startNotificationRetentionJob = (): void => {
  setTimeout(() => void runPurge(), INITIAL_DELAY_MS).unref?.();
  setInterval(() => void runPurge(), RUN_INTERVAL_MS).unref?.();
};
