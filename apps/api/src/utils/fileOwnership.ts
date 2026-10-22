import prisma from "@travenest/database";
import { ApiError } from "../middleware/errorHandler.js";

/**
 * Reject file URLs already attached to another account's records. Without
 * this an owner could attach a competitor's photo or document URL to their
 * own listing and then delete it, removing the competitor's stored file.
 * Pass an empty ownerId for a not-yet-created account.
 */
export const assertFilesNotOwnedByOthers = async (
  urls: string[],
  ownerId: string,
): Promise<void> => {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return;

  const otherOwner = ownerId ? { not: ownerId } : undefined;
  const [photo, vehicleDocument, ownerDocument] = await Promise.all([
    prisma.vehiclePhoto.findFirst({
      where: { url: { in: unique }, vehicle: { ownerId: otherOwner } },
      select: { id: true },
    }),
    prisma.vehicleDocument.findFirst({
      where: { url: { in: unique }, vehicle: { ownerId: otherOwner } },
      select: { id: true },
    }),
    prisma.ownerDocument.findFirst({
      where: { url: { in: unique }, ownerId: otherOwner },
      select: { id: true },
    }),
  ]);

  if (photo || vehicleDocument || ownerDocument) {
    throw ApiError.forbidden("This file belongs to another account.");
  }
};
