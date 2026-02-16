import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";

import { config } from "./config/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Import route modules
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import vehicleRoutes from "./modules/vehicle/vehicle.routes.js";
import bookingRoutes from "./modules/booking/booking.routes.js";
import quotationRoutes from "./modules/quotation/quotation.routes.js";
import reviewRoutes from "./modules/review/review.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";
import ownerRoutes from "./modules/owner/owner.routes.js";
import tripPackageRoutes from "./modules/trip-package/trip-package.routes.js";
import uploadsRoutes from "./modules/uploads/uploads.routes.js";

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "x-csrf-token",
    ],
  }),
);

// Rate limiting (disabled in test environment to avoid rate limit errors during tests)
if (config.env !== "test") {
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Serve uploaded files
app.use("/uploads", express.static(path.resolve(config.upload.uploadDir)));

// Logging
if (config.env === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
const apiBase = `/api/${config.apiVersion}`;

app.use(`${apiBase}/auth`, authRoutes);
app.use(`${apiBase}/users`, userRoutes);
app.use(`${apiBase}/vehicles`, vehicleRoutes);
app.use(`${apiBase}/bookings`, bookingRoutes);
app.use(`${apiBase}/quotations`, quotationRoutes);
app.use(`${apiBase}/reviews`, reviewRoutes);
app.use(`${apiBase}/payments`, paymentRoutes);
app.use(`${apiBase}/notifications`, notificationRoutes);
app.use(`${apiBase}/owner`, ownerRoutes);
app.use(`${apiBase}/packages`, tripPackageRoutes);
app.use(`${apiBase}/uploads`, uploadsRoutes);

// API documentation endpoint
app.get(`${apiBase}`, (_req: Request, res: Response) => {
  res.json({
    name: "TraveNest API",
    version: config.apiVersion,
    description: "Vehicle rental management system API",
    endpoints: {
      auth: `${apiBase}/auth`,
      users: `${apiBase}/users`,
      vehicles: `${apiBase}/vehicles`,
      bookings: `${apiBase}/bookings`,
      quotations: `${apiBase}/quotations`,
      reviews: `${apiBase}/reviews`,
      payments: `${apiBase}/payments`,
      notifications: `${apiBase}/notifications`,
      owner: `${apiBase}/owner`,
      packages: `${apiBase}/packages`,
    },
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
