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
import tripRoutes from "./modules/trip/trip.routes.js";
import reviewRoutes from "./modules/review/review.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";
import messageRoutes from "./modules/message/message.routes.js";
import ownerRoutes from "./modules/owner/owner.routes.js";
import tripPackageRoutes from "./modules/trip-package/trip-package.routes.js";
import uploadsRoutes from "./modules/uploads/uploads.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import landingRoutes from "./modules/landing/landing.routes.js";
import routingRoutes from "./modules/routing/routing.routes.js";

const app: Express = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
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

// Rate limiting — enforced in production only.
// In development/test, navigation triggers many parallel requests (dashboard widgets,
// config polls) that legitimately exceed the production threshold; brute-force risk
// is absent locally where the API is only reachable from the dev machine.
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env !== "production",
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Serve uploaded files
const uploadsDir = path.resolve(config.upload.uploadDir);
const uploadsCacheControl =
  config.env === "production"
    ? "public, max-age=604800, stale-while-revalidate=86400"
    : "no-cache";

app.use(
  "/uploads",
  express.static(uploadsDir, {
    etag: true,
    lastModified: true,
    maxAge: config.env === "production" ? "7d" : 0,
    setHeaders: (res, filePath) => {
      if (/\.(?:png|jpg|jpeg|webp|gif|svg)$/i.test(filePath)) {
        res.setHeader("Cache-Control", uploadsCacheControl);
      }
    },
  }),
);

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
app.use(`${apiBase}/trips`, tripRoutes);
app.use(`${apiBase}/reviews`, reviewRoutes);
app.use(`${apiBase}/payments`, paymentRoutes);
app.use(`${apiBase}/notifications`, notificationRoutes);
app.use(`${apiBase}/messages`, messageRoutes);
app.use(`${apiBase}/owner`, ownerRoutes);
app.use(`${apiBase}/packages`, tripPackageRoutes);
app.use(`${apiBase}/uploads`, uploadsRoutes);
app.use(`${apiBase}/admin`, adminRoutes);
app.use(`${apiBase}/landing`, landingRoutes);
app.use(`${apiBase}/routing`, routingRoutes);

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
      trips: `${apiBase}/trips`,
      reviews: `${apiBase}/reviews`,
      payments: `${apiBase}/payments`,
      notifications: `${apiBase}/notifications`,
      messages: `${apiBase}/messages`,
      owner: `${apiBase}/owner`,
      packages: `${apiBase}/packages`,
      admin: `${apiBase}/admin`,
      landing: `${apiBase}/landing`,
      routing: `${apiBase}/routing`,
    },
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
