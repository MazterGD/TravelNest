import dns from "node:dns";

// Force IPv4-first DNS resolution. Node 18+ prefers AAAA records, which on Windows
// dev machines without working IPv6 routes (common with Supabase Storage's CDN endpoint)
// causes undici fetch to hang until timeout and throw "fetch failed".
dns.setDefaultResultOrder("ipv4first");

import app from "./app.js";
import { config } from "./config/index.js";
import { initSocketServer } from "./realtime/socket.js";
import { startNotificationRetentionJob } from "./jobs/notificationRetention.js";

const startServer = async () => {
  try {
    // You can add database connection check here
    // await prisma.$connect();

    const server = app.listen(config.port, () => {
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

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

startServer();
