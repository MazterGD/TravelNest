import type { Request, Response } from "express";
import { ApiError } from "../../middleware/errorHandler.js";
import { ResponseHelper } from "../../utils/response.js";
import { uploadBuffer } from "../../utils/storage.js";

const allowedRegistrationCategories = [
  "owner-documents",
  "vehicle-documents",
  "vehicle-photos",
];

const documentTypeFolders: Record<string, Record<string, string>> = {
  "owner-documents": {
    NIC: "nic",
    PROFILE_PHOTO: "profile-photo",
  },
  "vehicle-documents": {
    DRIVING_LICENSE: "driving-license",
    INSURANCE: "insurance",
    REGISTRATION_CERTIFICATE: "registration-certificate",
  },
};

const allowedPhotoTags = new Set([
  "exterior",
  "interior",
  "front",
  "rear",
  "seats",
  "other",
]);

export const uploadRegistrationFile = async (req: Request, res: Response) => {
  const { category, subfolder } = req.body as {
    category?: string;
    subfolder?: string;
  };
  const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;

  if (!uploadedFile) {
    throw ApiError.badRequest("File is required");
  }

  if (!category || !allowedRegistrationCategories.includes(category)) {
    throw ApiError.badRequest("Invalid upload category");
  }

  let prefix = `registration/${category}`;

  if (documentTypeFolders[category]) {
    if (!subfolder) {
      throw ApiError.badRequest("Document type is required");
    }

    const mapping = documentTypeFolders[category];
    const normalized = subfolder.trim();
    const folderKey = normalized.toUpperCase();
    const folder =
      mapping[folderKey] ||
      Object.values(mapping).find(
        (value) => value === normalized.toLowerCase(),
      );

    if (!folder) {
      throw ApiError.badRequest("Invalid document type");
    }

    prefix = `${prefix}/${folder}`;
  }

  if (category === "vehicle-photos" && subfolder) {
    const tag = subfolder.trim().toLowerCase();
    if (!allowedPhotoTags.has(tag)) {
      throw ApiError.badRequest("Invalid photo tag");
    }
    prefix = `${prefix}/${tag}`;
  }

  const upload = await uploadBuffer({
    prefix,
    fileName: uploadedFile.originalname,
    buffer: uploadedFile.buffer,
    contentType: uploadedFile.mimetype,
  });

  return ResponseHelper.created(res, {
    url: upload.publicUrl,
    path: upload.path,
  });
};
