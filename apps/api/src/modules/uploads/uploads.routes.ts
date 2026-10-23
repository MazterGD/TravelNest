import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { ApiError, asyncHandler } from "../../middleware/errorHandler.js";
import { config } from "../../config/index.js";
import * as uploadsController from "./uploads.controller.js";

const router = Router();

const registrationUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowed.includes(file.mimetype)) {
      cb(ApiError.badRequest("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// Anonymous (used before the owner account exists), so cap uploads per IP to
// keep the endpoint from being used as free file hosting.
const registrationUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many uploads. Please try again later.",
  },
  skip: () => config.env !== "production",
});

router.post(
  "/registration",
  registrationUploadLimiter,
  registrationUpload.single("file"),
  asyncHandler(uploadsController.uploadRegistrationFile),
);

export default router;
