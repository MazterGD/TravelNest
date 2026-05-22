import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../middleware/errorHandler.js";
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
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

router.post(
  "/registration",
  registrationUpload.single("file"),
  asyncHandler(uploadsController.uploadRegistrationFile),
);

export default router;
