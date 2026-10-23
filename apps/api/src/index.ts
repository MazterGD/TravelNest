import dns from "node:dns";

// Force IPv4-first DNS resolution. Node 18+ prefers AAAA records, which on Windows
// dev machines without working IPv6 routes (common with Supabase Storage's CDN endpoint)
// causes undici fetch to hang until timeout and throw "fetch failed".
dns.setDefaultResultOrder("ipv4first");

import type { Server } from "node:http";
import prisma from "@travenest/database";
import app from "./app.js";
import { config } from "./config/index.js";
import { getIO, initSocketServer } from "./realtime/socket.js";
import { startNotificationRetentionJob } from "./jobs/notificationRetention.js";
import { startBookingLifecycleJobs } from "./jobs/bookingLifecycle.js";

let server: Server | undefined;

const startServer = async () => {
  try {
    // You can add database connection check here
    // await prisma.$connect();

    server = app.listen(config.port, () => {
      console.log(`
TraveNest API Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: ${config.env}
URL: http://localhost:${config.port}
API Base: http://localhost:${config.port}/api/${config.apiVersion}
Realtime: ws://localhost:${config.port}/socket.io
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });

    initSocketServer(server);
    startNotificationRetentionJob();
    startBookingLifecycleJobs();

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${config.port} is already in use. Stop the existing process or set a different PORT in your environment.`,
        );
      } else {
        console.error("Server failed to start:", error);
      }

      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Stop taking requests, let in-flight ones finish, then release the database.
const shutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  // Long-lived connections must not keep a deploy waiting forever.
  setTimeout(() => process.exit(1), 10_000).unref();
  getIO()?.close();
  if (!server) {
    process.exit(0);
  }
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
