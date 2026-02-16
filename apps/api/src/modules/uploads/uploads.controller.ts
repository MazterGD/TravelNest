import type { Request, Response } from "express";
import { ApiError } from "../../middleware/errorHandler.js";
import { ResponseHelper } from "../../utils/response.js";
import { uploadBuffer } from "../../utils/storage.js";

const allowedRegistrationCategories = [
  "owner-documents",
  "vehicle-documents",
  "vehicle-photos",
];

export const uploadRegistrationFile = async (req: Request, res: Response) => {
  const { category } = req.body as { category?: string };
  const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;

  if (!uploadedFile) {
    throw ApiError.badRequest("File is required");
  }

  if (!category || !allowedRegistrationCategories.includes(category)) {
    throw ApiError.badRequest("Invalid upload category");
  }

  const upload = await uploadBuffer({
    prefix: `registration/${category}`,
    fileName: uploadedFile.originalname,
    buffer: uploadedFile.buffer,
    contentType: uploadedFile.mimetype,
  });

  return ResponseHelper.created(res, {
    url: upload.publicUrl,
    path: upload.path,
  });
};
